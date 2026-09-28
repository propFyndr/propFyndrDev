import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectFactualAttribute } from '../deterministicFactRouter'

describe('detectFactualAttribute', () => {
  it('detects RERA queries with various phrasings', () => {
    const q1 = detectFactualAttribute('what is the rera number for ATS Pious?')
    assert.equal(q1?.attribute, 'rera')
    assert.ok(q1?.subjectHint.includes('ATS Pious'))

    const q2 = detectFactualAttribute('show me rera id of Godrej Woods')
    assert.equal(q2?.attribute, 'rera')
    assert.ok(q2?.subjectHint.includes('Godrej Woods'))

    const q3 = detectFactualAttribute('ATS Picturesque Repute rera registration details')
    assert.equal(q3?.attribute, 'rera')
    assert.ok(q3?.subjectHint.includes('ATS Picturesque Repute'))

    const q4 = detectFactualAttribute('is Ace Parkway rera approved?')
    assert.equal(q4?.attribute, 'rera')
    assert.ok(q4?.subjectHint.includes('Ace Parkway'))
  })

  it('detects OC and completion certificate queries', () => {
    const q1 = detectFactualAttribute('is Mahagun Mezzaria oc obtained?')
    assert.equal(q1?.attribute, 'oc')
    assert.ok(q1?.subjectHint.includes('Mahagun Mezzaria'))

    const q2 = detectFactualAttribute('oc status for Eldeco Live By The Greens')
    assert.equal(q2?.attribute, 'oc')
    assert.ok(q2?.subjectHint.includes('Eldeco Live By The Greens'))

    const q3 = detectFactualAttribute('has ATS Pristine got occupancy certificate?')
    assert.equal(q3?.attribute, 'oc')
    assert.ok(q3?.subjectHint.includes('ATS Pristine'))
  })

  it('detects Water Source & TDS queries', () => {
    const q1 = detectFactualAttribute('what is the water tds in Mahagun Mezzaria?')
    assert.equal(q1?.attribute, 'water')
    assert.ok(q1?.subjectHint.includes('Mahagun Mezzaria'))

    const q2 = detectFactualAttribute('water source for Supertech Capetown')
    assert.equal(q2?.attribute, 'water')
    assert.ok(q2?.subjectHint.includes('Supertech Capetown'))

    const q3 = detectFactualAttribute('ganga jal supply in Prateek Edifice')
    assert.equal(q3?.attribute, 'water')
    assert.ok(q3?.subjectHint.includes('Prateek Edifice'))
  })

  it('detects UP Lifts Act 2024 compliance queries', () => {
    const q1 = detectFactualAttribute('are the lifts safe in Lotus Boulevard?')
    assert.equal(q1?.attribute, 'lift')
    assert.ok(q1?.subjectHint.includes('Lotus Boulevard'))

    const q2 = detectFactualAttribute('up lifts act compliance for Gulshan Dynasty')
    assert.equal(q2?.attribute, 'lift')
    assert.ok(q2?.subjectHint.includes('Gulshan Dynasty'))
  })

  it('detects Land Dues and Amitabh Kant queries', () => {
    const q1 = detectFactualAttribute('land dues status for Amrapali Silicon City')
    assert.equal(q1?.attribute, 'land_dues')
    assert.ok(q1?.subjectHint.includes('Amrapali Silicon City'))

    const q2 = detectFactualAttribute('amitabh kant 25% dues in Lotus Zing')
    assert.equal(q2?.attribute, 'land_dues')
    assert.ok(q2?.subjectHint.includes('Lotus Zing'))
  })

  it('returns null for non-attribute queries (passes to normal lanes)', () => {
    assert.equal(detectFactualAttribute('3 bhk flats in sector 150 under 1.5 cr'), null)
    assert.equal(detectFactualAttribute('how much stamp duty do I pay in UP?'), null)
    assert.equal(detectFactualAttribute('compare ATS Pious and Ace Parkway'), null)
    assert.equal(detectFactualAttribute('best builders in Noida'), null)
  })
})
