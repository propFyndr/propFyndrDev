import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  statedMonthlyIncome, incomeInConversation, isAffordabilityQuestion, computeAffordability, renderAffordabilityTable,
} from './affordability'

describe('affordability — the arithmetic the model got wrong', () => {
  it('never quotes an EMI larger than the income', () => {
    // The bug: "₹80,000 and ₹1,000,000 per month" on a ₹2 lakh income. Ten
    // lakh of EMI on two lakh of salary. A slipped digit crossing between
    // lakh notation and plain numerals, on a figure a buyer would act on.
    for (const income of [80_000, 1_50_000, 2_00_000, 5_00_000]) {
      const a = computeAffordability(income)
      assert.ok(a.emiStretched < income, `EMI ${a.emiStretched} >= income ${income}`)
      assert.ok(a.emiConservative < a.emiStretched)
    }
  })

  it('sizes a ₹2 lakh income the way a bank would', () => {
    const a = computeAffordability(2_00_000)
    assert.equal(a.emiConservative, 80_000)   // 40% FOIR
    assert.equal(a.emiStretched, 1_00_000)    // 50% FOIR
    // At 8.75% over 20 years, ~₹0.9 Cr of loan and ~₹1.1 Cr of property.
    assert.ok(a.loanConservativeCr > 0.8 && a.loanConservativeCr < 1.0, `${a.loanConservativeCr}`)
    assert.ok(a.priceConservativeCr > 1.0 && a.priceConservativeCr < 1.3, `${a.priceConservativeCr}`)
    assert.ok(a.priceStretchedCr > a.priceConservativeCr)
  })

  it('reads an income however the buyer writes it', () => {
    assert.equal(statedMonthlyIncome('I earn 2 lakh a month'), 2_00_000)
    assert.equal(statedMonthlyIncome('I earn 1.5 lakh per month'), 1_50_000)
    assert.equal(statedMonthlyIncome('my salary is 250000'), 2_50_000)
    assert.equal(statedMonthlyIncome('I make 80000 a month'), 80_000)
  })

  it('does not invent an income that was never stated', () => {
    // Without a number this must stay on the ordinary path so it can ask.
    assert.equal(statedMonthlyIncome('what can I afford in Noida?'), null)
    assert.equal(statedMonthlyIncome('show me 3 BHK under 2 crore'), null)
    // 2 crore is a budget, not a monthly salary.
    assert.equal(statedMonthlyIncome('my budget is 2 crore'), null)
  })

  it('recognises the question only when it is one', () => {
    assert.equal(isAffordabilityQuestion('what can I afford in Noida?'), true)
    assert.equal(isAffordabilityQuestion('how much can I borrow'), true)
    assert.equal(isAffordabilityQuestion('does it have a gym'), false)
    assert.equal(isAffordabilityQuestion('How much home loan can I get?'), true)
  })

  it('carries the income stated on an earlier turn', () => {
    const history = [{ role: 'user', content: 'My salary is 1.8 lakh a month. How much home loan can I get?' }, { role: 'assistant', content: 'About 2 lakh EMI' }]
    assert.equal(incomeInConversation('Ok so what can I actually afford then, roughly?', history), 180000)
    assert.equal(incomeInConversation('does it have a gym', history), null)
  })

  it('renders every figure in Indian notation', () => {
    const t = renderAffordabilityTable(computeAffordability(2_00_000))
    assert.match(t, /Monthly EMI/)
    assert.match(t, /₹80,000/)
    assert.match(t, /Down payment needed/)
    // The failure shape: a raw seven-digit rupee figure.
    assert.ok(!/₹\d{7,}/.test(t), t)
  })
})
