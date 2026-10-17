import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { asksBudgetPlan, extraDownPayment } from '../affordability'

// Live session ed1ac3ff, 17 Oct 2026: each of these reached the model, which did
// the arithmetic, was rejected by the integrity check, and ended on the outage notice.
describe('budget planning is answered in code', () => {
  it('claims the turns the buyer actually typed', () => {
    for (const q of [
      'Help me work out a realistic budget and EMI.',
      'so how much should be my monthly salary in order to match this EMI',
      'nice and now If I secure another 20 lakhs from personal savings',
      'what income do i need, how much should my salary be',
    ]) assert.ok(asksBudgetPlan(q), q)
  })

  it('leaves searches and unrelated money talk alone', () => {
    for (const q of ['show me 3bhk under 1.2 cr', 'what is the stamp duty in noida', 'is noida good for investment'])
      assert.ok(!asksBudgetPlan(q), q)
  })

  it('reads the extra down payment', () => {
    assert.equal(extraDownPayment('If I secure another 20 lakhs from personal savings'), 20_00_000)
    assert.equal(extraDownPayment('add an extra 0.5 cr'), 50_00_000)
    assert.equal(extraDownPayment('budget 1.2 cr'), null)
  })
})
