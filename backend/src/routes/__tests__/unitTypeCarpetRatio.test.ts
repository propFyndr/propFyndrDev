import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCarpetToSuperRatio } from '../../lib/calculators'

describe('computeCarpetToSuperRatio', () => {
  it('computes carpet ÷ super × 100', () => {
    assert.equal(computeCarpetToSuperRatio(1200, 1500), 80)
  })

  it('returns null when either area is missing', () => {
    assert.equal(computeCarpetToSuperRatio(null, 1500), null)
    assert.equal(computeCarpetToSuperRatio(1200, null), null)
    assert.equal(computeCarpetToSuperRatio(undefined, undefined), null)
  })

  it('returns null rather than Infinity when super area is zero', () => {
    assert.equal(computeCarpetToSuperRatio(1200, 0), null)
  })
})
