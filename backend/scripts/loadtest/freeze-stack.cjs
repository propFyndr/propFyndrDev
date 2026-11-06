// Reproduce the event-loop freeze under sustained load and read the stack of whatever is spinning.
//   node scripts/loadtest/freeze-stack.cjs [users] [minutes]
// Local backend on dev Neon, started with the inspector; when /healthz stops answering, pause via CDP and print the stack.
const { spawn, execSync } = require('child_process')
const fs = require('fs')
const [users = '25', minutes = '4'] = process.argv.slice(2)
const PORT = 3059, INSPECT = 9339
const dbUrl = (fs.readFileSync('.env', 'utf8').match(/^DATABASE_URL=(.*)$/m) || [])[1]?.replace(/^["']|["']$/g, '')
if (!dbUrl || /ep-super-water-aof3o8gy/.test(dbUrl)) throw new Error('refusing: live or missing DATABASE_URL')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = async () => { try { return (await fetch(`http://127.0.0.1:${PORT}/api/v1/healthz`, { signal: AbortSignal.timeout(4000) })).ok } catch { return false } }

async function stack() {
  const targets = await (await fetch(`http://127.0.0.1:${INSPECT}/json`)).json()
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  let paused
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) pending.get(d.id)(d)
    if (d.method === 'Debugger.paused') paused?.(d.params)
  }
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('Debugger.enable')
  const out = []
  for (let k = 0; k < 4; k++) {
    const p = new Promise((r) => (paused = r))
    await send('Debugger.pause')
    const params = await Promise.race([p, sleep(5000).then(() => null)])
    if (!params) { out.push('(no pause within 5s)'); continue }
    out.push(`--- sample ${k + 1} (${params.reason})\n` + params.callFrames.slice(0, 14).map((f) => `  ${f.functionName || '(anon)'}  ${f.url.replace(/^file:\/\/\//, '').split('/').slice(-3).join('/')}:${f.location.lineNumber + 1}`).join('\n'))
    await send('Debugger.resume'); await sleep(300)
  }
  ws.close()
  return out.join('\n')
}

;(async () => {
  const pool = process.env.POOL // e.g. POOL=3 forces Prisma's connection_limit, like Render's 1-CPU container
  const env = { ...process.env, PORT: String(PORT), DISABLE_RATE_LIMIT: 'true', REDIS_KEY_PREFIX: `dev:fs-${Date.now()}:`, LANGFUSE_SECRET_KEY: '', LANGFUSE_PUBLIC_KEY: '', ...(pool ? { DATABASE_URL: dbUrl + (dbUrl.includes('?') ? '&' : '?') + `connection_limit=${pool}&pool_timeout=${process.env.POOLT || 10}` } : {}) }
  const server = spawn('npx.cmd', ['tsx', `--inspect=${INSPECT}`, 'src/index.ts'], { env, shell: true, stdio: 'ignore' })
  let load
  try {
    for (let i = 0; i < 240 && !(await alive()); i++) await sleep(500)
    load = spawn('npx.cmd', ['tsx', 'scripts/loadtest/chat-load.ts', `http://127.0.0.1:${PORT}`, users, minutes, process.env.LABEL || 'c3d2-freeze', '--think=10', '--questions=scripts/loadtest/det-questions.json'], { shell: true, stdio: 'ignore' })
    const end = Date.now() + (Number(minutes) + 2) * 60000
    let dead = 0
    while (Date.now() < end) {
      await sleep(2000)
      dead = (await alive()) ? 0 : dead + 1
      if (dead >= 3) { console.log('FROZEN: /healthz unanswered for ~20s; sampling stack'); console.log(await stack()); return }
    }
    console.log('no freeze within the window')
  } finally {
    for (const p of [load, server]) { try { if (p) execSync(`taskkill /T /F /PID ${p.pid}`, { stdio: 'ignore' }) } catch {} }
  }
})().catch((e) => { console.error(e); process.exit(1) })
