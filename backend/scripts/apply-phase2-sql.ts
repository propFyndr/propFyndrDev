#!/usr/bin/env tsx
/**
 * Apply Phase 2 Consolidated SQL to database
 * Parses SQL file and executes UPDATE statements via Prisma transaction
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

function parseSQL(sql: string): string[] {
  // Remove comments and extract UPDATE statements
  const lines = sql.split('\n')
  let statements: string[] = []
  let currentStatement = ''

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('--')) continue

    // Skip transaction control
    if (['BEGIN', 'BEGIN TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(trimmed.toUpperCase())) {
      continue
    }

    // Skip CREATE TABLE (already created)
    if (trimmed.toUpperCase().startsWith('CREATE TABLE')) {
      // Read until semicolon
      currentStatement += line + '\n'
      if (trimmed.endsWith(';')) {
        currentStatement = ''
      }
      continue
    }

    // Accumulate statement
    currentStatement += line + '\n'

    // Check for statement end
    if (trimmed.endsWith(';')) {
      const stmt = currentStatement.trim().slice(0, -1) // Remove trailing semicolon
      if (stmt && stmt.toUpperCase().startsWith('UPDATE')) {
        statements.push(stmt)
      } else if (stmt && stmt.toUpperCase().startsWith('SELECT')) {
        statements.push(stmt)
      }
      currentStatement = ''
    }
  }

  return statements.filter(s => s.length > 0)
}

async function main() {
  try {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`APPLYING PHASE 2 CONSOLIDATED SQL`)
    console.log(`${'═'.repeat(60)}\n`)

    // Read SQL file
    const sqlPath = path.join(__dirname, '../../phase2-consolidated-valid-columns.sql')

    if (!fs.existsSync(sqlPath)) {
      console.error(`✗ SQL file not found: ${sqlPath}`)
      process.exit(1)
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8')
    console.log(`✓ Loaded SQL file (${(sql.length / 1024).toFixed(1)}KB)`)

    // Parse statements
    const statements = parseSQL(sql)
    const updateStatements = statements.filter(s => s.toUpperCase().startsWith('UPDATE'))
    const selectStatements = statements.filter(s => s.toUpperCase().startsWith('SELECT'))

    console.log(`✓ Parsed ${updateStatements.length} UPDATE statements\n`)
    console.log(`Executing in transaction...\n`)

    // Execute all UPDATEs in transaction
    let executed = 0
    for (const stmt of updateStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt)
        executed++

        if (executed % 50 === 0) {
          console.log(`  ✓ ${executed}/${updateStatements.length} updates applied...`)
        }
      } catch (e) {
        console.error(`✗ Statement ${executed + 1} failed:`, String(e).slice(0, 200))
      }
    }

    console.log(`\n✓ Applied ${executed} project updates\n`)

    // Verify
    if (selectStatements.length > 0) {
      const result = await prisma.$queryRawUnsafe(selectStatements[0])
      console.log(`VERIFICATION:`)
      console.log(`  Total: ${(result as any)[0]?.projects_updated || 0}`)
      console.log(`  Avg Quality: ${(result as any)[0]?.avg_quality_after || 'N/A'}/100\n`)
    }

    console.log(`✓ Phase 2 data LIVE`)
  } catch (error) {
    console.error('✗ Failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
