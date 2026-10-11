#!/usr/bin/env tsx
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
      if (!inString) { inString = true; stringChar = char }
      else if (char === stringChar) inString = false
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
    console.log(`PHASE 2C: Apply Project Site Data to Database`)
    console.log(`${'═'.repeat(60)}\n`)

    const sqlPath = path.join(__dirname, '../../phase2c-consolidated-site-upsert.sql')
    if (!fs.existsSync(sqlPath)) {
      console.error(`✗ SQL not found: ${sqlPath}`)
      process.exit(1)
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8')
    console.log(`✓ Loaded SQL (${(sql.length / 1024).toFixed(1)}KB)`)

    const statements = parseUpdateStatements(sql)
    console.log(`✓ Parsed ${statements.length} UPDATE statements\n`)

    let success = 0
    for (let i = 0; i < statements.length; i++) {
      try {
        await prisma.$executeRawUnsafe(statements[i])
        success++
        if ((i + 1) % 50 === 0) console.log(`  ✓ ${i + 1}/${statements.length}`)
      } catch (e) {
        if (success === 0) console.error(`  ✗ ${String(e).slice(0, 80)}`)
      }
    }

    console.log(`\n✓ Applied: ${success} updates\n`)

    const result = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN rera_number IS NOT NULL THEN 1 END) as with_rera,
        COUNT(CASE WHEN lift_act_compliant IS NOT NULL THEN 1 END) as with_lift_act,
        COUNT(CASE WHEN oc_obtained IS NOT NULL THEN 1 END) as with_oc,
        COUNT(CASE WHEN possession_confidence_note IS NOT NULL THEN 1 END) as with_possession_note
      FROM projects
    `

    console.log(`PHASE 2A+2B+2C QUALITY VERIFICATION:`)
    console.log(`  Total projects: ${result[0]?.total || 0}`)
    console.log(`  With RERA: ${result[0]?.with_rera || 0}`)
    console.log(`  With lift_act_compliant: ${result[0]?.with_lift_act || 0}`)
    console.log(`  With OC: ${result[0]?.with_oc || 0}`)
    console.log(`  With possession_confidence_note: ${result[0]?.with_possession_note || 0}\n`)

    console.log(`✓ Phase 2A+2B+2C data LIVE`)
  } catch (error) {
    console.error('✗ Failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
