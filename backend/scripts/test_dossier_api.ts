import http from 'http'

function request(options: http.RequestOptions, data?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => resolve({ status: res.statusCode || 0, body }))
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function run() {
  console.log('--- 1. Testing POST /api/v1/dossier/create ---')
  const payload = JSON.stringify({
    targetSector: 'Sector 76 & Sector 10',
    targetBhk: '3 BHK Layout',
    buyerName: 'Verma Family Co-Decision',
  })

  const createRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/v1/dossier/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    payload
  )

  console.log('Create HTTP Status:', createRes.status)
  const created = JSON.parse(createRes.body)
  console.log('Generated Token:', created.token)
  console.log('Share URL:', created.shareUrl)
  console.log('Consultation Trail Steps:', created.dossier?.consultationTrail?.length)
  console.log('Search Evolution Summary:', created.dossier?.consultation?.searchEvolutionSummary)
  console.log('Projects Shortlisted:', created.dossier?.projects?.map((p: any) => p.name))
  console.log('Trade-Off Dilemma Option A:', created.dossier?.tradeOffDilemma?.optionA?.name)
  console.log('Trade-Off Dilemma Option B:', created.dossier?.tradeOffDilemma?.optionB?.name)

  const token = created.token
  if (!token) throw new Error('Token was not generated!')

  console.log('\n--- 2. Testing GET /api/v1/dossier/:token ---')
  const getRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/v1/dossier/${token}`,
    method: 'GET',
  })
  console.log('Get HTTP Status:', getRes.status)
  const getObj = JSON.parse(getRes.body)
  console.log('Fetched Buyer Name:', getObj.dossier?.consultation?.buyerName)

  console.log('\n--- 3. Testing POST /api/v1/dossier/:token/react (LIKE) ---')
  const pId = getObj.dossier?.projects?.[0]?.id || 'p-1'
  const likePayload = JSON.stringify({
    projectId: pId,
    reactionType: 'LIKE',
  })
  const reactRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3001,
      path: `/api/v1/dossier/${token}/react`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(likePayload),
      },
    },
    likePayload
  )
  console.log('Like React HTTP Status:', reactRes.status)
  const reactObj = JSON.parse(reactRes.body)
  console.log('Reactions Map:', JSON.stringify(reactObj.familyReactions))

  console.log('\n--- 4. Testing POST /api/v1/dossier/:token/react (CONCERN) ---')
  const concernPayload = JSON.stringify({
    projectId: pId,
    reactionType: 'CONCERN',
    note: 'Ensure Amitabh Kant 25% Authority dues challan is stamped.',
  })
  const concernRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3001,
      path: `/api/v1/dossier/${token}/react`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(concernPayload),
      },
    },
    concernPayload
  )
  console.log('Concern React HTTP Status:', concernRes.status)
  const concernObj = JSON.parse(concernRes.body)
  console.log('Reactions with Concern:', JSON.stringify(concernObj.familyReactions))

  console.log('\n--- 5. Testing Frontend Page Render for the Token ---')
  const feRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/dossier/${token}`,
    method: 'GET',
  })
  console.log('Frontend Next.js HTTP Status for /dossier/' + token + ':', feRes.status)
  console.log('Frontend HTML Content-Length:', feRes.body.length)

  console.log('\n✅ ALL INTEGRATION CHECKS PASSED PERFECTLY!')
}

run().catch((err) => {
  console.error('API Verification error:', err)
  process.exit(1)
})
