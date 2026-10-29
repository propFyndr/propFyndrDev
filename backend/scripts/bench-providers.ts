// backend/scripts/bench-providers.ts
//
// Day 0 item 1: time every AI provider on its own, on the real chat route.
//
//   npx tsx scripts/bench-providers.ts                 # every leg, one child process each
//   npx tsx scripts/bench-providers.ts --leg "<label>" # one leg
//
// Each leg runs in its own process, with the chain narrowed to that leg
// (BENCH_ONLY_LEG in fallbackChain.ts) and no cooldown or rate-budget skips, so
// a failing leg is measured rather than skipped. The prompt is the real one:
// questions go through the whole route, and only turns that reached the model
// count (many are answered from rows in code). Up to 30 per leg.
//
// Timing comes from the leg itself (legEvents): first provider chunk and total,
// not the paragraph-buffered SSE stream, so legs are compared on the provider.
// The first-token deadline is raised to 60 s so a slow first token is measured
// instead of being cut at 8 s.
//
// Real provider calls on real keys. Redis and Langfuse off (nothing written to
// the shared caches or traces). Sessions are written to the dev DB under
// `healthcheck-` guest tokens and deleted at the end of each leg.
import { config } from 'dotenv'
config()
import { spawnSync } from 'child_process'
import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const TARGET = 30
const MAX_CONSECUTIVE_FAILS = 5
const legArg = process.argv.indexOf('--leg') > -1 ? process.argv[process.argv.indexOf('--leg') + 1] : null

interface Row { label: string; reached: number; ok: number; failed: number; firstChunk: number[]; total: number[]; errors: string[]; stoppedEarly: boolean }

function questions(): string[] {
  const health = JSON.parse(readFileSync(join(__dirname, 'health-chat-questions.json'), 'utf8')) as string[]
  const replay = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'lib', 'eval', 'route-replay.json'), 'utf8')) as Array<{ turns: Array<{ text: string }> }>
  const single = replay.filter((c) => c.turns.length === 1).map((c) => c.turns[0].text)
  return [...new Set([...health, ...single])]
}

async function runOneLeg(label: string): Promise<Row> {
  process.env.NODE_ENV = 'test'
  process.env.BENCH_ONLY_LEG = label
  process.env.STREAM_FIRST_TOKEN_MS = '60000'
  process.env.GEMINI_INITIAL_TOKEN_TIMEOUT_MS = '60000'
  process.env.OPENAI_INITIAL_TOKEN_TIMEOUT_MS = '60000'
  process.env.FALLBACK_TURN_BUDGET_MS = '120000'
  for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'UPSTASH_REDIS_URL', 'UPSTASH_REDIS_TOKEN', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_PUBLIC_KEY', 'LANGFUSE_BASE_URL']) process.env[k] = ''
  process.env.TURN_TRACE = 'off'

  const { default: request } = await import('supertest')
  const { app } = await import('../src/index')
  const { prisma } = await import('../src/lib/db')
  const { legEvents } = await import('../src/lib/ai/fallbackChain')
  type Ev = import('../src/lib/ai/fallbackChain').LegEvent

  const row: Row = { label, reached: 0, ok: 0, failed: 0, firstChunk: [], total: [], errors: [], stoppedEarly: false }
  const tokens: string[] = []
  let streak = 0
  try {
    for (const q of questions()) {
      if (row.reached >= TARGET) break
      const events: Ev[] = []
      const on = (e: Ev) => events.push(e)
      legEvents.on('leg', on)
      const guestToken = `healthcheck-${randomUUID()}`
      tokens.push(guestToken)
      await request(app as never).post('/api/v1/chat').set('x-guest-token', guestToken)
        .send({ action: { type: 'TEXT_MESSAGE', payload: { text: q } }, sessionId: null, guestToken, intent: {} })
        .buffer(true).parse((r, cb) => { r.on('data', () => {}); r.on('end', () => cb(null, '')) })
      legEvents.off('leg', on)
      if (!events.length) continue // answered in code; not a provider measurement
      row.reached++
      const e = events[0]
      if (e.ok) {
        row.ok++
        streak = 0
        if (e.firstChunkMs != null) row.firstChunk.push(e.firstChunkMs)
        row.total.push(e.totalMs)
      } else {
        row.failed++
        streak++
        row.errors.push(e.error ?? 'unknown')
        if (streak >= MAX_CONSECUTIVE_FAILS) { row.stoppedEarly = true; break }
      }
      console.error(`${label}: ${row.reached}/${TARGET} ${e.ok ? 'ok' : 'FAIL'} first ${e.firstChunkMs ?? '—'}ms total ${e.totalMs}ms ${e.ok ? '' : (e.error ?? '').slice(0, 80)}`)
    }
  } finally {
    await new Promise((r) => setTimeout(r, 2500))
    await prisma.chatSession.deleteMany({ where: { guest_token: { in: tokens } } }).catch(() => {})
    await prisma.$disconnect()
  }
  return row
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const sec = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`)

async function main() {
  if (legArg) {
    const row = await runOneLeg(legArg)
    process.stdout.write(`BENCH_ROW ${JSON.stringify(row)}\n`)
    process.exit(0)
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FALLBACK_CHAIN } = require('../src/lib/config') as typeof import('../src/lib/config')
  const rows: Row[] = []
  for (const leg of FALLBACK_CHAIN) {
    if (!process.env[leg.envKey]) { console.error(`skip ${leg.label}: no key`); continue }
    const r = spawnSync(process.execPath, [...process.execArgv, __filename, '--leg', leg.label], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 })
    const line = (r.stdout ?? '').split('\n').find((l) => l.startsWith('BENCH_ROW '))
    if (line) rows.push(JSON.parse(line.slice('BENCH_ROW '.length)))
    else console.error(`${leg.label}: no result (exit ${r.status})`)
  }
  const out = [
    `## Provider benchmark — ${new Date().toISOString()} — local machine, real chat route, dev DB`,
    '',
    '| Leg | Reached model | Failed | Failure rate | First chunk p50 / p90 | Total p50 / p90 | Note |',
    '| :--- | ---: | ---: | ---: | :--- | :--- | :--- |',
    ...rows.map((r) => `| ${r.label} | ${r.reached} | ${r.failed} | ${r.reached ? Math.round((r.failed / r.reached) * 100) : 0}% | ${sec(pct(r.firstChunk, 50))} / ${sec(pct(r.firstChunk, 90))} | ${sec(pct(r.total, 50))} / ${sec(pct(r.total, 90))} | ${r.stoppedEarly ? `stopped after ${MAX_CONSECUTIVE_FAILS} failures in a row` : ''}${r.errors.length ? ` ${[...new Set(r.errors.map((e) => e.slice(0, 60)))].slice(0, 2).join('; ')}` : ''} |`),
  ].join('\n')
  console.log(out)
  writeFileSync(join(__dirname, '..', '..', 'docs', `PROVIDER_BENCH_${new Date().toISOString().slice(0, 10)}.md`), out + '\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
