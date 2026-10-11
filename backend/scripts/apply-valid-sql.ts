#!/usr/bin/env tsx
/**
 * Apply Phase 2 Valid Columns SQL to database
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`APPLYING PHASE 2 VALID COLUMNS SQL`)
    console.log(`${'═'.repeat(60)}\n`)

    // Read SQL file
    const sqlPath = path.join(__dirname, '../../phase2-consolidated-valid-columns.sql')

    if (!fs.existsSync(sqlPath)) {
      console.error(`✗ SQL file not found: ${sqlPath}`)
      process.exit(1)
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8')
    console.log(`✓ Loaded SQL file (${(sql.length / 1024).toFixed(1)}KB)`)
    console.log(`✓ Executing SQL transaction...\n`)

    // Execute entire SQL
    await prisma.$executeRawUnsafe(sql)

    console.log(`✓ SQL executed successfully\n`)

    // Verify results
    const result = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total_projects,
             COUNT(CASE WHEN rera_number IS NOT NULL THEN 1 END) as with_rera,
             COUNT(CASE WHEN oc_obtained IS NOT NULL THEN 1 END) as with_oc
      FROM projects
    `

    console.log(`VERIFICATION RESULT:`)
    console.log(`  Total projects: ${result[0]?.total_projects || 0}`)
    console.log(`  With RERA: ${result[0]?.with_rera || 0}`)
    console.log(`  With OC: ${result[0]?.with_oc || 0}\n`)

    console.log(`✓ Phase 2 data LIVE in database`)
  } catch (error) {
    console.error('✗ Failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
