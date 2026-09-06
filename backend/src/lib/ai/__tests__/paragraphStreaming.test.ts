/**
 * Paragraph-level release keeps the gate and gives back the streaming.
 *
 * The property that matters is not "text arrives sooner" - it is that the two
 * halves of the trade are both real: a violation found BEFORE anything has
 * left still rolls the turn to another leg with nothing delivered, and one
 * found AFTER stops the answer where it stands rather than letting the rest
 * through.
 *
 * These exercise `checkAnswerIntegritySync` directly, because that is the
 * decision the release depends on and the one whose third state - null, "I
 * could not check" - is easy to collapse into "clean" by accident.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkAnswerIntegritySync, scanDisclosure } from '../answerIntegrity'

const PROMPT = 'You are RealtyPal.\n\nVERIFIED FACTS\nProject: ATS Pious Hideaways\nBuilder: ATS Infrastructure\n'

describe('the synchronous gate', () => {
  // These run with a cold known-name cache, which is the state the first turn
  // after every restart is in - and the state where collapsing "cannot judge"
  // into "clean" would do real damage.

  it('catches a disclosure violation with no reference set at all', () => {
    // The disclosure half needs no database, so a cold cache must not excuse
    // it. This is the answer that was measured in production, to "hi".
    const leak = checkAnswerIntegritySync(
      'We currently maintain verified data on 280 projects across 61 sectors.',
      PROMPT,
    )
    assert.notEqual(leak, null, 'a disclosure violation must be reported even on a cold cache')
    assert.ok((leak ?? []).length > 0)
  })

  it('reports "cannot judge" rather than "clean" when it cannot check names', () => {
    // An ordinary, honest paragraph. The fabrication half could not run, so the
    // only correct answer is null - returning [] here would stream an invented
    // project name to the buyer on the first turn after a restart.
    const verdict = checkAnswerIntegritySync(
      'ATS Pious Hideaways is in Sector 150 and possession is scheduled for June 2026.',
      PROMPT,
    )
    assert.equal(verdict, null)
  })

  it('treats empty text as nothing to judge, not as unjudgeable', () => {
    assert.deepEqual(checkAnswerIntegritySync('   ', PROMPT), [])
  })
})

describe('a violation is contained in one paragraph', () => {
  // The premise of releasing by paragraph: every class measured in production
  // fits inside one, so gating each finished paragraph catches what gating the
  // whole answer caught.
  const CASES: Array<[string, string]> = [
    ['inventory size', 'We currently maintain verified data on 280 projects across 61 sectors.'],
    ['meta leak', 'The provided verified facts block only contains information for a single project.'],
    ['opaque score', 'The builder holds a 92% delivery score across its portfolio.'],
    ['raw payload', '{ "id": "88319d1f-5049-410e-9c2a-2913c1f373b3", "name": "X", "sector": "Y", "price_min_cr": 1.85 }'],
  ]

  for (const [label, paragraph] of CASES) {
    it(`catches ${label} in a single paragraph`, () => {
      assert.ok(scanDisclosure(paragraph).length > 0, label)
    })
  }

  it('does not fire on an honest paragraph carrying figures', () => {
    assert.deepEqual(
      scanDisclosure('The project spans 18 acres with 82% open green space. GST is 5% and stamp duty 7%.'),
      [],
    )
  })
})
