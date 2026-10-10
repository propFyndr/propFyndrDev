/**
 * Wave Extraction Pipeline
 * Extracts verified project data from 4 trusted sources:
 * 1. UP RERA website (RERA status, possession date, compliance)
 * 2. Builder website (company profile, track record, past projects)
 * 3. Project website (specifications, amenities, current pricing)
 * 4. Google Maps (location verification, reviews, AQI)
 *
 * Output: audit-trail JSON + SQL upsert
 * Each field tagged with confidence tier (HIGH | MEDIUM | LOW)
 * Source attribution: which site provided each fact
 * Freshness: timestamp of extraction, expiry window per data type
 */

import * as fs from 'fs'
import * as path from 'path'

interface ConfidenceTier {
  tier: 'HIGH' | 'MEDIUM' | 'LOW'
  source: 'rera_website' | 'builder_site' | 'project_site' | 'google_maps' | 'news_archive'
  url?: string
  extracted_at: string
  expires_at: string // Freshness window
  note?: string
}

interface ExtractedField {
  field_name: string
  value: any
  confidence: ConfidenceTier
  previous_value?: any // For change detection
  conflict_detected?: boolean // If sources disagree
  conflict_detail?: string
}

interface ProjectWaveExtraction {
  project_id: string
  project_name: string
  rera_number?: string
  extraction_wave: number
  extraction_timestamp: string
  fields: ExtractedField[]
  conflicts: string[]
  missing_sources: string[]
  data_quality_score: number // 0-100, based on completeness & confidence
  audit_trail: {
    action: string
    timestamp: string
    detail: string
  }[]
}

/**
 * Freshness windows (after which data must be re-fetched)
 */
const FRESHNESS_WINDOWS = {
  possession_date: 30, // days (legal documents change infrequently)
  price: 7, // days (marketing updates often)
  available_units: 7, // days (inventory moves fast)
  builder_track_record: 90, // days (company info static)
  oc_status: 30, // days (regulatory, updated quarterly)
  rera_compliance: 30, // days (RERA amendments)
  google_maps_reviews: 3, // days (real-time feedback)
}

/**
 * Core fields to extract per project
 * Priority order: legal/regulatory > financial > marketing
 */
const EXTRACTION_FIELDS = [
  // Legal & Regulatory (Tier 1)
  { name: 'rera_number', sources: ['rera_website'], tier: 'HIGH', window: 30 },
  { name: 'rera_compliance_score', sources: ['rera_website'], tier: 'HIGH', window: 30 },
  { name: 'possession_date', sources: ['rera_website', 'project_site'], tier: 'HIGH', window: 30 },
  { name: 'oc_obtained', sources: ['rera_website'], tier: 'HIGH', window: 30 },
  { name: 'oc_obtained_date', sources: ['rera_website'], tier: 'HIGH', window: 30 },

  // Financial (Tier 2)
  { name: 'base_price_per_sqft', sources: ['project_site', 'builder_site'], tier: 'MEDIUM', window: 7 },
  { name: 'available_units_count', sources: ['project_site', 'builder_site'], tier: 'MEDIUM', window: 7 },

  // Builder Track Record (Tier 2)
  { name: 'projects_delivered_count', sources: ['builder_site', 'news_archive'], tier: 'MEDIUM', window: 90 },
  { name: 'average_delay_months', sources: ['builder_site', 'news_archive'], tier: 'MEDIUM', window: 90 },

  // Infrastructure & Amenities (Tier 3)
  { name: 'total_units', sources: ['rera_website', 'project_site', 'builder_site'], tier: 'MEDIUM', window: 60 },
  { name: 'total_towers', sources: ['project_site', 'builder_site'], tier: 'MEDIUM', window: 60 },

  // Market & Location (Tier 3)
  { name: 'location_verified', sources: ['google_maps'], tier: 'HIGH', window: 365 },
  { name: 'aqi_annual_avg', sources: ['google_maps'], tier: 'MEDIUM', window: 30 },
  { name: 'google_reviews_count', sources: ['google_maps'], tier: 'MEDIUM', window: 3 },
  { name: 'google_rating', sources: ['google_maps'], tier: 'MEDIUM', window: 3 },
]

/**
 * Extraction strategy per source:
 * - RERA: High-confidence regulatory data, deterministic
 * - Builder site: Company profile, past projects (semi-structured)
 * - Project site: Specs, pricing, amenities (marketing-controlled)
 * - Google Maps: Real-time reviews, location verification (crowd-sourced)
 */

export async function extractWaveData(
  projectIds: string[],
  waveNumber: number
): Promise<ProjectWaveExtraction[]> {
  const extractions: ProjectWaveExtraction[] = []
  const now = new Date().toISOString()

  for (const projectId of projectIds) {
    const extraction: ProjectWaveExtraction = {
      project_id: projectId,
      project_name: '', // Will be populated from JSON
      extraction_wave: waveNumber,
      extraction_timestamp: now,
      fields: [],
      conflicts: [],
      missing_sources: [],
      data_quality_score: 0,
      audit_trail: [
        {
          action: 'extraction_started',
          timestamp: now,
          detail: `Wave ${waveNumber} extraction initiated`,
        },
      ],
    }

    // TODO: Implement per-source extraction
    // 1. Load project JSON → extract basic fields
    // 2. RERA lookup → fetch RERA status, compliance, possession
    // 3. Builder website → fetch track record, past projects
    // 4. Project website → fetch current pricing, available units
    // 5. Google Maps → verify location, fetch reviews/AQI
    // 6. Consolidate → merge conflicts, score confidence
    // 7. Generate SQL diff

    extractions.push(extraction)
  }

  return extractions
}

/**
 * Generate SQL upsert with audit trail
 * Safe: runs in transaction, can rollback per wave
 */
export function generateUpsertSQL(extractions: ProjectWaveExtraction[]): string {
  let sql = `-- Wave ${extractions[0]?.extraction_wave} Upsert\n`
  sql += `-- Timestamp: ${new Date().toISOString()}\n`
  sql += `-- Total projects: ${extractions.length}\n`
  sql += `\nBEGIN TRANSACTION;\n\n`

  for (const ext of extractions) {
    sql += `-- Project: ${ext.project_name} (${ext.project_id})\n`
    sql += `-- Quality Score: ${ext.data_quality_score}/100\n`
    sql += `-- Conflicts: ${ext.conflicts.length}\n\n`

    sql += `UPDATE projects SET\n`
    for (const field of ext.fields) {
      const confidence = field.confidence.tier === 'HIGH' ? 'verified' : 'builder_attested'
      sql += `  ${field.field_name} = ${typeof field.value === 'string' ? `'${field.value}'` : field.value},\n`
      sql += `  data_source = '${field.confidence.source}',\n`
      sql += `  last_verified_at = '${field.confidence.extracted_at}',\n`
      sql += `  verification_level = '${confidence}',\n`
    }
    sql += `  updated_at = NOW()\n`
    sql += `WHERE id = '${ext.project_id}';\n\n`
  }

  sql += `-- Rollback plan: ROLLBACK;\n`
  sql += `COMMIT;\n`

  return sql
}

export async function main() {
  console.log('Wave Extraction Pipeline v1')
  console.log('Awaiting project list and source data...\n')

  // Placeholder: actual extraction will be implemented in the execution phase
  console.log('Pipeline ready. Awaiting Wave 1 projects...')
}

main()
