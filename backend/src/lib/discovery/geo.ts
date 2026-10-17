// Geospatial utilities: Haversine distance, sector centroids, radial search
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import type { ScoredProject } from './types'

const EARTH_RADIUS_KM = 6371
/**
 * There is no static centroid table any more, deliberately.
 *
 * `SECTOR_CENTROID_CACHE` held 82 entries described as "pre-computed from
 * historical project data". They were not: every entry was the previous one
 * plus exactly 0.0060 latitude and 0.0058 longitude, a linear ramp generated
 * arithmetically from Sector 75 outward. Sector 100 came out at 28.6855,
 * 77.5147 — about 17km east of where Sector 100 actually is, out past Dadri.
 *
 * That mattered because `getSectorCentroid` fell back to it whenever a sector
 * held no project with coordinates, and both `nearby.ts` and the spatial branch
 * of `projects.ts` then ran a Haversine radius search from the invented point.
 * A buyer asking what is near a sector we hold nothing in got a confident list
 * of projects computed from made-up geography.
 *
 * A sector we have no coordinates for now returns null, which every caller
 * already handles by falling back to non-spatial retrieval. Curated adjacency
 * lives in `SECTOR_ADJACENCY` (constants.ts) and is real; use that for
 * "which sectors are near this one".
 */
/**
 * A coordinate a script wrote, not a location anyone measured.
 *
 * 78 projects sat at exactly 28.4000, 77.5500 and two at 28.0000, 77.0000
 * (dev, 17 Oct 2026): every one of them came out 26.4 km from Jewar, and the
 * same point fed radius searches and the airport line in the facts block. A
 * measured location almost never has both values at two decimals or fewer, so
 * that shape is treated as missing.
 */
export function isPlaceholderCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return true
  const coarse = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6
  return coarse(lat) && coarse(lng)
}

/**
 * Calculate Haversine distance between two lat/lng points in kilometers
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Get sector centroid (center point) for Haversine-based radial search
 * Falls back to database query if not in cache
 */
export async function getSectorCentroid(
  sector: string,
  city?: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    // 1. Prioritize real database project coordinates
    const result = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT AVG(lat)::float as lat, AVG(lng)::float as lng
      FROM projects
      WHERE sector ILIKE ${sector}
      ${city ? Prisma.sql`AND city ILIKE ${city}` : Prisma.empty}
      AND lat IS NOT NULL AND lng IS NOT NULL
      AND NOT (lat = round(lat::numeric, 2) AND lng = round(lng::numeric, 2))
    `

    /**
     * `AVG()` over zero matching rows returns one row of NULLs, not no rows.
     *
     * So this used to return `{ lat: null, lng: null }` for any sector we hold
     * nothing in — an object, and therefore truthy at every call site. Measured:
     * `resolveLocationTerm` echoes an unmatched term back as a `literal` sector,
     * so "Too high. Cheaper nearby?" became a sector name, this returned a
     * null-coordinate centroid, the proximity lane accepted it as an anchor, and
     * the buyer was told: "We don't hold any projects within 3.5 km of Too high.
     * Cheaper nearby?." The whole message printed as a place.
     *
     * A centroid without coordinates is not a centroid.
     */
    const row = result?.[0]
    if (typeof row?.lat === 'number' && typeof row?.lng === 'number') {
      return { lat: row.lat, lng: row.lng }
    }
  } catch (err) {
    console.error(`Failed to compute sector centroid for ${sector} from DB:`, err)
  }

  // No static fallback — see the note at the top of this file. A sector we hold
  // no coordinates for has no centroid, and saying so lets the caller fall back
  // to non-spatial retrieval instead of measuring from an invented point.
  return null
}

/**
 * Find projects within a radius of anchor coordinates
 * Uses Haversine distance with bounding-box pre-filtering for performance
 */
export async function getProjectsWithinRadius(
  anchorLat: number,
  anchorLng: number,
  radiusKm: number,
  whereFilter?: Prisma.ProjectWhereInput
): Promise<
  Array<{
    id: string
    name: string
    lat: number
    lng: number
    sector: string
    distance_km: number
  }>
> {
  // Bounding box approximation: 1 degree latitude ≈ 111 km
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((anchorLat * Math.PI) / 180))

  const minLat = anchorLat - latDelta
  const maxLat = anchorLat + latDelta
  const minLng = anchorLng - lngDelta
  const maxLng = anchorLng + lngDelta

  try {
    // Fetch all projects in bounding box, then filter by Haversine in-app
    const projects = await prisma.project.findMany({
      where: {
        lat: { gte: minLat, lte: maxLat },
        lng: { gte: minLng, lte: maxLng },
        ...whereFilter,
      },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        sector: true,
      },
    })

    // Calculate distance and filter to radiusKm
    const withDistance = projects
      .filter((p) => !isPlaceholderCoordinate(p.lat, p.lng))
      .map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat!,
        lng: p.lng!,
        sector: p.sector,
        distance_km: calculateHaversineDistanceKm(anchorLat, anchorLng, p.lat!, p.lng!),
      }))
      .filter((p) => p.distance_km <= radiusKm)
      // Nearest first — callers page this list, so an unordered result set means
      // the closest projects can be the ones truncated away.
      .sort((a, b) => a.distance_km - b.distance_km)

    return withDistance
  } catch (err) {
    console.error('getProjectsWithinRadius failed:', err)
    return []
  }
}
