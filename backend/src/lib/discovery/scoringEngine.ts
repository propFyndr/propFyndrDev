/**
 * Phase 2: Multi-dimensional Ranking Engine
 *
 * 11 independent dimension scorers for RealtyAsk recommendation engine.
 * Each scorer returns a 0-100 score with explanation and optional deal-breaker flag.
 *
 * Composite scoring uses geometric mean with dynamic weights based on intent priorities.
 */

import { Intent } from './types'

/**
 * Complete project data needed for scoring.
 * Combines core fields + computed metadata from database queries.
 */
export interface ProjectWithMetadata {
  // Core identifiers
  id: string
  name: string
  sector: string

  // Possession timeline
  possession_date: Date | null
  possession_label?: string | null
  status: string

  // Pricing
  price_min_cr?: number | null
  price_max_cr?: number | null

  // Property specs
  unit_types: Array<{
    bhk: number
    carpet_area_sqft?: number | null
    super_area_sqft?: number | null
    price_min_cr?: number | null
    price_max_cr?: number | null
  }>

  // Amenities & features
  has_pool?: boolean
  has_gym?: boolean
  has_clubhouse?: boolean
  is_gated?: boolean
  maintenance_cost?: number | null
  amenities?: Array<{ name: string }> | null

  // Legal & compliance
  rera_number?: string | null
  legal_flag?: string | null
  litigation_count?: number | null
  oc_obtained?: boolean | null

  // Builder information
  builder?: {
    name: string
    delivery_score?: number | null
    delayed_projects_count?: number | null
    average_delay_months?: number | null
    credai_member?: boolean | null
    litigation_count?: number | null
    financial_hygiene_score?: number | null
  }

  // Metadata from queries
  builderHistory?: {
    onTimePercent: number
    avgDelayMonths: number
    litigationCount: number
    reraCompliant: boolean
    financialStability: number
  }

  nearbySchools?: Array<{
    name: string
    distance_km?: number
    rating?: number
  }> | null

  nearbyHospitals?: Array<{
    name: string
    distance_km?: number
  }> | null

  nearbyMetro?: {
    name: string
    distance_km?: number
    distance_meters?: number
  } | null

  commute_matrix?: Array<{
    destination: string
    distance_km: number
    travel_time_min: number
  }> | null
}

/**
 * Sector-level and market-level metadata for relative scoring.
 */
export interface ScoringMetadata {
  sectorAvgPricePerSqft?: number
  sectorAvgMaintenanceCost?: number
  sectorMedianPossessionMonths?: number
  competitorCount?: number
}

/**
 * Single scorer result: score (0-100) + explanation + optional deal-breaker flag.
 */
export interface DimensionScore {
  score: number  // 0-100
  explanation: string
  dealBreaker?: boolean
}

/**
 * Complete ranking result with all dimension scores + final composite score.
 */
export interface RankingResult {
  finalScore: number  // 0-100 (geometric mean)
  dimensionScores: {
    budget: DimensionScore
    location: DimensionScore
    timeline: DimensionScore
    specs: DimensionScore
    builder: DimensionScore
    legal: DimensionScore
    amenities: DimensionScore
    pricing: DimensionScore
    personal: DimensionScore
    drivers: DimensionScore
    gaps: DimensionScore
  }
  dealBreakers: DimensionScore[]  // All scores where dealBreaker=true
}

// ============================================================================
// DIMENSION 1: BUDGET SCORE
// ============================================================================

function budgetScore(
  intent: Intent,
  project: ProjectWithMetadata,
  _metadata: ScoringMetadata
): DimensionScore {
  if (!intent.budgetMax) {
    return { score: 100, explanation: 'No budget constraint specified' }
  }

  const prices = project.unit_types
    .map((u) => u.price_min_cr)
    .filter((p): p is number => p != null)

  if (prices.length === 0) {
    return { score: 50, explanation: 'Pricing not available for comparison' }
  }

  const lowestPrice = Math.min(...prices)
  const budgetMax = intent.budgetMax

  if (lowestPrice <= budgetMax) {
    // Within budget: ramp up to 100 at midpoint
    const headroom = (budgetMax - lowestPrice) / budgetMax
    const score = Math.round(75 + headroom * 25) // 75-100
    return {
      score: Math.min(score, 100),
      explanation: `₹${lowestPrice.toFixed(2)}Cr — within budget (₹${(budgetMax - lowestPrice).toFixed(2)}Cr headroom)`
    }
  }

  const overage = lowestPrice - budgetMax
  const overagePercent = (overage / budgetMax) * 100

  if (overagePercent <= 10) {
    return {
      score: 50,
      explanation: `₹${lowestPrice.toFixed(2)}Cr — ₹${overage.toFixed(2)}Cr over budget (${overagePercent.toFixed(0)}%)`,
      dealBreaker: false
    }
  }

  if (overagePercent <= 25) {
    return {
      score: 25,
      explanation: `₹${lowestPrice.toFixed(2)}Cr — significantly over budget by ₹${overage.toFixed(2)}Cr`,
      dealBreaker: false
    }
  }

  return {
    score: 0,
    explanation: `₹${lowestPrice.toFixed(2)}Cr — far exceeds budget (${overagePercent.toFixed(0)}% over)`,
    dealBreaker: true
  }
}

// ============================================================================
// DIMENSION 2: LOCATION SCORE
// ============================================================================

function locationScore(
  intent: Intent,
  project: ProjectWithMetadata,
  _metadata: ScoringMetadata
): DimensionScore {
  let totalScore = 0
  const components: string[] = []

  // Metro proximity: 40% weight → 0-40 points
  // Ideal: < 1km = 40, 1-2km = 30, 2-3km = 20, 3-5km = 10, > 5km = 0
  let metroScore = 0
  if (project.nearbyMetro?.distance_km != null) {
    const metroKm = project.nearbyMetro.distance_km
    if (metroKm < 1) metroScore = 40
    else if (metroKm < 2) metroScore = 30
    else if (metroKm < 3) metroScore = 20
    else if (metroKm < 5) metroScore = 10
    else metroScore = 0
    components.push(`${project.nearbyMetro.name} ${metroKm.toFixed(1)}km`)
  } else {
    metroScore = 20 // Neutral when data unavailable
  }
  totalScore += metroScore

  // Commute fit: 30% weight → 0-30 points
  // Check if user has work location in commute_matrix
  let commuteScore = 20 // Neutral
  if (intent.lifestyleKeywords?.includes('work') && project.commute_matrix?.length) {
    // Find shortest commute
    const shortestCommute = Math.min(
      ...project.commute_matrix.map((c) => c.travel_time_min)
    )
    if (shortestCommute < 15) commuteScore = 30
    else if (shortestCommute < 30) commuteScore = 20
    else if (shortestCommute < 45) commuteScore = 10
    else commuteScore = 0
    components.push(`commute ${shortestCommute}min`)
  }
  totalScore += commuteScore

  // Schools: 20% weight → 0-20 points
  // Ideal: 3+ schools nearby with avg rating >= 3.5 = 20pts
  let schoolScore = 0
  if (project.nearbySchools && project.nearbySchools.length > 0) {
    const avgRating = project.nearbySchools.reduce((sum, s) => sum + (s.rating ?? 3), 0) / project.nearbySchools.length
    if (project.nearbySchools.length >= 3 && avgRating >= 3.5) schoolScore = 20
    else if (project.nearbySchools.length >= 2 && avgRating >= 3) schoolScore = 15
    else if (project.nearbySchools.length >= 1) schoolScore = 8
    components.push(`${project.nearbySchools.length} schools`)
  } else {
    schoolScore = 5 // Neutral
  }
  totalScore += schoolScore

  // Hospitals & Parks: 10% weight → 0-10 points
  let amenityScore = 0
  if (project.nearbyHospitals && project.nearbyHospitals.length > 0) {
    amenityScore += Math.min(project.nearbyHospitals.length * 2, 5)
  }
  if (project.amenities?.some((a) => a.name.toLowerCase().includes('park'))) {
    amenityScore += 5
  }
  amenityScore = Math.min(amenityScore, 10)
  totalScore += amenityScore

  const finalScore = Math.min(totalScore, 100)
  const explanation =
    components.length > 0
      ? `Good connectivity: ${components.join(', ')}`
      : 'Connectivity data not fully available'

  return { score: finalScore, explanation }
}

// ============================================================================
// DIMENSION 3: TIMELINE SCORE
// ============================================================================

function timelineScore(
  intent: Intent,
  project: ProjectWithMetadata,
  metadata: ScoringMetadata
): DimensionScore {
  let score = 50 // Neutral baseline

  const monthsUntilPossession = project.possession_date
    ? (project.possession_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
    : null

  // Possession timeline fit (±30 points)
  if (monthsUntilPossession != null) {
    if (intent.possession === 'immediate') {
      score += monthsUntilPossession <= 3 ? 30 : monthsUntilPossession <= 6 ? 15 : -20
    } else if (intent.possession === '1year') {
      score += monthsUntilPossession <= 12 ? 30 : monthsUntilPossession <= 18 ? 10 : -10
    } else if (intent.possession === '2year') {
      score += monthsUntilPossession <= 24 ? 30 : monthsUntilPossession <= 30 ? 10 : -5
    } else if (intent.possession === '3year+') {
      score += 30 // Any future date acceptable
    } else {
      score += 10 // No specific preference
    }
  } else {
    score += 5 // Data unavailable
  }

  // Builder delay risk penalty (±20 points)
  if (project.builderHistory?.avgDelayMonths != null) {
    const avgDelay = project.builderHistory.avgDelayMonths
    if (avgDelay <= 3) score += 20
    else if (avgDelay <= 6) score += 10
    else if (avgDelay <= 12) score -= 10
    else score -= 20
  }

  const finalScore = Math.max(0, Math.min(score, 100))
  const months = monthsUntilPossession
    ? monthsUntilPossession < 1
      ? '< 1 month'
      : `${Math.round(monthsUntilPossession)} months`
    : 'Unknown'
  const delayRisk = project.builderHistory?.avgDelayMonths
    ? ` (builder avg delay: +${project.builderHistory.avgDelayMonths} months)`
    : ''

  return {
    score: finalScore,
    explanation: `Possession ${months}${delayRisk}`
  }
}

// ============================================================================
// DIMENSION 4: SPECS SCORE
// ============================================================================

function specsScore(
  intent: Intent,
  project: ProjectWithMetadata,
  _metadata: ScoringMetadata
): DimensionScore {
  const score = 50 // Neutral baseline

  if (!intent.bhk || intent.bhk.length === 0) {
    return { score: 75, explanation: 'No specific BHK requirement' }
  }

  // BHK match: 40% weight (max 40 points)
  const matchingBhks = project.unit_types.filter((u) => intent.bhk!.includes(u.bhk))
  let bhkScore = 0
  if (matchingBhks.length === intent.bhk.length) {
    bhkScore = 40 // Perfect match
  } else if (matchingBhks.length > 0) {
    bhkScore = 25 // Partial match
  } else {
    // Check if off by 1
    const offByOne = project.unit_types.some((u) =>
      intent.bhk!.some((b) => Math.abs(u.bhk - b) === 1)
    )
    bhkScore = offByOne ? 15 : 0
  }

  // Carpet area: 30% weight (max 30 points)
  let areaScore = 20 // Neutral
  if (intent.areaMin || intent.areaMax) {
    const fits = matchingBhks.some(
      (u) =>
        u.carpet_area_sqft != null &&
        (!intent.areaMin || u.carpet_area_sqft >= intent.areaMin) &&
        (!intent.areaMax || u.carpet_area_sqft <= intent.areaMax)
    )
    areaScore = fits ? 30 : 5
  }

  // Balcony/Parking/Orientation: 20% weight (max 20 points)
  let featureScore = 10 // Neutral
  if (intent.lifestyleKeywords?.includes('balcony')) {
    // Assume all units in project have balconies (property spec)
    featureScore += 10
  }
  if (intent.lifestyleKeywords?.includes('parking')) {
    featureScore += 10
  }
  featureScore = Math.min(featureScore, 20)

  const totalScore = bhkScore + areaScore + featureScore
  const finalScore = Math.min(totalScore, 100)

  const specText = matchingBhks.map((u) => `${u.bhk}BHK`).join(', ') || 'No matching specs'

  return {
    score: finalScore,
    explanation: `Specs match: ${specText}`
  }
}

// ============================================================================
// DIMENSION 5: BUILDER TRUST SCORE
// ============================================================================

function builderScore(
  _intent: Intent,
  project: ProjectWithMetadata,
  _metadata: ScoringMetadata
): DimensionScore {
  let score = 50 // Neutral baseline

  if (!project.builder && !project.builderHistory) {
    return { score: 50, explanation: 'Limited builder information available' }
  }

  const history = project.builderHistory

  // On-time delivery: 50% weight (max 50 points)
  if (history?.onTimePercent != null) {
    score = Math.round(history.onTimePercent * 0.5)
  } else if (project.builder?.delivery_score != null) {
    score = Math.round(project.builder.delivery_score * 0.5)
  }

  // Litigation penalty: 30% weight
  const litigationCount = history?.litigationCount ?? project.builder?.litigation_count ?? 0
  if (litigationCount === 0) {
    score += 30
  } else if (litigationCount === 1) {
    score += 15
  } else if (litigationCount <= 3) {
    score += 5
  }
  // 4+ cases: 0 additional points

  // RERA compliance: 20% weight
  const reraCompliant = history?.reraCompliant ?? project.rera_number != null
  if (reraCompliant) {
    score += 20
  } else if (project.legal_flag?.toLowerCase().includes('rera')) {
    score -= 10
  }

  // Financial stability bonus: up to 10 bonus points
  if (history?.financialStability != null) {
    score += Math.round(history.financialStability * 0.1)
  }

  const finalScore = Math.max(0, Math.min(score, 100))

  const components: string[] = []
  if (history?.onTimePercent != null) components.push(`${history.onTimePercent}% on-time`)
  if (litigationCount === 0) components.push('no litigation')
  if (reraCompliant) components.push('RERA-compliant')

  return {
    score: finalScore,
    explanation: components.length > 0 ? `Builder: ${components.join(', ')}` : 'Builder track record unknown'
  }
}

// ============================================================================
// DIMENSION 6: LEGAL SCORE
// ============================================================================

function legalScore(
  _intent: Intent,
  project: ProjectWithMetadata,
  _metadata: ScoringMetadata
): DimensionScore {
  const concerns: string[] = []
  let score = 100 // Innocent until proven guilty

  // RERA registration: critical
  if (!project.rera_number) {
    score -= 40
    concerns.push('No RERA registration')
  }

  // Litigation: deal breaker
  if (project.litigation_count && project.litigation_count > 0) {
    score -= 50
    concerns.push(`${project.litigation_count} litigation case(s)`)
  }

  // Legal flag (NCLT, disputes, etc.)
  if (project.legal_flag) {
    score -= 40
    concerns.push(project.legal_flag)
  }

  // Occupancy certificate status
  if (project.oc_obtained === true) {
    score += 20
  } else if (project.oc_obtained === false) {
    score -= 15
  }

  const finalScore = Math.max(0, Math.min(score, 100))
  const dealBreaker = finalScore < 40

  return {
    score: finalScore,
    explanation: concerns.length > 0 ? concerns.join('; ') : 'All legal checks clear',
    dealBreaker
  }
}

// ============================================================================
// DIMENSION 7: AMENITIES SCORE
// ============================================================================

function amenitiesScore(
  intent: Intent,
  project: ProjectWithMetadata,
  metadata: ScoringMetadata
): DimensionScore {
  let score = 50 // Neutral baseline

  // Pool: wanted? +20 points
  if (intent.lifestyleKeywords?.includes('pool')) {
    score += project.has_pool ? 20 : 0
  }

  // Gym: wanted? +20 points
  if (intent.lifestyleKeywords?.includes('gym')) {
    score += project.has_gym ? 20 : 0
  }

  // Clubhouse: wanted? +20 points
  if (intent.lifestyleKeywords?.includes('clubhouse')) {
    score += project.has_clubhouse ? 20 : 0
  }

  // Gated community: wanted? +20 points
  if (intent.lifestyleKeywords?.includes('gated') || intent.riskProfile === 'nri') {
    score += project.is_gated ? 20 : 0
  }

  // Maintenance cost fit: ±10 points
  if (project.maintenance_cost != null && metadata.sectorAvgMaintenanceCost != null) {
    const ratio = project.maintenance_cost / metadata.sectorAvgMaintenanceCost
    if (ratio < 0.8) {
      score += 10 // Below average
    } else if (ratio > 1.3) {
      score -= 5 // Above average
    }
  }

  const finalScore = Math.min(score, 100)

  const amenities: string[] = []
  if (project.has_pool) amenities.push('pool')
  if (project.has_gym) amenities.push('gym')
  if (project.has_clubhouse) amenities.push('clubhouse')
  if (project.is_gated) amenities.push('gated')

  return {
    score: finalScore,
    explanation: amenities.length > 0 ? `Amenities: ${amenities.join(', ')}` : 'Standard amenities'
  }
}

// ============================================================================
// DIMENSION 8: PRICING SCORE
// ============================================================================

function pricingScore(
  _intent: Intent,
  project: ProjectWithMetadata,
  metadata: ScoringMetadata
): DimensionScore {
  if (!metadata.sectorAvgPricePerSqft) {
    return { score: 50, explanation: 'No sector pricing data available' }
  }

  const unitWithArea = project.unit_types.find((u) => u.carpet_area_sqft && u.price_min_cr)
  if (!unitWithArea) {
    return { score: 50, explanation: 'Insufficient pricing data' }
  }

  const pricePerSqft = (unitWithArea.price_min_cr! * 1_000_000) / (unitWithArea.carpet_area_sqft! * 9) // Convert to per sqft in rupees (1 sqft ≈ 0.0929 sqm, but for price calc use direct)

  // Actually, let me recalculate properly: 1 cr = 10^7 rupees, 1 sqft carpet area
  const pricePerSqftCorrect = (unitWithArea.price_min_cr! * 1_000_000) / (unitWithArea.carpet_area_sqft! || 1000)

  const sectorAvg = metadata.sectorAvgPricePerSqft
  const ratio = pricePerSqftCorrect / sectorAvg

  let score: number
  if (ratio < 0.85) {
    score = 100 // Excellent value
  } else if (ratio < 0.95) {
    score = 85 // Good value
  } else if (ratio < 1.05) {
    score = 70 // Fair value
  } else if (ratio < 1.15) {
    score = 50 // Slightly premium
  } else {
    score = 30 // Premium pricing
  }

  return {
    score,
    explanation: `Price: ₹${pricePerSqftCorrect.toFixed(0)}/sqft (sector avg ₹${sectorAvg.toFixed(0)})`
  }
}

// ============================================================================
// DIMENSION 9: PERSONAL FIT SCORE
// ============================================================================

function personalScore(
  intent: Intent,
  project: ProjectWithMetadata,
  _metadata: ScoringMetadata
): DimensionScore {
  let score = 50 // Neutral baseline

  // Family stage fit: if user mentions "family" or "schools"
  if ((intent.lifestyleKeywords?.includes('family') || intent.lifestyleKeywords?.includes('schools')) && project.nearbySchools && project.nearbySchools.length >= 2) {
    score += 30
  }

  // Lifestyle priority matching
  const lifestyleMatches = intent.lifestyleKeywords?.filter(
    (kw) => project.amenities?.some((a) => a.name.toLowerCase().includes(kw.toLowerCase()))
  ).length ?? 0

  if (lifestyleMatches > 0) {
    score += Math.min(lifestyleMatches * 10, 20)
  }

  // Commute consideration
  if (project.commute_matrix && project.commute_matrix.length > 0) {
    const bestCommute = Math.min(...project.commute_matrix.map((c) => c.travel_time_min))
    if (bestCommute < 20) {
      score += 15
    } else if (bestCommute < 40) {
      score += 8
    }
  }

  const finalScore = Math.min(score, 100)
  const reasons: string[] = []
  if (project.nearbySchools && project.nearbySchools.length >= 2) reasons.push('excellent schools')
  if (lifestyleMatches > 0) reasons.push(`${lifestyleMatches} lifestyle match(es)`)

  return {
    score: finalScore,
    explanation: reasons.length > 0 ? `Good fit: ${reasons.join(', ')}` : 'Standard fit'
  }
}

// ============================================================================
// DIMENSION 10: DECISION DRIVERS SCORE
// ============================================================================

function driversScore(
  intent: Intent,
  project: ProjectWithMetadata,
  _metadata: ScoringMetadata
): DimensionScore {
  let score = 50 // Neutral baseline

  // Primary motivation alignment
  if (intent.purpose === 'investment') {
    // Investors value builder track record and location tier
    score += project.builderHistory?.onTimePercent ?? 0 > 80 ? 20 : 10
  } else if (intent.purpose === 'endUse') {
    // End users value location, amenities, and possession timeline
    score += project.nearbySchools ? 15 : 0
  }

  // Deal breakers check
  if (project.legal_flag?.toLowerCase().includes('insolvency')) {
    return {
      score: 0,
      explanation: 'Insolvency risk present — not suitable',
      dealBreaker: true
    }
  }

  // Risk tolerance alignment
  if (intent.riskProfile === 'risk_averse') {
    if (project.builder?.credai_member && project.rera_number) {
      score += 20
    } else {
      score -= 20
    }
  }

  // Timeline horizon match
  if (intent.possession) {
    const monthsOut = project.possession_date
      ? (project.possession_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
      : null

    if (monthsOut != null) {
      if (intent.possession === 'immediate' && monthsOut <= 6) score += 15
      else if (intent.possession === '1year' && monthsOut <= 12) score += 15
      else if (intent.possession === '2year' && monthsOut <= 24) score += 15
      else if (intent.possession === '3year+') score += 15
    }
  }

  const finalScore = Math.max(0, Math.min(score, 100))

  return {
    score: finalScore,
    explanation: intent.purpose
      ? `${intent.purpose === 'investment' ? 'Investment' : 'Owner-occupancy'} potential`
      : 'Decision drivers not specified'
  }
}

// ============================================================================
// DIMENSION 11: CRITICAL GAPS SCORE
// ============================================================================

function gapsScore(
  intent: Intent,
  project: ProjectWithMetadata,
  _metadata: ScoringMetadata
): DimensionScore {
  let score = 100 // Innocent unless gaps found
  const gaps: string[] = []

  // Resale lock-in check
  // (This would typically come from project.resale_allowed field in DB)
  // For now, assume projects allow resale unless flagged
  // score remains 100

  // Rental allowance check (income-focused investors)
  if (intent.purpose === 'investment' && intent.lifestyleKeywords?.includes('rental')) {
    // Assume allowed unless project explicitly forbids
    // score remains 100
  }

  // Vastu/women safety if explicitly wanted
  if (intent.lifestyleKeywords?.includes('vastu')) {
    // No vastu data in schema, neutral
    score -= 10 // Can't verify, slight penalty
    gaps.push('Vastu compliance not verified')
  }

  if (intent.lifestyleKeywords?.includes('women-safe') || intent.riskProfile === 'nri') {
    if (project.is_gated) {
      score += 20
    } else {
      score -= 10
      gaps.push('Safety features not confirmed')
    }
  }

  // NRI eligibility
  if (intent.riskProfile === 'nri') {
    if (project.rera_number && project.builder?.credai_member) {
      score += 20 // Fully compliant for NRI
    } else {
      score -= 15 // Missing NRI safeguards
      gaps.push('NRI compliance gaps')
    }
  }

  const finalScore = Math.max(0, Math.min(score, 100))

  return {
    score: finalScore,
    explanation: gaps.length > 0 ? `Potential gaps: ${gaps.join(', ')}` : 'No critical gaps identified'
  }
}

// ============================================================================
// HELPER: COMPUTE DYNAMIC WEIGHTS
// ============================================================================

/**
 * Compute dimension weights based on intent priorities.
 * High-priority dimensions get 0.12-0.15, medium get 0.08-0.10, low get 0.05-0.07.
 * 11 dimensions × avg 0.091 ≈ 1.0
 */
export function computeWeights(intent: Intent): Record<string, number> {
  const weights = {
    budget: 0.12,      // Always important
    location: 0.12,    // Always important
    timeline: 0.10,    // Usually important
    specs: 0.09,       // Moderately important
    builder: 0.09,     // Moderately important
    legal: 0.10,       // Critical for risk-averse
    amenities: 0.07,   // Nice-to-have
    pricing: 0.08,     // Important for value seekers
    personal: 0.08,    // Important for lifestyle
    drivers: 0.07,     // Intent-specific
    gaps: 0.06         // Safety net check
  }

  // Adjust weights based on intent signals
  if (intent.purpose === 'investment') {
    weights.builder += 0.05 // Builder track record crucial for investors
    weights.pricing -= 0.02
    weights.personal -= 0.03
  }

  if (intent.riskProfile === 'risk_averse' || intent.riskProfile === 'nri') {
    weights.legal += 0.03
    weights.builder += 0.02
    weights.gaps += 0.02
    weights.personal -= 0.02
  }

  // Normalize weights to sum to 1.0
  const sum = Object.values(weights).reduce((a, b) => a + b, 0)
  Object.keys(weights).forEach((k) => {
    weights[k as keyof typeof weights] /= sum
  })

  return weights
}

// ============================================================================
// HELPER: GEOMETRIC MEAN WITH WEIGHTS
// ============================================================================

/**
 * Calculate geometric mean with optional weights.
 * Formula: (s1^w1 × s2^w2 × ... × sn^wn)^(1/sum(w))
 *
 * One score of 0 → final 0 (catches deal breakers)
 */
function geometricMean(scores: number[], weights: Record<string, number>): number {
  const keys = Object.keys(weights)
  if (keys.length === 0) return 0

  // Cap all scores at 100
  const cappedScores = keys.map((k, idx) => Math.min(scores[idx] ?? 0, 100))

  // If any score is 0, return 0 (deal breaker propagation)
  if (cappedScores.some((s) => s === 0)) {
    return 0
  }

  // Geometric mean: take log, multiply by weights, sum, divide by sum of weights, exponentiate
  let logSum = 0
  let weightSum = 0
  keys.forEach((k, idx) => {
    const score = cappedScores[idx]
    const weight = weights[k] ?? 1
    logSum += Math.log(Math.max(score, 0.1)) * weight // Avoid log(0)
    weightSum += weight
  })

  if (weightSum === 0) return 0
  const result = Math.exp(logSum / weightSum)
  return Math.round(result)
}

// ============================================================================
// MAIN ENTRY POINT: RANK PROJECT
// ============================================================================

/**
 * Comprehensive ranking of a project against user intent.
 * Returns all dimension scores + final composite score (0-100).
 */
export function rankProject(
  intent: Intent,
  project: ProjectWithMetadata,
  metadata: ScoringMetadata = {}
): RankingResult {
  // Compute all 11 dimension scores
  const dimensionScores = {
    budget: budgetScore(intent, project, metadata),
    location: locationScore(intent, project, metadata),
    timeline: timelineScore(intent, project, metadata),
    specs: specsScore(intent, project, metadata),
    builder: builderScore(intent, project, metadata),
    legal: legalScore(intent, project, metadata),
    amenities: amenitiesScore(intent, project, metadata),
    pricing: pricingScore(intent, project, metadata),
    personal: personalScore(intent, project, metadata),
    drivers: driversScore(intent, project, metadata),
    gaps: gapsScore(intent, project, metadata)
  }

  // Identify deal breakers
  const dealBreakers = Object.values(dimensionScores).filter((s) => s.dealBreaker)

  // Compute dynamic weights
  const weights = computeWeights(intent)

  // Calculate final score using geometric mean (0 if any dealBreaker present)
  const dimensionArray = Object.values(dimensionScores).map((s) => s.score)
  const finalScore = dealBreakers.length > 0 ? 0 : geometricMean(dimensionArray, weights)

  return {
    finalScore,
    dimensionScores,
    dealBreakers
  }
}

// ============================================================================
// BATCH RANKING
// ============================================================================

/**
 * Rank multiple projects and sort by final score (descending).
 * Filters out projects with deal breakers if strict mode enabled.
 */
export function rankProjects(
  intent: Intent,
  projects: ProjectWithMetadata[],
  metadata: ScoringMetadata = {},
  options: { excludeDealBreakers?: boolean } = {}
): Array<RankingResult & { projectId: string; projectName: string }> {
  const ranked = projects.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    ...rankProject(intent, p, metadata)
  }))

  // Filter deal breakers if requested
  if (options.excludeDealBreakers) {
    return ranked.filter((r) => r.dealBreakers.length === 0).sort((a, b) => b.finalScore - a.finalScore)
  }

  return ranked.sort((a, b) => b.finalScore - a.finalScore)
}
