import { prisma } from '../src/lib/db'

async function auditHealth() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      builder_id: true,
      price_min_cr: true,
      sector: true,
      oc_status: true,
      possession_date: true,
      amenities: true,
      verified_at: true,
      coordinates: true,
      walkability_score: true,
      lift_act_compliant: true,
    },
  })

  const perfect = projects.filter(p =>
    p.name &&
    p.builder_id &&
    p.price_min_cr &&
    p.sector &&
    p.oc_status &&
    p.possession_date &&
    p.amenities &&
    p.verified_at &&
    p.coordinates &&
    p.walkability_score !== null &&
    p.lift_act_compliant !== null
  )

  const partial = projects.filter(p =>
    (p.name && p.builder_id && p.price_min_cr && p.sector) &&
    !(
      p.name &&
      p.builder_id &&
      p.price_min_cr &&
      p.sector &&
      p.oc_status &&
      p.possession_date &&
      p.amenities &&
      p.verified_at &&
      p.coordinates &&
      p.walkability_score !== null
    )
  )

  console.log(`\n📊 PROJECT HEALTH AUDIT (382 total)`)
  console.log(`✅ PERFECT (all core fields): ${perfect.length}`)
  console.log(`🟡 PARTIAL (missing non-critical): ${partial.length}`)
  console.log(`❌ INCOMPLETE (missing core): ${projects.length - perfect.length - partial.length}`)
  console.log(`\n📋 COMPLETENESS BREAKDOWN:`)
  console.log(`  - Name: ${projects.filter(p => p.name).length}/382`)
  console.log(`  - Builder: ${projects.filter(p => p.builder_id).length}/382`)
  console.log(`  - Price: ${projects.filter(p => p.price_min_cr).length}/382`)
  console.log(`  - Sector: ${projects.filter(p => p.sector).length}/382`)
  console.log(`  - OC Status: ${projects.filter(p => p.oc_status).length}/382`)
  console.log(`  - Possession: ${projects.filter(p => p.possession_date).length}/382`)
  console.log(`  - Amenities: ${projects.filter(p => p.amenities).length}/382`)
  console.log(`  - Verified At: ${projects.filter(p => p.verified_at).length}/382`)
  console.log(`  - Coordinates: ${projects.filter(p => p.coordinates).length}/382`)
  console.log(`  - Walkability: ${projects.filter(p => p.walkability_score !== null).length}/382`)

  const missing = projects.filter(p => !perfect.includes(p))
  if (missing.length > 0) {
    console.log(`\n⚠️  MISSING FIELDS (top 5):`)
    const gaps: Record<string, number> = {}
    missing.forEach(p => {
      if (!p.name) gaps['name'] = (gaps['name'] || 0) + 1
      if (!p.oc_status) gaps['oc_status'] = (gaps['oc_status'] || 0) + 1
      if (!p.possession_date) gaps['possession'] = (gaps['possession'] || 0) + 1
      if (!p.amenities) gaps['amenities'] = (gaps['amenities'] || 0) + 1
      if (!p.coordinates) gaps['coordinates'] = (gaps['coordinates'] || 0) + 1
      if (p.walkability_score === null) gaps['walkability'] = (gaps['walkability'] || 0) + 1
    })
    Object.entries(gaps).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([field, count]) => {
      console.log(`    ${field}: ${count} projects`)
    })
  }

  await prisma.$disconnect()
}

auditHealth().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})
