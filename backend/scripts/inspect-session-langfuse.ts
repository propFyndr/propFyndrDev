import https from 'https'

const SECRET_KEY = 'sk-lf-132cebf4-282a-49a3-a220-cf1dc1668345'
const PUBLIC_KEY = 'pk-lf-b953c5f2-2520-41cb-a6f8-d57c7739a588'
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
