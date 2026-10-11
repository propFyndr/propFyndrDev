#!/usr/bin/env tsx
/**
 * Generate Phase 2A Consolidated SQL from RERA-enhanced audits
 */

import * as fs from 'fs'

interface ProjectExtraction {
  project_id: string
  project_name: string
  fields: Array<{ field_name: string; value: any; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; source: string }>
  quality_score: number
}

const VALID_COLUMNS = new Set([
  'rera_number',
  'rera_url',
  'total_units',
  'total_towers',
  'status',
  'possession_date',
  'possession_label',
  'possession_confidence',
  'possession_confidence_note',
  'oc_obtained',
  'oc_obtained_date',
  'oc_valid_until',
  'oc_restrictions',
  'rera_valid_until',
  'legal_flag_detail',
  'litigation_count',
  'water_source',
  'land_title_clear',
  'fir_against_project',
  'approvals_status',
  'expected_handover_quarter',
  'ongoing_litigation_count',
  'nclt_moratorium_active',
  'air_quality_index_avg',
  'lift_act_compliant',
])

function generateSQL(projects: ProjectExtraction[]): string {
  let sql = `-- PHASE 2A: Real RERA Data via Tavily\n`
  sql += `-- Generated: ${new Date().toISOString()}\n`
  sql += `-- Total projects: ${projects.length}\n`
  sql += `-- Quality: ${Math.round(projects.reduce((s, p) => s + p.quality_score, 0) / projects.length)}/100\n\n`

  sql += `BEGIN TRANSACTION;\n\n`

  let updateCount = 0
  for (const project of projects) {
    if (!project.fields || project.fields.length === 0) continue

    const updates: Array<{ name: string; val: string }> = []

    for (const field of project.fields) {
      if (!VALID_COLUMNS.has(field.field_name)) continue
      if (field.value === null || field.value === undefined) continue

      let val: string
      if (typeof field.value === 'string') {
        val = `'${field.value.replace(/'/g, "''")}'`
      } else if (typeof field.value === 'boolean') {
        val = field.value ? 'true' : 'false'
      } else {
        val = String(field.value)
      }

      updates.push({ name: field.field_name, val })
    }

    if (updates.length === 0) continue

    updateCount++
    sql += `-- ${project.project_name} (${updates.length} fields, quality: ${project.quality_score})\n`
    sql += `UPDATE projects SET\n`
    sql += updates.map(u => `  ${u.name} = ${u.val}`).join(',\n')
    sql += `\nWHERE id = '${project.project_id}';\n\n`
  }

  sql += `SELECT COUNT(*) as updated FROM projects WHERE updated_at > NOW() - INTERVAL '1 minute';\n`
  sql += `COMMIT;\n`

  return sql
}

async function main() {
  console.log(`Generating Phase 2A SQL from RERA-enhanced audits...\n`)

  const allProjects: ProjectExtraction[] = []

  for (let wave = 1; wave <= 6; wave++) {
    const path = `wave${wave}-project-rera_enhanced-audit.json`
    if (!fs.existsSync(path)) {
      console.log(`⚠ ${path} not found`)
      continue
    }

    console.log(`Loading ${path}...`)
    const projects: ProjectExtraction[] = JSON.parse(fs.readFileSync(path, 'utf-8'))
    allProjects.push(...projects)
  }

  console.log(`✓ Loaded ${allProjects.length} projects\n`)

  const sql = generateSQL(allProjects)
  const sqlPath = 'phase2a-consolidated-rera-upsert.sql'
  fs.writeFileSync(sqlPath, sql)

  const avgQuality = Math.round(allProjects.reduce((s, p) => s + p.quality_score, 0) / allProjects.length)
  console.log(`✓ Generated: ${sqlPath}`)
  console.log(`✓ Projects: ${allProjects.length}`)
  console.log(`✓ Quality: ${avgQuality}/100\n`)
}

main().catch(console.error)
