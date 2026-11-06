// backend/scripts/loadtest/chat-load.ts
//
// Cycle 3, Day 2: N buyers at once, over HTTP, against a deployed backend.
//
//   npx tsx scripts/loadtest/chat-load.ts <https://backend> <users> <minutes> <label> [--think=20] [--questions=scripts/corpus/day5-100.json]
//
// Each virtual buyer is a person: own token, own session, 3-6 questions per conversation, a pause
// between questions, then a new person takes the seat. Every turn is judged by the same rules:
//   ok        HTTP 200, stream ended with `done`, non-empty answer
//   notice    the answer is our outage/high-traffic notice (a clear message, counted separately)
//   empty     stream finished but no answer text (blank screen)
//   limited   HTTP 429
//   error     other HTTP status, timeout, dropped stream
// Tokens are `loadtest-<uuid>` with a bot user agent: sessions are marked is_bot and never count as people.
// Refuses to run against the live database endpoint's backend (realtypalsdev.onrender.com).
import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { judge, type Verdict } from './judge'


interface Turn {
  buyer: number; q: string; at: number; verdict: Verdict; status: number | null
  firstTokenMs: number | null; totalMs: number; chars: number; lane: string | null; answer: string; flags: string[]; error?: string
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null
}


const UA = 'RealtyAsk-loadtest/1.0 (bot; cycle 3 day 2)'
const LIVE_HOSTS = ['realtypalsdev.onrender.com', 'realtyask.in', 'www.realtyask.in']
async function oneTurn(base: string, token: string, sessionId: string | null, intent: unknown, q: string) {
  const t0 = Date.now()
  let status: number | null = null, firstTokenMs: number | null = null, body = ''
  try {
    const res = await fetch(`${base}/api/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-guest-token': token, 'x-realtyask-timing': '1', 'user-agent': UA },
      body: JSON.stringify({ action: { type: 'TEXT_MESSAGE', payload: { text: q } }, sessionId, guestToken: token, intent }),
      signal: AbortSignal.timeout(90_000),
    })
    status = res.status
    if (res.body) {
      for await (const chunk of res.body.pipeThrough(new TextDecoderStream()) as unknown as AsyncIterable<string>) {
        body += chunk
        if (firstTokenMs === null && body.includes('event: token')) firstTokenMs = Date.now() - t0
      }
    }
    return { status, firstTokenMs, totalMs: Date.now() - t0, body }
  } catch (e) {
    return { status, firstTokenMs, totalMs: Date.now() - t0, body, error: (e as Error).message }
  }
}

async function main() {
  const [base0, usersArg, minutesArg, label, ...flags] = process.argv.slice(2)
  if (!base0 || !usersArg || !minutesArg || !label) throw new Error('usage: chat-load.ts <https://backend> <users> <minutes> <label> [--think=20] [--questions=file]')
  const base = base0.replace(/\/$/, '')
  if (LIVE_HOSTS.some((h) => base.includes(h))) throw new Error(`refusing: ${base} is the live site`)
  const users = Number(usersArg), minutes = Number(minutesArg)
  const flag = (n: string, d: string) => flags.find((f) => f.startsWith(`--${n}=`))?.split('=')[1] ?? d
  const thinkMs = Number(flag('think', '20')) * 1000
  const questions = (JSON.parse(readFileSync(flag('questions', 'scripts/corpus/day5-100.json'), 'utf8')) as { q: string }[]).map((x) => x.q)

  // Wake a sleeping dev instance first so cold start is not counted as load.
  const w0 = Date.now()
  const warm = await fetch(`${base}/api/v1/health`, { signal: AbortSignal.timeout(120_000) }).then((r) => r.text()).catch((e) => `ERR ${e.message}`)
  process.stderr.write(`warm-up ${Date.now() - w0}ms ${warm.slice(0, 80)}\n`)

  const start = Date.now(), end = start + minutes * 60_000
  const turns: Turn[] = []
  let qi = Math.floor(Math.random() * questions.length)

  async function buyer(id: number) {
    await new Promise((r) => setTimeout(r, Math.random() * thinkMs)) // spread the first wave
    while (Date.now() < end) {
      const token = `loadtest-${randomUUID()}`
      let sessionId: string | null = null, intent: unknown = {}
      for (let i = 0, n = 3 + Math.floor(Math.random() * 4); i < n && Date.now() < end; i++) {
        const q = questions[qi++ % questions.length]
        const r = await oneTurn(base, token, sessionId, intent, q)
        const j = judge(r.status, r.body)
        const sid = /"sessionId":"([^"]+)"/.exec(r.body)?.[1]; if (sid) sessionId = sid
        const im = /event: done\ndata: (.+)/.exec(r.body)?.[1]; if (im) { try { intent = (JSON.parse(im) as { intent?: unknown }).intent ?? {} } catch { /* keep last */ } }
        turns.push({ buyer: id, q, at: Date.now() - start, verdict: r.error ? 'error' : j.verdict, status: r.status, firstTokenMs: r.firstTokenMs, totalMs: r.totalMs, chars: j.answer.length, lane: j.lane, answer: j.answer, flags: j.flags, error: r.error })
        await new Promise((res) => setTimeout(res, thinkMs * (0.6 + Math.random() * 0.8)))
      }
    }
  }
  const tick = setInterval(() => process.stderr.write(`t+${Math.round((Date.now() - start) / 1000)}s turns=${turns.length} bad=${turns.filter((t) => t.verdict !== 'ok').length}\n`), 30_000)
  await Promise.all(Array.from({ length: users }, (_, i) => buyer(i)))
  clearInterval(tick)

  const by = (v: Verdict) => turns.filter((t) => t.verdict === v).length
  const minuteRows = Array.from({ length: minutes }, (_, m) => {
    const ts = turns.filter((t) => t.at >= m * 60_000 && t.at < (m + 1) * 60_000)
    const ft = ts.map((t) => t.firstTokenMs).filter((x): x is number => x !== null)
    return { minute: m + 1, turns: ts.length, notOk: ts.filter((t) => t.verdict !== 'ok').length, firstTokenP50: pct(ft, 50), firstTokenP95: pct(ft, 95), totalP95: pct(ts.map((t) => t.totalMs), 95) }
  })
  const ft = turns.map((t) => t.firstTokenMs).filter((x): x is number => x !== null)
  const summary = {
    label, target: base, users, minutes, thinkSec: thinkMs / 1000, at: new Date().toISOString(),
    turns: turns.length, flagged: turns.filter((t) => t.flags.length).length, ok: by('ok'), notice: by('notice'), empty: by('empty'), limited: by('limited'), error: by('error'),
    errorKinds: Object.fromEntries([...new Set(turns.filter((t) => t.error || t.verdict === 'error').map((t) => t.error ?? `HTTP ${t.status}`))].map((k) => [k, turns.filter((t) => (t.error ?? `HTTP ${t.status}`) === k && t.verdict === 'error').length])),
    firstTokenMs: { p50: pct(ft, 50), p90: pct(ft, 90), p99: pct(ft, 99) },
    totalMs: { p50: pct(turns.map((t) => t.totalMs), 50), p90: pct(turns.map((t) => t.totalMs), 90), max: Math.max(0, ...turns.map((t) => t.totalMs)) },
    perMinute: minuteRows,
  }
  const dir = join(__dirname, '../../../docs/benchmark/answers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${label}.json`), JSON.stringify({ summary, turns }, null, 2) + '\n')
  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
}

// ponytail: self-check lives here, run with `tsx chat-load.ts --selfcheck`; split to a test file if it grows.
if (process.argv[2] === '--selfcheck') {
  const sse = (...e: [string, unknown][]) => e.map(([n, d]) => `event: ${n}\ndata: ${JSON.stringify(d)}\n\n`).join('')
  const eq = (a: unknown, b: unknown, m: string) => { if (a !== b) throw new Error(`${m}: got ${String(a)}, want ${String(b)}`) }
  eq(judge(200, sse(['token', { token: 'Hello ' }], ['token', { token: 'there' }], ['done', {}])).verdict, 'ok', 'normal answer')
  eq(judge(200, sse(['done', {}])).verdict, 'empty', 'blank answer must not pass')
  eq(judge(200, sse(['token', { token: 'partial' }])).verdict, 'error', 'dropped stream must not pass')
  eq(judge(429, '').verdict, 'limited', '429')
  eq(judge(500, '').verdict, 'error', '500')
  eq(judge(200, sse(['token', { token: 'old' }], ['token', { token: 'We are briefly unavailable.', replace: true }], ['done', {}])).verdict, 'notice', 'replace notice')
  eq(judge(200, sse(['token', { token: 'Poised for long-term value growth' }], ['done', {}])).flags.join(), 'poised for', 'forecast wording flagged')
  eq(judge(200, sse(['token', { token: 'Pick by budget.' }], ['done', {}])).flags.length, 0, 'clean answer unflagged')
  eq(judge(200, sse(['token', { token: 'carpet area) starting around 2 Cr' }], ['done', {}])).flags.join(), 'starts-mid-sentence', 'truncated start flagged')
  eq(judge(200, sse(['token', { token: 'Offers strong rental yields.' }], ['done', {}])).flags.join(), 'strong rental yields', 'rental yield claim flagged')
  eq(judge(200, sse(['token', { token: 'Gross yield table from rents we hold: rental yield 3.1%.' }], ['done', {}])).flags.length, 0, 'computed yield table unflagged')
  console.log('selfcheck ok')
} else {
  main().catch((e) => { console.error(e); process.exit(1) })
}
