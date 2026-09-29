import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildProjectFacts,
  projectScalarFacts,
  detectIntentSlice,
  PRICING_FACT_FIELDS,
  LEGAL_FACT_FIELDS,
  LIVABILITY_FACT_FIELDS,
} from '../../projectFactsBlock'
import { estimateTokensReal } from '../../ai/tokenizer'

function mockFullProjectRow() {
  return {
    id: 'proj_mock_1',
    name: 'Godrej Woods',
    sector: 'Sector 43',
    city: 'Noida',
    status: 'under_construction',
    possession_date: '2026-12-31',
    possession_label: 'Dec 2026',
    price_min_cr: 2.25,
    price_max_cr: 5.5,
    price_range_label: '₹2.25 - 5.5 Cr',
    price_per_sqft: 14500,
    maintenance_per_sqft_monthly: 4.5,
    gst_pass_through: true,
    price_includes_plc: true,
    price_includes_club: false,
    price_includes_taxes: false,
    dg_power_rate_per_unit: 18.5,
    resale_lock_in_months: 12,
    rera_number: 'UPRERAPRJ7047',
    land_title_clear: true,
    nclt_moratorium_active: false,
    authority_dues_cleared: true,
    fir_against_project: false,
    litigation_count: 0,
    ongoing_litigation_count: 0,
    escrow_verified: true,
    oc_obtained: false,
    open_space_pct: 78,
    green_cover_percent: 65,
    walkability_score: 82,
    women_safety_score: 88,
    construction_quality_rating: 4.5,
    buyer_satisfaction_rating: 4.2,
    noise_level_db: 52,
    pet_friendly: true,
    bachelor_tenants_allowed: false,
    vastu_compliant: true,
    top_school_distance_km: 1.8,
    hospital_distance_km: 2.4,
    airport_distance_km: 42,
    has_security_24x7: true,
    has_cctv: true,
    street_lights: true,
    has_png_gas_pipeline: true,
    has_service_lift: true,
    total_units: 1200,
    total_towers: 10,
    ceiling_height_ft: 11.5,
    description: 'A premium forest-themed luxury project in central Noida with 10 residential towers.',
    builder: {
      name: 'Godrej Properties',
      founded_year: 1990,
      delivered_projects: 85,
    },
    unit_types: [
      { bhk: 2, super_area_sqft: 1250, price_min_cr: 2.25 },
      { bhk: 3, super_area_sqft: 1850, price_min_cr: 3.45 },
      { bhk: 4, super_area_sqft: 2600, price_min_cr: 5.15 },
    ],
    amenities: Array.from({ length: 30 }, (_, i) => ({ name: `Amenity Item ${i + 1}` })),
    connectivity: [
      { name: 'Golf Course Metro', distance_km: 1.2, travel_time_min: 5 },
      { name: 'Noida Expressway', distance_km: 2.0, travel_time_min: 6 },
    ],
    payment_plans: [
      { plan_name: 'Construction Linked (CLP)', description: '10:80:10' },
      { plan_name: 'Subvention Plan', description: '20:80' },
    ],
    cost_sheet: {
      base_price_per_sqft: 14500,
      club_charges: 250000,
      ifms: 50,
      car_parking: 400000,
    },
    decision_profile: {
      decision_thesis: 'Strong central location with premium developer execution credibility.',
      market_intelligence: 'Long detailed narrative about Noida Sector 43 market dynamics...',
      financial_intelligence: 'Detailed analysis of payment plans and financial viability...',
    },
  }
}

describe('Phase 2.2 — Intent-Scoped JIT Fact Projection (Field-Diet Engine)', () => {
  it('detects intent slices from buyer query phrasing', () => {
    assert.equal(detectIntentSlice('What are the payment plans and price per sqft?'), 'pricing')
    assert.equal(detectIntentSlice('Show me the cheapest 3 BHK rates and maintenance costs'), 'pricing')
    assert.equal(detectIntentSlice('Does this project have an active RERA number and any litigation?'), 'legal')
    assert.equal(detectIntentSlice('Is there any court dispute, NCLT case or pending authority dues?'), 'legal')
    assert.equal(detectIntentSlice('What amenities does it have? Is there a swimming pool and park?'), 'livability')
    assert.equal(detectIntentSlice('How far is the metro and top schools? Is it pet friendly?'), 'livability')
    assert.equal(detectIntentSlice('Tell me about Godrej Woods'), null)
  })

  it('pricing slice includes pricing fields and excludes amenities/connectivity', () => {
    const raw = mockFullProjectRow()
    const facts = buildProjectFacts(raw as any, { intentSlice: 'pricing' })

    // Preserved pricing fields
    assert.ok(facts.name === 'Godrej Woods')
    assert.ok(facts.price_min_cr === '2.25 Cr')
    assert.equal((facts.cost_sheet as any)?.base_price_per_sqft, '14500')
    assert.ok(facts.maintenance_per_sqft_monthly)
    assert.ok(facts.payment_plans)
    assert.ok(facts.cost_sheet)

    // Excluded non-pricing items
    assert.equal(facts.amenities, undefined, 'amenities should be excluded from pricing slice')
    assert.equal(facts.connectivity, undefined, 'connectivity should be excluded from pricing slice')
    assert.equal(facts.open_space_pct, undefined, 'open space pct excluded from pricing slice')
    assert.equal(facts.walkability_score, undefined, 'walkability excluded from pricing slice')
    assert.equal(facts.rera_number, undefined, 'rera number excluded from pricing slice')
  })

  it('drops full project row under pricing slice to <= 750 tokens', () => {
    const raw = mockFullProjectRow()
    const fullFacts = buildProjectFacts(raw as any)
    const dietFacts = buildProjectFacts(raw as any, { intentSlice: 'pricing' })

    const fullJson = JSON.stringify(fullFacts)
    const dietJson = JSON.stringify(dietFacts)

    const fullTokens = estimateTokensReal(fullJson)
    const dietTokens = estimateTokensReal(dietJson)

    assert.ok(
      dietTokens <= 750,
      `Diet tokens (${dietTokens}) must be <= 750 (was full: ${fullTokens} tokens)`,
    )
    assert.ok(
      dietJson.length < fullJson.length * 0.6,
      `Diet facts length (${dietJson.length}) must be at least 40% smaller than full facts (${fullJson.length})`,
    )
  })

  it('legal slice retains legal standing and excludes amenities & cost sheet', () => {
    const raw = mockFullProjectRow()
    const facts = buildProjectFacts(raw as any, { intentSlice: 'legal' })

    assert.ok(facts.name === 'Godrej Woods')
    assert.ok(facts.rera_number === 'UPRERAPRJ7047')
    assert.ok(facts.land_title_clear === 'clear')

    assert.equal(facts.amenities, undefined)
    assert.equal(facts.connectivity, undefined)
    assert.equal(facts.payment_plans, undefined)
    assert.equal(facts.cost_sheet, undefined)
    assert.equal(facts.price_min_cr, undefined)
  })

  it('livability slice retains amenities, connectivity and green cover while excluding payment plans & cost sheet', () => {
    const raw = mockFullProjectRow()
    const facts = buildProjectFacts(raw as any, { intentSlice: 'livability' })

    assert.ok(facts.name === 'Godrej Woods')
    assert.ok(facts.open_space_pct === '78%')
    assert.ok(facts.green_cover_percent === '65%')
    assert.ok(facts.walkability_score === '82/100')
    assert.ok(facts.pet_friendly === 'pet friendly')
    assert.ok(facts.amenities && Array.isArray(facts.amenities))
    assert.ok(facts.connectivity && Array.isArray(facts.connectivity))

    assert.equal(facts.payment_plans, undefined)
    assert.equal(facts.cost_sheet, undefined)
    assert.equal(facts.price_min_cr, undefined)
  })

  it('HARD RULE 6f: Mandatory legal disclosure is ALWAYS preserved even on pricing or livability slices', () => {
    const rawWithRisk = {
      ...mockFullProjectRow(),
      litigation_count: 5,
      ongoing_litigation_count: 2,
      nclt_moratorium_active: true,
      builder: {
        name: 'Amrapali Group',
        insolvency_history: true,
        legal_flag: 'NCLT_SUPERVISION',
      },
    }

    // Check pricing slice
    const pricingFacts = buildProjectFacts(rawWithRisk as any, { intentSlice: 'pricing' })
    assert.ok(
      pricingFacts.developer_legal_standing,
      'developer_legal_standing must NOT be stripped from pricing slice',
    )
    assert.ok(
      pricingFacts.legal_risk_summary,
      'legal_risk_summary must NOT be stripped from pricing slice',
    )
    assert.match(
      pricingFacts.legal_risk_summary as string,
      /MANDATORY LEGAL DISCLOSURE/,
      'Must contain mandatory legal disclosure banner',
    )

    // Check livability slice
    const livabilityFacts = buildProjectFacts(rawWithRisk as any, { intentSlice: 'livability' })
    assert.ok(
      livabilityFacts.developer_legal_standing,
      'developer_legal_standing must NOT be stripped from livability slice',
    )
    assert.ok(
      livabilityFacts.legal_risk_summary,
      'legal_risk_summary must NOT be stripped from livability slice',
    )
  })
})
