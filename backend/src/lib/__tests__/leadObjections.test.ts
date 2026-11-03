import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractObjections } from '../leadObjections'
import { suggestOpening } from '../leadBrief'

describe('a lead carries the concerns the buyer stated', () => {
  it('keeps one per category, most concerned first, in the buyer\'s words', () => {
    const out = extractObjections([
      { id: 'm1', content: '3bhk in sector 150 under 2 cr' },
      { id: 'm2', content: 'is possession going to be delayed? I am worried about that' },
      { id: 'm3', content: 'what is the RERA number' },
      { id: 'm4', content: 'EMI on 90 lakh loan' },
    ])
    assert.deepEqual(out.map((o) => o.category), ['possession', 'legal', 'financing'])
    assert.equal(out[0].messageId, 'm2')
    assert.equal(out[0].confidence, 0.8)
    assert.equal(out.find((o) => o.category === 'financing')!.confidence, 0.5)
  })

  it('records nothing for a chat with no concern', () => {
    assert.deepEqual(extractObjections([{ content: 'show me 2bhk in sector 76' }]), [])
  })

  it('removes a phone number from the quoted text', () => {
    const [o] = extractObjections([{ content: 'call me on 98765 43210, worried about the price being too high' }])
    assert.equal(o.category, 'price')
    assert.doesNotMatch(o.text, /98765/)
  })

  it('gives the brief its opening line', () => {
    const found = extractObjections([{ content: 'is it safe? what about the litigation' }])
    const opening = suggestOpening(found.map((o) => ({ category: o.category, text: o.text, confidence: o.confidence })))
    assert.match(opening ?? '', /RERA registration and approvals/)
  })
})
