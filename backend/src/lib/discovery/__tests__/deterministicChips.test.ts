// backend/src/lib/discovery/__tests__/deterministicChips.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateProjectChips, type ChipProjectInput } from '../deterministicChips'

describe('Zero-Token Deterministic Due-Diligence Chip Engine', () => {
  const riskyProject: ChipProjectInput = {
    name: 'Sector 150 Greens',
    slug: 'sector-150-greens',
    sector: 'Sector 150',
    amitabh_kant_clearance: false,
    oc_status: 'NONE',
    water_source_type: 'BOREWELL',
    water_tds_range: '> 1800 ppm',
    shahdara_drain_impact: true,
    lift_act_compliant: false,
    all_in_cost_multiplier: 1.32,
    has_servant_room: true,
  }

  it('triggers top 3 prioritized forensic chips for a project with multiple risk flags', () => {
    const chips = generateProjectChips(riskyProject, [])
    assert.equal(chips.length, 3, 'Should cap at top 3 chips')
    assert.equal(chips[0].category, 'legal', 'Priority 1 must be legal/registry standing')
    assert.equal(chips[1].category, 'water', 'Priority 2 must be drinking water TDS')
    assert.equal(chips[2].category, 'environment', 'Priority 3 must be Shahdara drain')
  })

  it('suppresses topics already asked in the conversation session', () => {
    // If user already discussed registry and water:
    const chips = generateProjectChips(riskyProject, ['registry', 'water'])
    assert.equal(chips.length, 3)
    assert.equal(chips[0].category, 'environment', 'Should promote environmental chip')
    assert.equal(chips[1].category, 'safety', 'Should promote lift safety chip')
    assert.equal(chips[2].category, 'cost', 'Should promote true cost chip')
  })

  it('generates true cost and servant room chips when earlier risks are clear', () => {
    const cleanProject: ChipProjectInput = {
      name: 'Clean Meadows',
      slug: 'clean-meadows',
      amitabh_kant_clearance: true,
      oc_status: 'FULL_OC',
      water_source_type: 'GANGA_JAL',
      water_tds_range: '150-300 ppm',
      shahdara_drain_impact: false,
      lift_act_compliant: true,
      all_in_cost_multiplier: 1.28,
      has_servant_room: true,
    }

    const chips = generateProjectChips(cleanProject, [])
    assert.equal(chips.length, 2)
    assert.equal(chips[0].category, 'cost')
    assert.equal(chips[1].category, 'layout')
    assert.ok(chips[0].label.includes('+28%'))
  })

  it('returns empty array when project has no triggers or input is null', () => {
    assert.deepEqual(generateProjectChips(null), [])
    assert.deepEqual(generateProjectChips(undefined), [])
  })

  it('executes in sub-millisecond time (<1ms)', () => {
    const start = performance.now()
    for (let i = 0; i < 500; i++) {
      generateProjectChips(riskyProject, ['registry'])
    }
    const duration = performance.now() - start
    const perCallMs = duration / 500
    assert.ok(perCallMs < 0.1, `Per-call time was ${perCallMs.toFixed(3)}ms (must be < 0.1ms)`)
  })
})

it('a topic asked in a full sentence suppresses its chip', () => {
  const chips = generateProjectChips(
    { name: 'X', slug: 'x', water_source_type: 'BOREWELL' } as any,
    ['what water supply do they have?'],
  )
  assert.equal(chips.some(c => c.category === 'water'), false)
})
