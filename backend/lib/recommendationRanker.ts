/**
 * Recommendation Ranking Algorithm
 * Phase 3D: Optimized with Phase 2 enriched data
 *
 * Scoring factors:
 * 1. Budget fit (hard filter)
 * 2. Location fit (sector, metro proximity)
 * 3. Possession timeline fit
 * 4. Builder track record (lift_act_compliant, OC status)
 * 5. Amenities match (Phase 2C)
 * 6. Location infrastructure (walkability, hospital/school proximity)
 */

export interface ProjectScore {
  project_id: string
  project_name: string
  total_score: number
  score_breakdown: {
    budget_fit: number
    location_fit: number
    possession_fit: number
    builder_fit: number
    amenities_fit: number
    infrastructure_fit: number
  }
  reason: string
  tradeoff: string
}

export interface BuyerProfile {
  budget_min_cr?: number
  budget_max_cr?: number
  preferred_sectors?: string[]
  preferred_bhk?: number
  possession_months?: number
  required_amenities?: string[]
  must_have_metro_distance_km?: number
}

export interface EnrichedProject {
  id: string
  name: string
  price_min_cr?: number
  price_max_cr?: number
  sector?: string
  possession_date?: Date
  walkability_score?: number
  hospital_distance_km?: number
  top_school_distance_km?: number
  lift_act_compliant?: boolean
  oc_obtained?: boolean
  amenities_list?: string[]
}

/**
 * Score and rank projects against buyer profile
 */
export function rankProjects(
  projects: EnrichedProject[],
  buyer: BuyerProfile
): ProjectScore[] {
  const scored = projects
    .map(project => scoreProject(project, buyer))
    .filter(score => score.total_score > 0)
    .sort((a, b) => b.total_score - a.total_score)

  return scored
}

function scoreProject(project: EnrichedProject, buyer: BuyerProfile): ProjectScore {
  const breakdown = {
    budget_fit: scoreBudgetFit(project, buyer),
    location_fit: scoreLocationFit(project, buyer),
    possession_fit: scorePossessionFit(project, buyer),
    builder_fit: scoreBuilderFit(project, buyer),
    amenities_fit: scoreAmenitiesFit(project, buyer),
    infrastructure_fit: scoreInfrastructureFit(project, buyer),
  }

  const total_score = Object.values(breakdown).reduce((a, b) => a + b, 0) / 6

  return {
    project_id: project.id,
    project_name: project.name,
    total_score: Math.round(total_score),
    score_breakdown: breakdown,
    reason: generateReason(project, buyer, breakdown),
    tradeoff: generateTradeoff(project, buyer, breakdown),
  }
}

function scoreBudgetFit(project: EnrichedProject, buyer: BuyerProfile): number {
  if (!buyer.budget_max_cr || !project.price_min_cr) return 50

  if (project.price_min_cr > buyer.budget_max_cr * 1.1) return 0 // 10% tolerance
  if (project.price_min_cr > buyer.budget_max_cr) return 25
  if (project.price_min_cr > buyer.budget_max_cr * 0.8) return 75
  return 100
}

function scoreLocationFit(project: EnrichedProject, buyer: BuyerProfile): number {
  let score = 50

  // Sector preference
  if (buyer.preferred_sectors?.includes(project.sector || '')) {
    score += 30
  }

  // Metro proximity (boost if close)
  if (project.walkability_score && project.walkability_score > 75) {
    score += 20
  }

  return Math.min(100, score)
}

function scorePossessionFit(project: EnrichedProject, buyer: BuyerProfile): number {
  if (!buyer.possession_months || !project.possession_date) return 50

  const monthsToHandover = monthsBetween(new Date(), project.possession_date)
  const within_timeline = monthsToHandover <= buyer.possession_months

  if (within_timeline) return 100
  if (monthsToHandover <= buyer.possession_months + 6) return 75
  if (monthsToHandover <= buyer.possession_months + 12) return 50
  return 25
}

function scoreBuilderFit(project: EnrichedProject, buyer: BuyerProfile): number {
  let score = 50

  if (project.lift_act_compliant) score += 25
  if (project.oc_obtained) score += 25

  return Math.min(100, score)
}

function scoreAmenitiesFit(project: EnrichedProject, buyer: BuyerProfile): number {
  if (!buyer.required_amenities || !project.amenities_list) return 50

  const matched = buyer.required_amenities.filter(amenity =>
    project.amenities_list?.some(a => a.toLowerCase().includes(amenity.toLowerCase()))
  ).length

  const matchPercent = (matched / buyer.required_amenities.length) * 100
  return Math.round(matchPercent)
}

function scoreInfrastructureFit(project: EnrichedProject, buyer: BuyerProfile): number {
  let score = 50

  // Hospital proximity (prefer < 2km)
  if (project.hospital_distance_km && project.hospital_distance_km < 2) {
    score += 25
  }

  // School proximity (prefer < 1.5km)
  if (project.top_school_distance_km && project.top_school_distance_km < 1.5) {
    score += 25
  }

  return Math.min(100, score)
}

function generateReason(
  project: EnrichedProject,
  buyer: BuyerProfile,
  breakdown: any
): string {
  const reasons: string[] = []

  if (breakdown.budget_fit > 75) {
    reasons.push(`Fits your ${buyer.budget_max_cr} Cr budget`)
  }

  if (breakdown.location_fit > 75 && project.walkability_score) {
    reasons.push(`Strong location (walkability ${project.walkability_score})`)
  }

  if (breakdown.possession_fit > 75) {
    reasons.push(`Possession within your timeline`)
  }

  if (breakdown.builder_fit > 75) {
    if (project.lift_act_compliant && project.oc_obtained) {
      reasons.push(`Builder has clear OC and LIFT Act compliance`)
    }
  }

  return reasons.join('; ') || `Matches your requirements`
}

function generateTradeoff(
  project: EnrichedProject,
  buyer: BuyerProfile,
  breakdown: any
): string {
  if (breakdown.possession_fit < 50) {
    return `Possession expected in ${monthsBetween(new Date(), project.possession_date || new Date())} months`
  }

  if (breakdown.location_fit < 50) {
    if (project.hospital_distance_km) {
      return `Hospital ${project.hospital_distance_km}km away`
    }
    return `Location may be less connected`
  }

  if (breakdown.budget_fit < 75 && project.price_min_cr) {
    return `Price starts at ₹${project.price_min_cr} Cr (above stated budget)`
  }

  return ''
}

function monthsBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30))
}
