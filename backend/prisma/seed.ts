/**
 * Prisma Seed Script: Apply Phase 2 Enhanced Data to Database
 *
 * Loads wave1-6-project-enhanced-audit.json files and applies to live database
 * using Prisma ORM for type safety and transaction support.
 *
 * Usage:
 *   npx prisma db seed
 * Or:
 *   npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

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

async function loadAudits(): Promise<ProjectExtraction[]> {
  const allProjects: ProjectExtraction[] = []

  for (let wave = 1; wave <= 6; wave++) {
    const auditPath = path.join(
      __dirname,
      '..',
      '..',
      `wave${wave}-project-enhanced-audit.json`
    )

    if (!fs.existsSync(auditPath)) {
      console.log(`⚠ ${auditPath} not found, skipping`)
      continue
    }

    console.log(`Loading Wave ${wave} audit...`)
    const projects: ProjectExtraction[] = JSON.parse(
      fs.readFileSync(auditPath, 'utf-8')
    )
    allProjects.push(...projects)
  }

  return allProjects
}

async function applyToDatabase(projects: ProjectExtraction[]): Promise<void> {
  console.log(`\nApplying ${projects.length} projects to database...\n`)

  let updated = 0
  let failed = 0
  const now = new Date()

  for (const project of projects) {
    try {
      // Extract field values - Project model fields only
      const updateData: Record<string, any> = {}

      // Valid Project fields (from schema)
      const validProjectFields = new Set([
        'rera_number',
        'rera_url',
        'rera_compliance_score',
        'rera_valid_until',
        'oc_obtained',
        'oc_obtained_date',
        'oc_valid_until',
        'oc_restrictions',
        'legal_flag',
        'legal_flag_detail',
        'litigation_count',
        'ongoing_litigation_count',
        'nclt_status',
        'total_units',
        'total_towers',
        'status',
        'possession_date',
        'possession_label',
        'possession_confidence',
        'possession_confidence_note',
        'average_builder_delay_months',
        'expected_handover_quarter',
        'aqi_annual_avg',
        'water_source',
        'land_title_clear',
        'fir_against_project',
        'approvals_status',
      ])

      // Add all fields that exist in schema
      for (const field of project.fields) {
        if (validProjectFields.has(field.field_name) && field.value !== null && field.value !== undefined) {
          updateData[field.field_name] = field.value
        }
      }

      // Skip if no valid fields to update
      if (Object.keys(updateData).length === 0) {
        continue
      }

      try {
        // Upsert to database
        await prisma.project.update({
          where: { id: project.project_id },
          data: updateData,
        })
      } catch (updateError) {
        // Log but don't fail completely for field mapping errors
        if (String(updateError).includes('Unknown argument')) {
          console.warn(`⚠ Field mapping issue for ${project.project_name}, skipping this project`)
          failed++
          continue
        }
        throw updateError
      }

      updated++
      if (updated % 50 === 0) {
        console.log(`  ${updated}/${projects.length} projects updated...`)
      }
    } catch (e) {
      failed++
      console.error(`✗ Failed to update ${project.project_name}:`, e)
    }
  }

  console.log(`\n✓ Database update complete`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Failed: ${failed}`)

  // Verify
  console.log(`\n✓ Seed complete: ${updated} projects updated, ${failed} failed`)
}

async function main(): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`PRISMA SEED: Phase 2 Enhanced Data`)
  console.log(`${'═'.repeat(60)}\n`)

  try {
    // Load audits
    const projects = await loadAudits()
    console.log(`✓ Loaded ${projects.length} projects from audit files\n`)

    if (projects.length === 0) {
      console.log('⚠ No projects loaded. Ensure audit files exist.')
      return
    }

    // Apply to database
    await applyToDatabase(projects)

    console.log(`\n✓ Seeding complete`)
  } catch (error) {
    console.error('✗ Seed failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
