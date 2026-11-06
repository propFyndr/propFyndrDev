// backend/scripts/loadtest/failure-drills.ts
//
// Cycle 3, Day 2 task 3: switch one part off at a time and see what a buyer gets.
//
//   npx tsx scripts/loadtest/failure-drills.ts [scenario,scenario] [label]
//
// Starts the real backend (`tsx src/index.ts`) locally on the dev database, once per scenario, with
// ONE dependency broken through its environment, then asks the same six questions. Never touches
// Render or live: DATABASE_URL comes from backend/.env (dev Neon) and the script refuses a live endpoint.
// Pass = every turn ends in a real answer or our own notice (verdict ok|notice), never blank, hung,
// 5xx or a dropped stream, and carries no wording from judge.BANNED.
// Scenario `server-killed` kills the process after the first token and reports what the client saw.
import { spawn, execSync, type ChildProcess } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { judge } from './judge'

const PORT = 3055
const BASE = `http://127.0.0.1:${PORT}`
const AI_KEYS = [
  'GEMINI_API_KEY', 'GEMINI_API_KEY1', 'GEMINI_API_KEY2', 'GEMINI_API_KEY_OLD_DEPLETED', 'MISTRAL_API_KEY', 'MISTRAL_API_KEY1',
  'GROQ_API_KEY', 'GROQ_API_KEY1', 'GROQ_API_KEY2', 'GROQ_API_KEY3', 'GROQ_BLOG_API_KEY', 'COHERE_API_KEY', 'NVIDIA_API_KEY',
  'CLOUDFLARE_API_KEY', 'OPENAI_API_KEY', 'AZURE_OPENAI_API_KEY',
]
// The server refuses to boot with NO AI key (fatal at startup), so "providers off" means keys the providers reject.
const rejected = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, 'invalid-key-drill']))
const DEAD_DB = 'postgresql://nobody:nothing@127.0.0.1:1/none?connect_timeout=3'

const SCENARIOS: Record<string, Record<string, string>> = {
  baseline: {},
  'providers-off': rejected(AI_KEYS),
  'cache-off': { UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', UPSTASH_REDIS_TOKEN: '' },
  'database-off': { DATABASE_URL: DEAD_DB, DIRECT_URL: DEAD_DB },
  'server-killed': {},
}

// One per lane: a fact from our rows, an open question, arithmetic, a statutory figure, off-topic, a greeting.
const QUESTIONS = [
  'What are the payment plans for ATS Destinaire in Sector 1?',
  'Is Greater Noida West a good area for a family with two kids?',
  'What would the monthly EMI be on a 75 lakh loan at 8.5% for 20 years?',
  'How much stamp duty do I pay on a 90 lakh flat if my wife is the primary owner?',
  'What is the weather in Paris today?',
  'Hi',
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// `shell: true` on Windows makes child.kill() hit only the shell; kill the whole tree.
const killTree = (c: ChildProcess) => { try { execSync(`taskkill /T /F /PID ${c.pid}`, { stdio: 'ignore' }) } catch { /* already gone */ } }
const portBusy = async () => { try { await fetch(`${BASE}/api/v1/healthz`, { signal: AbortSignal.timeout(1500) }); return true } catch { return false } }

async function waitUp(child: ChildProcess, ms: number) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (child.exitCode !== null) return false
    try { if ((await fetch(`${BASE}/api/v1/healthz`, { signal: AbortSignal.timeout(2000) })).ok) return true } catch { /* not yet */ }
    await sleep(500)
  }
  return false
}

async function ask(q: string, killAfterFirstToken?: ChildProcess) {
  const token = `loadtest-drill-${Math.random().toString(36).slice(2)}`
  const t0 = Date.now()
  let status: number | null = null, body = '', error: string | undefined, firstTokenMs: number | null = null
  try {
    const res = await fetch(`${BASE}/api/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-guest-token': token, 'user-agent': 'RealtyAsk-loadtest/1.0 (bot; drill)' },
      body: JSON.stringify({ action: { type: 'TEXT_MESSAGE', payload: { text: q } }, sessionId: null, guestToken: token, intent: {} }),
      signal: AbortSignal.timeout(90_000),
    })
    status = res.status
    if (res.body) {
      for await (const chunk of res.body.pipeThrough(new TextDecoderStream()) as unknown as AsyncIterable<string>) {
        body += chunk
        if (firstTokenMs === null && body.includes('event: token')) {
          firstTokenMs = Date.now() - t0
          if (killAfterFirstToken) killTree(killAfterFirstToken)
        }
      }
    }
  } catch (e) { error = (e as Error).message }
  const j = judge(status, body)
  return { q, status, verdict: error ? 'error' : j.verdict, flags: j.flags, lane: j.lane, firstTokenMs, totalMs: Date.now() - t0, chars: j.answer.length, answer: j.answer, error }
}

async function runScenario(name: string) {
  // A leftover server on this port would answer instead of the broken one and make every scenario look healthy.
  if (await portBusy()) throw new Error(`port ${PORT} already answers; stop that process first`)
  const env = { ...process.env, PORT: String(PORT), DISABLE_RATE_LIMIT: 'true', REDIS_KEY_PREFIX: `dev:drill-${Date.now()}:`, LANGFUSE_SECRET_KEY: '', LANGFUSE_PUBLIC_KEY: '', ...SCENARIOS[name] }
  const child = spawn('npx', ['tsx', 'src/index.ts'], { env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  child.stdout?.on('data', (d) => { log += d }); child.stderr?.on('data', (d) => { log += d })
  const up = await waitUp(child, 120_000)
  if (!up) { killTree(child); try { mkdirSync(join(__dirname, '../../../docs/benchmark/answers'), { recursive: true }); writeFileSync(join(__dirname, `../../../docs/benchmark/answers/c3d2-drill-${name}.log`), log) } catch { /* convenience */ } return { name, started: false, log: log.slice(-900), turns: [] } }
  const turns = []
  if (name === 'server-killed') {
    turns.push(await ask('Is Greater Noida West a good area for a family with two kids?', child))
  } else {
    for (const q of QUESTIONS) turns.push(await ask(q))
  }
  killTree(child)
  await sleep(1500)
  try { mkdirSync(join(__dirname, '../../../docs/benchmark/answers'), { recursive: true }); writeFileSync(join(__dirname, `../../../docs/benchmark/answers/c3d2-drill-${name}.log`), log) } catch { /* log is a convenience */ }
  return { name, started: true, log: log.slice(-400), turns }
}

async function main() {
  const [list, label = 'c3d2-drills'] = process.argv.slice(2)
  const names = (list ? list.split(',') : Object.keys(SCENARIOS)).filter((n) => n in SCENARIOS)
  const live = /ep-super-water-aof3o8gy/.test(`${process.env.DATABASE_URL ?? ''}${process.env.DIRECT_URL ?? ''}`)
  if (live) throw new Error('refusing: DATABASE_URL in this shell is the live endpoint')
  const results = []
  for (const n of names) {
    process.stderr.write(`== ${n}\n`)
    const r = await runScenario(n)
    const bad = r.turns.filter((t) => !['ok', 'notice'].includes(t.verdict) || t.flags.length)
    process.stderr.write(`   started=${r.started} turns=${r.turns.length} notOk/flagged=${bad.length}\n`)
    // server-killed: the buyer's browser loses the stream; pass = it noticed quickly instead of hanging. What the page then shows is a frontend check.
    const pass = n === 'server-killed' ? r.turns.length === 1 && r.turns[0].verdict === 'error' && r.turns[0].totalMs < 15000 : r.started && r.turns.length > 0 && bad.length === 0
    results.push({ ...r, pass })
  }
  const dir = join(__dirname, '../../../docs/benchmark/answers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${label}.json`), JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify(results.map((r) => ({ scenario: r.name, started: r.started, pass: r.pass, verdicts: r.turns.map((t) => `${t.verdict}${t.flags.length ? '!' : ''}/${t.totalMs}ms`) })), null, 1))
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
