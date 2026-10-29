// backend/scripts/health-chat.ts
//
// One repeatable speed and reliability check of the chat, dev or live.
//
//   npm run health:chat -- --base https://<backend host>            # 30 questions × 3 runs
//   npm run health:chat -- --base http://localhost:3001 --runs 1
//
// Real HTTP and SSE against the deployed route, the path a buyer hits. Each
// question gets its own `healthcheck-<uuid>` guest token: never a website
// token, so these sessions stay out of every real-people count
// (realPeopleSessions in routes/admin.ts), and no question asks for a callback,
// so no lead is written. One token per question also keeps the per-guest rate
// limit and daily cost cap from showing up as failures.
//
// Per turn it records:
//   sign of life  the first `status` event (or first token, if that comes first)
//   first word    the first `token` event
//   done          the `done` event
//   failure       HTTP error, no answer text, a timeout, or the outage notice
// Cached turns (done.cached) are reported apart: runs 2 and 3 hit the answer
// cache, and mixing them in would make the median look faster than a buyer's.
//
// Targets (Day 0): under 1 failure in 50, median first word under 3 s.
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isOutageNotice } from '../src/lib/ai/outageNotice'

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const BASE = arg('base', 'http://localhost:3001').replace(/\/$/, '')
const RUNS = Number(arg('runs', '3'))
const LIMIT = Number(arg('limit', '0'))
const TIMEOUT_MS = Number(arg('timeout', '90000'))

const all = JSON.parse(readFileSync(join(__dirname, 'health-chat-questions.json'), 'utf8')) as string[]
const QUESTIONS = LIMIT > 0 ? all.slice(0, LIMIT) : all

interface Turn {
  run: number
  question: string
  status: number
  lifeMs: number | null
  firstWordMs: number | null
  doneMs: number | null
  cached: boolean
  failure: string | null
}

async function ask(question: string, run: number): Promise<Turn> {
  const guestToken = `healthcheck-${randomUUID()}`
  const t0 = Date.now()
  const turn: Turn = { run, question, status: 0, lifeMs: null, firstWordMs: null, doneMs: null, cached: false, failure: null }
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
  let answer = ''
  try {
    const res = await fetch(`${BASE}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-guest-token': guestToken },
      body: JSON.stringify({ action: { type: 'TEXT_MESSAGE', payload: { text: question } }, sessionId: null, guestToken, intent: {} }),
      signal: abort.signal,
    })
    turn.status = res.status
    if (!res.ok || !res.body) {
      turn.failure = `http ${res.status}`
      return turn
    }
    const decoder = new TextDecoder()
    let buf = ''
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += decoder.decode(chunk, { stream: true })
      let cut: number
      while ((cut = buf.indexOf('\n\n')) > -1) {
        const frame = buf.slice(0, cut)
        buf = buf.slice(cut + 2)
        const ev = /^event: (\w+)/m.exec(frame)?.[1]
        const raw = /^data: (.+)$/m.exec(frame)?.[1]
        if (!ev || !raw) continue
        let data: Record<string, unknown> = {}
        try { data = JSON.parse(raw) } catch { continue }
        const at = Date.now() - t0
        if (ev === 'status' && turn.lifeMs == null) turn.lifeMs = at
        if (ev === 'token' && String(data.token ?? '').trim()) {
          if (turn.firstWordMs == null) turn.firstWordMs = at
          if (turn.lifeMs == null) turn.lifeMs = at
          answer += String(data.token)
        }
        if (ev === 'done') {
          turn.doneMs = at
          turn.cached = data.cached === true
        }
      }
    }
    if (!answer.trim()) turn.failure = 'no answer text'
    else if (isOutageNotice(answer)) turn.failure = 'outage notice'
    else if (turn.doneMs == null) turn.failure = 'stream ended without done'
  } catch (e) {
    turn.failure = abort.signal.aborted ? `timeout ${TIMEOUT_MS / 1000}s` : `error: ${(e as Error).message}`
  } finally {
    clearTimeout(timer)
  }
  return turn
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const sec = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`)

function summary(label: string, turns: Turn[]): string {
  const first = turns.map((t) => t.firstWordMs).filter((n): n is number => n != null)
  const life = turns.map((t) => t.lifeMs).filter((n): n is number => n != null)
  const done = turns.map((t) => t.doneMs).filter((n): n is number => n != null)
  return `| ${label} | ${turns.length} | ${sec(pct(life, 50))} / ${sec(pct(life, 100))} | ${sec(pct(first, 50))} / ${sec(pct(first, 90))} / ${sec(pct(first, 100))} | ${sec(pct(done, 50))} / ${sec(pct(done, 100))} |`
}

async function main() {
  console.log(`health:chat ${BASE}, ${QUESTIONS.length} questions × ${RUNS} runs, started ${new Date().toISOString()}`)
  const turns: Turn[] = []
  for (let run = 1; run <= RUNS; run++) {
    for (const q of QUESTIONS) {
      const t = await ask(q, run)
      turns.push(t)
      console.log(`${t.failure ? 'FAIL' : 'ok  '} r${run} life ${sec(t.lifeMs)} first ${sec(t.firstWordMs)} done ${sec(t.doneMs)}${t.cached ? ' (cached)' : ''}${t.failure ? ` [${t.failure}]` : ''}  ${q.slice(0, 60)}`)
    }
  }

  const failed = turns.filter((t) => t.failure)
  const fresh = turns.filter((t) => !t.cached)
  const cached = turns.filter((t) => t.cached)
  console.log(`\n## health:chat — ${BASE} — ${new Date().toISOString()}\n`)
  console.log(`Turns ${turns.length}. Failures ${failed.length} (${((failed.length / turns.length) * 100).toFixed(1)}%; target under 2%). Cache hit rate ${((cached.length / turns.length) * 100).toFixed(0)}%.\n`)
  console.log('| Turns | n | sign of life p50 / max | first word p50 / p90 / max | done p50 / max |')
  console.log('| :--- | ---: | :--- | :--- | :--- |')
  console.log(summary('all', turns))
  console.log(summary('fresh (not cached)', fresh))
  if (cached.length) console.log(summary('cached', cached))
  if (failed.length) {
    console.log('\nFailures:')
    for (const t of failed) console.log(`- r${t.run} [${t.failure}] ${t.question}`)
  }
  const slowest = [...fresh].filter((t) => t.firstWordMs != null).sort((a, b) => b.firstWordMs! - a.firstWordMs!).slice(0, 5)
  console.log('\nSlowest first word (fresh):')
  for (const t of slowest) console.log(`- ${sec(t.firstWordMs)} r${t.run} ${t.question}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
