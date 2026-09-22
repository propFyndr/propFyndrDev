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
