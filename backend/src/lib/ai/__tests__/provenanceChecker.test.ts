import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { verifyPriceProvenance } from '../provenanceChecker'

describe('verifyPriceProvenance', () => {
  it('allows prices that are grounded in the prompt facts', () => {
    const prompt = `VERIFIED_FACTS_BLOCK:
Project: ATS Pious Hideaways
price_min_cr: 1.45
price_max_cr: 2.20
price_range_label: ₹1.45 - 2.20 Cr
average_rate_sqft: 12,500`

    const response = 'ATS Pious Hideaways offers 3 BHK apartments starting at ₹1.45 Cr up to ₹2.20 Cr.'
    const violations = verifyPriceProvenance(response, prompt)
    assert.equal(violations.length, 0)
  })

  it('catches fabricated Crore prices not present in prompt', () => {
    const prompt = `VERIFIED_FACTS_BLOCK:
Project: ATS Pious Hideaways
price_min_cr: 1.45
price_max_cr: 2.20`

    const response = 'You can get a flat in ATS Pious for just ₹0.75 Cr today.'
    const violations = verifyPriceProvenance(response, prompt)
    assert.equal(violations.length, 1)
    assert.equal(violations[0].kind, 'fabrication')
    assert.ok(violations[0].detail.includes('₹0.75 Cr'))
  })

  it('catches fabricated Lakh prices not present in prompt', () => {
    const prompt = `VERIFIED_FACTS_BLOCK:
Project: ATS Pious Hideaways
price_min_cr: 1.45
price_max_cr: 2.20`

    const response = 'Entry level 2 BHK units start at ₹65 Lakh.'
    const violations = verifyPriceProvenance(response, prompt)
    assert.equal(violations.length, 1)
    assert.equal(violations[0].kind, 'fabrication')
    assert.ok(violations[0].detail.includes('₹65 Lakh'))
  })

  it('allows grounded sqft rates and catches fabricated sqft rates', () => {
    const prompt = `VERIFIED_FACTS_BLOCK:
Project: Ace Parkway
rate_sqft: 14500`

    const groundedResponse = 'Priced at ₹14,500/sqft, Ace Parkway matches Sector 150 luxury standards.'
    assert.equal(verifyPriceProvenance(groundedResponse, prompt).length, 0)

    const fabricatedResponse = 'Units are available at a steep discount of ₹7,800/sqft.'
    const violations = verifyPriceProvenance(fabricatedResponse, prompt)
    assert.equal(violations.length, 1)
    assert.equal(violations[0].kind, 'fabrication')
    assert.ok(violations[0].detail.includes('₹7,800/sqft'))
  })

  it('permits ungrounded rates when accompanied by explicit market qualifiers', () => {
    const prompt = 'VERIFIED_FACTS_BLOCK: General market discussion'
    const response = 'Prevailing rates in this sector hover around ₹9,200/sqft (typical market average for Sector 150).'
    const violations = verifyPriceProvenance(response, prompt)
    assert.equal(violations.length, 0)
  })

  it('permits user stated budget numbers from userMessage', () => {
    const prompt = 'VERIFIED_FACTS_BLOCK: Project: Stellar Mi\nprice_min_cr: 1.80'
    const userMessage = 'Looking for 3BHK in Central Noida under ₹1.20 Cr'
    const response = 'You asked for options under ₹1.20 Cr, but Stellar Mi starts at ₹1.80 Cr.'
    const violations = verifyPriceProvenance(response, prompt, userMessage)
    assert.equal(violations.length, 0)
  })
})
