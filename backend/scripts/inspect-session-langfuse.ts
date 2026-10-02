import https from 'https'

import 'dotenv/config'
// Keys come from the environment, as in src/lib/monitoring/langfuse.ts. A hardcoded
// secret here shipped to git once; never inline one again.
const SECRET_KEY = process.env.LANGFUSE_SECRET_KEY ?? ''
const PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY ?? ''
if (!SECRET_KEY || !PUBLIC_KEY) {
  console.error('Set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY (backend/.env).')
  process.exit(1)
}
const BASE_URL = 'us.cloud.langfuse.com'

function getAuthHeader() {
  return 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64')
}

function fetchApi(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed)
        } catch (e) {
          resolve(data)
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

async function main() {
  // Let's inspect session 9902e425-e5d9-4dd8-a923-08c822f063e3 specifically
  console.log('=== INSPECTING TEAM SESSION 9902e425-e5d9-4dd8-a923-08c822f063e3 ===')
  const sessionTracesRes = await fetchApi('/api/public/traces?sessionId=9902e425-e5d9-4dd8-a923-08c822f063e3&limit=50')
  const sessionTraces = (sessionTracesRes?.data || []).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  console.log(`Found ${sessionTraces.length} turns in this session.\n`)

  for (let i = 0; i < sessionTraces.length; i++) {
    const t = sessionTraces[i]
    let q = ''
    try {
      const inp = typeof t.input === 'string' ? JSON.parse(t.input) : t.input
      q = inp.userMessage || inp.message || inp.query || ''
    } catch {
      q = String(t.input)
    }

    let a = ''
    try {
      const out = typeof t.output === 'string' ? JSON.parse(t.output) : t.output
      a = out.response || out.text || out.message || ''
    } catch {
      a = String(t.output)
    }

    if (!q) continue

    console.log(`Turn ${i + 1} [${t.timestamp}]:`)
    console.log(`User: "${q}"`)
    console.log(`PropFyndr:\n${a}\n`)
    console.log('----------------------------------------------------')
  }

  // Also fetch all distinct sessions in the last 24h
  console.log('\n=== RECENT SESSIONS LIST ===')
  const sessionsRes = await fetchApi('/api/public/sessions?limit=30')
  const sessions = sessionsRes?.data || []
  console.log(`Total sessions: ${sessions.length}`)
  for (const s of sessions) {
    console.log(`Session: ${s.id} | Created: ${s.createdAt}`)
  }
}

main().catch(console.error)
