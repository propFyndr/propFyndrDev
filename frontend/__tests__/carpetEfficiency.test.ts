import { computeCarpetEfficiency } from '@/lib/chat/carpetEfficiency'

describe('computeCarpetEfficiency', () => {
  it('computes loading percentage and carpet efficiency accurately', () => {
    // 1200 super, 850 carpet
    const res = computeCarpetEfficiency(1200, 850, 1.2)
    expect(res.commonAreaSqft).toBe(350)
    expect(res.loadingPercentage).toBe(29.2)
    expect(res.carpetEfficiencyPercentage).toBe(70.8)
  })

  it('calculates effective carpet rate per sqft based on total price or advertised rate', () => {
    // 1000 super, 700 carpet, advertised 10000/sqft
    const res = computeCarpetEfficiency(1000, 700, 1.0, { advertisedRatePerSqft: 10000 })
    expect(res.advertisedRatePerSqft).toBe(10000)
    // 10000 * (1000 / 700) = 14285.7 -> 14286
    expect(res.effectiveCarpetRatePerSqft).toBe(14286)
  })

  it('determines Elevator Congestion Index (ECI) ratings correctly', () => {
    // 60 flats, 2 lifts -> 30 flats/lift -> Low Wait
    const low = computeCarpetEfficiency(1000, 750, 1.0, { totalFlats: 60, totalLifts: 2 })
    expect(low.eciScore).toBe(30)
    expect(low.eciRating).toBe('Low Wait')

    // 80 flats, 2 lifts -> 40 flats/lift -> Standard
    const standard = computeCarpetEfficiency(1000, 750, 1.0, { totalFlats: 80, totalLifts: 2 })
    expect(standard.eciScore).toBe(40)
    expect(standard.eciRating).toBe('Standard')

    // 120 flats, 2 lifts -> 60 flats/lift -> High Congestion
    const high = computeCarpetEfficiency(1000, 750, 1.0, { totalFlats: 120, totalLifts: 2 })
    expect(high.eciScore).toBe(60)
    expect(high.eciRating).toBe('High Congestion')
  })
})
