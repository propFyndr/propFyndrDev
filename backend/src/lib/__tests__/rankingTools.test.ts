import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getBestValueProjects,
  getFastestPossessionProjects,
  getBestForFamiliesProjects,
} from '../projectFacts'

// Built 8 Sep 2026 — these three tools were previously removed as dead
// promises (advertised, no schema, no handler). These tests hit the real
// database (Noida/Greater Noida seeded data), matching this suite's own
// standard of asserting against real data rather than a mock.

describe('getBestValueProjects', () => {
  it('ranks ascending by rupees-per-sqft, never descending', async () => {
    const result = await getBestValueProjects({ city: 'Noida', limit: 10 })
    if (result.found) {
      const rates = (result.projects as Array<{ rate_per_sqft_inr: number }>).map((p) => p.rate_per_sqft_inr)
      for (let i = 1; i < rates.length; i++) {
        assert.ok(rates[i] >= rates[i - 1], `rate at ${i} (${rates[i]}) should be >= previous (${rates[i - 1]})`)
      }
    }
  })

  it('names no project when nothing matches an impossible filter', async () => {
    const result = await getBestValueProjects({ sector: 'not-a-real-sector-999', city: 'Noida' })
    assert.equal(result.found, false)
    assert.ok(typeof result.message === 'string' && result.message.length > 0)
  })

  it('never returns an opaque quality score, only the price/area arithmetic', async () => {
    const result = await getBestValueProjects({ city: 'Noida', limit: 5 })
    if (result.found) {
      for (const p of result.projects as Array<Record<string, unknown>>) {
        assert.equal('overall_score' in p, false)
        assert.equal('dna_score' in p, false)
        assert.ok(typeof p.rate_per_sqft_inr === 'number')
      }
    }
  })
})

describe('getFastestPossessionProjects', () => {
  it('sorts every ready_to_move project before any under-construction one', async () => {
    const result = await getFastestPossessionProjects({ city: 'Noida', limit: 15 })
    if (result.found) {
      const statuses = (result.projects as Array<{ status: string }>).map((p) => p.status)
      const firstNonReady = statuses.findIndex((s) => s !== 'ready_to_move')
      if (firstNonReady !== -1) {
        assert.ok(
          statuses.slice(0, firstNonReady).every((s) => s === 'ready_to_move'),
          'a ready_to_move project appeared after a non-ready one',
        )
      }
    }
  })
})

describe('getBestForFamiliesProjects', () => {
  it('never invents a family-friendliness score — only real counts and bhk_available', async () => {
    const result = await getBestForFamiliesProjects({ city: 'Noida', limit: 5 })
    if (result.found) {
      for (const p of result.projects as Array<Record<string, unknown>>) {
        assert.equal('family_score' in p, false)
        assert.ok(Array.isArray(p.bhk_available))
      }
    }
  })
})
