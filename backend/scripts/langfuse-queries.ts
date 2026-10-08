/**
 * What buyers actually asked, and what they got back — straight from Langfuse.
 *
 *   npm run audit:langfuse                          # last 200 traces
 *   npm run audit:langfuse -- --limit=500
 *   npm run audit:langfuse -- --session=<sessionId> --full
 *   npm run audit:langfuse -- --since=2026-10-04 --out=langfuse.json
 *
 * Replaces analyze-langfuse.ts, fetch-langfuse-sessions.ts and
 * analyze_langfuse_queries.ts, which were three copies of one fetch capped at a
 * single page of 100. This one pages until --limit, and marks the replies a
 * buyer should never have seen (outage notice, "no verified data", a raw dump),
 * so a review starts from the failures rather than from scrolling.
 */
import 'dotenv/config'
import { writeFileSync } from 'fs'

const SECRET_KEY = process.env.LANGFUSE_SECRET_KEY ?? ''
const PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY ?? ''
const BASE_URL = (process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com').replace(/\/$/, '')
if (!SECRET_KEY || !PUBLIC_KEY) {
  console.error('Set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY (backend/.env).')
  process.exit(1)
}

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const LIMIT = Number(arg('limit') ?? 200)
const SESSION = arg('session')
const SINCE = arg('since')
const OUT = arg('out')
const FULL = process.argv.includes('--full')

/** Replies that mean the turn failed the buyer, whatever the HTTP status said. */
const SUSPECT: Array<[string, RegExp]> = [
  ['outage', /briefly unavailable|rather say so than guess/i],
  ['no-data', /do not hold verified|don't hold verified|not in our verified|cannot confirm/i],
  ['empty', /^\s*$/],
]

const auth = 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64')

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: auth } })
  if (!res.ok) throw new Error(`Langfuse ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

function text(v: unknown, keys: string[]): string {
  if (v == null) return ''
  if (typeof v === 'string') {
    try { return text(JSON.parse(v), keys) } catch { return v }
  }
  if (typeof v === 'object') {
    for (const k of keys) {
      const hit = (v as Record<string, unknown>)[k]
      if (typeof hit === 'string') return hit
    }
  }
  return JSON.stringify(v)
}

async function main(): Promise<void> {
  const traces: any[] = []
  for (let page = 1; traces.length < LIMIT; page++) {
    const qs = new URLSearchParams({ page: String(page), limit: String(Math.min(100, LIMIT - traces.length)) })
    if (SESSION) qs.set('sessionId', SESSION)
    if (SINCE) qs.set('fromTimestamp', new Date(SINCE).toISOString())
    const res = await get(`/api/public/traces?${qs}`)
    traces.push(...(res.data ?? []))
    if (!res.data?.length || page >= (res.meta?.totalPages ?? page)) break
  }

  const rows = traces
    .map(t => {
      const query = text(t.input, ['userMessage', 'message', 'query']).trim()
      const answer = text(t.output, ['response', 'text', 'answer']).trim()
      const flags = SUSPECT.filter(([, re]) => re.test(answer)).map(([k]) => k)
      return { id: t.id, timestamp: t.timestamp, sessionId: t.sessionId, name: t.name, tags: t.tags, latency: t.latency, query, answer, flags }
    })
    .filter(r => r.query && r.query !== '{}')
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))

  for (const r of rows) {
    const mark = r.flags.length ? ` !! ${r.flags.join(',')}` : ''
    console.log(`[${r.timestamp}] ${r.sessionId ?? 'anon'} ${r.name ?? ''} ${(r.tags ?? []).join(',')}${mark}`)
    console.log(`  Q: ${r.query}`)
    console.log(`  A: ${FULL ? r.answer : r.answer.slice(0, 220).replace(/\n/g, ' ')}\n`)
  }

  const flagged = rows.filter(r => r.flags.length)
  console.log(`${rows.length} queries, ${new Set(rows.map(r => r.sessionId)).size} sessions, ${flagged.length} flagged`)
  if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
