import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildHardFilters } from './projects'
import type { Intent } from './types'

describe('buildHardFilters — Noida / Greater Noida / Greater Noida West region matching', () => {
  it('"Noida" excludes Greater Noida markers in sector text and, when silent, excludes Greater Noida cities', () => {
    const where = buildHardFilters({ sector: 'Noida' } as Intent)
    assert.deepEqual(where.AND, [{
      AND: [
        { NOT: { sector: { contains: 'greater noida', mode: 'insensitive' } } },
        { NOT: { city: { equals: 'Greater Noida West', mode: 'insensitive' } } },
        { NOT: { city: { equals: 'Greater Noida', mode: 'insensitive' } } },
      ],
    }])
    assert.equal(where.OR, undefined)
  })

  it('"Greater Noida" matches by sector text OR, when sector is silent, by city', () => {
    const where = buildHardFilters({ sector: 'Greater Noida' } as Intent)
    assert.deepEqual(where.AND, [{
      OR: [
        {
          AND: [
            { sector: { contains: 'greater noida', mode: 'insensitive' } },
            { NOT: { sector: { contains: 'greater noida west', mode: 'insensitive' } } },
          ],
        },
        {
          AND: [
            { NOT: { sector: { contains: 'greater noida', mode: 'insensitive' } } },
            { city: { equals: 'Greater Noida', mode: 'insensitive' } },
          ],
        },
      ],
    }])
  })

  it('"Greater Noida West" matches by sector text OR, when sector is silent, by city', () => {
    const where = buildHardFilters({ sector: 'Greater Noida West' } as Intent)
    assert.deepEqual(where.AND, [{
      OR: [
        { sector: { contains: 'greater noida west', mode: 'insensitive' } },
        {
          AND: [
            { NOT: { sector: { contains: 'greater noida', mode: 'insensitive' } } },
            { city: { equals: 'Greater Noida West', mode: 'insensitive' } },
          ],
        },
      ],
    }])
  })

  it('"Noida Extension" resolves to the exact same filter as "Greater Noida West"', () => {
    const extension = buildHardFilters({ sector: 'Noida Extension' } as Intent)
    const west = buildHardFilters({ sector: 'Greater Noida West' } as Intent)
    assert.deepEqual(extension.AND, west.AND)
  })

  it('a specific (non-city-level) sector still uses the existing whole-word OR matching, unaffected', () => {
    const where = buildHardFilters({ sector: 'Sector 10' } as Intent)
    assert.equal(where.AND, undefined)
    assert.ok(Array.isArray(where.OR) && where.OR.length > 0)
  })
})

// Live 26 Oct: "only show me above 3.8 cr" listed ₹1.25 Cr projects through unpriced units.
describe('buildHardFilters — budget floor', () => {
  const floorOf = (intent: Partial<Intent>) => JSON.stringify(buildHardFilters(intent as Intent))
  it('needs a priced unit reaching the floor; exact when the floor is hard', () => {
    const f = floorOf({ budgetMin: 3.8, budgetHard: true })
    assert.match(f, /"price_max_cr":\{"gte":3\.8\}/)
    assert.doesNotMatch(f, /"price_min_cr":null/)
  })
  it('keeps the tolerance on a soft floor', () => {
    assert.doesNotMatch(floorOf({ budgetMin: 3.8 }), /"gte":3\.8\}/)
  })
})
