import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { scoreProject, computeBudgetStatus, buildPriceRangeLabel } from '../scoring'
import { SCORE_THRESHOLD } from '../constants'
import type { Intent } from '../types'

/** Minimal valid scoreProject candidate — override per test. */
function baseProject(overrides: Partial<Parameters<typeof scoreProject>[0]> = {}): Parameters<typeof scoreProject>[0] {
  return {
    unit_types: [{ bhk: 3, price_min_cr: 1.5, price_max_cr: 2.0, carpet_area_sqft: 1200 }],
    possession_date: null,
    amenities: [],
    ai_search_keywords: [],
    builder: {},
    hero_image_url: null,
    images: [],
    rera_number: 'UPRERAPRJ1234',
    ...overrides,
  }
}

describe('Scoring: Price Range Label', () => {
  it('formats range with min and max', () => {
    const label = buildPriceRangeLabel(1.5, 2.5)
    assert.equal(label, '₹1.50–2.50Cr')
  })

  it('formats with min only (+ notation)', () => {
    const label = buildPriceRangeLabel(2.0, null)
    assert.equal(label, '₹2.00Cr+')
  })

  it('returns "Price on request" when no data', () => {
    const label = buildPriceRangeLabel(null, null)
    assert.equal(label, 'Price on request')
  })
})

describe('Scoring: Budget Status', () => {
  it('returns "within" when project min ≤ intent max', () => {
    const unitTypes = [{ price_min_cr: 1.5 }]
    const intent: Intent = { budgetMax: 2.0 }
    const status = computeBudgetStatus(unitTypes, intent)
    assert.equal(status, 'within')
  })

  it('returns "slightly_over" when project within tolerance', () => {
    const unitTypes = [{ price_min_cr: 2.1 }]
    const intent: Intent = { budgetMax: 2.0 }
    const status = computeBudgetStatus(unitTypes, intent)
    assert.equal(status, 'slightly_over')
  })

  it('returns "over" when project significantly exceeds budget', () => {
    const unitTypes = [{ price_min_cr: 3.0 }]
    const intent: Intent = { budgetMax: 2.0 }
    const status = computeBudgetStatus(unitTypes, intent)
    assert.equal(status, 'over')
  })

  it('uses lowest price when multiple unit types', () => {
    const unitTypes = [
      { price_min_cr: 5.0 },
      { price_min_cr: 2.0 },
      { price_min_cr: 3.5 },
    ]
    const intent: Intent = { budgetMax: 2.5 }
    const status = computeBudgetStatus(unitTypes, intent)
    assert.equal(status, 'within')
  })

  it('returns undefined when no budget intent', () => {
    const unitTypes = [{ price_min_cr: 2.0 }]
    const intent: Intent = {}
    const status = computeBudgetStatus(unitTypes, intent)
    assert.equal(status, undefined)
  })

  it('returns undefined when no price data', () => {
    const unitTypes = [{ price_min_cr: null }]
    const intent: Intent = { budgetMax: 2.0 }
    const status = computeBudgetStatus(unitTypes, intent)
    assert.equal(status, undefined)
  })
})

describe('Scoring: NCLT / insolvency disqualification', () => {
  // base.ts HARD RULES 6a/6b forbid recommending a legal_flag builder or a
  // project_risk_flag project unconditionally, with no risk-profile
  // qualifier. Retrieval must not be more permissive than the prompt it
  // feeds — an ordinary buyer with no extracted risk profile must still get
  // zero score (and so zero results) for an NCLT/insolvency-flagged project.

  it('disqualifies a builder.legal_flag NCLT project even with no risk profile on intent', () => {
    const intent: Intent = {} // no riskProfile set — the ordinary-buyer case
    const p = baseProject({ builder: { legal_flag: 'NCLT moratorium active' } })
    const score = scoreProject(p, intent)
    assert.equal(score, 0)
    assert.ok(score < SCORE_THRESHOLD, 'must fall below SCORE_THRESHOLD so scoreAndSort excludes it, not demotes it')
  })

  it('disqualifies a project_risk_flag insolvency project even with no risk profile on intent', () => {
    const intent: Intent = {}
    const p = baseProject({ project_risk_flag: 'Insolvency proceedings ongoing' })
    const score = scoreProject(p, intent)
    assert.equal(score, 0)
  })

  it('still disqualifies when a risk profile IS set (no regression on the old path)', () => {
    const intent: Intent = { riskProfile: 'nri' }
    const p = baseProject({ builder: { legal_flag: 'NCLT' } })
    const score = scoreProject(p, intent)
    assert.equal(score, 0)
  })

  it('does not disqualify a clean project with no flags', () => {
    const intent: Intent = {}
    const p = baseProject()
    const score = scoreProject(p, intent)
    assert.ok(score > 0)
  })
})

describe('Scoring: Project Score', () => {
  const baseProject = {
    unit_types: [
      {
        bhk: 3,
        price_min_cr: 2.0,
        price_max_cr: 2.5,
        carpet_area_sqft: 1200,
      }
    ],
    possession_date: new Date('2025-06-01'),
    amenities: [
      { name: 'Swimming Pool' },
      { name: 'Gym' },
      { name: 'Park' },
    ],
    ai_search_keywords: ['metro', 'mall', 'school'],
    builder: {
      credai_member: true,
      delivered_units: 5000,
      awards_count: 3,
      legal_flag: null,
    },
    hero_image_url: 'https://example.com/image.jpg',
    images: [{ type: 'interior' }, { type: 'exterior' }],
    rera_number: 'UPRERAPRJ123456',
    recommendation_profile: { tier: 'premium' },
    project_risk_flag: null,
    persona_profile: { primary_persona: 'first_time_buyer' },
  }

  it('scores within-budget projects with possession within 6 months highest', () => {
    const intent: Intent = { budgetMax: 2.0, possession: 'immediate' }
    const score1 = scoreProject({ ...baseProject, possession_date: new Date() }, intent)

    const futureProject = {
      ...baseProject,
      possession_date: new Date('2027-01-01'),
    }
    const score2 = scoreProject(futureProject, intent)

    assert(score1 > score2, 'Recent possession should score higher')
  })

  // "maximum score never exceeds 60" — this test used to assert exactly that,
  // and passed, without ever setting recommendation_profile.tier to a value
  // that earns a bonus, persona_profile alongside intent.purpose, or a
  // sectorTier argument. A passing test that avoids the code paths it claims
  // to cover is worse than no test: it told the next reader this was
  // verified. It wasn't — scoreProject stacks tier (+8), persona (+5), sector
  // tier (+10) and market-tier bias (+20) on top of the 59-point base signal
  // total, so the real ceiling is well past 60. Split into two tests: the
  // true base-signal cap (no bonus category populated), and proof the score
  // genuinely exceeds it once those categories are.
  it('base signals alone (no tier/persona/sectorTier/budget bonus) never exceed 59', () => {
    const intent: Intent = {} // no budgetMax → market-tier bias never fires either
    const noBonusProject = {
      ...baseProject,
      recommendation_profile: null,
      persona_profile: null,
    }
    const score = scoreProject(noBonusProject, intent)
    assert(score <= 59, `Score ${score} exceeds the 59-point base-signal cap`)
  })

  it('stacks tier + persona + sectorTier + market-tier bias past the base-signal cap', () => {
    const intent: Intent = { budgetMax: 2.5, purpose: 'investment' }
    const maxedProject = {
      ...baseProject,
      recommendation_profile: { tier: 'STRONG_BUY' },
      persona_profile: { primary_persona: 'INVESTOR' },
    }
    const score = scoreProject(maxedProject, intent, 'within', 'tier1')
    assert(score > 59, `Score ${score} did not exceed the base-signal cap — a bonus category silently stopped contributing`)
  })

  it('applies penalty for slightly_over budget', () => {
    const baseIntent: Intent = { budgetMax: 2.0 }
    const scoreWithin = scoreProject(baseProject, baseIntent, 'within')

    const overProject = {
      ...baseProject,
      unit_types: [
        {
          bhk: 3,
          price_min_cr: 2.15, // slightly over
          price_max_cr: 2.5,
          carpet_area_sqft: 1200,
        }
      ],
    }
    const scoreOver = scoreProject(overProject, baseIntent, 'slightly_over')

    assert(scoreWithin > scoreOver, 'Slightly over budget should have lower score')
  })

  it('applies larger penalty for significantly over budget', () => {
    const baseIntent: Intent = { budgetMax: 2.0 }

    const slightlyOverProject = {
      ...baseProject,
      unit_types: [
        {
          bhk: 3,
          price_min_cr: 2.15,
          price_max_cr: 2.5,
          carpet_area_sqft: 1200,
        }
      ],
    }
    const scoreSlightlyOver = scoreProject(slightlyOverProject, baseIntent, 'slightly_over')

    const significantlyOverProject = {
      ...baseProject,
      unit_types: [
        {
          bhk: 3,
          price_min_cr: 3.0,
          price_max_cr: 3.5,
          carpet_area_sqft: 1200,
        }
      ],
    }
    const scoreOver = scoreProject(significantlyOverProject, baseIntent, 'over')

    assert(scoreSlightlyOver > scoreOver, 'Significantly over budget should have larger penalty')
  })

  it('score is never negative', () => {
    const intent: Intent = { budgetMax: 1.0 }
    const expensiveProject = {
      ...baseProject,
      unit_types: [
        {
          bhk: 3,
          price_min_cr: 10.0,
          price_max_cr: 15.0,
          carpet_area_sqft: 1200,
        }
      ],
    }
    const score = scoreProject(expensiveProject, intent)
    assert(score >= 0, `Score ${score} should never be negative`)
  })

  it('projects without required data still score (graceful degradation)', () => {
    const minimalProject = {
      unit_types: [{ bhk: 3, price_min_cr: null, price_max_cr: null, carpet_area_sqft: null }],
      possession_date: null,
      amenities: [],
      ai_search_keywords: [],
      builder: {},
      hero_image_url: null,
      images: [],
      rera_number: null,
      recommendation_profile: null,
      project_risk_flag: null,
      persona_profile: null,
    }
    const intent: Intent = { budgetMax: 2.0 }
    const score = scoreProject(minimalProject, intent)
    assert(typeof score === 'number' && !isNaN(score), 'Should return valid score even with minimal data')
  })
})
