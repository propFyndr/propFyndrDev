import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8')

describe('lean schema + source tracking (sub-project A)', () => {
  it('adds the FactVerification model with the spec shape', () => {
    assert.match(schema, /model FactVerification \{/)
    for (const field of ['entityType', 'entityId', 'fieldName', 'tier', 'sourceUrl', 'sourceDoc', 'verifiedAt', 'verifiedBy']) {
      assert.match(schema, new RegExp(`\\b${field}\\b`), `FactVerification missing ${field}`)
    }
    assert.match(schema, /@@unique\(\[entityType, entityId, fieldName\]\)/)
  })

  it('adds the FactTier enum with the five source-provenance values', () => {
    assert.match(schema, /enum FactTier \{\s*SCRAPED\s*BUILDER_ATTESTED\s*VERIFIED\s*STATUTORY\s*COMPUTED\s*\}/)
  })

  it('gives Project a dedicated duplicate-archival field instead of overloading status', () => {
    assert.match(schema, /archived_duplicate_of\s+String\?/)
  })

  it('drops every field the spec names as templated with zero real signal', () => {
    const droppedProjectFields = [
      'women_safety_score', 'market_demand_score', 'appreciation_potential_5yr',
      'construction_quality_rating', 'buyer_satisfaction_rating', 'handover_defect_rate',
      'noise_level_db', 'mobile_network_rating', 'schools_nearby_count',
      'hospitals_nearby_count', 'shopping_nearby_count', 'it_parks_nearby_count',
      'banks_nearby_count', 'restaurants_nearby_count', 'college_distance_km',
      'competing_projects_nearby', 'resale_lock_in_months', 'price_includes_plc',
      'price_includes_club', 'price_includes_taxes', 'aqi_annual_avg',
      'vastu_compliant', 'north_facing_units', 'east_facing_preferred', 'nri_eligible',
      'pet_friendly', 'bachelor_tenants_allowed', 'authority_dues_cleared',
      'has_png_gas_pipeline', 'has_service_lift', 'escrow_verified', 'nclt_status',
      'legal_flag', 'land_tenure', 'rera_compliance_score', 'average_builder_delay_months',
    ]
    // rera_compliance_score must be gone from Project's own block but stay on Builder —
    // check it does not appear between "model Project {" and the matching close.
    const projectBlock = /model Project \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? ''
    for (const f of droppedProjectFields) {
      assert.doesNotMatch(projectBlock, new RegExp(`\\n\\s*${f}\\s`), `Project.${f} should be dropped`)
    }
    assert.match(schema, /model Builder \{[\s\S]*?rera_compliance_score/, 'Builder.rera_compliance_score must stay')
    assert.match(schema, /model Builder \{[\s\S]*?average_delay_months/, 'Builder.average_delay_months must stay')
  })

  it('drops the UnitType and CostSheet fields the spec names', () => {
    const unitTypeBlock = /model UnitType \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? ''
    for (const f of ['layout_variant_name', 'price_is_estimated', 'efficiency_rating', 'views', 'perfect_for', 'key_highlights', 'inventory_left', 'layout_pros', 'layout_cons', 'has_study', 'utility_area_sqft', 'layout_efficiency_pct']) {
      assert.doesNotMatch(unitTypeBlock, new RegExp(`\\n\\s*${f}\\s`), `UnitType.${f} should be dropped`)
    }
    assert.match(unitTypeBlock, /carpet_to_super_ratio_pct/, 'UnitType.carpet_to_super_ratio_pct must stay (merged target)')

    const costSheetBlock = /model CostSheet \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? ''
    assert.doesNotMatch(costSheetBlock, /\n\s*base_interest_rate\s/)
  })

  it('drops ProjectDna, RecommendationProfile, PersonaProfile entirely', () => {
    for (const model of ['ProjectDna', 'RecommendationProfile', 'PersonaProfile']) {
      assert.doesNotMatch(schema, new RegExp(`model ${model} \\{`), `${model} should be dropped`)
    }
    assert.match(schema, /model DecisionProfile \{/, 'DecisionProfile must stay')
  })
})
