// backend/src/lib/chat/handlers/__tests__/unitConfiguration.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCarpetLoading,
  calculateEffectiveCarpetRate,
  calculateElevatorCongestionIndex,
} from '../unitConfiguration'

describe('RERA Carpet Loading & Layout Efficiency Auditor', () => {
  it('calculates loading percentage accurately (super vs carpet)', () => {
    // 2000 super, 1400 carpet -> 600 sqft common -> 30% loading
    const loading30 = calculateCarpetLoading(2000, 1400)
    assert.equal(loading30, 30)

    // 1500 super, 1050 carpet -> 30%
    const loadingNcrStandard = calculateCarpetLoading(1500, 1050)
    assert.equal(loadingNcrStandard, 30)

    // When super is less than or equal to carpet, return 0
    assert.equal(calculateCarpetLoading(1000, 1000), 0)
    assert.equal(calculateCarpetLoading(0, 1000), 0)
  })

  it('calculates effective price per usable carpet sqft', () => {
    // 2.0 Cr for 1400 sqft carpet = 20,000,000 / 1400 = 14,286/sqft
    const effectiveRate = calculateEffectiveCarpetRate(2.0, 1400)
    assert.equal(effectiveRate, 14286)

    // 1.5 Cr for 1000 sqft carpet = 15,000,000 / 1000 = 15,000/sqft
    assert.equal(calculateEffectiveCarpetRate(1.5, 1000), 15000)

    // Returns 0 for invalid inputs
    assert.equal(calculateEffectiveCarpetRate(0, 1000), 0)
    assert.equal(calculateEffectiveCarpetRate(1.5, 0), 0)
  })

  it('computes Elevator Congestion Index (ECI) and ratings correctly', () => {
    // 600 units across 6 towers (100 units/tower), 3 lifts/tower = 33 units/lift -> Low Congestion
    const luxuryEci = calculateElevatorCongestionIndex(600, 6, 3)
    assert.equal(luxuryEci.unitsPerLift, 33)
    assert.ok(luxuryEci.rating.includes('Low Congestion'))

    // 1200 units across 8 towers (150 units/tower), 3 lifts = 50 units/lift -> Moderate
    const standardEci = calculateElevatorCongestionIndex(1200, 8, 3)
    assert.equal(standardEci.unitsPerLift, 50)
    assert.ok(standardEci.rating.includes('Moderate Transit'))

    // 1800 units across 8 towers (225 units/tower), 3 lifts = 75 units/lift -> High Density
    const highDensityEci = calculateElevatorCongestionIndex(1800, 8, 3)
    assert.equal(highDensityEci.unitsPerLift, 75)
    assert.ok(highDensityEci.rating.includes('High Density'))

    // Missing project data returns standard provisioning gracefully
    assert.deepEqual(calculateElevatorCongestionIndex(null, null), {
      unitsPerLift: null,
      rating: 'Standard provisioning',
    })
  })
})
