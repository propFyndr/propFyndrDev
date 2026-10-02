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
  console.log('Fetching Langfuse traces...')
  const tracesRes = await fetchApi('/api/public/traces?limit=50')
  const traces = tracesRes?.data || []
  console.log(`Found ${traces.length} recent traces in Langfuse.\n`)

  const summary: any[] = []

  for (const t of traces) {
    const traceId = t.id
    const name = t.name
    const timestamp = t.timestamp
    const input = t.input
    const output = t.output
    const sessionId = t.sessionId
    const tags = t.tags

    // Get trace details to get generations/spans
    summary.push({
      id: traceId,
      name,
      timestamp,
      sessionId,
      tags,
      input: typeof input === 'string' ? input : JSON.stringify(input),
      output: typeof output === 'string' ? output : JSON.stringify(output)
    })
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch(console.error)
