import { it } from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectsBlock } from '../blocks'

const project = (name: string, extra: Record<string, unknown>) => ({
  name, sector: 'Sector 1', builder: { name: 'B' }, unit_types: [], top_amenities: [], top_connectivity: [],
  status: 'under_construction', budgetStatus: 'within', ...extra,
}) as any

// "possession within a year" was a soft score: a project due 2029, or one whose
// 2025 date passed unbuilt, was listed under Exact Matches.
it('a project outside the stated possession window is not an exact match', () => {
  const block = buildProjectsBlock([project('OnTime', {}), project('Late', { possessionOutsideTimeline: true })])
  const exact = block.split('## Outside the Stated Possession Timeline')[0]
  assert.match(exact, /OnTime/)
  assert.doesNotMatch(exact, /Late/)
  assert.match(block, /Outside the Stated Possession Timeline — NOT MATCHES[\s\S]*Late/)
})
