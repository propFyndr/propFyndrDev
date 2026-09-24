import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dueDiligenceHandler } from '../dueDiligence'

const claims = (message: string, flags: Record<string, boolean> = {}) =>
  (dueDiligenceHandler.matches as (c: unknown) => boolean)({ message, flags })

describe('dueDiligenceHandler — matcher claims', () => {
  it('claims water source, supply, quality and TDS queries', () => {
    for (const q of [
      'what water source is it using?',
      'is Ganga Jal available in this project?',
      'what is the water TDS level?',
      'does it use authority borewell or municipal water supply?',
      'what is the water quality like?',
    ]) {
      assert.equal(claims(q), true, `should claim: ${q}`)
    }
  })

  it('claims lift safety and UP Lifts Act 2024 queries', () => {
    for (const q of [
      'is the project compliant with UP Lifts Act 2024?',
      'what about lift safety and emergency rescue devices?',
      'does it have mandatory ARD devices in elevators?',
      'what is the lift maintenance and AMC status?',
    ]) {
      assert.equal(claims(q), true, `should claim: ${q}`)
    }
  })

  it('claims registry, Amitabh Kant policy and OC status queries', () => {
    for (const q of [
      'has the developer cleared 25% dues under Amitabh Kant policy?',
      'what is the registry clearance status?',
      'what is the OC status of the project?',
      'is it a full OC or partial OC?',
    ]) {
      assert.equal(claims(q), true, `should claim: ${q}`)
    }
  })

  it('claims environmental corridor queries (Shahdara drain, power supply)', () => {
    for (const q of [
      'is it affected by the Shahdara drain corridor?',
      'does it suffer from drain smell or corrosion?',
      'what power supply type does it have?',
      'is it PVVNL multipoint connection or single point bulk?',
    ]) {
      assert.equal(claims(q), true, `should claim: ${q}`)
    }
  })

  it('claims the phrase the feature is named after', () => {
    // These fell through to the general lane, which answered "The Occupancy
    // Certificate was obtained on April 10, 2024" about a row holding NULL in
    // both date columns.
    for (const q of [
      'give me the due diligence scorecard for Amrapali Crystal Homes',
      'run a due diligence check on Mahagun Mezzaria',
      'forensic report for ACE Parkway',
    ]) {
      assert.equal(claims(q), true, `should claim: ${q}`)
    }
  })

  it('claims when ctx.flags.isDueDiligenceQuery is true', () => {
    assert.equal(claims('tell me about living reality', { isDueDiligenceQuery: true }), true)
  })

  it('does NOT claim unrelated queries', () => {
    for (const q of [
      'What is the stamp duty and registration charge in UP?',
      'Calculate my EMI for a 1.5 crore flat',
      'Show me 3BHK flats in Sector 150 under 1.5 crore',
      'Which builder has the best delivery track record?',
    ]) {
      assert.equal(claims(q), false, `should NOT claim: ${q}`)
    }
  })
})
