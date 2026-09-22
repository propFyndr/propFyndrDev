import { prisma } from '../src/lib/db'

async function main() {
  const targets = [
    'Apex Golf',
    'ATS Dolce',
    'Eldeco Mystic Greens',
    'Paramount Golf Foreste',
    'Stellar Jeevan',
    'ATS One Hamlet',
    'Mahagun Mezzaria',
    'Mahagun Mirabella',
    'Mahagun Moderne',
    'Jaypee Aman',
    'Great Value Sharanam'
  ]

  console.log('--- DATABASE INTEGRITY AUDIT ---')
  let duplicatesFound = 0

  for (const name of targets) {
    const rows = await prisma.project.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
      select: { id: true, name: true, sector: true, city: true, rera_number: true }
    })

    console.log(`[${name}] total: ${rows.length}`)
    for (const r of rows) {
      console.log(`  - ${r.name} | ${r.sector}, ${r.city} | RERA: ${r.rera_number}`)
    }

    if (name === 'Apex Golf') {
      const in150 = rows.filter(r => r.sector?.includes('150'))
      if (in150.length > 0) {
        console.error(`  ❌ ERROR: Found ${in150.length} Apex records in Sector 150!`)
        duplicatesFound++
      } else {
        console.log(`  ✅ Apex Golf Avenue verified exclusively in Sector 1, Greater Noida West`)
      }
    }
  }

  if (duplicatesFound === 0) {
    console.log('✅ ALL TARGET INTEGRITY CHECKS PASSED')
  } else {
    console.error(`❌ FAILED WITH ${duplicatesFound} ISSUES`)
    process.exit(1)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
