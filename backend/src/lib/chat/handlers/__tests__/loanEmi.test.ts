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

  it('reads a loan stated as a share of the flat price, without taking the share as the rate', () => {
    assert.deepEqual(
      parseLoanEmiQuestion('If I take an 80% loan on a 1.5 crore flat, what is my EMI and how much cash do I need up front?'),
      { principal: 12_000_000, rate: null, tenure: null, price: 15_000_000 })
    assert.deepEqual(parseLoanEmiQuestion('75% home loan on ₹90 lakh flat at 8.75% for 25 years, emi?'),
      { principal: 6_750_000, rate: 8.75, tenure: 25, price: 9_000_000 })
    assert.deepEqual(parseLoanEmiQuestion('1.5 crore ke flat pe 80% loan liya to EMI kitni banegi?'),
      { principal: 12_000_000, rate: null, tenure: null, price: 15_000_000 })
  })

  it('states the cash needed up front from statutory rates when the price is known', () => {
    const text = loanEmiAnswer({ principal: 12_000_000, rate: null, tenure: null, price: 15_000_000 })
    assert.match(text, /Down payment \(20%\) \| ₹30,00,000/)
    assert.match(text, /Stamp duty \(7%\) \| ₹10,50,000/)
    assert.match(text, /Registration \(1%\) \| ₹1,50,000/)
    assert.match(text, /\*\*Cash up front, ready to move\*\* \| \*\*₹42,00,000\*\*/)
    assert.match(text, /under construction.*₹7,50,000/i)
    assert.doesNotMatch(loanEmiAnswer({ principal: 9_000_000, rate: null, tenure: null }), /Cash up front/)
  })
})
