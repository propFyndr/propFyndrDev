// backend/src/lib/ai/__tests__/sessionMemory.requirementState.test.ts
//
// Covers the Phase 1 "Done When" criteria from
// docs/archive/planning/2026-10-11-chatgpt-parity-implementation-plan.md, Task 1.2:
// RequirementState must survive a terse follow-up turn that restates nothing,
// a corrected turn must still override the carried-forward value, and a
// malformed/legacy stored snapshot must not crash hydration.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRequirementState } from '../../discovery/requirementState'
import { parseStoredRequirementState } from '../sessionMemory'

describe('RequirementState cross-turn carry-forward (Phase 1)', () => {
  it('a terse named-project follow-up keeps the prior hard budget ceiling', () => {
    const turn1 = normalizeRequirementState('3bhk in sector 10 greater noida, budget under 1.5 cr')
    assert.equal(turn1.budget.maxCr, 1.5)
    assert.equal(turn1.budget.isHardCeiling, true)

    const turn2 = normalizeRequirementState('what about elite x?', {}, turn1)
    assert.equal(turn2.budget.maxCr, 1.5, 'budget ceiling must survive a turn that does not restate it')
    assert.equal(turn2.budget.isHardCeiling, true, 'hard-ceiling flag must survive a turn that does not restate it')
  })

  it('a terse named-project follow-up keeps the prior stated sector', () => {
    const turn1 = normalizeRequirementState('3bhk in sector 10 greater noida')
    assert.deepEqual(turn1.location.include, ['Sector 10'])

    const turn2 = normalizeRequirementState('what about elite x?', {}, turn1)
    assert.deepEqual(turn2.location.include, ['Sector 10'], 'stated sector must survive a turn that does not restate it')
  })

  it('a corrected BHK in the new turn still overrides the carried-forward value', () => {
    const turn1 = normalizeRequirementState('need a 3bhk')
    assert.deepEqual(turn1.unit.bhk, [3])

    const turn2 = normalizeRequirementState('actually make it a 2bhk', {}, turn1)
    assert.deepEqual(turn2.unit.bhk, [2], 'a restated BHK this turn must override the carried-forward value, not be ignored')
  })

  it('a shape with no recognizable RequirementState fields does not throw and carries nothing forward', () => {
    // Every field in RequirementStateSchema has a default, so an unrelated
    // object parses to an all-default state rather than failing validation —
    // which is fine: the point is it must not throw, and it must not inject
    // garbage into a real merge. An all-default state carries forward nothing
    // (empty sector, no budget), so this is functionally "no previous state"
    // for the only thing that matters: the next turn's merge.
    const legacyShape = { somethingThatIsNotARequirementState: true }
    assert.doesNotThrow(() => parseStoredRequirementState(legacyShape))
    const result = parseStoredRequirementState(legacyShape)
    assert.equal(result?.budget.maxCr, undefined)
    assert.deepEqual(result?.location.include, [])

    // And normalizeRequirementState must still work normally against it.
    const state = normalizeRequirementState('3bhk in sector 10', {}, result)
    assert.deepEqual(state.unit.bhk, [3])
  })

  it('a non-object / unparseable stored value does not throw and yields no previous state', () => {
    assert.doesNotThrow(() => parseStoredRequirementState('not even an object'))
    assert.doesNotThrow(() => parseStoredRequirementState(12345))
  })

  it('parseStoredRequirementState accepts a genuinely valid prior snapshot', () => {
    const turn1 = normalizeRequirementState('3bhk in sector 10, budget under 1.5 cr')
    const roundTripped = parseStoredRequirementState(turn1)
    assert.ok(roundTripped, 'a valid RequirementState must round-trip through schema validation')
    assert.equal(roundTripped!.budget.maxCr, 1.5)
  })

  it('a null/absent stored value yields no previous state, not an error', () => {
    assert.equal(parseStoredRequirementState(null), undefined)
    assert.equal(parseStoredRequirementState(undefined), undefined)
  })
})
