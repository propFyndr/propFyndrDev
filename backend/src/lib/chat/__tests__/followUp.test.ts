import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { asksAboutFocusAttribute, mentionsFocusPronoun, focusFallback } from '../followUp'

describe('follow-up about the project in focus', () => {
  for (const q of [
    'What payment plans do they offer?',
    'Show me the cost sheet. What are the extra charges?',
    'How far is the nearest metro station?',
    'What amenities are there?',
    'What sizes are the flats and what do they cost?',
    'Has the price gone up over time?',
    'Is it RERA registered?',
    'When is possession, and how far along is construction?',
    "What is the builder's track record?",
    'What are the specifications, like flooring and fittings?',
    'Which similar projects should I compare it with?',
    'What is the total cost of the cheapest flat including stamp duty and registration?',
    'What would the EMI be on that with an 80% loan?',
  ]) {
    it(`keeps the focus: "${q}"`, () => assert.equal(asksAboutFocusAttribute(q), true))
  }

  for (const q of [
    'Show me amenities in Sector 150 projects',
    'projects by ATS with a clubhouse',
    'payment plans for projects in Greater Noida West',
  ]) {
    it(`a new subject is a new search: "${q}"`, () => assert.equal(asksAboutFocusAttribute(q), false))
  }

  it('knows "they" and "their" point at the project', () => {
    assert.equal(mentionsFocusPronoun('what do they charge for parking'), true)
    assert.equal(mentionsFocusPronoun('is the market good now'), false)
  })
})

describe('focus fallback', () => {
  const catalog = [{ id: 'ats', name: 'ATS Pious Hideaways' }, { id: 'ace', name: 'ACE Parkway' }]
  it('prefers the saved focus over the first card of a list', () => {
    assert.deepEqual(focusFallback('ats', catalog, [{ id: 'ace', name: 'ACE Parkway' }, { id: 'x', name: 'X' }]), { id: 'ats', name: 'ATS Pious Hideaways' })
  })
  it('a list is never a focus; one card is', () => {
    assert.equal(focusFallback(null, catalog, [{ id: 'ace', name: 'ACE Parkway' }, { id: 'x', name: 'X' }]), null)
    assert.deepEqual(focusFallback(null, catalog, [{ id: 'ace', name: 'ACE Parkway' }]), { id: 'ace', name: 'ACE Parkway' })
  })
})
