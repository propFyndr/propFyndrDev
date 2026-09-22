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
  console.log('Fetching all traces from Langfuse (limit=100)...')
  const tracesRes = await fetchApi('/api/public/traces?limit=100')
  const traces = tracesRes?.data || []

  console.log(`Fetched ${traces.length} traces.\n`)

  const sessionsMap: Record<string, any[]> = {}
  const uniqueQueries = new Set<string>()
  const queryLog: Array<{ query: string; responsePreview: string; latency?: number; timestamp: string; sessionId: string }> = []

  for (const t of traces) {
    const sid = t.sessionId || 'anonymous'
    if (!sessionsMap[sid]) sessionsMap[sid] = []
    sessionsMap[sid].push(t)

    let q = ''
    if (typeof t.input === 'object' && t.input !== null) {
      q = t.input.userMessage || t.input.message || t.input.query || ''
    } else if (typeof t.input === 'string') {
      try {
        const parsed = JSON.parse(t.input)
        q = parsed.userMessage || parsed.message || parsed.query || t.input
      } catch {
        q = t.input
      }
    }

    let resp = ''
    if (typeof t.output === 'object' && t.output !== null) {
      resp = t.output.response || t.output.text || JSON.stringify(t.output)
    } else if (typeof t.output === 'string') {
      try {
        const parsed = JSON.parse(t.output)
        resp = parsed.response || parsed.text || t.output
      } catch {
        resp = t.output
      }
    }

    if (q && q.trim()) {
      uniqueQueries.add(q.trim())
      queryLog.push({
        query: q.trim(),
        responsePreview: (resp || '').slice(0, 150).replace(/\n/g, ' '),
        latency: t.latency,
        timestamp: t.timestamp,
        sessionId: sid
      })
    }
  }

  console.log(`Total Unique User Queries found: ${uniqueQueries.size}`)
  console.log(`Total Sessions found: ${Object.keys(sessionsMap).length}\n`)

  console.log('=== USER QUERIES IN LANGFUSE ===')
  let idx = 1
  for (const item of queryLog) {
    console.log(`${idx++}. [${item.timestamp}] (Session: ${item.sessionId})`)
    console.log(`   Q: "${item.query}"`)
    console.log(`   A: "${item.responsePreview}..."\n`)
  }
}

main().catch(console.error)
