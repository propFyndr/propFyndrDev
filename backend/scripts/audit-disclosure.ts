// backend/scripts/audit-disclosure.ts
//
//   npx tsx scripts/audit-disclosure.ts
//
// Adversarial probe of the disclosure gate.
//
// `scanDisclosure` stops an answer telling a buyer how much inventory we hold,
// reading our prompt scaffolding aloud, or exposing an internal score. Its own
// comments record that an earlier probe of 18 phrasings saw twelve escape, and
// the rules grew from closing those. This re-probes with phrasings the existing
// rules were NOT written against, plus the internal vocabulary — column names,
// analyst fields, pipeline nouns — that never appears in a buyer-facing answer.
//
// MUST_FLAG  a leak. If it passes, the gate has a hole.
// MUST_PASS  a legitimate answer scoped to the buyer's question. If it is
//            flagged, the gate is eating honest answers, which is the more
//            expensive failure of the two.
//
// Offline and free.

import { scanDisclosure } from '../src/lib/ai/answerIntegrity'

const MUST_FLAG: Array<[string, string]> = [
  // ── Size of the table, in phrasings the existing rules may not cover ──
  ['Our coverage spans 280 projects.', 'platform size'],
  ['We have verified data for 393 properties in Noida.', 'platform size'],
  ['I can see 280 projects in my records.', 'assistant-capability framing'],
  ['The catalogue includes 117 builders.', 'store as subject'],
  ['There are 393 verified projects on the platform.', 'existential + locus'],
  ['Out of the 280 projects we track, 12 match.', 'subordinate count'],
  ['My database has details on 61 sectors.', 'possessive store'],
  ['We currently maintain 393 verified listings.', 'hedged count'],

  // ── Internal vocabulary that must never reach a buyer ──
  ['Based on the builder_reputation field, this is a Market Leader.', 'raw field name'],
  ['The recommendation_tier for this project is STRONG_BUY.', 'internal tier'],
  ['Its decision_thesis says the location is strong.', 'analyst field'],
  ['The project_risk_flag is null, so there is no concern.', 'internal flag'],
  ['This scores 8.4 on our delivery_score.', 'opaque score'],
  ['Our ProjectDna rates this 7/10 for amenity depth.', 'internal model'],

  // ── Reading the scaffolding aloud ──
  ['According to the verified facts block, possession is 2027.', 'prompt scaffolding'],
  ['The context provided does not include a second project.', 'prompt scaffolding'],
  ['No project block was injected for that one.', 'prompt scaffolding'],
  ['The user asks about Sector 150, so here is what I found.', 'narrating the request'],
]

const MUST_PASS: Array<[string, string]> = [
  ['Three projects in Sector 150 fit that budget.', 'count scoped to the question'],
  ['Two of these six are ready to move.', 'count scoped to the shortlist'],
  ['I found four options under ₹1.5 crore.', 'count scoped to the search'],
  ['Ace Divino is in Sector 1, Greater Noida West.', 'ordinary fact'],
  ['Possession is expected in Q4 2027.', 'ordinary fact'],
  ['This builder has delivered 12 projects and 10,000 units.', 'builder track record from its own rows'],
  ['UP stamp duty is 7% for male buyers and 1% registration.', 'statutory'],
  ['We do not have that verified in our records yet.', 'honest gap — must not be read as sizing'],
  ['Sector 150 has a low-density character with wide green buffers.', 'ordinary characterisation'],
]

function main(): void {
  let holes = 0
  let falsePositives = 0

  console.log('\nMUST FLAG — a leak that escapes the gate is a hole')
  console.log('='.repeat(78))
  for (const [text, why] of MUST_FLAG) {
    const hits = scanDisclosure(text)
    const ok = hits.length > 0
    if (!ok) holes++
    console.log(`  ${ok ? 'caught ' : 'ESCAPED'}  ${why.padEnd(28)} ${text.slice(0, 58)}`)
  }

  console.log('\nMUST PASS — an honest answer flagged here is the worse failure')
  console.log('='.repeat(78))
  for (const [text, why] of MUST_PASS) {
    const hits = scanDisclosure(text)
    const ok = hits.length === 0
    if (!ok) falsePositives++
    console.log(`  ${ok ? 'passed ' : 'BLOCKED'}  ${why.padEnd(34)} ${text.slice(0, 52)}`)
  }

  console.log(`\n${MUST_FLAG.length - holes}/${MUST_FLAG.length} leaks caught, ${holes} escaped`)
  console.log(`${MUST_PASS.length - falsePositives}/${MUST_PASS.length} honest answers passed, ${falsePositives} wrongly blocked`)
  if (holes > 0 || falsePositives > 0) process.exitCode = 1
}

main()
