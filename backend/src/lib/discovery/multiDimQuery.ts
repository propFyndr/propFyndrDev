/**
 * Phase 3: Multi-Dimensional Query Engine
 *
 * Efficient Prisma queries to fetch projects + all metadata needed for Phase 2 scoring.
 *
 * Flow:
 * 1. Hard constraint filtering (Phase 1): budget, sector, BHK, legal
 * 2. Metadata fetch (Phase 2): join all scoring dimensions in single query
 * 3. Distance calculations (Haversine): metro/school/hospital connectivity
 * 4. Sector stats: benchmarking data for pricing/maintenance
 * 5. Return RankedProject with dimensions ready for scoring
 */

import { prisma } from '../db'
import type { ExtendedIntentWithConfidence } from '../ai/extendedIntent'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DimensionScore {
  dimension: string
  score: number
  weight: number
  basis: string
}

export interface ProjectWithMetadata {
  id: string
  name: string
  sector: string
  city: string
  slug: string
  status: 'under_construction' | 'ready_to_move' | 'new_launch'

  // Pricing
  priceMin: number
  priceMax: number
  pricePerSqft: number | null

  // Specs
  bhk: number[]
  carpetArea: number | null
  superArea: number | null
  balconies: number | null
  parkingCount: number
  orientation: string[]

  // Amenities
  hasPool: boolean
  hasGym: boolean
  hasClubhouse: boolean
  isGated: boolean
  maintenanceCostMonthly: number | null

  // Builder data
  builderName: string
  /**
   * Removed from the buyer-facing shape.
   *
   * It carried `builder.delivery_score` under a name ending in "Percent",
   * which is how "a 92% builder delivery score" reached an answer after the
   * score had been stripped from every other emitter. A field name that
   * asserts a unit the value does not have is worse than the raw score.
   * See BUYER_OPAQUE_SCORES in projectExposure.ts.
   */
  builderLitigationCount: number | null
  builderReraRegistered: boolean

  // Timeline
  possessionDate: Date | null
  possessionLabel: string | null
  possessionConfidence: string | null

  // Legal
  reraNumber: string | null
  legalFlag: string | null
  litigationCount: number | null

  // Location
  lat: number | null
  lng: number | null

  // Connectivity (computed from distance calculations)
  nearbyMetros: ConnectivityDetail[]
  nearbySchools: ConnectivityDetail[]
  nearbyHospitals: ConnectivityDetail[]
  nearbyParks: ConnectivityDetail[]

  // Sector stats (for benchmarking)
  sectorAvgPricePerSqft: number | null
  sectorAvgMaintenanceCost: number | null
}

export interface ConnectivityDetail {
  name: string
  distanceKm: number
  travelTime: number | null
  rating: number | null
}

export interface RankedProject {
  projectId: string
  projectName: string
  builderName: string
  sector: string
  finalScore: number
  dimensionScores: DimensionScore[]
  metadata: ProjectWithMetadata
  dealBreakers: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities: Distance Calculation (Haversine)
// ─────────────────────────────────────────────────────────────────────────────

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Hard Constraint Filtering
// ─────────────────────────────────────────────────────────────────────────────

function buildHardConstraintFilters(
  intent: ExtendedIntentWithConfidence
): Record<string, unknown> {
  const filters: Record<string, unknown> = {}

  // Budget constraint: projects with overlapping price range
  if (intent.budgetMin !== undefined || intent.budgetMax !== undefined) {
    const budgetMin = intent.budgetMin ?? 0
    const budgetMax = intent.budgetMax ?? Number.MAX_SAFE_INTEGER

    filters.AND = [
      { OR: [{ price_min_cr: { lte: budgetMax } }, { price_min_cr: null }] },
      { OR: [{ price_min_cr: { gte: budgetMin } }, { price_min_cr: null }] },
    ]
  }

  // Sector constraint
  if (intent.sectorPreference) {
    filters.sector = intent.sectorPreference
  }

  // City constraint (V1 is Noida-only)
  filters.city = 'Noida'

  // Legal constraints: exclude projects with deal-breaking legal flags
  if (intent.litigationMustBe0) {
    filters.litigation_count = 0
  }

  // RERA requirement
  if (intent.reraComplianceMust) {
    filters.rera_number = { not: null }
  }

  // Exclude projects with active legal disputes
  if (intent.riskTolerance === 'very_conservative') {
    filters.legal_flag = null
  }

  // Construction stage preference
  if (intent.constructionStagePreference && intent.constructionStagePreference !== 'any') {
    const stageMap: Record<string, 'under_construction' | 'ready_to_move' | 'new_launch'> = {
      pre_launch: 'new_launch',
      under_construction: 'under_construction',
      nearing_completion: 'under_construction',
      ready_to_move: 'ready_to_move',
    }
    const mappedStatus = stageMap[intent.constructionStagePreference]
    if (mappedStatus) {
      filters.status = mappedStatus
    }
  }

  // BHK constraint: filter projects that have matching unit types
  if (intent.bhk && intent.bhk.length > 0) {
    filters.unit_types = {
      some: {
        bhk: { in: intent.bhk },
      },
    }
  }

  return filters
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Efficient Metadata Fetch
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProjectsWithMetadata(
  filters: Record<string, unknown>,
  limit: number = 20,
  offset: number = 0
): Promise<
  Array<{
    id: string
    name: string
    slug: string
    sector: string
    city: string
    status: 'under_construction' | 'ready_to_move' | 'new_launch'
    lat: number | null
    lng: number | null
    price_min_cr: number | null
    possession_date: Date | null
    possession_label: string | null
    possession_confidence: string | null
    rera_number: string | null
    legal_flag: string | null
    litigation_count: number | null
    builder_id: string
    builder: {
      id: string
      name: string
      delivery_score: number | null
      litigation_count: number | null
      rera_promoter_id: string | null
    }
    unit_types: Array<{
      id: string
      bhk: number
      carpet_area_sqft: number | null
      super_area_sqft: number | null
      balcony_area_sqft: number | null
      balconies: number | null
      price_min_cr: number | null
      price_max_cr: number | null
      price_per_sqft: number | null
      unit_orientations: string[]
    }>
    amenities: Array<{
      id: string
      name: string
      category: string
    }>
    connectivity: Array<{
      id: string
      type: string
      name: string
      distance_km: number | null
      travel_time_min: number | null
      rating: number | null
    }>
    cost_sheet: {
      id: string
      maintenance_psf_monthly: number | null
    } | null
  }>
> {
  return prisma.project.findMany({
    where: filters,
    select: {
      id: true,
      name: true,
      slug: true,
      sector: true,
      city: true,
      status: true,
      lat: true,
      lng: true,
      price_min_cr: true,
      possession_date: true,
      possession_label: true,
      possession_confidence: true,
      rera_number: true,
      legal_flag: true,
      litigation_count: true,
      builder_id: true,
      builder: {
        select: {
          id: true,
          name: true,
          delivery_score: true,
          litigation_count: true,
          rera_promoter_id: true,
        },
      },
      unit_types: {
        select: {
          id: true,
          bhk: true,
          carpet_area_sqft: true,
          super_area_sqft: true,
          balcony_area_sqft: true,
          balconies: true,
          price_min_cr: true,
          price_max_cr: true,
          price_per_sqft: true,
          unit_orientations: true,
        },
      },
      amenities: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
      connectivity: {
        select: {
          id: true,
          type: true,
          name: true,
          distance_km: true,
          travel_time_min: true,
          rating: true,
        },
      },
      cost_sheet: {
        select: {
          id: true,
          maintenance_psf_monthly: true,
        },
      },
    },
    take: limit,
    skip: offset,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Connectivity Processing (Distance Filtering)
// ─────────────────────────────────────────────────────────────────────────────

function processConnectivity(
  project: { lat: number | null; lng: number | null },
  connectivityRaw: Array<{
    type: string
    name: string
    distance_km: number | null
    travel_time_min: number | null
    rating: number | null
  }>,
  intent: ExtendedIntentWithConfidence
): {
  nearbyMetros: ConnectivityDetail[]
  nearbySchools: ConnectivityDetail[]
  nearbyHospitals: ConnectivityDetail[]
  nearbyParks: ConnectivityDetail[]
} {
  const metroDistance = intent.metroDistance ?? 10 // Default 10km
  const schoolDistance = 5 // Default 5km for schools

  const result = {
    nearbyMetros: [] as ConnectivityDetail[],
    nearbySchools: [] as ConnectivityDetail[],
    nearbyHospitals: [] as ConnectivityDetail[],
    nearbyParks: [] as ConnectivityDetail[],
  }

  if (!project.lat || !project.lng) {
    return result
  }

  for (const conn of connectivityRaw) {
    // Pre-fetch connectivity data (stored distances take precedence)
    if (conn.distance_km === null) {
      continue // Skip if distance unavailable
    }

    const detail: ConnectivityDetail = {
      name: conn.name,
      distanceKm: conn.distance_km,
      travelTime: conn.travel_time_min,
      rating: conn.rating,
    }

    // Filter by type and distance threshold
    if (conn.type === 'metro' && conn.distance_km <= metroDistance) {
      result.nearbyMetros.push(detail)
    } else if (conn.type === 'school' && conn.distance_km <= schoolDistance) {
      result.nearbySchools.push(detail)
    } else if (conn.type === 'hospital' && conn.distance_km <= 10) {
      result.nearbyHospitals.push(detail)
    } else if (conn.type === 'park' && conn.distance_km <= 10) {
      result.nearbyParks.push(detail)
    }
  }

  // Sort by distance
  result.nearbyMetros.sort((a, b) => a.distanceKm - b.distanceKm)
  result.nearbySchools.sort((a, b) => a.distanceKm - b.distanceKm)
  result.nearbyHospitals.sort((a, b) => a.distanceKm - b.distanceKm)
  result.nearbyParks.sort((a, b) => a.distanceKm - b.distanceKm)

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4: Sector Statistics (Benchmarking)
// ─────────────────────────────────────────────────────────────────────────────

const sectorStatsCache = new Map<string, { stats: Record<string, number>; timestamp: number }>()
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour

async function getSectorStats(sector: string): Promise<{
  avgPricePerSqft: number | null
  avgMaintenanceCost: number | null
}> {
  const cacheKey = sector
  const cached = sectorStatsCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return {
      avgPricePerSqft: cached.stats.avgPricePerSqft ?? null,
      avgMaintenanceCost: cached.stats.avgMaintenanceCost ?? null,
    }
  }

  // Query projects in sector with pricing and maintenance data
  const projects = await prisma.project.findMany({
    where: { sector, city: 'Noida' },
    select: {
      unit_types: {
        select: {
          price_per_sqft: true,
          super_area_sqft: true,
        },
      },
      cost_sheet: {
        select: {
          maintenance_psf_monthly: true,
        },
      },
    },
  })

  // Calculate averages
  let totalPricePerSqft = 0
  let priceCount = 0
  let totalMaintenance = 0
  let maintenanceCount = 0

  for (const proj of projects) {
    for (const unit of proj.unit_types) {
      if (unit.price_per_sqft !== null) {
        totalPricePerSqft += unit.price_per_sqft
        priceCount++
      }
    }
    if (proj.cost_sheet?.maintenance_psf_monthly != null) {
      totalMaintenance += proj.cost_sheet.maintenance_psf_monthly
      maintenanceCount++
    }
  }

  const stats = {
    avgPricePerSqft: priceCount > 0 ? totalPricePerSqft / priceCount : null,
    avgMaintenanceCost: maintenanceCount > 0 ? totalMaintenance / maintenanceCount : null,
  }

  // Cache the result
  sectorStatsCache.set(cacheKey, {
    stats: {
      avgPricePerSqft: stats.avgPricePerSqft ?? 0,
      avgMaintenanceCost: stats.avgMaintenanceCost ?? 0,
    },
    timestamp: Date.now(),
  })

  return stats
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5: Metadata Assembly
// ─────────────────────────────────────────────────────────────────────────────

async function assembleProjectMetadata(
  rawProject: Awaited<ReturnType<typeof fetchProjectsWithMetadata>>[0],
  intent: ExtendedIntentWithConfidence
): Promise<ProjectWithMetadata> {
  // Extract unique BHKs from unit types
  const bhks = Array.from(new Set(rawProject.unit_types.map(u => u.bhk)))

  // Get median carpet/super area
  const carpetAreas = rawProject.unit_types
    .filter(u => u.carpet_area_sqft !== null)
    .map(u => u.carpet_area_sqft as number)
  const superAreas = rawProject.unit_types
    .filter(u => u.super_area_sqft !== null)
    .map(u => u.super_area_sqft as number)

  const carpetArea =
    carpetAreas.length > 0 ? carpetAreas[Math.floor(carpetAreas.length / 2)] : null
  const superArea =
    superAreas.length > 0 ? superAreas[Math.floor(superAreas.length / 2)] : null

  // Get median price per sqft
  const pricesPerSqft = rawProject.unit_types
    .filter(u => u.price_per_sqft !== null)
    .map(u => u.price_per_sqft as number)
  const pricePerSqft =
    pricesPerSqft.length > 0 ? pricesPerSqft[Math.floor(pricesPerSqft.length / 2)] : null

  // Get all unit orientations (flatten and dedupe)
  const allOrientations = Array.from(new Set(rawProject.unit_types.flatMap(u => u.unit_orientations)))

  // Count amenities by category
  const hasPool = rawProject.amenities.some(a => a.category === 'lifestyle' && a.name.toLowerCase().includes('pool'))
  const hasGym = rawProject.amenities.some(a => a.category === 'wellness' && a.name.toLowerCase().includes('gym'))
  const hasClubhouse = rawProject.amenities.some(a => a.name.toLowerCase().includes('clubhouse'))
  const isGated = rawProject.amenities.some(a => a.category === 'security' && a.name.toLowerCase().includes('gated'))

  // Get parking count (assume 1 per unit if available, else 0)
  const parkingCount = rawProject.amenities.some(
    a => a.category === 'parking' || a.name.toLowerCase().includes('parking')
  )
    ? 1
    : 0

  // Get balcony count from units
  const balconies =
    rawProject.unit_types.length > 0 ? rawProject.unit_types[0].balconies ?? null : null

  // Process connectivity
  const connectivity = processConnectivity(rawProject, rawProject.connectivity, intent)

  // Get sector stats
  const sectorStats = await getSectorStats(rawProject.sector)

  // Calculate average balcony area
  const balconyAreas = rawProject.unit_types
    .filter(u => u.balcony_area_sqft !== null)
    .map(u => u.balcony_area_sqft as number)
  const avgBalconyArea =
    balconyAreas.length > 0 ? balconyAreas[Math.floor(balconyAreas.length / 2)] : null

  // Get maintenance cost (psf -> monthly in rupees)
  const maintenanceCostMonthly = rawProject.cost_sheet?.maintenance_psf_monthly ?? null

  // Determine if builder is RERA registered
  const builderReraRegistered = !!rawProject.builder.rera_promoter_id

  // Calculate priceMax from unit_types
  const priceMaxValues = rawProject.unit_types
    .filter(u => u.price_max_cr !== null)
    .map(u => u.price_max_cr as number)
  const priceMax =
    priceMaxValues.length > 0 ? Math.max(...priceMaxValues) : rawProject.price_min_cr ?? 0

  return {
    id: rawProject.id,
    name: rawProject.name,
    sector: rawProject.sector,
    city: rawProject.city,
    slug: rawProject.slug,
    status: rawProject.status,
    priceMin: rawProject.price_min_cr ?? 0,
    priceMax,
    pricePerSqft,
    bhk: bhks,
    carpetArea,
    superArea,
    balconies,
    parkingCount,
    orientation: allOrientations,
    hasPool,
    hasGym,
    hasClubhouse,
    isGated,
    maintenanceCostMonthly,
    builderName: rawProject.builder.name,
    builderLitigationCount: rawProject.builder.litigation_count,
    builderReraRegistered,
    possessionDate: rawProject.possession_date,
    possessionLabel: rawProject.possession_label,
    possessionConfidence: rawProject.possession_confidence,
    reraNumber: rawProject.rera_number,
    legalFlag: rawProject.legal_flag,
    litigationCount: rawProject.litigation_count,
    lat: rawProject.lat,
    lng: rawProject.lng,
    nearbyMetros: connectivity.nearbyMetros,
    nearbySchools: connectivity.nearbySchools,
    nearbyHospitals: connectivity.nearbyHospitals,
    nearbyParks: connectivity.nearbyParks,
    sectorAvgPricePerSqft: sectorStats.avgPricePerSqft,
    sectorAvgMaintenanceCost: sectorStats.avgMaintenanceCost,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6: Deal Breaker Detection
// ─────────────────────────────────────────────────────────────────────────────

function detectDealBreakers(
  metadata: ProjectWithMetadata,
  intent: ExtendedIntentWithConfidence
): string[] {
  const breakers: string[] = []

  // Budget deal breakers
  if (intent.budgetMax && metadata.priceMin > intent.budgetMax) {
    breakers.push(`Price exceeds budget (₹${metadata.priceMin}Cr vs ₹${intent.budgetMax}Cr max)`)
  }

  // Legal deal breakers
  if (intent.litigationMustBe0 && metadata.litigationCount !== null && metadata.litigationCount > 0) {
    breakers.push(`${metadata.litigationCount} active litigation case(s)`)
  }

  if (intent.reraComplianceMust && !metadata.reraNumber) {
    breakers.push('Missing RERA registration')
  }

  if (metadata.legalFlag && intent.riskTolerance === 'very_conservative') {
    breakers.push(`Legal flag: ${metadata.legalFlag}`)
  }

  // BHK deal breakers
  if (intent.bhk && intent.bhk.length > 0) {
    const hasMatchingBhk = metadata.bhk.some(bhk => intent.bhk!.includes(bhk))
    if (!hasMatchingBhk) {
      breakers.push(`No matching BHK (project has ${metadata.bhk.join(', ')} BHK)`)
    }
  }

  // Spec deal breakers
  if (intent.balconyPreference === 'must_have' && !metadata.balconies) {
    breakers.push('No balcony in configuration')
  }

  if (intent.carpetAreaMin && metadata.carpetArea && metadata.carpetArea < intent.carpetAreaMin) {
    breakers.push(`Carpet area too small (${metadata.carpetArea} sqft vs ${intent.carpetAreaMin} sqft min)`)
  }

  if (intent.carpetAreaMax && metadata.carpetArea && metadata.carpetArea > intent.carpetAreaMax) {
    breakers.push(`Carpet area too large (${metadata.carpetArea} sqft vs ${intent.carpetAreaMax} sqft max)`)
  }

  return breakers
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point: Query and Score Projects
// ─────────────────────────────────────────────────────────────────────────────

export async function queryAndScoreProjects(
  intent: ExtendedIntentWithConfidence,
  options?: { limit?: number; offset?: number }
): Promise<RankedProject[]> {
  const limit = options?.limit ?? 20
  const offset = options?.offset ?? 0

  // Phase 1: Build hard constraint filters
  const filters = buildHardConstraintFilters(intent)

  // Phase 2: Fetch projects with all metadata
  const rawProjects = await fetchProjectsWithMetadata(filters, limit, offset)

  // Phase 3-5: Assemble and enrich metadata
  const results: RankedProject[] = []

  for (const rawProject of rawProjects) {
    const metadata = await assembleProjectMetadata(rawProject, intent)
    const dealBreakers = detectDealBreakers(metadata, intent)

    // Skip projects with deal breakers (they'll be explicitly filtered in scoring phase)
    // For now, just include them with flagged deal breakers
    const result: RankedProject = {
      projectId: rawProject.id,
      projectName: rawProject.name,
      builderName: rawProject.builder.name,
      sector: rawProject.sector,
      finalScore: 0, // Placeholder — Phase 2 scoring fills this
      dimensionScores: [], // Placeholder — Phase 2 scoring fills this
      metadata,
      dealBreakers,
    }

    results.push(result)
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Get single project with full metadata (for detail pages)
// ─────────────────────────────────────────────────────────────────────────────

export async function getProjectMetadata(
  projectId: string,
  intent?: ExtendedIntentWithConfidence
): Promise<ProjectWithMetadata | null> {
  const rawProject = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      slug: true,
      sector: true,
      city: true,
      status: true,
      lat: true,
      lng: true,
      price_min_cr: true,
      possession_date: true,
      possession_label: true,
      possession_confidence: true,
      rera_number: true,
      legal_flag: true,
      litigation_count: true,
      builder_id: true,
      builder: {
        select: {
          id: true,
          name: true,
          delivery_score: true,
          litigation_count: true,
          rera_promoter_id: true,
        },
      },
      unit_types: {
        select: {
          id: true,
          bhk: true,
          carpet_area_sqft: true,
          super_area_sqft: true,
          balcony_area_sqft: true,
          balconies: true,
          price_min_cr: true,
          price_max_cr: true,
          price_per_sqft: true,
          unit_orientations: true,
        },
      },
      amenities: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
      connectivity: {
        select: {
          id: true,
          type: true,
          name: true,
          distance_km: true,
          travel_time_min: true,
          rating: true,
        },
      },
      cost_sheet: {
        select: {
          id: true,
          maintenance_psf_monthly: true,
        },
      },
    },
  })

  if (!rawProject) {
    return null
  }

  // Use default empty intent if none provided
  const defaultIntent: ExtendedIntentWithConfidence = {
    metroDistance: 10,
  }

  return assembleProjectMetadata(rawProject, intent || defaultIntent)
}

// Export for testing and debugging
export { haversineDistance, buildHardConstraintFilters, processConnectivity }
