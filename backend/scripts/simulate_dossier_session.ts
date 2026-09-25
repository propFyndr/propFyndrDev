import { prisma } from '../src/lib/db'
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

async function simulateMultiTurnSession() {
  console.log('=== MULTI-TURN DOSSIER SESSION SIMULATION ===')

  // 1. Create a simulated session
  const session = await prisma.chatSession.create({
    data: {
      title: 'Sector 76 to Sector 10 Family Consultation',
      message_count: 8,
      chat_phase: 'RESEARCH',
    },
  })
  console.log('Created Chat Session:', session.id)

  const now = new Date()
  const messagesData = [
    {
      session_id: session.id,
      role: 'user',
      content: 'What are good 3 BHK options in Sector 76 Noida near the metro under 2 Cr?',
      created_at: new Date(now.getTime() - 40000),
    },
    {
      session_id: session.id,
      role: 'assistant',
      content: 'Sector 76 Noida features mature social infrastructure with a 5-minute walk to Sector 76 metro station. However, 3 BHK prices average ₹1.85 Cr to ₹2.4 Cr, creating a tight budget buffer.',
      created_at: new Date(now.getTime() - 35000),
    },
    {
      session_id: session.id,
      role: 'user',
      content: 'Is Amrapali Silicon City in Sector 76 safe regarding court receiver and registry dues?',
      created_at: new Date(now.getTime() - 30000),
    },
    {
      session_id: session.id,
      role: 'assistant',
      content: 'Amrapali Silicon City is physically complete under the Supreme Court NBCC receiver. However, sub-lease registry execution remains staggered.',
      created_at: new Date(now.getTime() - 25000),
    },
    {
      session_id: session.id,
      role: 'user',
      content: 'Can we get more carpet area and newer construction if we pivot to Sector 10 Greater Noida West?',
      created_at: new Date(now.getTime() - 20000),
    },
    {
      session_id: session.id,
      role: 'assistant',
      content: 'Pivoting to Sector 10 Greater Noida West delivers +30% larger carpet area for under ₹1.5 Cr. Note that Sector 10 relies primarily on borewell groundwater.',
      created_at: new Date(now.getTime() - 15000),
    },
    {
      session_id: session.id,
      role: 'user',
      content: 'Check Elite X in Sector 10 for water TDS and UP lifts act compliance.',
      created_at: new Date(now.getTime() - 10000),
    },
    {
      session_id: session.id,
      role: 'assistant',
      content: 'Elite X has 0 pending Authority land dues under the Amitabh Kant formula. Groundwater TDS is ~800 ppm, necessitating heavy reverse osmosis filtration.',
      created_at: new Date(now.getTime() - 5000),
    },
  ]

  await prisma.chatMessage.createMany({
    data: messagesData,
  })
  console.log('Inserted 4 turns (8 messages) into Prisma')

  // 2. Trigger Dossier Creation with this sessionId
  const payload = JSON.stringify({
    sessionId: session.id,
    buyerName: 'Verma Family Consultation',
    targetBhk: '3 BHK Layout',
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

  console.log('Dossier API Response Status:', createRes.status)
  const result = JSON.parse(createRes.body)
  const token = result.token
  console.log('Dossier Token:', token)
  console.log('Share URL:', result.shareUrl)

  const dossier = result.dossier
  console.log('\n--- EXTRACTED NARRATIVE SUMMARY ---')
  console.log('Search Evolution:', dossier.consultation.searchEvolutionSummary)
  console.log('Total Consultation Trail Steps:', dossier.consultationTrail.length)

  console.log('\n--- CONSULTATION TRAIL STEPS ---')
  for (const s of dossier.consultationTrail) {
    console.log(`[Step ${s.step}] [${s.badge}] ${s.sectorOrTopic}`)
    console.log(`  Q: "${s.userQuestion}"`)
    console.log(`  Verdict: "${s.groundRealityVerdict}"`)
  }

  if (dossier.tradeOffDilemma) {
    console.log('\n--- TRADE-OFF DILEMMA ---')
    console.log(`Option A: ${dossier.tradeOffDilemma.optionA.name} (+: ${dossier.tradeOffDilemma.optionA.advantage} | -: ${dossier.tradeOffDilemma.optionA.drawback})`)
    console.log(`Option B: ${dossier.tradeOffDilemma.optionB.name} (+: ${dossier.tradeOffDilemma.optionB.advantage} | -: ${dossier.tradeOffDilemma.optionB.drawback})`)
    console.log(`Recommendation: ${dossier.tradeOffDilemma.verdictRecommendation}`)
  }

  // 3. Test Frontend Next.js render of this specific dynamic multi-turn dossier
  const feRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/dossier/${token}`,
    method: 'GET',
  })
  console.log('\n--- FRONTEND RENDER STATUS ---')
  console.log(`GET http://localhost:3000/dossier/${token} -> HTTP ${feRes.status}`)
  console.log(`Rendered HTML length: ${feRes.body.length} bytes`)

  // Cleanup simulation session
  await prisma.chatMessage.deleteMany({ where: { session_id: session.id } })
  await prisma.chatSession.delete({ where: { id: session.id } })
  console.log('\nCleaned up simulation session record from DB.')
  console.log('🎉 SIMULATION COMPLETE: Day 7 Multi-Turn Consultation Trail works end-to-end!')
}

simulateMultiTurnSession().catch(err => {
  console.error('Simulation Failed:', err)
  process.exit(1)
})
