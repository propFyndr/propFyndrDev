import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { possessionDatePassed, possessionDisplay } from '../possession'
import { buildMatchSignals } from '../discovery/scoring'

const now = new Date('2026-10-14T00:00:00Z')

describe('possession date passed', () => {
  it('flags a missed date only on projects not delivered', () => {
    assert.equal(possessionDatePassed('under_construction', new Date('2025-06-01'), now), true)
    assert.equal(possessionDatePassed('new_launch', '2026-01-01', now), true)
    assert.equal(possessionDatePassed('ready_to_move', new Date('2025-06-01'), now), false)
    assert.equal(possessionDatePassed('under_construction', new Date('2027-06-01'), now), false)
    assert.equal(possessionDatePassed('under_construction', null, now), false)
  })
  it('labels the date instead of presenting it as a schedule', () => {
    assert.equal(possessionDisplay('June 2025', 'under_construction', new Date('2025-06-01'), now), 'June 2025 (possession date passed — status unconfirmed)')
    assert.equal(possessionDisplay('Dec 2027', 'under_construction', new Date('2027-12-01'), now), 'Dec 2027')
    assert.equal(possessionDisplay(null, 'ready_to_move', null, now), null)
  })
})

describe('match signals', () => {
  it('a missed date is not "possession in 6 months"', () => {
    const p = { unit_types: [], sector: 'Sector 1', status: 'under_construction', possession_date: new Date('2025-06-01') }
    const { matchReasons } = buildMatchSignals(p, {} as any)
    assert.ok(!matchReasons.some(r => /possession in 6 months|within a year/.test(r)), matchReasons.join('; '))
  })
})
