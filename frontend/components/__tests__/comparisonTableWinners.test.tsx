import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { buildMatrix } from '../ComparisonTable'
import type { ProjectCard, ProjectDetail } from '@/types/project'

// A column we hold no value for must read "Not on record" and never win a row
// over a recorded value: "Under Standard Audit" / "Standard Buffer" were
// invented readings, and a null used to outscore a recorded false.
const base = { id: 'a', name: 'A', slug: 'a' }
const detail = (over: Record<string, unknown>) => ({ ...base, ...over }) as unknown as ProjectDetail
const cards = [{ id: 'a' }, { id: 'b' }] as unknown as ProjectCard[]

function row(label: string, a: Record<string, unknown>, b: Record<string, unknown>) {
  const r = buildMatrix([detail(a), detail({ ...b, id: 'b' })], cards).find(x => x.label === label)
  if (!r) throw new Error(`row ${label} missing`)
  return r
}

describe('comparison rows never reward a missing value', () => {
  it.each([
    ['UP Lifts Act 2024', { lift_act_compliant: null }, { lift_act_compliant: false }],
    ['Drain Corridor Buffer', { shahdara_drain_impact: null }, { shahdara_drain_impact: true }],
    ['Water Reality (TDS)', { water_source_type: null }, { water_source_type: 'BOREWELL' }],
  ])('%s: not on record vs a recorded value has no winner', (label, a, b) => {
    const r = row(label, a, b)
    expect(r.winners).toEqual([])
    const { container } = render(<div>{r.values[0]}</div>)
    expect(container).toHaveTextContent('Not on record')
  })

  it('a recorded pass still wins', () => {
    expect(row('UP Lifts Act 2024', { lift_act_compliant: true }, { lift_act_compliant: null }).winners).toEqual([0])
  })
})
