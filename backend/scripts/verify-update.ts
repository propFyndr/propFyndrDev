#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const sample = await prisma.project.findFirst({
    where: { id: 'a9c643f8-b05b-4e1b-aa6b-e58e641be355' }
  })

  console.log(`\nSample Project (Paramount Golf Foreste):\n`)
  console.log(`  RERA Number: ${sample?.rera_number}`)
  console.log(`  OC Obtained: ${sample?.oc_obtained}`)
  console.log(`  Total Units: ${sample?.total_units}`)
  console.log(`  Status: ${sample?.status}`)
  console.log(`  Updated At: ${sample?.updated_at}\n`)

  // Count total with RERA data
  const withRera = await prisma.project.count({
    where: { rera_number: { not: null } }
  })

  const withOc = await prisma.project.count({
    where: { oc_obtained: { not: null } }
  })

  const total = await prisma.project.count()

  console.log(`Database Summary:`)
  console.log(`  Total Projects: ${total}`)
  console.log(`  With RERA Data: ${withRera}`)
  console.log(`  With OC Data: ${withOc}\n`)

  if (sample?.rera_number === 'UPRERAPRJ2001') {
    console.log(`✓ Phase 2 data was successfully applied to database`)
  } else {
    console.log(`⚠ Data may not have been applied. Check manually.`)
  }

  await prisma.$disconnect()
}

main()
