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

  // Day 1 (cycle 2): "Delivered" with no certificate behind it, and "no litigation" with no record.
  it('drops a delivered claim when the facts hold no occupancy certificate', () => {
    const out = dropUnsourcedJudgements('Mezzaria is in Sector 78. The project has been delivered and handed over to buyers. Metro is 2.1 km away.', FACTS)
    assert.equal(out.dropped.length, 1, JSON.stringify(out.dropped))
    assert.match(out.text, /Sector 78/)
  })

  it('keeps a delivered claim when the facts carry a granted certificate', () => {
    const facts = 'Mahagun Mezzaria. Possession status: Delivered. oc_status: FULL_OC.'
    const out = dropUnsourcedJudgements('The project has been delivered.', facts)
    assert.equal(out.dropped.length, 0)
  })

  for (const sentence of [
    'There is no litigation against the project.',
    'It has no pending court cases.',
    'The project is litigation-free.',
    'There are no legal disputes on record.',
  ]) {
    it(`drops "${sentence}" when no litigation record was supplied`, () => {
      const out = dropUnsourcedJudgements(`Mezzaria is in Sector 78. ${sentence}`, FACTS)
      assert.equal(out.dropped.length, 1, JSON.stringify(out.dropped))
    })
  }

  it('keeps a no-litigation line when the facts carry a zero litigation count', () => {
    const out = dropUnsourcedJudgements('There is no litigation against the project.', `${FACTS} ongoing_litigation_count: 0.`)
    assert.equal(out.dropped.length, 0)
  })

  // The facts reach the guard as the system prompt, where project rows are JSON (prompts/blocks.ts).
  it('reads evidence in the JSON shape the prompt carries', () => {
    assert.equal(dropUnsourcedJudgements('There is no litigation against the project.', '{"name":"X","litigation_count":0}').dropped.length, 0)
    assert.equal(dropUnsourcedJudgements('The project has been delivered.', '{"name":"X","oc_status":"FULL_OC"}').dropped.length, 0)
    assert.equal(dropUnsourcedJudgements('The project has been delivered.', "occupancy_certificate_status: 'Obtained'").dropped.length, 0)
    assert.equal(dropUnsourcedJudgements('The project has been delivered.', '{"oc_obtained":true}').dropped.length, 0)
    // A ready-to-move status is not a certificate.
    assert.equal(dropUnsourcedJudgements('The project has been delivered.', '{"status":"ready_to_move","oc_status":null}').dropped.length, 1)
    assert.equal(dropUnsourcedJudgements('There is no litigation against the project.', '{"litigation_count":null}').dropped.length, 1)
  })

  it('keeps an honest gap that mentions litigation', () => {
    assert.equal(dropUnsourcedJudgements('We hold no litigation record for this project.', FACTS).dropped.length, 0)
    assert.equal(dropUnsourcedJudgements('There is no record of court cases, which is not the same as none.', FACTS).dropped.length, 0)
  })

  it('keeps "not on record" wording about litigation', () => {
    const out = dropUnsourcedJudgements('Litigation: not on record.', FACTS)
    assert.equal(out.dropped.length, 0)
  })

  it('keeps the wording when our own facts carry it', () => {
    const facts = `${FACTS} Registry note: clean legal standing as recorded by the authority.`
    const out = dropUnsourcedJudgements('It has a clean legal standing.', facts)
    assert.equal(out.dropped.length, 0)
  })
})
