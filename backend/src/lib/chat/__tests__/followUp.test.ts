import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { asksAboutFocusAttribute, mentionsFocusPronoun, focusFallback, asksMarketWide } from '../followUp'

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

  it('a market-wide question carries no search; one that states its own does', () => {
    assert.equal(asksMarketWide('Will property prices in Noida double in 5 years? Give me a number.'), true)
    assert.equal(asksMarketWide('What is the average price per sq ft in Noida?'), true)
    assert.equal(asksMarketWide('3bhk in Noida under 1.5 cr, what are prices like?'), false)
    assert.equal(asksMarketWide('Show me flats in Noida with good appreciation'), false)
    assert.equal(asksMarketWide('Is the price fair?'), false)
  })
})

import { expandAffirmation } from "../followUp"
describe("okay to our own either/or prompt takes its first option (live, 27 Oct 2026)", () => {
  it("expands to the first option instead of repeating the question", () => {
    const history = [{ role: "assistant", content: "None of the projects we hold match 2 BHK in Sector 10. I can search all of Noida instead of Sector 10, or look at 1 BHK: which would you like?" }]
    const out = expandAffirmation("Okay", history)
    assert.match(out, /search all of Noida instead of Sector 10/)
    assert.ok(!/1 BHK/.test(out), out)
  })
})
