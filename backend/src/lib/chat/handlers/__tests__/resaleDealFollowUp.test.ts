import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dealFromConversation, isDealFollowUp } from '../resaleDeal'

describe('resale deal across turns', () => {
  const prior = ['I found a resale flat for ₹1.65 crore in Sector 77. Is it better than a new one?', 'The flat needs renovation, roughly 8 lakh']

  it('carries the price and renovation forward when this turn gives neither', () => {
    assert.deepEqual(dealFromConversation(prior, 'recalculate the total'), { prices: [16_500_000], renovation: 800_000 })
  })

  it('lets this turn price win and keeps the earlier renovation', () => {
    assert.deepEqual(dealFromConversation(prior, 'the seller dropped it to 1.58 crore'), { prices: [15_800_000], renovation: 800_000 })
  })

  it('treats a revision with no resale word as a follow-up only while a resale deal is on the table', () => {
    assert.ok(isDealFollowUp(prior, 'it now needs 10 lakh of renovation'))
    assert.ok(!isDealFollowUp(['3bhk under 1.5 cr'], 'it now needs 10 lakh of renovation'))
    assert.ok(!isDealFollowUp(prior, 'what is the total cost of Gulshan Botnia'))
  })
})
