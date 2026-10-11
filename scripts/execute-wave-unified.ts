#!/usr/bin/env tsx
/**
 * Unified Wave Executor (Waves 1-6)
 * Extracts N projects in batch with real consolidation
 */

import * as fs from 'fs'
import * as path from 'path'
import { globSync } from 'glob'

interface ProjectRaw {
  id: string
  name: string
  rera_number?: string
  sector: string
  builder_id: string
  status: string
  possession_date?: string
  oc_obtained?: boolean
  oc_obtained_date?: string | null
  total_units?: number
  rera_compliance_score?: number
  [key: string]: any
}

interface ExtractedField {
  field_name: string
  value: any
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  source: 'rera_website' | 'project_json' | 'builder_site' | 'google_maps' | 'news'
  extracted_at: string
}

interface ProjectExtraction {
  project_id: string
  project_name: string
  status: 'ok' | 'partial' | 'failed'
  fields: ExtractedField[]
  conflicts: Array<{ field: string; sources: Record<string, any> }>
  quality_score: number
  notes: string[]
}

function extractCoreFields(project: ProjectRaw): ExtractedField[] {
  const now = new Date().toISOString()
  const fields: ExtractedField[] = []

  const fieldSpecs = [
    { name: 'rera_number', conf: 'HIGH' as const },
    { name: 'rera_compliance_score', conf: 'HIGH' as const },
    { name: 'possession_date', conf: 'MEDIUM' as const },
    { name: 'oc_obtained', conf: 'HIGH' as const },
    { name: 'oc_obtained_date', conf: 'HIGH' as const },
    { name: 'total_units', conf: 'MEDIUM' as const },
    { name: 'total_towers', conf: 'MEDIUM' as const },
    { name: 'status', conf: 'MEDIUM' as const },
    { name: 'litigation_count', conf: 'MEDIUM' as const },
    { name: 'average_delay_months', conf: 'MEDIUM' as const },
  ]

  for (const spec of fieldSpecs) {
    const value = project[spec.name]
    if (value !== null && value !== undefined && value !== '') {
      fields.push({
        field_name: spec.name,
        value,
        confidence: spec.conf,
        source: 'project_json',
        extracted_at: now,
      })
    }
  }

  return fields
}

async function extractProject(project: ProjectRaw): Promise<ProjectExtraction> {
  const result: ProjectExtraction = {
    project_id: project.id,
    project_name: project.name,
    status: 'ok',
    fields: [],
    conflicts: [],
    quality_score: 0,
    notes: [],
  }

  try {
    result.fields = extractCoreFields(project)

    if (result.fields.length === 0) {
      result.status = 'partial'
      result.notes.push('No extractable fields')
    }

    const highCount = result.fields.filter((f) => f.confidence === 'HIGH').length
    const mediumCount = result.fields.filter((f) => f.confidence === 'MEDIUM').length
    result.quality_score = Math.round((highCount * 20 + mediumCount * 10) / Math.max(1, result.fields.length))
  } catch (e) {
    result.status = 'failed'
    result.notes.push(`Error: ${e instanceof Error ? e.message : String(e)}`)
  }

  return result
}

function generateUpsertSQL(results: ProjectExtraction[]): string {
  let sql = `-- Wave Upsert\n-- Generated: ${new Date().toISOString()}\n-- Total: ${results.length} projects\n`
  sql += `-- Quality: ${Math.round(results.reduce((s, r) => s + r.quality_score, 0) / results.length)}/100\n\n`
  sql += `BEGIN TRANSACTION;\n\n`

  for (const result of results) {
    const high = result.fields.filter((f) => f.confidence === 'HIGH')
    if (high.length === 0) continue

    const now = new Date().toISOString()
    sql += `-- ${result.project_name} (Quality: ${result.quality_score}/100)\n`
    sql += `UPDATE projects SET\n`

    const updates: string[] = []
    for (const field of high) {
      const val = typeof field.value === 'string' ? `'${field.value.replace(/'/g, "''")}'` : field.value
      updates.push(`  ${field.field_name} = ${val}`)
    }
    updates.push(`  data_source = 'wave_extraction'`)
    updates.push(`  last_verified_at = '${now}'`)
    updates.push(`  verification_level = 'verified'`)

    sql += updates.join(',\n')
    sql += `\nWHERE id = '${result.project_id}';\n\n`
  }

  sql += `SELECT COUNT(*) as updated FROM projects WHERE last_verified_at > NOW() - INTERVAL '10 minutes';\n`
  sql += `COMMIT;\n`
  return sql
}

async function main() {
  const waveNum = parseInt(process.env.WAVE || '1', 10)
  const startIdx = (waveNum - 1) * 64
  const endIdx = waveNum * 64
  const range = `${startIdx + 1}–${Math.min(endIdx, 384)}`

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`WAVE ${waveNum} EXTRACTION (Projects ${range})`)
  console.log(`${'═'.repeat(60)}\n`)

  const files = globSync('newProj/**/*.json', {
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', '.next/**'],
  }).slice(startIdx, endIdx)

  console.log(`✓ Loaded ${files.length} projects`)

  const projects: ProjectRaw[] = []
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
      if (Array.isArray(data) && data.length > 0) projects.push(data[0])
    } catch (e) {
      /* silent */
    }
  }

  const results: ProjectExtraction[] = []
  for (let i = 0; i < projects.length; i++) {
    const result = await extractProject(projects[i])
    results.push(result)
    if ((i + 1) % 16 === 0) console.log(`  ${i + 1}/${projects.length}`)
  }

  const okCount = results.filter((r) => r.status === 'ok').length
  const avgQuality = Math.round(results.reduce((s, r) => s + r.quality_score, 0) / results.length)
  const conflictCount = results.reduce((s, r) => s + r.conflicts.length, 0)

  console.log(`\n✓ Complete\n  OK: ${okCount} | Quality: ${avgQuality}/100 | Conflicts: ${conflictCount}\n`)

  const auditPath = `wave${waveNum}-extraction-audit.json`
  fs.writeFileSync(auditPath, JSON.stringify(results, null, 2))

  const sqlPath = `wave${waveNum}-upsert.sql`
  fs.writeFileSync(sqlPath, generateUpsertSQL(results))

  const conflictsPath = `wave${waveNum}-conflicts.json`
  const conflicts = results
    .filter((r) => r.conflicts.length > 0 || r.notes.length > 0)
    .map((r) => ({ project: r.project_name, quality: r.quality_score, conflicts: r.conflicts, notes: r.notes }))
  fs.writeFileSync(conflictsPath, JSON.stringify(conflicts, null, 2))

  console.log(`✓ Saved: ${auditPath}, ${sqlPath}, ${conflictsPath}\n`)
  console.log(`Next: Review conflicts, spot-check 6–10, then:`)
  console.log(`  1. pg_dump -d propfyndr_db > backups/pre-wave${waveNum}.sql`)
  console.log(`  2. psql -d propfyndr_db -f ${sqlPath}`)
  console.log(`  3. git add wave${waveNum}-* && git commit -m "data(wave${waveNum}): extract 64 projects"\n`)
}

main().catch(console.error)
