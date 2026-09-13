// What must be removed, and — more importantly — what must survive.
//
// The second half is the one that matters. Analytics captures buyer chat
// because "3BHK in Sector 150 under 1.5cr, possession within a year" is the
// product signal. A redactor that also eats the budget, the sector number or
// the BHK count has removed the reason for capturing anything.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { redactPii, containsPii } from '../redactPii'

describe('redacts direct identifiers', () => {
  for (const [input, mustNotContain] of [
    ['call me on 9876543210', '9876543210'],
    ['my number is 98765 43210', '98765'],
    ['reach me at +91 9876543210', '9876543210'],
    ['ping 98765-43210 please', '43210'],
    ['mail me at furqan.test@example.co.in', '@example'],
    ['aadhaar 1234 5678 9012', '5678'],
    ['pan ABCDE1234F', 'ABCDE1234F'],
  ] as Array<[string, string]>) {
    it(`removes it from "${input}"`, () => {
      const out = redactPii(input)
      assert.ok(!out.includes(mustNotContain), `left "${mustNotContain}" in "${out}"`)
      assert.equal(containsPii(input), true)
    })
  }
})

describe('leaves the product signal intact', () => {
  for (const q of [
    '3BHK in Sector 150 under 1.5cr',
    'I need a 2BHK near Sector 62 metro, budget 75 lakh',
    'possession within 12 months, loading under 30%',
    'is 1.25 crore too much for Sector 137',
    'stamp duty is 7% and registration 1%',
    'show me projects in Sector 128 and Sector 143',
    'what about Techzone 4',
    'EMI on 80 lakh at 8.5% for 20 years',
  ]) {
    it(`does not touch "${q}"`, () => {
      assert.equal(redactPii(q), q)
      assert.equal(containsPii(q), false)
    })
  }
})

describe('edge cases', () => {
  it('handles empty and whitespace input', () => {
    assert.equal(redactPii(''), '')
    assert.equal(redactPii('   '), '   ')
  })

  it('redacts more than one identifier in a message', () => {
    const out = redactPii('call 9876543210 or mail me@example.com')
    assert.ok(!out.includes('9876543210'))
    assert.ok(!out.includes('me@example.com'))
  })

  it('keeps the rest of the sentence around a redaction', () => {
    const out = redactPii('I want a 3BHK in Sector 150, call me on 9876543210')
    assert.ok(out.includes('3BHK'))
    assert.ok(out.includes('Sector 150'))
    assert.ok(out.includes('[phone]'))
  })
})
