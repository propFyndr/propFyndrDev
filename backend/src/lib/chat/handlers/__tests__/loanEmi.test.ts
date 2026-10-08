import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseLoanEmiQuestion, loanEmiAnswer } from '../loanEmi'
import { calculateEmi } from '../affordabilityHandler'

describe('loan EMI', () => {
  it('reads a stated loan, rate and tenure', () => {
    assert.deepEqual(parseLoanEmiQuestion('I can get a 90 lakh loan, what EMI would that be at 8.5% for 20 years?'),
      { principal: 9_000_000, rate: 8.5, tenure: 20 })
    assert.deepEqual(parseLoanEmiQuestion('emi on loan of 1.2 cr'), { principal: 12_000_000, rate: null, tenure: null })
  })

  it('leaves budgets and non-EMI questions alone', () => {
    assert.equal(parseLoanEmiQuestion('3bhk under 1.5 cr, what emi?'), null)
    assert.equal(parseLoanEmiQuestion('90 lakh loan possible?'), null)
  })

  it('computes with calculateEmi and names every assumption', () => {
    const text = loanEmiAnswer({ principal: 9_000_000, rate: null, tenure: null })
    assert.ok(text.includes(`₹${calculateEmi(9_000_000, 8.5, 20).toLocaleString('en-IN')} a month`))
    assert.match(text, /I assumed 8\.5% interest/)
    assert.match(text, /20-year tenure/)
    assert.doesNotMatch(loanEmiAnswer({ principal: 9_000_000, rate: 9, tenure: 15 }), /I assumed/)
  })
})
