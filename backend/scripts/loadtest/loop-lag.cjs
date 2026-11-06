// Event-loop blocking per turn: poll /healthz every 25 ms while one chat turn runs; report the worst stall.
//   node scripts/loadtest/loop-lag.cjs
const { spawn, execSync } = require('child_process')
const fs = require('fs')
const PORT = 3058
const dbUrl = (fs.readFileSync('.env', 'utf8').match(/^DATABASE_URL=(.*)$/m) || [])[1]?.replace(/^["']|["']$/g, '')
if (!dbUrl || /ep-super-water-aof3o8gy/.test(dbUrl)) throw new Error('refusing: live or missing DATABASE_URL')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ping = async () => { const t = performance.now(); try { await fetch(`http://127.0.0.1:${PORT}/api/v1/healthz`, { signal: AbortSignal.timeout(20000) }) } catch {} return performance.now() - t }
const QS = [
  'Is 1.5 crore too much for a 3 BHK in Noida right now?',
  'What would the monthly EMI be on a 75 lakh loan at 8.5% for 20 years?',
  'How much stamp duty do I pay on a 90 lakh flat if my wife is the primary owner?',
  'What is the weather in Paris today?',
  'Hi',
]
;(async () => {
  const env = { ...process.env, PORT: String(PORT), DISABLE_RATE_LIMIT: 'true', REDIS_KEY_PREFIX: `dev:lag-${Date.now()}:`, LANGFUSE_SECRET_KEY: '', LANGFUSE_PUBLIC_KEY: '' }
  const server = spawn('npx.cmd', ['tsx', 'src/index.ts'], { env, shell: true, stdio: 'ignore' })
  try {
    for (let i = 0; i < 240; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/api/v1/healthz`)).ok) break } catch {} await sleep(500) }
    await sleep(2000)
    for (const [n, label, pick] of [[5, 'emi', 1], [10, 'emi', 1], [25, 'emi', 1], [25, 'mixed', -1]]) {
      let stop = false, worst = 0
      const poller = (async () => { while (!stop) { worst = Math.max(worst, await ping()); await sleep(25) } })()
      const t0 = performance.now()
      const done = await Promise.all(Array.from({ length: n }, async (_, i) => {
        const q = QS[pick >= 0 ? pick : i % QS.length].replace('75', String(60 + i))
        const token = `loadtest-lag-${Math.random().toString(36).slice(2)}`
        try {
          const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-guest-token': token, 'user-agent': 'RealtyAsk-loadtest/1.0 (bot; lag)' }, body: JSON.stringify({ action: { type: 'TEXT_MESSAGE', payload: { text: q } }, sessionId: null, guestToken: token, intent: {} }), signal: AbortSignal.timeout(60000) })
          await res.text(); return performance.now() - t0
        } catch { return -1 }
      }))
      stop = true; await poller
      const okMs = done.filter((x) => x >= 0).sort((a, b) => a - b)
      console.log(`${n} parallel ${label}: finished=${okMs.length}/${n} p50=${Math.round(okMs[Math.floor(okMs.length / 2)] || 0)}ms max=${Math.round(okMs[okMs.length - 1] || 0)}ms worstHealthzStall=${Math.round(worst)}ms`)
      if (worst > 20000) break
    }
  } finally { try { execSync(`taskkill /T /F /PID ${server.pid}`, { stdio: 'ignore' }) } catch {} }
})()
