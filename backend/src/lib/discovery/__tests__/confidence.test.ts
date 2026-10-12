// backend/src/lib/discovery/__tests__/confidence.test.ts
//
// computeConfidence decides whether the chat route answers straight away or
// asks a clarifying question (chat-router.ts). The previous file tested a
// calculateConfidence in a dataFetcher module that no longer exists; this one
// pins the live function. It is on the CI coverage gate's critical list.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeConfidence } from '../confidence'
import type { Intent } from '../types'

const intent = (o: Partial<Intent>) => o as Intent

describe('computeConfidence', () => {
  it('is HIGH when the buyer names a project, whatever else is missing', () => {
    const r = computeConfidence(intent({ projectNames: ['Apex Golf Avenue'] }))
    assert.equal(r.level, 'HIGH')
    assert.equal(r.score, 0.95)
  })

  it('is HIGH when the buyer names a builder', () => {
    const r = computeConfidence(intent({ builderName: 'Godrej Properties' }))
    assert.equal(r.level, 'HIGH')
    assert.equal(r.score, 0.9)
  })

  it('is HIGH with BHK, budget and a sector together', () => {
    const r = computeConfidence(intent({ bhk: [3], budgetMax: 15000000, sector: 'Sector 150' }))
    assert.equal(r.level, 'HIGH')
    assert.equal(r.score, 0.88)
  })

  it('is MEDIUM with two of BHK, budget and sector', () => {
    const r = computeConfidence(intent({ bhk: [3], budgetMax: 15000000 }))
    assert.equal(r.level, 'MEDIUM')
    assert.equal(r.score, 0.72)
  })

  it('is MEDIUM with one signal plus a lifestyle preference', () => {
    const r = computeConfidence(intent({ bhk: [2], lifestyleKeywords: ['metro'] }))
    assert.equal(r.level, 'MEDIUM')
    assert.equal(r.score, 0.6)
  })

  it('is LOW with a single signal and nothing else', () => {
    const r = computeConfidence(intent({ bhk: [2] }))
    assert.equal(r.level, 'LOW')
    assert.equal(r.score, 0.3)
  })

  it('does not count a whole city as a sector', () => {
    // "Noida" narrows nothing; BHK + budget + city is two signals, not three.
    const r = computeConfidence(intent({ bhk: [3], budgetMax: 15000000, sector: 'Noida' }))
    assert.equal(r.level, 'MEDIUM')
  })
})
