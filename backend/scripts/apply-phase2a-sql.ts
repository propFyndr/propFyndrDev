#!/usr/bin/env tsx
/**
 * Apply Phase 2A Consolidated SQL to database
 * Individual UPDATE statement execution (avoids multi-command issue)
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
    if ((char === "'" || char === '"') && sql[i - 1] !== '\\') {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
      }
    }

    current += char

    if (char === ';' && !inString) {
      const trimmed = current.trim()
      if (trimmed.toUpperCase().startsWith('UPDATE')) {
        statements.push(trimmed.slice(0, -1))
      }
      current = ''
    }
  }

  return statements
}

async function main() {
  try {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`PHASE 2A: Apply Real RERA Data to Database`)
    console.log(`${'═'.repeat(60)}\n`)

    const sqlPath = path.join(__dirname, '../../phase2a-consolidated-rera-upsert.sql')

    if (!fs.existsSync(sqlPath)) {
      console.error(`✗ SQL not found: ${sqlPath}`)
      process.exit(1)
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8')
    console.log(`✓ Loaded SQL (${(sql.length / 1024).toFixed(1)}KB)`)

    const statements = parseUpdateStatements(sql)
    console.log(`✓ Parsed ${statements.length} UPDATE statements\n`)
    console.log(`Executing...\n`)

    let success = 0
    let failed = 0

    for (let i = 0; i < statements.length; i++) {
      try {
        await prisma.$executeRawUnsafe(statements[i])
        success++

        if ((i + 1) % 50 === 0) {
          console.log(`  ✓ ${i + 1}/${statements.length}`)
        }
      } catch (e) {
        failed++
        if (failed <= 3) {
          console.error(`  ✗ ${i + 1}: ${String(e).slice(0, 80)}`)
        }
      }
    }

    console.log(`\n✓ Complete: ${success} updates, ${failed} failed\n`)

    // Verify
    const result = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN rera_number IS NOT NULL THEN 1 END) as with_rera,
             ROUND(COUNT(CASE WHEN oc_obtained IS NOT NULL THEN 1 END)::float / COUNT(*) * 100) as oc_percent
      FROM projects
    `

    console.log(`VERIFICATION:`)
    console.log(`  Total projects: ${result[0]?.total || 0}`)
    console.log(`  With RERA: ${result[0]?.with_rera || 0}`)
    console.log(`  With OC: ${result[0]?.oc_percent || 0}%\n`)

    if (success > 300) {
      console.log(`✓ Phase 2A data LIVE in database`)
    }
  } catch (error) {
    console.error('✗ Failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
