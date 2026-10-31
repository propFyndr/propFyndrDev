// backend/scripts/corpus/day5-speed.ts
//
// Week plan Day 5.1–5.3: time 30 typical questions through the real chat route
// and the REAL model chain, and count the turns answered without calling a model.
// Each question is a new buyer (fresh guest, fresh session), asked in file order,
// so a later question can only be answered from cache by an earlier buyer's answer.
//
//   npx tsx scripts/corpus/day5-speed.ts scripts/corpus/day5-30.json day5-baseline
//
// "Called a model" is read from the wire, not from lane names: every outbound
// request to a model provider (Gemini, Cohere, Groq, NVIDIA, Cloudflare AI,
// Mistral, OpenAI, Cerebras) is counted, including the intent model and
// embeddings. Requests in the 2 s after the answer finishes are counted apart
// (background work the buyer does not wait for).
//
// Every run gets its own Redis prefix and a fresh process, so no run reads
// another run's (or live's) cached answers. Rate limits are off: this measures
// answers, not the limiter.
import http from 'http'
import https from 'https'
import { randomUUID } from 'crypto'
import { execSync } from 'child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const MODEL_HOST = /generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com|cohere\.(?:ai|com)|groq\.com|nvidia\.com|api\.cloudflare\.com\/client\/v4\/accounts\/[^/]+\/ai|mistral\.ai|cerebras|openrouter|api\.openai\.com/i

let calls: string[] = []
const note = (url: string) => { if (MODEL_HOST.test(url)) calls.push(url.replace(/\?.*$/, '').replace(/key=[^&]+/, '')) }

const realFetch = globalThis.fetch
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  note(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  return realFetch(input, init)
}) as typeof fetch
for (const mod of [http, https] as const) {
  const real = mod.request
  ;(mod as { request: unknown }).request = function (...args: unknown[]) {
    const a = args[0] as string | URL | { host?: string; hostname?: string; path?: string }
    note(typeof a === 'string' ? a : a instanceof URL ? a.href : `${a?.hostname ?? a?.host ?? ''}${a?.path ?? ''}`)
    return (real as (...x: unknown[]) => unknown).apply(mod, args)
  }
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null
}

async function main() {
  const [file, label = 'day5'] = process.argv.slice(2)
  // Read before the app loads: this is the code the run measures.
  const sha = execSync('git rev-parse --short HEAD').toString().trim()
  const dirtyTree = execSync('git status --porcelain --untracked-files=no').toString().trim().split('\n').filter(Boolean)
  process.env.LANGFUSE_SECRET_KEY = ''
  process.env.LANGFUSE_PUBLIC_KEY = ''
  process.env.DISABLE_RATE_LIMIT = 'true'
  process.env.REDIS_KEY_PREFIX = `dev:${label}-${Date.now()}:` // never live keys, never an earlier run's
  const { default: request } = await import('supertest')
  const { app } = await import('../../src/index')
  const { prisma } = await import('../../src/lib/db')
  const { onTurnTrace } = await import('../../src/lib/turnTrace')

  const questions = JSON.parse(readFileSync(file, 'utf8')) as { id: string; q: string; sameAs?: string; differsFrom?: string }[]
  let lane = 'no-trace'
  const stop = onTurnTrace((t) => { lane = t.lane })
  const turns = []
  for (const item of questions) {
    lane = 'no-trace'
    calls = []
    const guestToken = randomUUID()
    const t0 = Date.now()
    let firstMs: number | null = null
    let body = ''
    await request(app)
      .post('/api/v1/chat')
      .set('x-guest-token', guestToken)
      .send({ action: { type: 'TEXT_MESSAGE', payload: { text: item.q } }, sessionId: null, guestToken, intent: {} })
      .buffer(true)
      .parse((r, cb) => {
        r.setEncoding('utf8')
        r.on('data', (d: string) => { if (firstMs === null && d.includes('event: token')) firstMs = Date.now() - t0; body += d })
        r.on('end', () => cb(null, body))
      })
    const totalMs = Date.now() - t0
    const before = calls.length
    await new Promise((r) => setTimeout(r, 2000))
    const events = body.split('\n\n').flatMap((p) => {
      const ev = /^event: (\w+)/m.exec(p); const data = /^data: (.+)$/m.exec(p)
      if (!ev || !data) return []
      try { return [{ event: ev[1], data: JSON.parse(data[1]) }] } catch { return [] }
    })
    // A token event with `replace: true` swaps the whole text, as the client renders it; joining them all
    // showed a failed provider leg's partial sentence in front of the answer the buyer actually saw.
    const answer = events.filter((e) => e.event === 'token').reduce((text, e) => (e.data.replace ? String(e.data.token ?? '') : text + String(e.data.token ?? '')), '')
    const outage = /briefly unavailable|rather say so than guess|high traffic/i.test(answer)
    turns.push({
      ...item, lane, firstMs, totalMs, modelCalls: before, modelCallsAfter: calls.length - before,
      hosts: [...new Set(calls.map((c) => c.replace(/^https?:\/\//, '').split('/')[0]))], outage, chars: answer.length, answer,
    })
    process.stderr.write(`${item.id} | ${lane} | ${totalMs}ms | ai=${before}+${calls.length - before}${outage ? ' | OUTAGE' : ''} | ${item.q.slice(0, 50)}\n`)
  }
  stop()

  const total = turns.map((t) => t.totalMs)
  const first = turns.map((t) => t.firstMs).filter((x): x is number => x !== null)
  const summary = {
    label,
    sha,
    dirtyTree,
    at: new Date().toISOString(),
    db: (process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@').replace(/\?.*$/, ''),
    questions: turns.length,
    totalMs: { median: pct(total, 50), p90: pct(total, 90), max: Math.max(...total) },
    firstTokenMs: { median: pct(first, 50), p90: pct(first, 90), max: Math.max(...first) },
    answerCacheHits: turns.filter((t) => t.lane === 'answer-cache').length,
    noModelCall: turns.filter((t) => t.modelCalls === 0).length,
    noModelCallExcludingCache: turns.filter((t) => t.modelCalls === 0 && t.lane !== 'answer-cache').length,
    outages: turns.filter((t) => t.outage).map((t) => t.id),
    slowest: [...turns].sort((a, b) => b.totalMs - a.totalMs).slice(0, 5).map((t) => ({ id: t.id, lane: t.lane, totalMs: t.totalMs })),
  }
  const dir = join(__dirname, '../../../docs/benchmark/answers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${label}.json`), JSON.stringify({ summary, turns }, null, 2) + '\n')
  console.log(JSON.stringify(summary, null, 2))
  await prisma.$disconnect()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
