// backend/scripts/corpus/day5-latency.ts
//
// Cycle 2, Day 5 tasks 1–3: where each answer's time goes, step by step.
//
//   local (in-process app, dev DB, fresh Redis prefix):
//     npx tsx scripts/corpus/day5-latency.ts local scripts/corpus/day5-100.json c2d5-dev
//   remote (any deployed backend; client timing, plus server steps once the header is deployed):
//     npx tsx scripts/corpus/day5-latency.ts https://realtypalsdev.onrender.com scripts/corpus/day5-100.json c2d5-live
//
// Every question is a new buyer: its own token and session, so the per-user cost cap and the
// rate limiter never see two turns from one "person". Tokens are `latency-c2d5-<uuid>` with a
// bot user agent, so the server marks them is_bot and they never count as real people.
// Remote turns are paced at least PACE_MS apart and the first (warm-up) turn is dropped.
//
// Client clock: firstByte (any byte), firstStatus, firstToken (first `token` event), done.
// Server clock: the `timing` event (sent only when the request carries x-realtyask-timing: 1).
import { randomUUID } from 'crypto'
import { execSync } from 'child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const PACE_MS = 3000
const UA = 'RealtyAsk-latency-bench/1.0 (bot; cycle 2 day 5)'

interface Turn {
  id: string; q: string; source: string
  lane: string; firstByteMs: number | null; firstStatusMs: number | null; firstTokenMs: number | null; totalMs: number
  server: { stages: Record<string, number>; points: Record<string, number>; total: number } | null
  outage: boolean; error?: string
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null
}
const stat = (xs: number[]) => ({ n: xs.length, median: pct(xs, 50), p90: pct(xs, 90), max: xs.length ? Math.max(...xs) : null })

function parse(body: string) {
  const events = body.split('\n\n').flatMap((p) => {
    const ev = /^event: (\w+)/m.exec(p); const data = /^data: (.+)$/m.exec(p)
    if (!ev || !data) return []
    try { return [{ event: ev[1], data: JSON.parse(data[1]) }] } catch { return [] }
  })
  const answer = events.filter((e) => e.event === 'token').reduce((t, e) => (e.data.replace ? String(e.data.token ?? '') : t + String(e.data.token ?? '')), '')
  const timing = events.find((e) => e.event === 'timing')?.data ?? null
  return { answer, timing }
}

/** One turn over a byte stream we can watch arrive. */
async function streamTurn(open: () => Promise<AsyncIterable<string>>, t0: number) {
  let firstByteMs: number | null = null, firstStatusMs: number | null = null, firstTokenMs: number | null = null
  let body = ''
  for await (const chunk of await open()) {
    const now = Date.now() - t0
    firstByteMs ??= now
    body += chunk
    if (firstStatusMs === null && body.includes('event: status')) firstStatusMs = now
    if (firstTokenMs === null && body.includes('event: token')) firstTokenMs = now
  }
  return { firstByteMs, firstStatusMs, firstTokenMs, body }
}

async function main() {
  const [target, file, label = 'c2d5'] = process.argv.slice(2)
  if (!target || !file) throw new Error('usage: day5-latency.ts <local|https://backend> <questions.json> <label>')
  const local = target === 'local'
  const sha = execSync('git rev-parse --short HEAD').toString().trim()
  const dirty = execSync('git status --porcelain --untracked-files=no').toString().trim().split('\n').filter(Boolean)

  let base = target.replace(/\/$/, '')
  let close: () => Promise<void> = async () => {}
  let traceLane: string | null = null // local only: the lane the telemetry row records, read on `finish`
  if (local) {
    process.env.LANGFUSE_SECRET_KEY = ''
    process.env.LANGFUSE_PUBLIC_KEY = ''
    process.env.DISABLE_RATE_LIMIT = 'true'
    process.env.TURN_TRACE = 'off'
    process.env.REDIS_KEY_PREFIX = `dev:${label}-${Date.now()}:` // never live keys, never an earlier run's
    const { app } = await import('../../src/index')
    const { prisma } = await import('../../src/lib/db')
    const { onTurnTrace } = await import('../../src/lib/turnTrace')
    onTurnTrace((t) => { traceLane = t.lane })
    const server = app.listen(0)
    await new Promise((r) => server.once('listening', r))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    close = async () => { server.close(); await prisma.$disconnect() }
  }

  const questions = JSON.parse(readFileSync(file, 'utf8')) as { id: string; q: string; source: string }[]
  const list = local ? questions : [{ id: 'warmup', q: 'Hi', source: 'warmup' }, ...questions]
  const turns: Turn[] = []
  for (const item of list) {
    const token = `latency-c2d5-${randomUUID()}`
    const started = Date.now()
    const t0 = Date.now()
    traceLane = null
    let r: Turn
    try {
      const s = await streamTurn(async () => {
        const res = await fetch(`${base}/api/v1/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-guest-token': token, 'x-realtyask-timing': '1', 'user-agent': UA },
          body: JSON.stringify({ action: { type: 'TEXT_MESSAGE', payload: { text: item.q } }, sessionId: null, guestToken: token, intent: {} }),
          signal: AbortSignal.timeout(90_000),
        })
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
        return res.body.pipeThrough(new TextDecoderStream()) as unknown as AsyncIterable<string>
      }, t0)
      const { answer, timing } = parse(s.body)
      if (local) await new Promise((res) => setTimeout(res, 50)) // let `finish` fire
      r = {
        ...item, lane: traceLane ?? timing?.lane ?? 'unknown', firstByteMs: s.firstByteMs, firstStatusMs: s.firstStatusMs, firstTokenMs: s.firstTokenMs,
        totalMs: Date.now() - t0, server: timing ? { stages: timing.stages, points: timing.points, total: timing.total } : null,
        outage: /briefly unavailable|rather say so than guess|high traffic/i.test(answer),
      }
    } catch (e) {
      r = { ...item, lane: 'error', firstByteMs: null, firstStatusMs: null, firstTokenMs: null, totalMs: Date.now() - t0, server: null, outage: false, error: (e as Error).message }
    }
    if (item.id !== 'warmup') turns.push(r)
    process.stderr.write(`${item.id} | ${r.lane} | first=${r.firstTokenMs}ms total=${r.totalMs}ms${r.outage ? ' OUTAGE' : ''}${r.error ? ' ERR ' + r.error : ''} | ${item.q.slice(0, 50)}\n`)
    if (!local) { const wait = PACE_MS - (Date.now() - started); if (wait > 0) await new Promise((res) => setTimeout(res, wait)) }
  }

  const ok = turns.filter((t) => !t.error)
  const num = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === 'number')
  const stepNames = [...new Set(ok.flatMap((t) => Object.keys(t.server?.stages ?? {})))]
  const pointNames = [...new Set(ok.flatMap((t) => Object.keys(t.server?.points ?? {})))]
  const summarise = (ts: Turn[]) => ({
    turns: ts.length,
    client: { firstByteMs: stat(num(ts.map((t) => t.firstByteMs))), firstStatusMs: stat(num(ts.map((t) => t.firstStatusMs))), firstTokenMs: stat(num(ts.map((t) => t.firstTokenMs))), totalMs: stat(ts.map((t) => t.totalMs)) },
    serverStages: Object.fromEntries(stepNames.map((s) => [s, stat(num(ts.map((t) => t.server?.stages[s])))]).filter(([, v]) => (v as { n: number }).n > 0)),
    serverPoints: Object.fromEntries(pointNames.map((s) => [s, stat(num(ts.map((t) => t.server?.points[s])))]).filter(([, v]) => (v as { n: number }).n > 0)),
  })
  const lanes = [...new Set(ok.map((t) => t.lane))]
  const summary = {
    label, target: local ? 'local app, dev DB' : base, sha, dirty, at: new Date().toISOString(),
    db: local ? (process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@').replace(/\?.*$/, '') : 'n/a (remote)',
    errors: turns.filter((t) => t.error).map((t) => ({ id: t.id, error: t.error })),
    outages: turns.filter((t) => t.outage).map((t) => t.id),
    serverTimingSeen: ok.filter((t) => t.server).length,
    all: summarise(ok),
    byLane: Object.fromEntries(lanes.map((l) => [l, summarise(ok.filter((t) => t.lane === l))])),
    slowest: [...ok].sort((a, b) => b.totalMs - a.totalMs).slice(0, 8).map((t) => ({ id: t.id, lane: t.lane, firstTokenMs: t.firstTokenMs, totalMs: t.totalMs, stages: t.server?.stages })),
  }
  const dir = join(__dirname, '../../../docs/benchmark/answers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${label}.json`), JSON.stringify({ summary, turns }, null, 2) + '\n')
  console.log(JSON.stringify({ ...summary, byLane: Object.keys(summary.byLane) }, null, 2))
  await close()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
