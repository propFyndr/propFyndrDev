#!/usr/bin/env tsx
/**
 * Daily Quality Scorecard
 * Phase 3E: Calculate and store daily quality metrics
 * Run once per day via cron job
 */

import { PrismaClient } from '@prisma/client'
import { calculateQualityMetrics, formatQualityMetrics } from '../backend/lib/analytics'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`DAILY QUALITY SCORECARD`)
    console.log(`${'═'.repeat(60)}\n`)

    // Fetch all projects
    const projects = await prisma.$queryRaw<any[]>`
      SELECT
        id, name,
        rera_number, verified_at, lift_act_compliant,
        lat, lng, walkability_score,
        hospital_distance_km, top_school_distance_km
      FROM projects
    `

    console.log(`✓ Fetched ${projects.length} projects`)

    // Calculate quality metrics
    const metrics = calculateQualityMetrics(projects)

    // Store in database (create table if needed)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS quality_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE,
        total_projects INT,
        projects_with_rera INT,
        projects_with_verified_timestamp INT,
        projects_with_lift_act INT,
        projects_with_coordinates INT,
        projects_with_walkability INT,
        avg_fields_per_project INT,
        coverage_percent INT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(date)
      )
    `)

    await prisma.$executeRawUnsafe(`
      INSERT INTO quality_metrics (
        date, total_projects, projects_with_rera, projects_with_verified_timestamp,
        projects_with_lift_act, projects_with_coordinates, projects_with_walkability,
        avg_fields_per_project, coverage_percent
      ) VALUES (
        CURRENT_DATE, ${metrics.total_projects}, ${metrics.projects_with_rera},
        ${metrics.projects_with_verified_timestamp}, ${metrics.projects_with_lift_act},
        ${metrics.projects_with_coordinates}, ${metrics.projects_with_walkability},
        ${metrics.avg_fields_per_project}, ${metrics.coverage_percent}
      )
      ON CONFLICT (date) DO UPDATE SET
        total_projects = ${metrics.total_projects},
        projects_with_rera = ${metrics.projects_with_rera},
        projects_with_verified_timestamp = ${metrics.projects_with_verified_timestamp},
        projects_with_lift_act = ${metrics.projects_with_lift_act},
        projects_with_coordinates = ${metrics.projects_with_coordinates},
        projects_with_walkability = ${metrics.projects_with_walkability},
        avg_fields_per_project = ${metrics.avg_fields_per_project},
        coverage_percent = ${metrics.coverage_percent}
    `)

    console.log(`✓ Stored quality metrics for ${metrics.date.toDateString()}\n`)
    console.log(formatQualityMetrics(metrics))
    console.log(`\n✓ Daily scorecard complete\n`)

  } catch (error) {
    console.error('✗ Failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
