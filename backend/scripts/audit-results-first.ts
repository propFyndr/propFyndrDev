// backend/scripts/audit-results-first.ts
//
//   npx tsx scripts/audit-results-first.ts
//
// HARD RULE 11: "RESULTS FIRST — show data before asking any follow-up."
//
// The corpus graded 50 of 103 sector queries `too_short`, and every one of them
// came back with zero cards. They are not exotic phrasings; they are the most
// ordinary property searches a buyer types — "properties in noida sector 75",
// "flats in sector 75 noida for sale". A buyer who names a sector and gets a
// question back has been asked to fill in a form.
//
// This is deliberately NOT graded as a pass rate. The corpus runner's pass rate
// carries roughly ±6pp of provider nondeterminism, which is wider than most
// changes worth making — three runs of the same 103 queries scored 44.7%, 51.5%
// and 45.6% with no code change between two of them. What this reports instead
// is the thing that is not a matter of degree: did the turn show the buyer any
// inventory, or did it only ask?
//
// Run it before and after a change. A query moving from ASKED to SHOWED is a
// real move; a percentage shifting by four points is not.

const ENDPOINT = process.env.CHAT_ENDPOINT || 'http://localhost:3001/api/v1/chat'

/** Ordinary searches that name a place. Every one should show inventory. */
const MUST_SHOW = [
  'properties in noida sector 75',
  'properties in noida sector 137',
  'properties in sector 128 noida',
  'flats in sector 75 noida for sale',
  'property for sale in sector 75 noida',
  'luxury apartments & flats in noida sector 75',
  '3 bhk in greater noida',
  'properties in greater noida west',
  'properties in noida extension',
  'best properties in sector 150',
]

/** Turns where a question IS the right answer — nothing was named to search. */
const MAY_ASK = [
  'hi',
  'i want to buy a flat',
  'help me find something',
]

interface Turn { cards: number; text: string; ms: number }

async function ask(message: string): Promise<Turn> {
  const t0 = Date.now()
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({
      guestToken: `rf_${process.pid}_${Math.random().toString(36).slice(2, 8)}`,
      action: { type: 'TEXT_MESSAGE', payload: { text: message } },
    }),
    signal: AbortSignal.timeout(150_000),
  })
  if (!res.ok || !res.body) return { cards: 0, text: `HTTP ${res.status}`, ms: Date.now() - t0 }

  let text = ''
  let cards = 0
  const dec = new TextDecoder()
  let buf = ''
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      try {
        const e = JSON.parse(payload) as Record<string, unknown>
        if (typeof e.token === 'string') text += e.token
        if (Array.isArray(e.exactResults)) cards = (e.exactResults as unknown[]).length
      } catch { /* keepalive */ }
    }
  }
  return { cards, text, ms: Date.now() - t0 }
}

/** A turn whose whole content is a question back to the buyer. */
function onlyAsks(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  // Short, and ends on a question mark: a clarifier, not an answer.
  return t.length < 320 && /\?\s*$/.test(t)
}

async function main(): Promise<void> {
  console.log('\nRESULTS FIRST — did the turn show inventory, or only ask?\n')
  let failures = 0

  console.log('MUST SHOW — buyer named a place')
  console.log('='.repeat(78))
  for (const q of MUST_SHOW) {
    const r = await ask(q)
    const showed = r.cards > 0
    if (!showed) failures++
    console.log(`  ${showed ? 'SHOWED ' : 'ASKED  '} cards=${String(r.cards).padStart(2)}  ${String(r.ms).padStart(6)}ms  ${q}`)
    if (!showed) console.log(`            ${r.text.replace(/\s+/g, ' ').slice(0, 96)}`)
    await new Promise((s) => setTimeout(s, 1200))
  }

  console.log('\nMAY ASK — nothing named, a question is the right answer')
  console.log('='.repeat(78))
  for (const q of MAY_ASK) {
    const r = await ask(q)
    console.log(`  ${onlyAsks(r.text) ? 'asked  ' : 'answered'} cards=${String(r.cards).padStart(2)}  ${q}`)
    await new Promise((s) => setTimeout(s, 1200))
  }

  console.log(`\n${MUST_SHOW.length - failures}/${MUST_SHOW.length} named-place searches showed inventory`)
  if (failures > 0) process.exitCode = 1
}

main()
