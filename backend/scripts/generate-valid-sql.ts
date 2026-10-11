#!/usr/bin/env tsx
/**
 * Generate SQL using only columns that exist in projects table
 */

import * as fs from 'fs'
import * as path from 'path'

interface ProjectExtraction {
  project_id: string
  project_name: string
  fields: Array<{
    field_name: string
    value: any
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'
    source: string
  }>
  quality_score: number
}

// Valid columns from actual schema
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
  let sql = `-- CONSOLIDATED UPSERT: Phase 2 Enhancements\n`
  sql += `-- Generated: ${new Date().toISOString()}\n`
  sql += `-- Total projects: ${projects.length}\n`
  sql += `-- Quality: ${Math.round(projects.reduce((s, p) => s + p.quality_score, 0) / projects.length)}/100\n`
  sql += `-- Using only valid columns from projects schema\n\n`

  sql += `BEGIN TRANSACTION;\n\n`

  let updateCount = 0
  for (const project of projects) {
    if (!project.fields || project.fields.length === 0) continue

    const updates: Array<{ name: string; val: string }> = []

    // Filter to only valid columns
    for (const field of project.fields) {
      if (!VALID_COLUMNS.has(field.field_name)) continue
      if (field.value === null || field.value === undefined) continue

      let val: string
      if (typeof field.value === 'string') {
        val = `'${field.value.replace(/'/g, "''")}'`
      } else if (typeof field.value === 'boolean') {
        val = field.value ? 'true' : 'false'
      } else if (field.value instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(String(field.value))) {
        val = `'${field.value}'`
      } else {
        val = String(field.value)
      }

      updates.push({ name: field.field_name, val })
    }

    if (updates.length === 0) continue

    updateCount++
    sql += `-- Project: ${project.project_name} (${updates.length} fields, quality: ${project.quality_score}/100)\n`
    sql += `UPDATE projects SET\n`
    sql += updates.map(u => `  ${u.name} = ${u.val}`).join(',\n')
    sql += `\nWHERE id = '${project.project_id}';\n\n`
  }

  sql += `-- Verification\n`
  sql += `SELECT COUNT(*) as projects_updated,\n`
  sql += `       COUNT(CASE WHEN rera_number IS NOT NULL THEN 1 END) as with_rera,\n`
  sql += `       COUNT(CASE WHEN oc_obtained IS NOT NULL THEN 1 END) as with_oc\n`
  sql += `FROM projects\n`
  sql += `WHERE updated_at > NOW() - INTERVAL '5 minutes';\n\n`

  sql += `COMMIT;\n`

  return sql
}

async function main() {
  console.log(`Generating SQL with valid columns...\n`)

  const allProjects: ProjectExtraction[] = []

  // Load all audits
  for (let wave = 1; wave <= 6; wave++) {
    const auditPath = `wave${wave}-project-enhanced-audit.json`
    if (!fs.existsSync(auditPath)) {
      console.log(`⚠ ${auditPath} not found`)
      continue
    }

    console.log(`Loading ${auditPath}...`)
    const projects: ProjectExtraction[] = JSON.parse(fs.readFileSync(auditPath, 'utf-8'))
    allProjects.push(...projects)
  }

  console.log(`✓ Loaded ${allProjects.length} projects\n`)

  // Generate SQL
  const sql = generateSQL(allProjects)

  // Save
  const sqlPath = 'phase2-consolidated-valid-columns.sql'
  fs.writeFileSync(sqlPath, sql)

  console.log(`✓ Generated: ${sqlPath}`)
  console.log(`✓ File size: ${(sql.length / 1024).toFixed(1)}KB`)
  console.log(`✓ Ready to apply to database\n`)

  // Preview
  console.log(`First UPDATE statement:`)
  const lines = sql.split('\n').slice(0, 20)
  console.log(lines.join('\n'))
}

main().catch(console.error)
