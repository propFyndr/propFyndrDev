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

describe("a monthly budget beside a flat is a rental ask (live, 27 Oct 2026)", () => {
  for (const q of [
    "look for a 2 bhk in noida under 30k",
    "I'm relocating at Sector 10 Gr. Noida, find me some spacious 2BHK under 30k.",
    "1bhk flat within 18,000 in sector 62",
  ]) it(`matches: ${q}`, () => assert.equal(isRentalQuestion(q), true))

  for (const q of [
    "3bhk under 1.5 cr in sector 150",
    "2bhk under 90 lakh",
    "flat at 9,500 per sq ft is that fair",
    "my salary is 80k, which 2bhk can I afford",
    "emi of 45k on a 2bhk",
  ]) it(`does not match: ${q}`, () => assert.equal(isRentalQuestion(q), false))
})
