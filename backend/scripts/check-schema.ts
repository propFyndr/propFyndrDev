#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'projects'
      ORDER BY ordinal_position
    `

    console.log('PROJECTS TABLE SCHEMA:\n')
    result.forEach((col) => {
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'}`)
    })

    console.log(`\nTotal columns: ${result.length}`)
  } catch (e) {
    console.error('Error:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
