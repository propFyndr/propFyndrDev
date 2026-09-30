// backend/src/lib/ai/__tests__/brokerHype.test.ts

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectBrokerHype, checkAnswerIntegritySync } from '../answerIntegrity'

describe('Broker Hype Integrity Guard (Gate G12)', () => {
  it('detects unverified 70% open space claim and generates rewrite', () => {
    const text = 'This project offers 70% open space and landscaped greenery.'
    const violations = detectBrokerHype(text)
    assert.equal(violations.length, 1)
    assert.equal(violations[0].kind, 'broker_hype')
    assert.equal(violations[0].action, 'rewrite')
    assert.match(violations[0].rewrite ?? '', /The developer describes this property/i)
  })

  it('detects marketing superlatives: premium luxury, world-class amenities', () => {
    const text = 'Experience premium luxury living with world-class amenities in Sector 150.'
    const violations = detectBrokerHype(text)
    assert.equal(violations.length, 2)
    assert.ok(violations.some((v) => v.detail.includes('premium luxury')))
    assert.ok(violations.some((v) => v.detail.includes('world-class amenities')))
  })

  it('passes when the phrase is explicitly backed by the verified prompt facts', () => {
    const prompt = 'Project facts: 70% open space as per approved layout map.'
    const text = 'The development features 70% open space.'
    const violations = detectBrokerHype(text, prompt)
    assert.equal(violations.length, 0)
  })

  it('integrates into checkAnswerIntegritySync', () => {
    const res = checkAnswerIntegritySync(
      'It promises unmatched appreciation due to airport proximity.',
      'Verified facts: Sector 150 location',
    )
    assert.ok(res !== null)
    assert.ok(res.some((v) => v.kind === 'broker_hype'))
  })
})
