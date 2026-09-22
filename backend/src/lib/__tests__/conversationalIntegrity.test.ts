import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cardBudgetFor, GEOGRAPHY_OR_CONCEPTUAL_INQUIRY, CONSULTATIVE_INQUIRY } from '../discovery/cardBudget'
import { classifyQueryDeterministic, classifyQuery } from '../discovery/queryClassifier'
import { detectOpenQuery, hasPropertySearchSignal } from '../discovery/openQuery'
import { mergeIntent } from '../ai/intent'
import { getNearbySectors } from '../discovery/sectors'
import type { Intent } from '../discovery/types'

describe('Criterion 2: Strict Card Shooting Gate & Geography Detection', () => {
  const geoQueries = [
    'does sector 150 fall under noida extension',
    'is sector 150 part of noida extension',
    'which authority governs sector 150',
    'for every property you shortlisted, tell me the exact authority',
    'what is the difference between sector 150 and noida extension',
    'where is sector 150',
    'which projects in noida extension are technically inside noida',
    'what authority approved these projects'
  ]

  for (const q of geoQueries) {
    it(`suppresses cards for geography/authority query: "${q}"`, () => {
      assert.equal(GEOGRAPHY_OR_CONCEPTUAL_INQUIRY.test(q), true, `Regex should match "${q}"`)
      const budget = cardBudgetFor({ sector: 'Sector 150', city: 'Noida' } as Intent, q)
      assert.equal(budget.limit, 0, `Budget limit must be 0 for "${q}"`)

      const classification = classifyQueryDeterministic(q, { sector: 'Sector 150' })
      assert.ok(classification, `Classification should succeed for "${q}"`)
      assert.equal(classification.renderTarget, 'text')
      assert.equal(classification.queryKind, 'OPEN')

      const openDet = detectOpenQuery(q, false)
      assert.ok(openDet)
      assert.equal(openDet.topic, 'GENERAL')

      const searchSignal = hasPropertySearchSignal({ sector: 'Sector 150' }, q)
      assert.equal(searchSignal, false, `Search signal should be suppressed for "${q}"`)
    })
  }

  it('suppresses cards for consultative lifestyle inquiry without budget/BHK', () => {
    const q = 'I have a family of three, what should I look for?'
    assert.equal(CONSULTATIVE_INQUIRY.test(q), true)

    // With zero budget/BHK
    const intent: Intent = { city: 'Noida', lifestyleKeywords: ['family'] }
    const budget = cardBudgetFor(intent, q)
    assert.equal(budget.limit, 0, 'Should not shoot cards until budget or BHK is provided')

    const classification = classifyQueryDeterministic(q, intent)
    assert.ok(classification)
    assert.equal(classification.renderTarget, 'text')
    assert.equal(classification.queryKind, 'ADVISORY')
  })

  it('allows cards when user explicitly asks to view/search listings or provides criteria', () => {
    const searchMsg = 'Show me 3 BHK flats in Sector 75 under 1.5 Cr'
    const intent: Intent = { sector: 'Sector 75', bhk: [3], budgetMax: 1.5, city: 'Noida' }
    const budget = cardBudgetFor(intent, searchMsg)
    assert.ok(budget.limit > 0, 'Cards should be permitted for concrete search')
  })
})

describe('Criterion 3: Zero Sticky / Fallback Sectors on Corridor/City Switch', () => {
  it('clears previous sector when switching to a different city/corridor', () => {
    const previous: Intent = {
      sector: 'Sector 150',
      city: 'Noida',
      bhk: [3],
      budgetMax: 1.5
    }

    // User switches to Noida Extension / Greater Noida West
    const update = {
      city: 'Greater Noida West',
      budgetMax: 1.3
    }

    const merged = mergeIntent(previous, update)
    assert.equal(merged.city, 'Greater Noida West')
    assert.equal(merged.sector, undefined, 'Sector 150 should be cleared because it belongs to Noida, not Greater Noida West')
    assert.equal(merged.budgetMax, 1.3)
    assert.deepEqual(merged.bhk, [3], 'BHK should be retained')
  })
})

describe('Criterion 4: Natural Multi-Turn Delta Updates', () => {
  it('retains active sector and configuration when budget changes', () => {
    const turn1: Intent = {
      sector: 'Sector 75',
      city: 'Noida',
      bhk: [3],
      budgetMax: 1.5
    }

    // Turn 2: "What if my budget is 2 crores?"
    const turn2Update = {
      budgetMax: 2.0,
      queryKind: 'ADVISORY' as const
    }

    const merged = mergeIntent(turn1, turn2Update)
    assert.equal(merged.sector, 'Sector 75', 'Sector 75 must be retained')
    assert.deepEqual(merged.bhk, [3], '3 BHK must be retained')
    assert.equal(merged.budgetMax, 2.0, 'Budget must update to 2.0 Cr')
  })
})

describe('Strict Sector Adjacency without Numeric Hallucinations', () => {
  it('returns exact master-plan adjacent sectors only', () => {
    const adj76 = getNearbySectors('Sector 76')
    assert.ok(Array.isArray(adj76))
    // Should contain known neighbors 75, 77, 78, 79
    assert.ok(adj76.includes('Sector 75') || adj76.includes('Sector 77'))

    // An unmapped sector should NOT return arithmetic +/- numbers
    const unmapped = getNearbySectors('Sector 999')
    assert.deepEqual(unmapped, [], 'Unmapped sector should return empty list, not fake numbers')
  })
})
