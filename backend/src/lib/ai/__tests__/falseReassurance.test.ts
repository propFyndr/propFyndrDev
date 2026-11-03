// "Is Mahagun Mezzaria the safer buy?" (hard-43 Q5) and the two-sector comparison (Q11), 31 Oct 2026.
// The model wrote verdicts our rows cannot support. Prompt rules did not stop it, so the sentence
// is dropped in code unless the facts we supplied carry the same words.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dropUnsourcedJudgements } from '../projectFactChecks'

const FACTS = 'Mahagun Mezzaria. RERA validity: 28 Sep 2021. Possession status: Ready to move. Occupancy certificate: not on record.'

describe('false reassurance is dropped, not softened', () => {
  const cases: Array<[string, string]> = [
    ['objectively', 'Objectively, Mezzaria is the safer buy for a first-time buyer.'],
    ['zero-delay', 'The builder has a zero-delay track record.'],
    ['clean legal standing', 'It also has a clean legal standing.'],
    ['unblemished', 'The promoter has an unblemished insolvency record.'],
    ['risk-free', 'This is a risk-free purchase.'],
    ['superior choice', 'Sector 150 emerges as the superior choice for forward-looking capital deployment.'],
  ]
  for (const [name, sentence] of cases) {
    it(`drops "${name}"`, () => {
      const out = dropUnsourcedJudgements(`Mezzaria is in Sector 78. ${sentence} Metro is 2.1 km away.`, FACTS)
      assert.equal(out.dropped.length, 1, `expected the one sentence to be dropped, got ${JSON.stringify(out.dropped)}`)
      assert.match(out.text, /Sector 78/)
      assert.match(out.text, /2\.1 km/)
    })
  }

  it('drops an occupancy-certificate row that reads Delivered or Ready without a certificate', () => {
    const table = [
      '| Item | Mezzaria |',
      '| --- | --- |',
      '| Occupancy certificate | Delivered & Ready (OC status to be verified) |',
      '| RERA validity | 28 Sep 2021 |',
    ].join('\n')
    const out = dropUnsourcedJudgements(table, FACTS)
    assert.equal(out.dropped.length, 1)
    assert.doesNotMatch(out.text, /Occupancy certificate/i)
    assert.match(out.text, /RERA validity/)
  })

  it('keeps an occupancy row that states a received certificate', () => {
    const row = '| Occupancy certificate | Received 12 Mar 2024 |'
    const out = dropUnsourcedJudgements(row, FACTS)
    assert.equal(out.dropped.length, 0)
  })

  it('keeps an occupancy row that says it is not on record', () => {
    const out = dropUnsourcedJudgements('| Occupancy certificate | Not on record |', FACTS)
    assert.equal(out.dropped.length, 0)
  })

  it('keeps the wording when our own facts carry it', () => {
    const facts = `${FACTS} Registry note: clean legal standing as recorded by the authority.`
    const out = dropUnsourcedJudgements('It has a clean legal standing.', facts)
    assert.equal(out.dropped.length, 0)
  })
})
