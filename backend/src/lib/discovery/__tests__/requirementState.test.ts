// backend/src/lib/discovery/__tests__/requirementState.test.ts
//
// Test suite validating RequirementState normalization, hard vs soft constraint detection,
// commute anchor isolation, and exploratory query flags.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRequirementState } from '../requirementState'

describe('RequirementState Normalization & Constraint Classifier', () => {
  it('Test 1 (Query 1): Correctly isolates workplace anchor, soft BHK, soft budget, and exploratory intent', () => {
    const raw =
      "I have around ₹1.5 crore. I don't necessarily need to spend all of it. I work somewhere around Sector 62 but might change jobs next year. I want a good home for myself and my parents. Maybe 3BHK, but I'm not sure. What should I actually be looking for?"

    const state = normalizeRequirementState(raw)

    // Commute destination isolated, workplace != home living location
    assert.equal(state.commute.length, 1)
    assert.equal(state.commute[0].destination, 'Sector 62')
    assert.equal(state.commute[0].role, 'workplace')
    assert.ok(
      !state.location.include.includes('Sector 62'),
      'Workplace Sector 62 must never enter residential include filter',
    )

    // Soft budget
    assert.equal(state.budget.maxCr, 1.5)
    assert.equal(state.budget.isHardCeiling, false, 'around 1.5 Cr must be classified as a soft ceiling')

    // Soft BHK
    assert.deepEqual(state.unit.bhk, [3])
    assert.equal(state.unit.isBhkHard, false, 'maybe 3BHK must be classified as soft preference')

    // Exploratory inquiry
    assert.equal(
      state.control.hasExploratoryQuestion,
      true,
      'what should I actually be looking for must trigger exploratory question',
    )
    assert.ok(state.intentModes.includes('DISCOVER'), 'exploratory inquiry must include DISCOVER mode')
    assert.equal(state.preferences.useCase, 'self_use')
  })

  it('Test 2 (Query 2): Correctly classifies hard budget, hard carpet area, and hard BHK in Central Noida', () => {
    const raw = 'Show me 3BHK flats in Central Noida under ₹1.2 Cr with minimum 1,500 sq ft carpet area.'

    const state = normalizeRequirementState(raw)

    assert.deepEqual(state.location.include, ['Central Noida'])
    assert.equal(state.budget.maxCr, 1.2)
    assert.equal(state.budget.isHardCeiling, true, 'under 1.2 Cr is a hard budget ceiling')
    assert.deepEqual(state.unit.bhk, [3])
    assert.equal(state.unit.isBhkHard, true)
    assert.equal(state.unit.minCarpetSqft, 1500)
    assert.equal(state.unit.isCarpetHard, true, 'minimum 1,500 sq ft carpet is a hard constraint')
    assert.equal(state.control.hasExploratoryQuestion, false)
  })

  it('Test 3 (Query 3): Correctly classifies soft location preference and soft budget', () => {
    const raw = 'Looking for a home, budget around 2 cr, preferably near expressway, 3bhk'

    const state = normalizeRequirementState(raw)

    assert.equal(state.budget.maxCr, 2)
    assert.equal(state.budget.isHardCeiling, false, 'around 2 cr is a soft ceiling')
    assert.ok(
      state.location.softPreferences.some((p) => /expressway/i.test(p)),
      'expressway must be tagged as soft preference',
    )
    assert.equal(state.location.include.length, 0, 'soft preference should not be a rigid include')
  })

  it('Test 4 (Query 5): Detects all-in acquisition cost requirement', () => {
    const raw = 'I want a 3BHK in Sector 150. My all-in budget is ₹1.8 Cr including everything.'

    const state = normalizeRequirementState(raw)

    assert.deepEqual(state.location.include, ['Sector 150'])
    assert.equal(state.budget.maxCr, 1.8)
    assert.equal(state.budget.costType, 'all_in', 'must detect all-in acquisition cost type')
  })

  it('Test 5: Detects consultative exploratory inquiry without search parameters', () => {
    const raw = 'What do you suggest for a family moving from Bangalore with school-going kids?'

    const state = normalizeRequirementState(raw)

    assert.equal(state.control.hasExploratoryQuestion, true)
    assert.ok(state.intentModes.includes('DISCOVER'))
  })

  it('Test 6 (Query 6): Triggers clarification gate when given broad unconstrained corridor choices', () => {
    const raw = 'Should I buy in Noida or Greater Noida?'

    const state = normalizeRequirementState(raw)

    assert.equal(state.control.requiresClarification, true)
    assert.ok(state.control.clarificationPrompt && state.control.clarificationPrompt.length > 10)
  })

  it('Test 7: Correctly parses negative location exclusions', () => {
    const raw = 'Show me 3BHK options under 1.5 Cr, but avoid Expressway and no Sector 137'

    const state = normalizeRequirementState(raw)

    assert.ok(
      state.location.exclude.some((x) => /expressway/i.test(x)),
      'Expressway must be in location.exclude',
    )
    assert.ok(
      state.location.exclude.some((x) => /137/i.test(x)),
      'Sector 137 must be in location.exclude',
    )
  })

  it('Test 9: Extracts stated amenities (school, mall) as required, not hardcoded empty', () => {
    const raw = 'show me a 3bhk in sector 10, i want ample open space, and schools nearby, and should have a mall nearby too'
    const state = normalizeRequirementState(raw)
    assert.ok(state.preferences.requiredAmenities.includes('school'))
    assert.ok(state.preferences.requiredAmenities.includes('mall'))
    assert.ok(state.preferences.requiredAmenities.includes('open_space'))
  })

  it('Test 10: A soft amenity ask ("would be nice to have a gym") is preferred, not required', () => {
    const state = normalizeRequirementState('3bhk, would be nice to have a gym')
    assert.ok(state.preferences.preferredAmenities.includes('gym'))
    assert.ok(!state.preferences.requiredAmenities.includes('gym'))
  })

  it('Test 11: Stated amenities survive a terse named-project follow-up turn', () => {
    const turn1 = normalizeRequirementState('3bhk sector 10, school and mall nearby')
    assert.ok(turn1.preferences.requiredAmenities.includes('school'))
    const turn2 = normalizeRequirementState('what about elite x?', {}, turn1)
    assert.ok(turn2.preferences.requiredAmenities.includes('school'), 'amenities must survive a turn that does not restate them')
    assert.ok(turn2.preferences.requiredAmenities.includes('mall'))
  })

  it('Test 8: Parses possession status as hard ready_to_move requirement', () => {
    const raw = 'Need a ready to move 2BHK in Sector 75 under 90 lakhs'

    const state = normalizeRequirementState(raw)

    assert.deepEqual(state.location.include, ['Sector 75'])
    assert.equal(state.unit.status, 'ready_to_move')
    assert.equal(state.unit.isStatusHard, true)
    assert.deepEqual(state.unit.bhk, [2])
    assert.equal(state.budget.maxCr, 0.9)
    assert.equal(state.budget.isHardCeiling, true)
  })
})

describe('Possession window phrasing', () => {
  // "ready within a year" used to fall through, so the checklist dropped the
  // possession row and the card showed only ticks for a pick that failed it.
  const cases: Array<[string, number]> = [
    ['3BHK in Sector 150 under 2 Cr, ready within a year', 1],
    ['possession within 18 months', 2],
    ['possession within 6 months', 1],
    ['need possession in 2 years', 2],
    ['want to move in within one year', 1],
    ['handover by 3 yrs max', 3],
  ]
  for (const [text, years] of cases) {
    it(`"${text}" -> possession within ${years} yr`, () => {
      const s = normalizeRequirementState(text)
      assert.equal(s.unit.status, 'possession_window')
      assert.equal(s.unit.possessionDeadlineYears, years)
    })
  }

  it('a distance or a builder history is not a possession window', () => {
    for (const text of ['3BHK within 2 km of the metro', 'builder with 20 years of delivery']) {
      assert.equal(normalizeRequirementState(text).unit.possessionDeadlineYears, undefined, text)
    }
  })
})
