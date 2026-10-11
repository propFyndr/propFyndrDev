#!/usr/bin/env tsx
/**
 * Apply Phase 2 Valid Columns SQL - Execute each UPDATE individually
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

function parseUpdateStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inString = false
  let stringChar = ''

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    const nextChar = sql[i + 1]

    // Handle string boundaries
    if ((char === "'" || char === '"') && sql[i - 1] !== '\\') {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
      }
    }

    current += char

    // Check for statement end (semicolon outside string)
    if (char === ';' && !inString) {
      const trimmed = current.trim()
      if (trimmed.toUpperCase().startsWith('UPDATE')) {
        statements.push(trimmed.slice(0, -1)) // Remove trailing semicolon
      }
      current = ''
    }
  }

  return statements
}

async function main() {
  try {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`APPLYING PHASE 2 VALID COLUMNS SQL (Statement by Statement)`)
    console.log(`${'═'.repeat(60)}\n`)

    // Read SQL file
    const sqlPath = path.join(__dirname, '../../phase2-consolidated-valid-columns.sql')

    if (!fs.existsSync(sqlPath)) {
      console.error(`✗ SQL file not found: ${sqlPath}`)
      process.exit(1)
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8')
    console.log(`✓ Loaded SQL file (${(sql.length / 1024).toFixed(1)}KB)`)

    // Parse UPDATE statements
    const statements = parseUpdateStatements(sql)
    console.log(`✓ Parsed ${statements.length} UPDATE statements\n`)
    console.log(`Executing...\n`)

    // Execute each UPDATE
    let success = 0
    let failed = 0

    for (let i = 0; i < statements.length; i++) {
      try {
        await prisma.$executeRawUnsafe(statements[i])
        success++

        if ((i + 1) % 50 === 0) {
          console.log(`  ✓ ${i + 1}/${statements.length} completed`)
        }
      } catch (e) {
        failed++
        if (failed <= 5) {
          // Show first 5 errors
          console.error(`  ✗ Error on statement ${i + 1}: ${String(e).split('\n')[0].slice(0, 100)}`)
        }
      }
    }

    console.log(`\n✓ Complete: ${success} updates, ${failed} failed\n`)

    // Verify
    const result = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total_projects,
             COUNT(CASE WHEN rera_number IS NOT NULL THEN 1 END) as with_rera,
             COUNT(CASE WHEN oc_obtained IS NOT NULL THEN 1 END) as with_oc
      FROM projects
    `

    console.log(`VERIFICATION:`)
    console.log(`  Total projects: ${result[0]?.total_projects || 0}`)
    console.log(`  With RERA data: ${result[0]?.with_rera || 0}`)
    console.log(`  With OC data: ${result[0]?.with_oc || 0}\n`)

    if (success > 0) {
      console.log(`✓ Phase 2 data successfully applied to database`)
    }
  } catch (error) {
    console.error('✗ Failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
