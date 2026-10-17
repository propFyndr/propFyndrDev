import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesInvestmentScenario, ratesIn, yearsIn, priceIn, scenarioAnswer, matchesPriceMultiple, priceMultipleAnswer } from '../investmentScenario'

describe('investment scenario', () => {
  const q = 'What if prices grow by 5%, 8% or 12% annually? Show me what my investment could be worth after ten years.'

  it('claims a growth question that carries rates and a horizon', () => {
    assert.ok(matchesInvestmentScenario(q))
    assert.deepEqual(ratesIn(q), [5, 8, 12])
    assert.equal(yearsIn(q), 10)
  })

  it('leaves loans, rent and rate-free questions alone', () => {
    assert.ok(!matchesInvestmentScenario('emi at 8.5% for 20 years'))
    assert.ok(!matchesInvestmentScenario('what rental yield at 3% after 10 years'))
    assert.ok(!matchesInvestmentScenario('will prices grow in Sector 150 over the next 10 years'))
  })

  it('reads the price from the stated amount', () => {
    assert.equal(priceIn('I have ₹1.5 crore to invest'), 15_000_000)
    assert.equal(priceIn('over 10 years at 5%'), null)
  })

  it('compounds the buyer rates and counts entry cost, never adding a rate of its own', () => {
    const t = scenarioAnswer(15_000_000, [8], 10, false)
    const value = 15_000_000 * Math.pow(1.08, 10)
    assert.ok(t.includes(`₹${(value / 10_000_000).toFixed(2)} Cr`))
    assert.ok(t.includes('₹12,00,000'), '7% stamp duty + 1% registration on 1.5 Cr')
    assert.match(t, /arithmetic, not a forecast/)
    assert.match(t, /Not included:/)
    assert.deepEqual([...t.matchAll(/\| (\d+)% \|/g)].map(m => m[1]), ['8'])
  })
})

describe('price doubling', () => {
  const g7 = 'Will property prices in Noida double in 5 years? Give me a number.'

  it('answers with the rate a doubling needs and no forecast', () => {
    assert.ok(matchesPriceMultiple(g7))
    const t = priceMultipleAnswer(g7)
    assert.match(t, /14\.9% every year/)
    assert.match(t, /no verified Noida-wide price series/)
  })

  it('reads triple', () => {
    assert.match(priceMultipleAnswer('can my flat value triple in 10 years'), /11\.6% every year/)
  })

  it('leaves rate-carrying and horizon-free questions alone', () => {
    assert.ok(!matchesPriceMultiple('at 8% will my 1 cr double in 10 years'))
    assert.ok(!matchesPriceMultiple('will prices double'))
    assert.ok(!matchesPriceMultiple('Will my property value grow over the next 10 years?'))
  })
})
