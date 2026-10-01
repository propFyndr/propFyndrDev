import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_IN_BUDGET, statutoryMultiplier } from '../commuteShortlist'

describe('all-in budget on the commute shortlist', () => {
  it('recognises how buyers say all-in', () => {
    for (const q of ['1.5 cr all inclusive', '1.5cr all-in', 'budget 1.2 cr including stamp duty', '1.4 cr sab milake']) {
      assert.ok(ALL_IN_BUDGET.test(q), q)
    }
    assert.ok(!ALL_IN_BUDGET.test('budget 1.5 cr, 3bhk'))
  })

  it('deducts stamp duty and registration, plus GST only when under construction', () => {
    assert.equal(statutoryMultiplier('ready_to_move'), 1.08)
    assert.equal(statutoryMultiplier('under_construction'), 1.13)
  })
})
