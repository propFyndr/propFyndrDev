#!/usr/bin/env tsx
/**
 * Apply Phase 3A migration to database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`PHASE 3A: Apply Migration`)
    console.log(`${'═'.repeat(60)}\n`)

    // Add columns to projects table
    console.log(`Adding verification columns to projects table...`)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP DEFAULT NOW()
    `)
    console.log(`✓ Added verified_at column`)

    await prisma.$executeRawUnsafe(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS verification_source VARCHAR(50)
    `)
    console.log(`✓ Added verification_source column`)

    await prisma.$executeRawUnsafe(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS data_freshness_category VARCHAR(20)
    `)
    console.log(`✓ Added data_freshness_category column`)

    // Create price_history table
    console.log(`\nCreating price_history table...`)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        price_min_cr FLOAT,
        price_max_cr FLOAT,
        price_range_label VARCHAR(255),
        verified_at TIMESTAMP DEFAULT NOW(),
        verification_source VARCHAR(50),
        source_document VARCHAR(500),
        recorded_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    console.log(`✓ Created price_history table`)

    console.log(`\n✓ Phase 3A migration applied successfully`)
    console.log(`✓ Note: Indices will be created by Prisma when schema migrates\n`)

  } catch (error) {
    console.error('✗ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
