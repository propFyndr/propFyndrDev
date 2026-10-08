import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isRentalQuestion } from '../rentalAnswer'

// isRentalQuestion runs before every other lane in chat-router, so a false
// positive steals the turn from the lane that should answer it.

describe('isRentalQuestion', () => {
  const ASKS_FOR_RENT = [
    'what is the rent for a 2bhk in sector 150',
    'monthly rent in sector 76',
    'flats for rent in noida',
    'kiraya kitna hai',
    'can I rent a 3bhk near sector 62 metro?',
    'I want to rent a 2BHK in Noida for 25k a month',
  ]
  for (const q of ASKS_FOR_RENT) {
    it(`matches: ${q}`, () => assert.equal(isRentalQuestion(q), true))
  }

  const RENT_AS_CONTEXT = [
    'we currently rent in Indirapuram, want to buy 3bhk under 1.5 cr',
    "I'll rent it out",
    "rent it for ₹45k, what's my ROI",
    'what is the rental income on a 2bhk in sector 150',
    'rental potential of sector 150',
    'rental return on a 1.2 cr flat',
    'rental yield on a 3bhk in sector 76',
    'should I keep renting or buy',
    'rent vs buy',
    'costs ₹1.6 Cr and rents for ₹40k, what is the yield',
    "I'm renting in sector 62 now, what can 1 cr get me",
    'show me 3bhk under 1.5 cr',
  ]
  for (const q of RENT_AS_CONTEXT) {
    it(`does not match: ${q}`, () => assert.equal(isRentalQuestion(q), false))
  }
})
