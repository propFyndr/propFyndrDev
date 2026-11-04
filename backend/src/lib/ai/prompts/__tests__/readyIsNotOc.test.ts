import { it } from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectsBlock } from '../blocks'

// Cycle 2 Day 1: every ready-to-move row was serialized as "DELIVERED — occupancy certificate
// issued", and the prompt head treats DELIVERED as "OC issued is a confirmed fact". No project on
// dev held an oc_status (4 Nov 2026), so the model was told a certificate existed for all of them.
it('a ready-to-move status is not presented to the model as an occupancy certificate', () => {
  const block = buildProjectsBlock([{
    name: 'Ready Towers', sector: 'Sector 1', builder: { name: 'B' }, unit_types: [], top_amenities: [], top_connectivity: [],
    status: 'ready_to_move', budgetStatus: 'within',
  } as any])
  assert.match(block, /READY_TO_MOVE/)
  assert.doesNotMatch(block, /\bDELIVERED\b/)
  assert.doesNotMatch(block, /occupancy certificate issued/i)
})
