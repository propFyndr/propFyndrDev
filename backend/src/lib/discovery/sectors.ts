// backend/src/lib/discovery/sectors.ts
import { prisma } from '../db'
import { SectorContext, SectorOverview } from './types'
import { getSectorLocation } from './sectorToCity'
import { SECTORS_OVERVIEW_MAX, SECTOR_ADJACENCY } from './constants'

export async function getSectorContext(rawSector: string, city?: string): Promise<SectorContext | null> {
  const cleanSector = rawSector.replace(/,\s*(greater noida west|greater noida|noida extension|noida|up|uttar pradesh)$/i, '').replace(/^[,\s]+|[,\s]+$/g, '').trim()
  const loc = getSectorLocation(cleanSector)
  const targetCity = loc ? loc.city : (city || undefined)

  const where: any = { sector: { equals: cleanSector, mode: 'insensitive' } }
  if (targetCity) {
    where.city = { equals: targetCity, mode: 'insensitive' }
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      unit_types: { select: { price_min_cr: true, price_max_cr: true } },
      connectivity: { select: { type: true, name: true, distance_km: true } },
    },
  })

  if (projects.length === 0) return null

  const allPrices = projects.flatMap((p) => p.unit_types.filter((u) => u.price_min_cr).map((u) => u.price_min_cr!))
  const allMaxPrices = projects.flatMap((p) => p.unit_types.filter((u) => u.price_max_cr).map((u) => u.price_max_cr!))
  const priceMinCr = allPrices.length ? Math.min(...allPrices) : null
  const priceMaxCr = allMaxPrices.length ? Math.max(...allMaxPrices) : null

  const rtmCount = projects.filter((p) => {
    const s = String(p.status)
    return s === 'ready_to_move'
  }).length
  const ucCount = projects.filter((p) => {
    const s = String(p.status)
    return s === 'under_construction' || s === 'new_launch'
  }).length

  const allConn = projects.flatMap((p) => p.connectivity)
  const metroStations = [
    ...new Set(allConn.filter((c) => String(c.type) === 'metro').map((c) => c.name)),
  ].slice(0, 3)
  const keyRoads = [
    ...new Set(
      allConn
        .filter((c) => { const t = String(c.type); return t === 'road' || t === 'expressway' })
        .map((c) => c.name)
    ),
  ].slice(0, 3)
  const nearbyLandmarks = [
    ...new Set(
      allConn
        .filter((c) => { const t = String(c.type); return t === 'hospital' || t === 'school' || t === 'mall' })
        .map((c) => c.name)
    ),
  ].slice(0, 4)

  return {
    sector: cleanSector,
    projectCount: projects.length,
    priceMinCr,
    priceMaxCr,
    rtmCount,
    ucCount,
    metroStations,
    keyRoads,
    nearbyLandmarks,
  }
}

export async function getAllSectorsOverview(lifestyleKeywords?: string[], city: string = 'Noida'): Promise<SectorOverview[]> {
  // Multi-city support: filter by city, key by city+sector
  const projects = await prisma.project.findMany({
    where: { city: { equals: city, mode: 'insensitive' } },
    include: {
      unit_types: { select: { price_min_cr: true, price_max_cr: true } },
      amenities: { select: { name: true, category: true } },
      connectivity: { select: { type: true, name: true } },
    },
    take: 200,
  })

  const bySector = new Map<string, typeof projects>()
  for (const p of projects) {
    const key = `${p.city}+${p.sector}`
    const existing = bySector.get(key) ?? []
    existing.push(p)
    bySector.set(key, existing)
  }

  const overviews: SectorOverview[] = []
  for (const [key, sectorProjects] of bySector) {
    const [, sector] = key.split('+')  // Extract sector from city+sector key
    const allPrices = sectorProjects.flatMap((p) => p.unit_types.filter((u) => u.price_min_cr).map((u) => u.price_min_cr!))
    const allMaxPrices = sectorProjects.flatMap((p) => p.unit_types.filter((u) => u.price_max_cr).map((u) => u.price_max_cr!))

    // If lifestyle keywords given, score and filter sectors by amenity relevance
    const allAmenityNames = sectorProjects.flatMap((p) => p.amenities.map((a) => a.name.toLowerCase()))
    if (lifestyleKeywords?.length) {
      const matches = lifestyleKeywords.filter((kw) =>
        allAmenityNames.some((a) => a.includes(kw.toLowerCase()))
      )
      if (matches.length === 0) continue
    }

    const topAmenities = [
      ...new Set(sectorProjects.flatMap((p) => p.amenities.map((a) => a.name))),
    ].slice(0, 5)

    const metroStations = [
      ...new Set(
        sectorProjects.flatMap((p) =>
          p.connectivity.filter((c) => String(c.type) === 'metro').map((c) => c.name)
        )
      ),
    ].slice(0, 2)

    overviews.push({
      sector,
      projectCount: sectorProjects.length,
      priceMinCr: allPrices.length ? Math.min(...allPrices) : null,
      priceMaxCr: allMaxPrices.length ? Math.max(...allMaxPrices) : null,
      rtmCount: sectorProjects.filter((p) => {
        const s = String(p.status)
        return s === 'ready_to_move'
      }).length,
      ucCount: sectorProjects.filter((p) => {
        const s = String(p.status)
        return s === 'under_construction' || s === 'new_launch'
      }).length,
      topAmenities,
      metroStations,
    })
  }

  // Sort by project count descending, return top N
  return overviews.sort((a, b) => b.projectCount - a.projectCount).slice(0, SECTORS_OVERVIEW_MAX)
}

/**
 * Return adjacent sectors for a given sector name, ordered by geographic proximity.
 * Uses strict verified master-plan adjacency from SECTOR_ADJACENCY.
 */
export function getNearbySectors(sector: string): string[] {
  const normalized = sector.trim()
  return SECTOR_ADJACENCY[normalized] ?? []
}
