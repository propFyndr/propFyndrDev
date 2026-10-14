import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderAppreciationScenarios, horizonsFrom, inrCr, yearsToRecover, SCENARIO_RATES_PCT } from '../scenarioTable'
import { UP_STATUTORY } from '../../factPresentation'

describe('appreciation scenarios', () => {
  const t = renderAppreciationScenarios({ amountCr: 2, source: 'budget', years: [5, 10] })

  it('is plain compound arithmetic on the buyer amount', () => {
    // 2 Cr at 6% for 10 years = 3.58 Cr; at 10% = 5.19 Cr; flat stays 2 Cr.
    assert.match(t, /\| 6% a year \| ₹2\.68 crore \| ₹3\.58 crore \|/)
    assert.match(t, /\| 10% a year \| ₹3\.22 crore \| ₹5\.19 crore \|/)
    assert.match(t, /\| 0% a year \(flat\) \| ₹2 crore \| ₹2 crore \|/)
    assert.equal(SCENARIO_RATES_PCT.length, 5)
  })

  it('opens with the statutory cost of buying, from UP_STATUTORY', () => {
    const pct = UP_STATUTORY.stampDutyPct + UP_STATUTORY.registrationPct
    assert.match(t, new RegExp(`cost ₹16 lakh on ₹2 crore`))
    assert.match(t, new RegExp(`has to rise ${pct}% just to get that back`))
    assert.match(t, /never if prices stay flat/)
    assert.match(t, new RegExp(`${UP_STATUTORY.stampDutyFemalePct + UP_STATUTORY.registrationPct}% in total if a woman`))
  })

  it('says it is not a forecast, and never uses the phrasing the guardrail blocks', () => {
    assert.match(t, /arithmetic, not a forecast/)
    assert.doesNotMatch(t, /\b\d{1,3}%?\s*(?:annual\s+|yearly\s+)?(?:returns?|cagr|roi|appreciation)\b/i)
  })

  it('names its basis: budget, project price, or per ₹1 crore', () => {
    assert.match(t, /your stated budget of ₹2 crore/)
    assert.match(
      renderAppreciationScenarios({ amountCr: 1.45, source: 'project', projectName: 'ACE Parkway' }),
      /the price we hold for ACE Parkway, ₹1\.45 crore/,
    )
    assert.match(renderAppreciationScenarios({ amountCr: 1, source: 'unit' }), /every ₹1 crore you put in/)
  })

  it('renders nothing for a missing amount', () => {
    assert.equal(renderAppreciationScenarios({ amountCr: 0, source: 'budget' }), '')
  })
})

describe('helpers', () => {
  it('reads the horizon the buyer asked for', () => {
    assert.deepEqual(horizonsFrom('appreciation in around 10 years projected'), [5, 10])
    assert.deepEqual(horizonsFrom('what about 15 yrs'), [5, 15])
    assert.deepEqual(horizonsFrom('in 3 years'), [3])
    assert.deepEqual(horizonsFrom('best sector to invest'), [5, 10])
  })
  it('formats lakh and crore', () => {
    assert.equal(inrCr(0.16), '₹16 lakh')
    assert.equal(inrCr(3.5795), '₹3.58 crore')
    assert.equal(inrCr(10), '₹10 crore')
  })
  it('years to recover buying costs', () => {
    assert.equal(yearsToRecover(0.08, 0), null)
    assert.ok(Math.abs((yearsToRecover(0.08, 4) as number) - 1.96) < 0.01)
  })
})

describe('asksAppreciation recognises the common wording', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { asksAppreciation } = require('../yieldTable') as typeof import('../yieldTable')
  it('matches appreciation questions it used to miss', () => {
    for (const q of [
      'price appreciation in Sector 150',
      'which is the best sector to put the money in noida? good appreciation in around 10 years',
      'how much appreciation can I expect',
      'will it appreciate',
      'capital gains on a flat in noida',
      'best sector to invest in noida',
    ]) assert.equal(asksAppreciation(q), true, q)
  })
  it('still ignores plain searches', () => {
    for (const q of ['3bhk in sector 150 under 2 crore', 'best sector for families', 'ready to move flats']) {
      assert.equal(asksAppreciation(q), false, q)
    }
  })
})
