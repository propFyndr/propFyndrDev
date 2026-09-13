import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isReraProcessQuestion, isPaymentPlanRequest, isReraGuaranteeQuestion } from '../topicFlags'

describe('rera process question', () => {
  it('catches the phrasing that was misrouted to the builder scorecard', () => {
    // Answered with six builders and their delivery scores. The buyer asked how
    // verification works, not who is safest.
    assert.equal(isReraProcessQuestion('How do I verify whether a Noida property project is RERA compliant?'), true)
  })

  for (const q of [
    'how do I check RERA for a project',
    'is Godrej Woods RERA registered',
    'what is the RERA status of this project',
    'is this builder blacklisted or under NCLT',
  ]) {
    it(`still catches: ${q}`, () => assert.equal(isReraProcessQuestion(q), true))
  }

  for (const q of [
    'which builders in Noida have the best on-time delivery record',
    'best builder in noida for apartments',
    'compare Sector 75 and Sector 150',
  ]) {
    it(`leaves alone: ${q}`, () => assert.equal(isReraProcessQuestion(q), false))
  }
})

describe('rera guarantee question', () => {
  // "Does a UP RERA registration guarantee on-time delivery?" is among the most
  // asked diligence questions in Noida. It matched no playbook, and `on-time
  // delivery` sits in the builder reputation regex — so it was answered with a
  // league table of six developers, none of it addressing the question.
  for (const q of [
    'Does a UP RERA registration guarantee on-time delivery?',
    'Does a registered UP RERA number guarantee that a project will not face construction delays?',
    'will RERA prevent possession delays',
    'is delivery guaranteed if the project is RERA registered',
  ]) {
    it(`routes to the RERA answer: ${q.slice(0, 46)}`, () => {
      assert.equal(isReraGuaranteeQuestion(q), true)
      // It must also clear the process flag, because that is what excludes the
      // builder scorecard from claiming the turn first.
      assert.equal(isReraProcessQuestion(q), true)
    })
  }

  for (const q of [
    'which builders in Noida have the best on-time delivery record',
    'how do I check RERA for a project',
    'when is possession for Ace Divino',
  ]) {
    it(`leaves alone: ${q}`, () => assert.equal(isReraGuaranteeQuestion(q), false))
  }
})

describe('payment plan request', () => {
  it('does not fire on money the buyer holds', () => {
    // Answered with the three standard CLP/DP/Flexi structures and "which
    // project would you like?" — it never touched income, EMI or budget.
    assert.equal(
      isPaymentPlanRequest('I earn ₹1.5 lakh per month and have ₹25 lakh available for a down payment. What type of property should I realistically consider in Noida?'),
      false,
    )
  })

  for (const q of [
    'Show payment plans for Nirala Diadem',
    'what is the payment plan',
    'what payment schedules are available',
    'do they offer a construction linked plan',
    'is there a down payment plan',
    'show me down payment options',
    'CLP or PLP for this project',
    'flexi plan available?',
  ]) {
    it(`still catches: ${q}`, () => assert.equal(isPaymentPlanRequest(q), true))
  }

  for (const q of [
    'how much stamp duty do I pay in UP',
    'what is the total cost of this flat',
    'I have 25 lakh for the down payment, what can I afford',
  ]) {
    it(`leaves alone: ${q}`, () => assert.equal(isPaymentPlanRequest(q), false))
  }
})
