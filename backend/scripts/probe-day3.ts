// backend/scripts/probe-day3.ts
//
//   npx tsx scripts/probe-day3.ts
//
// Drives the Day 3 pass conditions that only a real multi-turn session can
// show: project context held across consecutive follow-ups, and a project we do
// NOT hold answered without invention.
//
// Prints the first lines of each answer plus the session id it carried, so a
// dropped referent is visible rather than inferred.

const ENDPOINT = process.env.CHAT_ENDPOINT || 'http://localhost:3001/api/v1/chat'

interface Turn { text: string; sessionId: string | null; guestToken: string | null }

/**
 * POST /chat reads `guestToken` from the BODY only. `x-guest-token` is read by
 * the GET session routes and ignored here, so a probe that sends the header has
 * its session minted under a server-generated token instead, every follow-up
 * then fails the ownership check, and the stream comes back empty — which looks
 * exactly like a lost referent.
 */
async function ask(message: string, sessionId: string | null, guestToken: string | null): Promise<Turn> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: { type: 'TEXT_MESSAGE', payload: { text: message } },
      ...(sessionId ? { sessionId } : {}),
      ...(guestToken ? { guestToken } : {}),
    }),
  })
  const body = await res.text()
  let text = ''
  let nextSession: string | null = sessionId
  let nextGuest: string | null = guestToken
  for (const line of body.split('\n')) {
    if (!line.startsWith('data:')) continue
    try {
      const payload = JSON.parse(line.slice(5).trim())
      if (typeof payload.token === 'string') text += payload.token
      if (payload.sessionId) nextSession = payload.sessionId
      if (payload.guestToken) nextGuest = payload.guestToken
    } catch {
      // partial frame, ignore
    }
  }
  return { text: text.trim(), sessionId: nextSession, guestToken: nextGuest }
}

function show(label: string, t: Turn, mentions: string[]): void {
  const first = t.text.split('\n').filter(Boolean).slice(0, 3).join(' ⏎ ')
  console.log(`\n── ${label}`)
  console.log(`   ${first.slice(0, 260)}`)
  for (const m of mentions) {
    const hit = new RegExp(m, 'i').test(t.text)
    console.log(`   ${hit ? 'HOLDS  ' : 'LOST   '} ${m}`)
  }
}

async function main(): Promise<void> {
  const token = `probe_day3_${Date.now()}`

  // Pass condition: "Multi-turn flow preserves project context across 3+
  // consecutive follow-ups (costSheet -> hiddenCharges -> waterSource)".
  // Turns 2-4 never name the project again.
  let s: string | null = null
  let g: string | null = token
  const project = 'Mahagun Mezzaria'
  const script: Array<[string, string[]]> = [
    [`show me the cost sheet for ${project}`, [project]],
    ['are there any hidden charges for it?', [project]],
    ['what water source is it using?', [project]],
    ['and are the lifts registered?', [project]],
  ]
  console.log(`\n=== MULTI-TURN CONTEXT (${project}) — turns 2-4 never repeat the name ===`)
  for (const [msg, mentions] of script) {
    const turn = await ask(msg, s, g)
    s = turn.sessionId
    g = turn.guestToken
    show(`"${msg}"`, turn, mentions)
  }

  // Pass condition: "Out-of-DB queries synthesize specific answers from live
  // web grounding matching the buyer's exact question rather than generic
  // stubs" — and, above that, without inventing a figure.
  console.log(`\n\n=== OUT OF DATABASE ===`)
  const outToken = `probe_day3_out_${Date.now()}`
  for (const q of [
    'what is the possession date for Skyline Verdant Quartz Residency?',
    'tell me about DLF Camellias in Gurgaon',
  ]) {
    const turn = await ask(q, null, outToken)
    show(`"${q}"`, turn, ['not (in|have)|don.t (have|hold)|no records|outside'])
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
