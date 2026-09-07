import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildComparisonDiff } from '../comparisonDiff'

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'Project A',
    possession_date: null,
    possession_label: null,
    total_towers: null,
    open_space_pct: null,
    unit_types: [],
    amenities: [],
    connectivity: [],
    builder: null,
    ...overrides,
  }
}

describe('buildComparisonDiff', () => {
  it('returns null for fewer than two projects', () => {
    assert.equal(buildComparisonDiff([project()]), null)
  })

  it('picks the cheaper project by entry price, ignoring noise-level gaps', () => {
    const a = project({ name: 'Ace Parkway', unit_types: [{ bhk: 3, price_min_cr: 2.1, super_area_sqft: 1500 }] })
    const b = project({ name: 'Godrej Woods', unit_types: [{ bhk: 3, price_min_cr: 1.8, super_area_sqft: 1500 }] })
    const diff = buildComparisonDiff([a, b]) as any
    assert.equal(diff.entry_price.leader, 'Godrej Woods')
    assert.match(diff.entry_price.deltaNote, /Godrej Woods leads by 0.3 Cr/)
  })

  it('treats a sub-threshold price gap as immaterial rather than manufacturing a winner', () => {
    const a = project({ name: 'A', unit_types: [{ bhk: 3, price_min_cr: 2.0, super_area_sqft: 1500 }] })
    const b = project({ name: 'B', unit_types: [{ bhk: 3, price_min_cr: 2.02, super_area_sqft: 1500 }] })
    const diff = buildComparisonDiff([a, b]) as any
    assert.equal(diff.entry_price.leader, null)
    assert.equal(diff.entry_price.deltaNote, 'difference is not material')
  })

  it('computes price per sqft from the cheapest configuration, not an average', () => {
    const a = project({
      name: 'A',
      unit_types: [
        { bhk: 2, price_min_cr: 1.0, super_area_sqft: 1000 }, // 10,000/sqft
        { bhk: 3, price_min_cr: 2.0, super_area_sqft: 1500 }, // 13,333/sqft
      ],
    })
    const b = project({ name: 'B', unit_types: [{ bhk: 3, price_min_cr: 1.5, super_area_sqft: 1200 }] }) // 12,500/sqft
    const diff = buildComparisonDiff([a, b]) as any
    assert.equal(diff.price_per_sqft.leader, 'A')
  })

  it('reports possession by calendar date, not the label text', () => {
    const a = project({ name: 'Sooner', possession_date: new Date('2027-06-01') })
    const b = project({ name: 'Later', possession_date: new Date('2029-06-01') })
    const diff = buildComparisonDiff([a, b]) as any
    assert.equal(diff.possession.leader, 'Sooner')
    assert.equal(diff.possession.monthsApart, 24)
  })

  it('omits a possession leader when only one project has a recorded date', () => {
    const a = project({ name: 'A', possession_date: new Date('2027-06-01') })
    const b = project({ name: 'B', possession_date: null })
    const diff = buildComparisonDiff([a, b]) as any
    assert.equal(diff.possession.leader, null)
    assert.equal(diff.possession.monthsApart, null)
  })

  it('surfaces builder track record from the widened builder relation', () => {
    const a = project({ name: 'A', builder: { average_delay_months: 0, projects_delivered_count: 12 } })
    const b = project({ name: 'B', builder: { average_delay_months: 8, projects_delivered_count: 3 } })
    const diff = buildComparisonDiff([a, b]) as any
    assert.equal(diff.builder_track_record.average_delay.leader, 'A')
    assert.equal(diff.builder_track_record.projects_delivered.leader, 'A')
  })

  it('separates shared amenities from what makes each project distinct', () => {
    const a = project({ name: 'A', amenities: [{ name: 'Pool' }, { name: 'Gym' }, { name: 'Tennis Court' }] })
    const b = project({ name: 'B', amenities: [{ name: 'Pool' }, { name: 'Gym' }, { name: 'Jogging Track' }] })
    const diff = buildComparisonDiff([a, b]) as any
    assert.deepEqual(diff.amenities.shared, ['Gym', 'Pool'])
    assert.deepEqual(diff.amenities.unique.A, ['Tennis Court'])
    assert.deepEqual(diff.amenities.unique.B, ['Jogging Track'])
  })

  it('names no leader when neither project has the underlying data', () => {
    const a = project({ name: 'A' })
    const b = project({ name: 'B' })
    const diff = buildComparisonDiff([a, b]) as any
    assert.equal(diff.entry_price.leader, null)
    assert.equal(diff.entry_price.values.A, 'not recorded')
  })

  it('extends to a three-way comparison without special-casing two', () => {
    const a = project({ name: 'A', unit_types: [{ price_min_cr: 1.0, super_area_sqft: 1000 }] })
    const b = project({ name: 'B', unit_types: [{ price_min_cr: 1.5, super_area_sqft: 1000 }] })
    const c = project({ name: 'C', unit_types: [{ price_min_cr: 0.8, super_area_sqft: 1000 }] })
    const diff = buildComparisonDiff([a, b, c]) as any
    assert.equal(diff.entry_price.leader, 'C')
  })

  it('carries an explicit instruction not to recompute the numbers', () => {
    const diff = buildComparisonDiff([project({ name: 'A' }), project({ name: 'B' })]) as any
    assert.match(diff.note, /do not recompute/)
  })
})
