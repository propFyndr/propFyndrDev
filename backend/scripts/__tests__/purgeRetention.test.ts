import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCutoff } from '../purge-retention'

describe('computeCutoff', () => {
  it('returns a date exactly 12 months before now', () => {
    const now = new Date('2026-10-11T00:00:00.000Z')
    const cutoff = computeCutoff(now)
    assert.equal(cutoff.getUTCFullYear(), 2025)
    assert.equal(cutoff.getUTCMonth(), 9) // October is month 9 (0-indexed)
    assert.equal(cutoff.getUTCDate(), 11)
  })

  it('handles a leap-year edge case (Feb 29 now; 2027 has no Feb 29, so JS Date rolls the day into March — acceptable, errs toward purging slightly more conservatively, never less)', () => {
    const now = new Date('2028-02-29T00:00:00.000Z')
    const cutoff = computeCutoff(now)
    assert.equal(cutoff.getUTCFullYear(), 2027)
    assert.equal(cutoff.getUTCMonth(), 2) // rolls over to March 1, 2027
    assert.equal(cutoff.getUTCDate(), 1)
  })
})
