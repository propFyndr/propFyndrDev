import https from 'https'
import 'dotenv/config'

const SECRET_KEY = process.env.LANGFUSE_SECRET_KEY ?? ''
const PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY ?? ''

function getAuthHeader() {
  return 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64')
}

function fetchApi(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'us.cloud.langfuse.com',
      path,
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
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
  console.log('Fetching Langfuse traces (limit 150)...')
  const res = await fetchApi('/api/public/traces?limit=100')
  const traces = res?.data || []
  console.log(`Found ${traces.length} traces.`)

  const extracted: any[] = []
  for (const t of traces) {
    let inputStr = ''
    try {
      const inp = typeof t.input === 'string' ? JSON.parse(t.input) : t.input
      inputStr = inp?.message || inp?.userMessage || JSON.stringify(inp)
    } catch {
      inputStr = String(t.input)
    }

    let outputStr = ''
    try {
      const out = typeof t.output === 'string' ? JSON.parse(t.output) : t.output
      outputStr = out?.response || out?.text || JSON.stringify(out)
    } catch {
      outputStr = String(t.output)
    }

    extracted.push({
      id: t.id,
      sessionId: t.sessionId,
      timestamp: t.timestamp,
      tags: t.tags,
      query: inputStr,
      responsePreview: outputStr ? outputStr.slice(0, 140) : null
    })
  }

  // Filter out empty or test
  const realQueries = extracted.filter(x => x.query && !x.query.startsWith('test') && x.query !== '{}')
  console.log('--- Real queries extracted from Langfuse: ---')
  for (const q of realQueries) {
    console.log(`[${q.timestamp}] [Session: ${q.sessionId}] Query: "${q.query}" | Resp: "${q.responsePreview}"`)
  }
}

main().catch(console.error)
