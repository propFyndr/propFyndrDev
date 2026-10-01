// backend/src/lib/web.ts
// External tool helpers used by the AI advisor: web search (Tavily→Serper),
// area background (Wikipedia), commute (Google Maps), and live page read (Jina).
// All are best-effort: they degrade to null/empty rather than throwing so a
// single tool failure never breaks a chat turn.
// single tool failure never breaks a chat turn.

// ── SSRF Protection ──────────────────────────────────────────────────────────
// Blocks attempts to use the server as a proxy to reach internal infrastructure.
const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  '169.254.169.254',   // AWS/GCP/Azure metadata
  '169.254.170.2',     // ECS metadata
  '100.100.100.200',   // Alibaba Cloud metadata
  'metadata.google.internal',
])

import { getCached, setCached } from './cache'

export function isSafeUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString)
    // Only allow HTTPS
    if (u.protocol !== 'https:') return false
    // Block known internal/metadata hosts
    if (BLOCKED_HOSTS.has(u.hostname)) return false
    // Block private IP ranges
    const ipv4Match = u.hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number)
      if (a === 10) return false                    // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return false  // 172.16.0.0/12
      if (a === 192 && b === 168) return false      // 192.168.0.0/16
    }
    return true
  } catch {
    return false
  }
}

// ── Web search: Tavily primary, Serper fallback & WebFact DB Cache ────────
import { prisma } from './db'
import crypto from 'node:crypto'

export interface WebResult {
  title: string
  url: string
  content: string
  score?: number
}

export interface WebSearchResponse {
  answer: string
  results: WebResult[]
  source: 'tavily' | 'serper' | 'cache' | 'none'
}

/**
 * Domains trusted for price, market and RERA claims.
 *
 * Deliberately narrow: a market-trend number is only as good as its source. It is
 * the wrong list for looking up who founded a company or what a brokerage does —
 * pass `restrictDomains: false` for those, or the search returns nothing at all.
 */
export const TRUSTED_DOMAINS = [
  'up-rera.in', 'credai.org', 'economictimes.com', 'hindustantimes.com',
  'thehindu.com', 'ndtv.com', 'moneycontrol.com', 'livemint.com',
  'business-standard.com', 'financialexpress.com',
]

export interface WebSearchOptions {
  /** Restrict results to TRUSTED_DOMAINS. Default true. */
  restrictDomains?: boolean
  maxResults?: number
}

export function computeWebFactKey(query: string, restrictDomains = true): string {
  const norm = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return crypto.createHash('sha256').update(`${restrictDomains ? 'res' : 'open'}:${norm}`).digest('hex')
}

export function determineFactCategoryAndTtl(query: string): { category: string; ttlMs: number } {
  if (/\b(?:price|rate|sqft|cost|circle rate|appreciation)\b/i.test(query)) {
    return { category: 'price_trend', ttlMs: 30 * 86400 * 1000 } // 30 days
  }
  if (/\b(?:infra|metro|airport|expressway|highway|inauguration|status|delay)\b/i.test(query)) {
    return { category: 'infrastructure', ttlMs: 7 * 86400 * 1000 } // 7 days
  }
  if (/\b(?:law|rera|act|stamp duty|gst|circle rate|policy|guideline|amitabh kant)\b/i.test(query)) {
    return { category: 'regulation', ttlMs: 90 * 86400 * 1000 } // 90 days
  }
  return { category: 'general', ttlMs: 7 * 86400 * 1000 } // 7 days
}

export function computeFactTtl(typeOrQuery: string): number {
  return determineFactCategoryAndTtl(typeOrQuery).ttlMs
}

async function searchTavily(query: string, maxResults: number, restrictDomains: boolean): Promise<{ answer: string; results: WebResult[] } | null> {
  const key = process.env.TAVILY_API_KEY
  if (!key) return null
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: true,
      ...(restrictDomains ? { include_domains: TRUSTED_DOMAINS } : {}),
    }),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`Tavily ${res.status}`)
  const data = (await res.json()) as { answer?: string; results?: WebResult[] }
  return { answer: data.answer ?? '', results: (data.results ?? []).slice(0, maxResults) }
}

async function searchSerper(query: string, maxResults: number): Promise<{ answer: string; results: WebResult[] } | null> {
  const key = process.env.SERPER_API_KEY
  if (!key) return null
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: maxResults }),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`Serper ${res.status}`)
  const data = (await res.json()) as {
    organic?: Array<{ title: string; link: string; snippet: string }>
    answerBox?: { answer?: string }
    knowledgeGraph?: { description?: string }
  }
  const answer = data.answerBox?.answer ?? data.knowledgeGraph?.description ?? ''
  const results = (data.organic ?? []).slice(0, maxResults).map((r) => ({ title: r.title, url: r.link, content: r.snippet }))
  return { answer, results }
}

/**
 * Universal search function with persistent PostgreSQL WebFact cache and fallback.
 */
export async function tavilySearch(query: string, maxResults = 3, opts: WebSearchOptions = {}): Promise<WebSearchResponse> {
  const restrictDomains = opts.restrictDomains !== false
  const factKey = computeWebFactKey(query, restrictDomains)

  // 1. Check persistent database cache (WebFact)
  try {
    const cached = await prisma.webFact.findFirst({
      where: {
        query_key: factKey,
        expires_at: { gt: new Date() },
      },
    })
    if (cached) {
      const parsedResults: WebResult[] = cached.results_json ? JSON.parse(cached.results_json) : []
      return {
        answer: cached.answer_snippet,
        results: parsedResults.slice(0, maxResults),
        source: (cached.source_name as any) || 'cache',
      }
    }
  } catch (err) {
    console.warn('[WEB_FACT:CACHE_READ_ERROR]', err)
  }

  // 2. Fetch fresh results via Tavily -> Serper
  let answer = ''
  let results: WebResult[] = []
  let source: 'tavily' | 'serper' | 'none' = 'none'

  try {
    const tData = await searchTavily(query, maxResults, restrictDomains)
    if (tData && (tData.answer || tData.results.length > 0)) {
      answer = tData.answer
      results = tData.results
      source = 'tavily'
    } else {
      const sData = await searchSerper(query, maxResults)
      if (sData) {
        answer = sData.answer
        results = sData.results
        source = 'serper'
      }
    }
  } catch {
    try {
      const sData = await searchSerper(query, maxResults)
      if (sData) {
        answer = sData.answer
        results = sData.results
        source = 'serper'
      }
    } catch {
      return { answer: '', results: [], source: 'none' }
    }
  }

  // 3. Persist to WebFact table
  if (results.length > 0 || answer) {
    const { category, ttlMs } = determineFactCategoryAndTtl(query)
    const expiresAt = new Date(Date.now() + ttlMs)
    const firstUrl = results[0]?.url || 'https://up-rera.in'

    prisma.webFact.upsert({
      where: { query_key: factKey },
      update: {
        answer_snippet: answer,
        results_json: JSON.stringify(results),
        source_url: firstUrl,
        source_name: source,
        category,
        fetched_at: new Date(),
        expires_at: expiresAt,
      },
      create: {
        query_key: factKey,
        query_text: query.slice(0, 500),
        answer_snippet: answer,
        results_json: JSON.stringify(results),
        source_url: firstUrl,
        source_name: source,
        category,
        expires_at: expiresAt,
      },
    }).catch((err) => console.warn('[WEB_FACT:UPSERT_ERROR]', err))
  }

  return { answer, results, source }
}

/** Formats web search results into a compact LLM context string. */
export function formatTavilyContext(answer: string, results: WebResult[]): string {
  const lines: string[] = []
  if (answer) lines.push(`Summary: ${answer}`)
  results.slice(0, 3).forEach((r, i) => {
    lines.push(`\n[Source ${i + 1}] ${r.title} — ${r.url}`)
    lines.push(r.content.slice(0, 400))
  })
  return lines.join('\n').trim()
}

export async function webSearch(query: string, maxResults = 3, opts: WebSearchOptions = {}): Promise<string> {
  const restrictDomains = opts.restrictDomains !== false
  const cacheKey = `web:v1:${restrictDomains ? 'r' : 'o'}:${maxResults}:${query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()}`
  const cached = await getCached<string>(cacheKey)
  if (cached) return cached

  const data = await tavilySearch(query, maxResults, opts)
  if (!data.answer && data.results.length === 0) return ''

  const lines: string[] = []
  lines.push('\n<untrusted_source url="web-search">')
  if (data.answer) lines.push(`Summary: ${data.answer}`)
  data.results.slice(0, maxResults).forEach((r, i) => {
    lines.push(`\n[Source ${i + 1}] ${r.title} — ${r.url}`)
    lines.push(r.content.slice(0, 400))
  })
  lines.push('\n</untrusted_source>\n')
  const formatted = lines.join('\n').trim()

  if (formatted) void setCached(cacheKey, formatted, 7 * 24 * 3600)
  return formatted
}

// ── Area background: Wikipedia (free, no key) ──────────────────────────────

async function getWikiSummary(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(title.replace(/\s+/g, '_'))
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
      headers: { 'User-Agent': 'PropFyndr/1.0 (contact@propfyndr.in)' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { type?: string; title: string; extract?: string; content_urls?: { desktop?: { page?: string } } }
    if (data.type === 'disambiguation' || !data.extract || data.extract.length < 50) return null
    const url = data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`
    return `${data.title}: ${data.extract.slice(0, 800)}\nSource: ${url}`
  } catch {
    return null
  }
}

export async function areaInfo(sector: string, city: string): Promise<string | null> {
  return (await getWikiSummary(`${sector}, ${city}`)) ?? (await getWikiSummary(city))
}

// ── Commute: Google Maps Distance Matrix ───────────────────────────────────

export async function commute(origin: string, destination: string): Promise<string | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', origin)
  url.searchParams.set('destinations', destination)
  url.searchParams.set('mode', 'driving')
  url.searchParams.set('units', 'metric')
  url.searchParams.set('region', 'in')
  url.searchParams.set('key', key)
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
    const data = (await res.json()) as {
      rows?: Array<{ elements?: Array<{ status: string; duration?: { text: string }; distance?: { text: string } }> }>
    }
    const el = data.rows?.[0]?.elements?.[0]
    if (!el || el.status !== 'OK' || !el.duration || !el.distance) return null
    return `Driving from ${origin} to ${destination}: ${el.duration.text} (${el.distance.text}).`
  } catch {
    return null
  }
}

// ── Live page read: Jina Reader (RERA / news / builder pages) ──────────────

export async function readPage(url: string, maxChars = 2500): Promise<string | null> {
  // Guard: SSRF protection
  if (!isSafeUrl(url)) {
    console.warn('[web] Blocked unsafe URL:', url)
    return 'Error: This URL cannot be accessed.'
  }

  const key = process.env.JINA_API_KEY
  try {
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        Accept: 'text/markdown',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const content = (await res.text()).slice(0, maxChars)
    // Wrap fetched content in untrusted_source boundary to prevent injection
    return `\n<untrusted_source url="${url}">\n${content}\n</untrusted_source>\n`
  } catch {
    return null
  }
}
