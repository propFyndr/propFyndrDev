import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computePick } from '../pickOne'

describe('computePick', () => {
  const uc = { name: 'Under Build', status: 'under_construction', price_min_cr: 1.2, rera_number: 'R1', possession_label: 'Dec 2028' }
  const rtm = { name: 'Ready Home', status: 'ready_to_move', price_min_cr: 1.4, rera_number: 'R2', oc_status: 'FULL_OC' }
  const over = { name: 'Too Dear', status: 'ready_to_move', price_min_cr: 2.1, rera_number: 'R3', oc_status: 'FULL_OC' }

  it('ranks budget fit, then possession, and names a drawback from the row', () => {
    const pick = computePick([uc, rtm, over], 1.5)!
    assert.equal(pick.name, 'Ready Home')
    assert.match(pick.reasons.join(' '), /within your ₹1.5 Cr budget/)
    assert.match(pick.drawback, /nothing adverse|verify/)
  })

  it('a legal flag sinks a project however cheap', () => {
    const flagged = { ...rtm, name: 'Flagged', price_min_cr: 0.9, legal_flag: 'NCLT case' }
    assert.notEqual(computePick([flagged, rtm], 1.5)!.name, 'Flagged')
  })

  it('an under-construction pick says so as its drawback', () => {
    const pick = computePick([uc, { ...uc, name: 'Later', possession_label: 'Dec 2030', possession_date: '2030-12-01' }], 1.5)!
    assert.match(pick.drawback, /under construction/)
  })

  it('needs at least two to choose between', () => {
    assert.equal(computePick([rtm], 1.5), null)
  })
})
