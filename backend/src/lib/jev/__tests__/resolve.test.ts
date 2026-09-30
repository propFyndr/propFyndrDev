// backend/src/lib/jev/__tests__/resolve.test.ts

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { levenshtein, toConfidence, resolveEntity } from '../resolve'
import { normalizeRequirementState } from '../../discovery/requirementState'

describe('JEV Entity Resolver & State Transitions', () => {
  describe('Levenshtein & Confidence Algorithms', () => {
    it('computes exact distance 0 for identical strings', () => {
      assert.equal(levenshtein('godrej woods', 'godrej woods'), 0)
    })

    it('computes single substitution/deletion', () => {
      // godrej wood vs godrej woods -> 1 deletion
      assert.equal(levenshtein('godrej wood', 'godrej woods'), 1)
      assert.equal(levenshtein('ats pious', 'ats pous'), 1)
    })

    it('scores high confidence for close matches', () => {
      const conf = toConfidence(1, 12)
      assert.ok(conf >= 0.75, `Expected >= 0.75, got ${conf}`)
    })

    it('scores low confidence for divergent strings', () => {
      const conf = toConfidence(8, 10)
      assert.ok(conf < 0.75, `Expected < 0.75, got ${conf}`)
    })
  })

  describe('resolveEntity Rejection Gates', () => {
    it('returns null for empty or single char query', async () => {
      const res = await resolveEntity('a')
      assert.equal(res, null)
    })

    it('returns null for completely fictitious projects (threshold gate)', async () => {
      const res = await resolveEntity('Random Fantasy Sky Castle 999', 'project')
      assert.equal(res, null)
    })
  })

  describe('BACKTRACK State Machine Transition (Gate G9)', () => {
    it('restores prior budget ceiling when user says go back to 1.5 Cr', () => {
      // Turn 1: Initial state has 1.5 Cr budget
      const state1 = normalizeRequirementState('3 BHK in Sector 150 under 1.5 Cr')
      assert.equal(state1.budget.maxCr, 1.5)

      // Turn 2: User pushed budget to 2 Cr
      const state2 = normalizeRequirementState('what about up to 2 Cr', {}, state1)
      assert.equal(state2.budget.maxCr, 2.0)

      // Turn 3: User backtracks: "go back to 1.5 Cr"
      const state3 = normalizeRequirementState('actually go back to 1.5 Cr', {}, state2, [state1, state2])
      assert.equal(state3.budget.maxCr, 1.5)
      assert.equal(state3.budget.isHardCeiling, true)
    })

    it('restores prior budget from state history when phrase is "go back to original budget"', () => {
      const state1 = normalizeRequirementState('2 BHK in Noida under 90 Lakh')
      const state2 = normalizeRequirementState('show me 1.2 Cr options', {}, state1)
      const state3 = normalizeRequirementState('no go back to original budget', {}, state2, [state1, state2])
      assert.equal(state3.budget.maxCr, 0.9)
    })
  })
})
