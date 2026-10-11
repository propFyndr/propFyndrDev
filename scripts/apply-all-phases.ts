#!/usr/bin/env tsx
/**
 * Consolidate all Phase 2 enhancements into single SQL upsert
 * Merges: RERA + Builder + Project data from final audits
 */

import * as fs from 'fs'

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

function generateConsolidatedSQL(projects: ProjectExtraction[]): string {
  let sql = `-- CONSOLIDATED UPSERT: All Phase 2 Enhancements\n`
  sql += `-- Generated: ${new Date().toISOString()}\n`
  sql += `-- Total projects: ${projects.length}\n`
  sql += `-- Quality: ${Math.round(projects.reduce((s, p) => s + p.quality_score, 0) / projects.length)}/100\n`
  sql += `-- Data sources: RERA (HIGH), Builder (MEDIUM), Project Site (MEDIUM)\n\n`

  sql += `-- BACKUP: Create copy of current state before changes\n`
  sql += `CREATE TABLE projects_backup_${Date.now()} AS SELECT * FROM projects;\n\n`

  sql += `BEGIN TRANSACTION;\n\n`

  let updateCount = 0
  for (const project of projects) {
    if (!project.fields || project.fields.length === 0) continue

    const high = project.fields.filter((f) => f.confidence === 'HIGH')
    const medium = project.fields.filter((f) => f.confidence === 'MEDIUM')
    const allUpdates = [...high, ...medium]

    if (allUpdates.length === 0) continue

    updateCount++
    const now = new Date().toISOString()

    sql += `-- Project: ${project.project_name} | Quality: ${project.quality_score}/100\n`
    sql += `UPDATE projects SET\n`

    const updateStrs: string[] = []

    // Add all fields
    for (const field of allUpdates) {
      if (field.value === null || field.value === undefined) continue

      let val: string
      if (typeof field.value === 'string') {
        val = `'${field.value.replace(/'/g, "''")}'`
      } else if (typeof field.value === 'boolean') {
        val = field.value ? 'true' : 'false'
      } else {
        val = String(field.value)
      }

      updateStrs.push(`  ${field.field_name} = ${val}`)
    }

    // Add metadata
    updateStrs.push(`  data_source = 'phase2_consolidated'`)
    updateStrs.push(`  last_verified_at = '${now}'`)
    updateStrs.push(`  verification_level = '${high.length > 0 ? 'verified' : 'builder_attested'}'`)

    sql += updateStrs.join(',\n')
    sql += `\nWHERE id = '${project.project_id}';\n\n`
  }

  sql += `-- Verification\n`
  sql += `SELECT COUNT(*) as projects_updated, AVG(quality_score) as avg_quality_after\n`
  sql += `FROM projects\n`
  sql += `WHERE last_verified_at > NOW() - INTERVAL '10 minutes';\n\n`

  sql += `-- Rollback if needed: ROLLBACK;\n`
  sql += `COMMIT;\n`

  return sql
}

async function main() {
  console.log(`Consolidating all Phase 2 enhancements...\n`)

  const allProjects: ProjectExtraction[] = []

  // Load all final audits
  for (let wave = 1; wave <= 6; wave++) {
    const auditPath = `wave${wave}-project-enhanced-audit.json`
    if (!fs.existsSync(auditPath)) continue

    const projects: ProjectExtraction[] = JSON.parse(fs.readFileSync(auditPath, 'utf-8'))
    allProjects.push(...projects)
  }

  console.log(`✓ Loaded ${allProjects.length} projects from all audits\n`)

  // Generate SQL
  const consolidatedSQL = generateConsolidatedSQL(allProjects)
  const sqlPath = 'phase2-consolidated-all-enhancements-upsert.sql'
  fs.writeFileSync(sqlPath, consolidatedSQL)

  console.log(`✓ Generated: ${sqlPath}\n`)

  // Statistics
  const avgQuality = Math.round(allProjects.reduce((s, p) => s + p.quality_score, 0) / allProjects.length)
  const highConfidence = allProjects.reduce((s, p) => s + p.fields.filter((f) => f.confidence === 'HIGH').length, 0)
  const mediumConfidence = allProjects.reduce((s, p) => s + p.fields.filter((f) => f.confidence === 'MEDIUM').length, 0)

  console.log(`CONSOLIDATED DATA SUMMARY:`)
  console.log(`  Projects: ${allProjects.length}`)
  console.log(`  Average quality: ${avgQuality}/100`)
  console.log(`  HIGH confidence fields: ${highConfidence}`)
  console.log(`  MEDIUM confidence fields: ${mediumConfidence}`)
  console.log(`  Total enriched fields: ${highConfidence + mediumConfidence}\n`)

  console.log(`APPLICATION INSTRUCTIONS:\n`)
  console.log(`1. BACKUP (RECOMMENDED):\n`)
  console.log(`   pg_dump -d propfyndr_db > backups/pre-phase2-consolidated-$(date +%s).sql\n`)

  console.log(`2. APPLY SQL:\n`)
  console.log(`   psql -d propfyndr_db -f ${sqlPath}\n`)

  console.log(`3. VERIFY:\n`)
  console.log(`   psql -d propfyndr_db -c "SELECT COUNT(*) as projects, AVG((quality_score)::float) as avg_quality FROM (SELECT * FROM projects WHERE last_verified_at > NOW() - INTERVAL '10 minutes') t;"\n`)

  console.log(`4. ROLLBACK (IF NEEDED):\n`)
  console.log(`   psql -d propfyndr_db -c "ROLLBACK; DROP TABLE projects_backup_TIMESTAMP;"\n`)

  console.log(`Ready for database application.`)
}

main().catch(console.error)
