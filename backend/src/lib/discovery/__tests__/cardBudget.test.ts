import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cardBudgetFor } from '../cardBudget'

describe('a question about the conversation', () => {
  it('earns no cards even when the buyer has narrowed a lot', () => {
    // Measured: "what did I ask you first?" was answered correctly and then
    // had six project cards rendered under it, because by that point two
    // constraints were on the intent and the budget only read the intent.
    const narrowed = { sector: 'Sector 79', bhk: [3], budgetMax: 2 } as never
    assert.equal(cardBudgetFor(narrowed, 'what did I ask you first?').limit, 0)
    assert.equal(cardBudgetFor(narrowed, 'what have I told you so far?').limit, 0)
    assert.equal(cardBudgetFor(narrowed, 'what was my first budget again?').limit, 0)
    // An ordinary inventory turn is untouched.
    assert.equal(cardBudgetFor(narrowed, 'show me 3bhk in sector 79').limit, 6)
  })
})

describe('a question whose answer is not a set of buildings', () => {
  // Every string below is from a real production run, and every one of them
  // rendered project cards under an answer that was not about inventory.
  const narrowed = { sector: 'Sector 150', bhk: [3], budgetMax: 2 } as never

  it('shows no cards for a calculation', () => {
    for (const q of [
      'how much would the EMI be',
      'what is the stamp duty on 1.5 cr',
      'is GST applicable',
      'what down payment do I need',
      'what loan tenure can I get',
    ]) {
      assert.equal(cardBudgetFor(narrowed, q).limit, 0, q)
    }
  })

  it('shows no cards when the buyer is arranging a next step', () => {
    for (const q of [
      'i want to visit this weekend',
      'can someone call me',
      'book a site visit',
      'what documents are needed',
    ]) {
      assert.equal(cardBudgetFor(narrowed, q).limit, 0, q)
    }
  })

  it('does not eat an inventory ask that merely mentions money', () => {
    // The failure mode of a wide rule: affordability and price questions are
    // genuinely answered with a shortlist, and must keep their cards.
    for (const q of [
      'what can i afford with 1.5 cr',
      'show me the cheapest 3bhk in sector 150',
      'which projects are under 2 crore',
      'best value for money projects here',
    ]) {
      assert.equal(cardBudgetFor(narrowed, q).limit, 6, q)
    }
  })
})
