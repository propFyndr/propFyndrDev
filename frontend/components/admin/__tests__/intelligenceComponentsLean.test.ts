import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('admin intelligence components — lean schema cutover', () => {
  const files = ['ProjectForm.tsx', 'InvestmentInsightsEditor.tsx', 'LocationIntelligenceEditor.tsx', 'IntelligenceWorkspace.tsx']
  const dropped = [
    'women_safety_score', 'nri_eligible', 'vastu_compliant', 'noise_level_db',
    'market_demand_score', 'appreciation_potential_5yr', 'resale_lock_in_months',
    'escrow_verified', 'has_png_gas_pipeline', 'mobile_network_rating',
    'has_service_lift', 'authority_dues_cleared', 'land_tenure', 'pet_friendly',
    'bachelor_tenants_allowed', 'schools_nearby_count', 'hospitals_nearby_count',
    'shopping_nearby_count', 'it_parks_nearby_count', 'banks_nearby_count',
    'restaurants_nearby_count', 'aqi_annual_avg',
    'ProjectDna', 'RecommendationProfile', 'PersonaProfile',
  ]

  for (const file of files) {
    it(`${file} references no dropped field or model`, () => {
      const src = readFileSync(join(__dirname, '..', file), 'utf8')
      for (const f of dropped) assert.doesNotMatch(src, new RegExp(`\\b${f}\\b`), `${file} still references ${f}`)
    })
  }
})
