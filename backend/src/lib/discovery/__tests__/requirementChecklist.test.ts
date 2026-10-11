// backend/src/lib/discovery/__tests__/requirementChecklist.test.ts

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RequirementStateSchema, type RequirementState } from '../requirementState'
import { buildRequirementChecklist, countExplicitCriteria } from '../requirementChecklist'

const NOW = new Date('2026-10-12T00:00:00Z')
const state = (over: Record<string, unknown> = {}): RequirementState => RequirementStateSchema.parse(over)

const FULL = state({
  budget: { maxCr: 1.5, isHardCeiling: true },
  location: { include: ['Sector 150'] },
  unit: { bhk: [3], possessionDeadlineYears: 1 },
  preferences: { requiredAmenities: ['gym', 'school'] },
})

const PROJECT = {
  sector: 'Sector 150',
  city: 'Noida',
  price_min_cr: 1.1,
  possession_date: '2027-03-01T00:00:00Z',
  unit_types: [{ bhk: 2, price_min_cr: 1.1 }, { bhk: 3, price_min_cr: 1.4 }],
  top_amenities: [{ name: 'Gymnasium' }, { name: 'Club House' }],
  amenity_count: 2,
}

describe('countExplicitCriteria', () => {
  it('counts 0 for an empty state', () => {
    assert.equal(countExplicitCriteria(state()), 0)
  })
  it('counts amenities as one category regardless of how many', () => {
    assert.equal(countExplicitCriteria(state({ preferences: { requiredAmenities: ['gym', 'pool', 'school'] } })), 1)
  })
  it('counts all five categories', () => {
    assert.equal(countExplicitCriteria(FULL), 5)
  })
})

describe('buildRequirementChecklist', () => {
  it('returns null below the threshold (2 criteria)', () => {
    const s = state({ budget: { maxCr: 1.5 }, unit: { bhk: [3] } })
    assert.equal(buildRequirementChecklist(s, PROJECT, NOW), null)
  })

  it('returns rows exactly at the threshold (3 criteria)', () => {
    const s = state({ budget: { maxCr: 1.5 }, unit: { bhk: [3] }, location: { include: ['Sector 150'] } })
    assert.equal(buildRequirementChecklist(s, PROJECT, NOW)?.length, 3)
  })

  it('checks each stated criterion against the project rows', () => {
    const rows = buildRequirementChecklist(FULL, PROJECT, NOW)!
    assert.deepEqual(rows.map((r) => r.status), ['met', 'met', 'met', 'met', 'unknown'])
    // Budget uses the cheapest unit in the asked BHK, not the 2BHK floor price.
    assert.equal(rows[0].note, 'From ₹1.4 Cr')
    // Nearby school is never judged from data we don't hold per project.
    assert.match(rows[4].note, /Nearby school not verified/)
  })

  it('marks absent fields unknown, never met or caution', () => {
    const rows = buildRequirementChecklist(FULL, {}, NOW)!
    assert.deepEqual(rows.map((r) => r.status), ['unknown', 'unknown', 'unknown', 'unknown', 'unknown'])
  })

  it('hard ceiling has zero tolerance; soft ceiling allows 10%', () => {
    const over = { ...PROJECT, unit_types: [{ bhk: 3, price_min_cr: 1.6 }] }
    assert.equal(buildRequirementChecklist(FULL, over, NOW)![0].status, 'unmet')
    const soft = state({ ...FULL, budget: { maxCr: 1.5, isHardCeiling: false } })
    const row = buildRequirementChecklist(soft, over, NOW)![0]
    assert.equal(row.status, 'caution')
    assert.equal(row.note, 'From ₹1.6 Cr, 7% above')
  })

  it('flags wrong sector, missing BHK and late possession as unmet', () => {
    const p = { ...PROJECT, sector: 'Sector 10', unit_types: [{ bhk: 2, price_min_cr: 1.1 }], possession_date: '2029-01-01' }
    const rows = buildRequirementChecklist(FULL, p, NOW)!
    assert.deepEqual(rows.slice(1, 4).map((r) => r.status), ['unmet', 'unmet', 'unmet'])
    assert.equal(rows[2].note, 'Offers 2 BHK')
  })

  it('an amenity missing from a complete list is caution; from a truncated list, unknown', () => {
    const s = state({ ...FULL, preferences: { requiredAmenities: ['swimming_pool'] } })
    assert.equal(buildRequirementChecklist(s, PROJECT, NOW)![4].status, 'caution')
    const truncated = { ...PROJECT, amenity_count: 25 }
    assert.equal(buildRequirementChecklist(s, truncated, NOW)![4].status, 'unknown')
  })

  it('does not match "parking" as a park', () => {
    const s = state({ ...FULL, preferences: { requiredAmenities: ['park'] } })
    const p = { ...PROJECT, top_amenities: [{ name: 'Covered Parking' }], amenity_count: 1 }
    assert.equal(buildRequirementChecklist(s, p, NOW)![4].status, 'caution')
  })
})
