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

// ── Web search: Tavily primary, Serper fallback ────────────────────────────

interface WebResult { title: string; url: string; content: string }

/**
 * Domains trusted for price, market and RERA claims.
 *
 * Deliberately narrow: a market-trend number is only as good as its source. It is
 * the wrong list for looking up who founded a company or what a brokerage does —
 * pass `restrictDomains: false` for those, or the search returns nothing at all.
 */
const TRUSTED_DOMAINS = [
  'up-rera.in', 'credai.org', '99acres.com', 'magicbricks.com',
  'nobroker.in', 'housing.com', 'economictimes.com', 'hindustantimes.com',
  'thehindu.com', 'ndtv.com', 'moneycontrol.com',
]

export interface WebSearchOptions {
  /** Restrict results to TRUSTED_DOMAINS. Default true. */
  restrictDomains?: boolean
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

/** Returns a compact, source-attributed context string, or '' if nothing found. */
/**
 * A web answer is paid for once. Every search result we use is kept in our own
 * Redis for a week, so the next buyer asking the same thing reads our copy
 * instead of paying Tavily/Serper again (CHAT_INTELLIGENCE_ROADMAP.md, Phase 7).
 * A week because what this is used for — market direction, infrastructure news,
 * another city's market — moves slower than that. Misses and errors are not cached.
 */
const WEB_CACHE_TTL_SECS = 7 * 24 * 3600

function webCacheKey(query: string, maxResults: number, restrictDomains: boolean): string {
  const q = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return `web:v1:${restrictDomains ? 'r' : 'o'}:${maxResults}:${q}`
}

export async function webSearch(query: string, maxResults = 3, opts: WebSearchOptions = {}): Promise<string> {
  const restrictDomains = opts.restrictDomains !== false
  const cacheKey = webCacheKey(query, maxResults, restrictDomains)
  const cached = await getCached<string>(cacheKey)
  if (cached) return cached
  const fresh = await webSearchUncached(query, maxResults, restrictDomains)
  if (fresh) void setCached(cacheKey, fresh, WEB_CACHE_TTL_SECS)
  return fresh
}

async function webSearchUncached(query: string, maxResults: number, restrictDomains: boolean): Promise<string> {
  let data: { answer: string; results: WebResult[] } | null = null
  try {
    data = await searchTavily(query, maxResults, restrictDomains)
    if (!data || (!data.answer && data.results.length === 0)) data = await searchSerper(query, maxResults)
  } catch {
    try { data = await searchSerper(query, maxResults) } catch { data = null }
  }
  if (!data) return ''
  const lines: string[] = []
  lines.push('\n<untrusted_source url="web-search">')
  if (data.answer) lines.push(`Summary: ${data.answer}`)
  data.results.slice(0, 3).forEach((r, i) => {
    lines.push(`\n[Source ${i + 1}] ${r.title} — ${r.url}`)
    lines.push(r.content.slice(0, 400))
  })
  lines.push('\n</untrusted_source>\n')
  return lines.join('\n').trim()
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
