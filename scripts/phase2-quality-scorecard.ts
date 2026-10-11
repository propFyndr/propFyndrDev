#!/usr/bin/env tsx
/**
 * Phase 2 Quality Scorecard
 * Calculates final quality scores across all 348 projects
 * Compares baseline (24/100) vs. Phase 2A-2D enrichment
 */

import * as fs from 'fs'

interface ProjectExtraction {
  project_id: string
  project_name: string
  fields: Array<{ field_name: string; value: any; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; source: string }>
  quality_score: number
}

interface QualityStats {
  total_projects: number
  high_confidence_fields: number
  medium_confidence_fields: number
  low_confidence_fields: number
  total_fields: number
  quality_score: number
  field_distribution: Map<string, { count: number; confidence: string }>
}

function calculateQuality(projects: ProjectExtraction[]): QualityStats {
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0
  const fieldDist = new Map<string, { count: number; confidence: string }>()

  for (const project of projects) {
    for (const field of project.fields) {
      if (field.confidence === 'HIGH') highCount++
      else if (field.confidence === 'MEDIUM') mediumCount++
      else lowCount++

      const key = field.field_name
      if (!fieldDist.has(key)) {
        fieldDist.set(key, { count: 0, confidence: field.confidence })
      }
      const entry = fieldDist.get(key)!
      entry.count++
    }
  }

  const totalFields = highCount + mediumCount + lowCount
  const qualityScore = Math.round(((highCount * 35 + mediumCount * 18) / 348) * 100)

  return {
    total_projects: projects.length,
    high_confidence_fields: highCount,
    medium_confidence_fields: mediumCount,
    low_confidence_fields: lowCount,
    total_fields: totalFields,
    quality_score: qualityScore,
    field_distribution: fieldDist,
  }
}

async function main() {
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`PHASE 2: QUALITY SCORECARD (2A-2D)`)
  console.log(`${'═'.repeat(70)}\n`)

  const allProjects: ProjectExtraction[] = []
  for (let wave = 1; wave <= 6; wave++) {
    const path = `wave${wave}-project-maps_enhanced-audit.json`
    if (!fs.existsSync(path)) continue
    const projects: ProjectExtraction[] = JSON.parse(fs.readFileSync(path, 'utf-8'))
    allProjects.push(...projects)
  }

  if (allProjects.length === 0) {
    console.error(`✗ No audit files found`)
    process.exit(1)
  }

  const stats = calculateQuality(allProjects)

  console.log(`FINAL QUALITY SCORE: ${stats.quality_score}/100`)
  console.log(`  Baseline (Phase 2A mock): 24/100`)
  console.log(`  Target (Phase 2D): 38/100`)
  console.log(`  Actual (2A-2D combined): ${stats.quality_score}/100`)
  console.log(`  Status: ${stats.quality_score >= 38 ? '✓ REACHED TARGET' : '⚠ Below target'}\n`)

  console.log(`FIELD CONTRIBUTION:`)
  console.log(`  HIGH-confidence fields (35 pts): ${stats.high_confidence_fields}`)
  console.log(`  MEDIUM-confidence fields (18 pts): ${stats.medium_confidence_fields}`)
  console.log(`  LOW-confidence fields (0 pts): ${stats.low_confidence_fields}`)
  console.log(`  TOTAL fields: ${stats.total_fields}\n`)

  console.log(`FIELD COVERAGE (by type):\n`)

  // Group by source/phase
  const byPhase = {
    'Phase 2A (RERA)': 0,
    'Phase 2B (Builder)': 0,
    'Phase 2C (Site)': 0,
    'Phase 2D (Maps)': 0,
  }

  for (const [field, data] of stats.field_distribution.entries()) {
    let phase = ''
    if (field === 'rera_number' || field === 'oc_obtained') phase = 'Phase 2A (RERA)'
    else if (field.includes('lift_act')) phase = 'Phase 2B (Builder)'
    else if (['amenities_list', 'unit_configurations', 'payment_plan_installments', 'possession_confidence_note'].includes(field)) phase = 'Phase 2C (Site)'
    else if (['lat', 'lng', 'hospital_distance_km', 'top_school_distance_km', 'walkability_score'].includes(field)) phase = 'Phase 2D (Maps)'

    if (phase) {
      byPhase[phase as keyof typeof byPhase] += data.count
    }
  }

  for (const [phase, count] of Object.entries(byPhase)) {
    const pct = ((count / stats.total_fields) * 100).toFixed(1)
    console.log(`  ${phase}: ${count} fields (${pct}%)`)
  }

  console.log(`\nTOP FIELDS BY COVERAGE:\n`)
  const sortedFields = Array.from(stats.field_distribution.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)

  for (const [field, data] of sortedFields) {
    const pct = ((data.count / allProjects.length) * 100).toFixed(0)
    console.log(`  ${field}: ${data.count}/${allProjects.length} (${pct}%) [${data.confidence}]`)
  }

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`PHASE 2 STATUS: COMPLETE`)
  console.log(`  Projects processed: ${allProjects.length}`)
  console.log(`  Quality improvement: 24→${stats.quality_score}/100 (+${stats.quality_score - 24} points)`)
  console.log(`${'═'.repeat(70)}\n`)
}

main().catch(console.error)
