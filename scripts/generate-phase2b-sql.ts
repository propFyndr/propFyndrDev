#!/usr/bin/env tsx
import * as fs from 'fs'

interface ProjectExtraction {
  project_id: string
  project_name: string
  fields: Array<{ field_name: string; value: any; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; source: string }>
  quality_score: number
}

const VALID_COLUMNS = new Set([
  'projects_delivered_count', 'average_builder_delay_months', 'lift_act_compliant', 'awards_count',
  'rera_number', 'oc_obtained', 'possession_date', 'possession_label', 'total_units', 'status',
])

function generateSQL(projects: ProjectExtraction[]): string {
  let sql = `-- PHASE 2B: Builder Track Record via Tavily\n`
  sql += `-- Generated: ${new Date().toISOString()}\n`
  sql += `-- Total projects: ${projects.length}\n\n`
  sql += `BEGIN TRANSACTION;\n\n`

  let updateCount = 0
  for (const project of projects) {
    if (!project.fields || project.fields.length === 0) continue

    const updates: Array<{ name: string; val: string }> = []
    for (const field of project.fields) {
      if (!VALID_COLUMNS.has(field.field_name)) continue
      if (field.value === null || field.value === undefined) continue

      let val: string
      if (typeof field.value === 'string') val = `'${field.value.replace(/'/g, "''")}'`
      else if (typeof field.value === 'boolean') val = field.value ? 'true' : 'false'
      else val = String(field.value)

      updates.push({ name: field.field_name, val })
    }

    if (updates.length === 0) continue
    updateCount++
    sql += `UPDATE projects SET\n`
    sql += updates.map(u => `  ${u.name} = ${u.val}`).join(',\n')
    sql += `\nWHERE id = '${project.project_id}';\n\n`
  }

  sql += `COMMIT;\n`
  return sql
}

async function main() {
  console.log(`Generating Phase 2B SQL...\n`)

  const allProjects: ProjectExtraction[] = []
  for (let wave = 1; wave <= 6; wave++) {
    const path = `wave${wave}-project-builder_enhanced-audit.json`
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
  fs.writeFileSync('phase2b-consolidated-builder-upsert.sql', sql)

  console.log(`✓ Generated: phase2b-consolidated-builder-upsert.sql`)
  console.log(`✓ Size: ${(sql.length / 1024).toFixed(1)}KB\n`)
}

main().catch(console.error)
