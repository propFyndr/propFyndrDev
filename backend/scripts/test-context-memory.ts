// backend/scripts/test-context-memory.ts
import http from 'http'
import { randomUUID } from 'crypto'

interface ChatResponse {
  fullText: string
  sessionId: string | null
  chips: any[]
  uiState: any
}

async function sendChatMessage(
  message: string,
  sessionId?: string,
  guestToken?: string,
  userId?: string,
): Promise<ChatResponse> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      action: {
        type: 'TEXT_MESSAGE',
        payload: { text: message },
      },
      sessionId,
      guestToken,
      userId,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(postData)),
    }
    if (guestToken) {
      headers['x-guest-token'] = guestToken
    }

    const req = http.request(
      'http://localhost:3001/api/v1/chat',
      {
        method: 'POST',
        headers,
      },
      (res) => {
        let fullText = ''
        let resSessionId: string | null = null
        let chips: any[] = []
        let uiState: any = null

        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.token) fullText += parsed.token
                if (parsed.message && !parsed.token) fullText += `[SSE Message: ${parsed.message}]`
                if (parsed.sessionId) resSessionId = parsed.sessionId
                if (parsed.chips) chips = parsed.chips
                if (parsed.ui_state) uiState = parsed.ui_state
                if (parsed.event === 'done' && parsed.sessionId) resSessionId = parsed.sessionId
              } catch {
                // non-json or ping
              }
            }
          }
        })
        res.on('end', () =>
          resolve({
            fullText,
            sessionId: resSessionId,
            chips,
            uiState,
          }),
        )
      },
    )

    req.on('error', reject)
    req.setTimeout(40000, () => {
      req.destroy()
      reject(new Error('Request timed out after 40s'))
    })
    req.write(postData)
    req.end()
  })
}

async function runMemoryAudit() {
  console.log('====================================================================')
  console.log('  REALTYPALS / PROPFYNDR CONTEXT AWARENESS & MEMORY AUDIT')
  console.log('====================================================================\n')

  const guestA = 'guest_audit_' + randomUUID().slice(0, 8)
  const guestB = 'guest_intruder_' + randomUUID().slice(0, 8)

  // -------------------------------------------------------------------------
  // TEST SUITE 1: SAME CHAT (Multi-Turn Conversational Memory & Backtracking)
  // -------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: SAME CHAT CONTEXT & REVISION MEMORY ---')

  // Turn 1: Stating initial preferences
  console.log('\n[Turn 1]: Stating Initial Preferences: 3 BHK in Sector 150 under 2.5 Cr...')
  const turn1 = await sendChatMessage(
    'Looking for 3 BHK apartments in Sector 150 under 2.5 Cr',
    undefined,
    guestA,
  )
  const session1 = turn1.sessionId!
  console.log(`  Session ID: ${session1}`)
  console.log(`  Response (first 180 chars): ${turn1.fullText.slice(0, 180).replace(/\n/g, ' ')}...`)

  // Turn 2: Anaphoric / Ordinal Referent ("the first one")
  console.log('\n[Turn 2]: Referent Resolution: "What about the first one? How far is it from the metro?"')
  const turn2 = await sendChatMessage(
    'What about the first one? How far is it from the metro station?',
    session1,
    guestA,
  )
  console.log(`  Response (first 250 chars): ${turn2.fullText.slice(0, 250).replace(/\n/g, ' ')}...`)

  // Turn 3: Subject Focus Continuity ("what is its payment plan?")
  console.log('\n[Turn 3]: Subject Focus Continuity: "What is its payment plan and possession date?"')
  const turn3 = await sendChatMessage(
    'What is its payment plan and possession date?',
    session1,
    guestA,
  )
  console.log(`  Response (first 250 chars): ${turn3.fullText.slice(0, 250).replace(/\n/g, ' ')}...`)

  // Turn 4: Modifying constraint (Budget revision to 1.8 Cr)
  console.log('\n[Turn 4]: Budget Revision: "Actually let\'s tighten the budget to 1.8 Cr max"')
  const turn4 = await sendChatMessage(
    'Actually let\'s tighten the budget to 1.8 Cr max',
    session1,
    guestA,
  )
  console.log(`  Response (first 250 chars): ${turn4.fullText.slice(0, 250).replace(/\n/g, ' ')}...`)

  // Turn 5: Question about Conversation History ("What was my first budget?")
  console.log('\n[Turn 5]: History Query: "What was my first budget?"')
  const turn5 = await sendChatMessage(
    'What was my first budget?',
    session1,
    guestA,
  )
  console.log(`  Response: ${turn5.fullText.trim()}`)

  // Turn 6: Verbatim Question Recall ("What did I ask you first?")
  console.log('\n[Turn 6]: Verbatim Question Recall: "What did I ask you first?"')
  const turn6 = await sendChatMessage(
    'What did I ask you first?',
    session1,
    guestA,
  )
  console.log(`  Response: ${turn6.fullText.trim()}`)

  // -------------------------------------------------------------------------
  // TEST SUITE 2: DIFFERENT CHATS (Cross-Session Profile Memory for Same User)
  // -------------------------------------------------------------------------
  console.log('\n\n--- TEST SUITE 2: DIFFERENT CHATS (Cross-Session User Memory) ---')
  console.log('Starting Chat Session 2 for the SAME user (guestA)...')
  console.log('[Chat 2, Turn 1]: "Show me recommended properties for me" (no BHK or budget restated)')
  const chat2Turn1 = await sendChatMessage(
    'Show me recommended properties for me based on what you know',
    undefined, // New session!
    guestA,
  )
  console.log(`  New Session ID: ${chat2Turn1.sessionId}`)
  console.log(`  Response (first 300 chars): ${chat2Turn1.fullText.slice(0, 300).replace(/\n/g, ' ')}...`)

  const chat2SessionId = chat2Turn1.sessionId!
  console.log('\n[Chat 2, Turn 2]: Cross-Chat Memory Query: "What do you know about my budget and bedroom preference?"')
  const chat2Turn2 = await sendChatMessage(
    'What do you know about my budget and bedroom preference?',
    chat2SessionId,
    guestA,
  )
  console.log(`  Response: ${chat2Turn2.fullText.trim()}`)

  // -------------------------------------------------------------------------
  // TEST SUITE 3: SESSION ISOLATION & SECURITY (Different Users)
  // -------------------------------------------------------------------------
  console.log('\n\n--- TEST SUITE 3: SESSION ISOLATION & PRIVACY (IDOR Protection) ---')
  console.log(`Attempting to access Session 1 (${session1}) from a different user (guestB)...`)
  const intrusionAttempt = await sendChatMessage(
    'What were we talking about earlier?',
    session1, // Target Session 1
    guestB,   // Different guest
  )
  console.log(`  Intrusion response: ${intrusionAttempt.fullText.trim()}`)

  console.log('\n====================================================================')
  console.log('  AUDIT COMPLETE')
  console.log('====================================================================')
}

runMemoryAudit().catch(console.error)
