#!/usr/bin/env tsx
/**
 * Apply Phase 3B migration - Lead Brief table
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`PHASE 3B: Create Lead Brief Table`)
    console.log(`${'═'.repeat(60)}\n`)

    // Create lead_briefs table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS lead_briefs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id VARCHAR(255),
        project_id VARCHAR(255),
        guest_token VARCHAR(255),
        requirement_summary TEXT,
        readiness_signals TEXT[],
        objections TEXT[],
        best_contact_method VARCHAR(50),
        best_contact_time_window VARCHAR(100),
        buyer_name VARCHAR(255),
        buyer_phone VARCHAR(20),
        buyer_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    console.log(`✓ Created lead_briefs table`)

    // Verify table exists
    const briefsCheck = await prisma.$queryRaw<any[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'lead_briefs'
      ) as exists
    `

    if (briefsCheck[0]?.exists) {
      console.log(`✓ Verified lead_briefs table exists\n`)
    } else {
      throw new Error('lead_briefs table creation failed')
    }

    console.log(`✓ Phase 3B migration complete`)
    console.log(`✓ Lead Brief infrastructure ready for partner portal\n`)

  } catch (error) {
    console.error('✗ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
