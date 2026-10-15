import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesResaleDealQuestion, parseResaleAmounts, resaleCostAnswer } from '../resaleDeal'
import { isResaleInquiry } from '../../../advisory/marketAdvisory'

describe('resale deal', () => {
  it('claims checking and arithmetic questions about a resale flat', () => {
    for (const q of [
      'What documents and outstanding charges should I check for the resale flat?',
      'The seller has now reduced the price to ₹1.58 crore, but the flat needs renovation. Recalculate the total cost',
      'checklist before I pay token for a second hand flat',
    ]) assert.ok(matchesResaleDealQuestion(q), q)
  })

  it('leaves listings requests, new-launch questions and unregistered-title questions alone', () => {
    assert.ok(!matchesResaleDealQuestion('show me resale flats in sector 77'))
    assert.ok(isResaleInquiry('show me resale flats in sector 77'), 'still reaches the scope reply')
    assert.ok(!matchesResaleDealQuestion('documents to check for a new launch in sector 150'))
    assert.ok(!matchesResaleDealQuestion('resale flat seller ke paas registry nahi hai, should i pay'))
  })

  it('keeps a renovation estimate apart from a second price', () => {
    assert.deepEqual(parseResaleAmounts('asking 1.65 cr, dropped to 1.58 cr, needs renovation'), { prices: [16_500_000, 15_800_000], renovation: null })
    assert.deepEqual(parseResaleAmounts('resale at 1.58 cr, renovation 8 lakh'), { prices: [15_800_000], renovation: 800_000 })
  })

  it('computes statutory costs from the stated price and never invents the unstated', () => {
    const t = resaleCostAnswer([15_800_000], 800_000)
    assert.ok(t.includes('₹11,06,000'), 'stamp duty 7% of 1.58 Cr')
    assert.ok(t.includes('₹1,58,000'), 'registration 1%')
    assert.ok(t.includes('₹1,78,64,000'), 'price + duty + registration + renovation')
    assert.match(t, /I can't say/)
    assert.doesNotMatch(resaleCostAnswer([15_800_000], null), /₹0\b/)
    assert.match(resaleCostAnswer([15_800_000], null), /did not give an estimate/)
  })
})
