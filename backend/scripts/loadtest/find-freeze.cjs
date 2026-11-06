// Ask each question alone to a local dev-DB backend; report the first one after which /healthz stops answering.
//   node scripts/loadtest/find-freeze.cjs [questions.json]
const { spawn, execSync } = require('child_process')
const fs = require('fs')
const qs = JSON.parse(fs.readFileSync(process.argv[2] || 'scripts/loadtest/det-questions.json', 'utf8')).map((x) => x.q)
const PORT = 3057
const dbUrl = (fs.readFileSync('.env', 'utf8').match(/^DATABASE_URL=(.*)$/m) || [])[1]?.replace(/^["']|["']$/g, '')
if (!dbUrl || /ep-super-water-aof3o8gy/.test(dbUrl)) throw new Error('refusing: live or missing DATABASE_URL')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = async () => { try { return (await fetch(`http://127.0.0.1:${PORT}/api/v1/healthz`, { signal: AbortSignal.timeout(4000) })).ok } catch { return false } }
;(async () => {
  const env = { ...process.env, PORT: String(PORT), DISABLE_RATE_LIMIT: 'true', REDIS_KEY_PREFIX: `dev:ff-${Date.now()}:`, LANGFUSE_SECRET_KEY: '', LANGFUSE_PUBLIC_KEY: '' }
  const server = spawn('npx.cmd', ['tsx', 'src/index.ts'], { env, shell: true, stdio: 'ignore' })
  try {
    for (let i = 0; i < 240 && !(await alive()); i++) await sleep(500)
    for (let i = 0; i < qs.length; i++) {
      const token = `loadtest-ff-${Date.now()}-${i}`
      const t0 = Date.now()
      let status = 'timeout'
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/chat`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-guest-token': token, 'user-agent': 'RealtyAsk-loadtest/1.0 (bot; find-freeze)' },
          body: JSON.stringify({ action: { type: 'TEXT_MESSAGE', payload: { text: qs[i] } }, sessionId: null, guestToken: token, intent: {} }), signal: AbortSignal.timeout(20000),
        })
        await res.text(); status = res.status
      } catch (e) { status = e.name }
      const ok = await alive()
      console.log(`${i} ${status} ${Date.now() - t0}ms alive=${ok} | ${qs[i]}`)
      if (!ok) { console.log('FROZEN after question', i); break }
    }
  } finally { try { execSync(`taskkill /T /F /PID ${server.pid}`, { stdio: 'ignore' }) } catch {} }
})()
