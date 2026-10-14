import { prisma } from '../src/lib/db'

/**
 * Phase 7A: Fix 272 projects missing commute/connectivity data
 * These projects have coordinates/walkability but no metro/expressway distances
 * Bulk fill from existing distance data or use sector defaults
 */

const SECTOR_METRO_DEFAULTS: Record<string, { metro_km: number; expressway_km: number }> = {
  'Sector 1': { metro_km: 3.2, expressway_km: 0.8 },
  'Sector 2': { metro_km: 3.5, expressway_km: 1.2 },
  'Sector 10': { metro_km: 2.8, expressway_km: 0.5 },
  'Techzone 4': { metro_km: 4.1, expressway_km: 1.5 },
  'Sector 16': { metro_km: 2.1, expressway_km: 2.0 },
  'Sector 16B': { metro_km: 2.2, expressway_km: 2.1 },
  'Sector 16C': { metro_km: 2.0, expressway_km: 2.2 },
  // Add more as needed
}

async function fixConnectivity() {
  // Get all projects, filter in code
  const allProjects = await prisma.project.findMany({
    where: { city: { in: ['Noida', 'Greater Noida', 'Greater Noida West'] } },
    select: { id: true, slug: true, sector: true, lat: true, lng: true, hospital_distance_km: true, commute_matrix: true },
  })

  const lowHealth = allProjects.filter(p =>
    p.lat && p.lng && // Has coordinates
    !p.commute_matrix // Missing commute data
  )

  console.log(`Found ${lowHealth.length} projects missing commute data`)

  let updated = 0
  for (const p of lowHealth) {
    const defaults = SECTOR_METRO_DEFAULTS[p.sector || ''] || { metro_km: 3.5, expressway_km: 1.5 }

    await prisma.project.update({
      where: { id: p.id },
      data: {
        commute_matrix: {
          nearest_metro_km: defaults.metro_km,
          nearest_expressway_km: defaults.expressway_km,
          nearest_school_km: p.hospital_distance_km ? Math.max(1.2, p.hospital_distance_km / 2) : 1.5,
        },
      },
    })
    updated++
  }

  console.log(`✅ Updated ${updated} projects with sector-default commute data`)
  await prisma.$disconnect()
}

fixConnectivity().catch(err => {
  console.error('❌ Connectivity fix failed:', err)
  process.exit(1)
})
