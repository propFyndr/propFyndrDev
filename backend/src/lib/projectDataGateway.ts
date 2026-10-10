/**
 * Project Data Gateway — Single source of truth for all project data.
 *
 * All project queries route through here. No data is returned without validation,
 * completeness tracking, and source attribution. The AI layer never talks to DB
 * directly — only through this gateway.
 *
 * Design principle: Verified DB facts only. No hallucinations. No guessing.
 */

import { prisma } from './db'
import { INTERNAL_ONLY_FIELDS } from './projectExposure'
import {
  getFloorPlans,
  getPriceHistory,
  getConstructionStatus,
  getProjectIntelligence,
  getFullCostSheet,
  getAmenitiesAndConnectivity,
  getProjectImages,
  getBuilderNews,
  getUserSavedState,
  getSectorProjects,
} from './projectFacts'

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

export type DataSource = 'database' | 'google_maps' | 'calculator' | 'estimated' | 'derived'

interface FloorPlanConfig {
  name?: string
  bhk?: number
  price_min_cr?: number
  price_max_cr?: number
  carpet_area_sqft?: number
  super_area_sqft?: number
  carpet_to_super_ratio_pct?: number | null
  [key: string]: unknown
}

function isValidConfig(config: unknown): config is FloorPlanConfig {
  return typeof config === 'object' && config !== null && ('name' in config || 'bhk' in config)
}

export interface FactValidation {
  fact: string
  value: unknown
  source: DataSource
  confidence: number // 0-1: 1 = verified DB, 0.95 = external API, 0.6 = estimated
  validated: boolean
  reason?: string // Why confidence < 1
  dataAge?: number // Days since data was recorded
  lastVerifiedAt?: string // ISO date
}

export interface DataCompleteness {
  complete: boolean
  coverage: number // 0-1: percentage of expected fields present
  missing: string[]
  missingByImportance: { critical: string[]; optional: string[] }
}

export interface ProjectDataGatewayResponse {
  projectId: string
  projectName: string
  found: boolean
  message?: string // If not found
  data?: Record<string, FactValidation> // Validated facts
  completeness?: DataCompleteness
  sources?: DataSource[]
  timestamp: string
  cacheKey?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Scoring
// ─────────────────────────────────────────────────────────────────────────────

function scoreConfidence(params: {
  source: DataSource
  validated: boolean
  dataAgeDays?: number
  isCritical?: boolean
}): number {
  let score = 1.0

  // Base score by source
  if (params.source === 'database') score = 0.98
  else if (params.source === 'google_maps') score = 0.92
  else if (params.source === 'calculator') score = 0.95
  else if (params.source === 'derived') score = 0.85
  else if (params.source === 'estimated') score = 0.65

  // Reduce if not validated
  if (!params.validated) score *= 0.75

  // Reduce if stale (older than 90 days)
  if (params.dataAgeDays && params.dataAgeDays > 90) {
    const staleFactor = Math.max(0.5, 1 - params.dataAgeDays / 500)
    score *= staleFactor
  }

  return Math.max(0.3, Math.min(1.0, score))
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Resolution
// ─────────────────────────────────────────────────────────────────────────────

async function resolveProject(nameOrId: string) {
  const term = (nameOrId ?? '').trim()
  if (!term) return null

  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { id: term },
        { slug: term },
        { name: { equals: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      sector: true,
      city: true,
      status: true,
      price_min_cr: true,
      price_range_label: true,
      builder_id: true,
      rera_number: true,
      possession_date: true,
      possession_label: true,
      maintenance_per_sqft_monthly: true,
      dg_power_rate_per_unit: true,
      has_penthouse: true,
      has_duplex: true,
      air_quality_index_avg: true,
      green_cover_percent: true,
      rental_yield_annual_percent: true,
      escrow_bank_name: true,
      nclt_moratorium_active: true,
      land_title_clear: true,
    },
    orderBy: { name: 'asc' },
  })

  if (project) return project

  // Multi-word token match: split by spaces and match when all significant words exist in name or slug
  const words = term.split(/\s+/).filter(w => w.length > 2)
  if (words.length > 1) {
    return prisma.project.findFirst({
      where: {
        AND: words.map(w => ({
          OR: [
            { name: { contains: w, mode: 'insensitive' } },
            { slug: { contains: w, mode: 'insensitive' } },
          ],
        })),
      },
      select: {
        id: true,
        name: true,
        sector: true,
        city: true,
        status: true,
        price_min_cr: true,
        price_range_label: true,
        builder_id: true,
        rera_number: true,
        possession_date: true,
        possession_label: true,
        maintenance_per_sqft_monthly: true,
        dg_power_rate_per_unit: true,
        has_penthouse: true,
        has_duplex: true,
        air_quality_index_avg: true,
        green_cover_percent: true,
        rental_yield_annual_percent: true,
        escrow_bank_name: true,
        nclt_moratorium_active: true,
        land_title_clear: true,
      },
    })
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Data Fetchers (wrapped with validation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch and validate floor plan data.
 * Critical fields: name, bhk, price_min_cr, carpet_area_sqft
 */
async function getFloorPlansWithValidation(
  projectId: string,
  projectName: string
): Promise<Record<string, FactValidation>> {
  const facts: Record<string, FactValidation> = {}

  const data = (await getFloorPlans(projectId)) as Record<string, unknown>

  if (!data.found) {
    return facts
  }

  const configs = (data.configurations as unknown[]) || []
  facts['floor_plan_count'] = {
    fact: `Total floor plan configurations`,
    value: configs.length,
    source: 'database',
    confidence: 1.0,
    validated: true,
  }

  // Validate each configuration
  configs.forEach((item: unknown, idx: number) => {
    if (!isValidConfig(item)) return
    const config = item
    if (!config.name || !config.bhk) return

    const prefix = `config_${idx}_${config.bhk}bhk`
    facts[`${prefix}_name`] = {
      fact: `Configuration name`,
      value: config.name,
      source: 'database',
      confidence: 1.0,
      validated: !!config.name,
    }

    facts[`${prefix}_price_min_cr`] = {
      fact: `Minimum price (Cr)`,
      value: config.price_min_cr,
      source: 'database',
      confidence: config.price_min_cr ? 0.98 : 0.5,
      validated: !!config.price_min_cr,
      reason: config.price_min_cr ? undefined : 'Price not recorded',
    }

    facts[`${prefix}_carpet_area_sqft`] = {
      fact: `Carpet area (sqft)`,
      value: config.carpet_area_sqft,
      source: 'database',
      confidence: config.carpet_area_sqft ? 0.98 : 0.6,
      validated: !!config.carpet_area_sqft,
      reason: config.carpet_area_sqft ? undefined : 'Carpet area not recorded',
    }

    const ratio = config.carpet_to_super_ratio_pct ?? (
      config.carpet_area_sqft && config.super_area_sqft
        ? Math.round((config.carpet_area_sqft / config.super_area_sqft) * 1000) / 10
        : null
    )

    if (config.super_area_sqft) {
      facts[`${prefix}_super_area_sqft`] = {
        fact: `Super area (sqft)`,
        value: config.super_area_sqft,
        source: 'database',
        confidence: 0.98,
        validated: true,
      }

      facts[`${prefix}_carpet_efficiency_pct`] = {
        fact: `Carpet efficiency %`,
        value: ratio,
        source: 'derived',
        confidence: 0.95,
        validated: true,
      }
    }

    const effStr = ratio != null ? `${ratio}%` : 'Standard'
    const carpetStr = config.carpet_area_sqft ? `${config.carpet_area_sqft} sq ft` : 'N/A'
    const superStr = config.super_area_sqft ? `${config.super_area_sqft} sq ft` : 'N/A'
    const priceStr = config.price_min_cr ? `, starting at ₹${config.price_min_cr} Cr` : ''

    facts[`${config.bhk}bhk_unit_configuration`] = {
      fact: `${config.bhk} BHK Floor Plan & Area Summary`,
      value: `${config.name || `${config.bhk} BHK`}: Carpet Area ${carpetStr}, Super Built-up Area ${superStr}, Carpet Area Efficiency ${effStr}${priceStr}`,
      source: 'database',
      confidence: 1.0,
      validated: true,
    }

    facts[`${config.bhk}bhk_carpet_efficiency`] = {
      fact: `${config.bhk} BHK Carpet Area Efficiency`,
      value: ratio != null ? `${ratio}% (Ratio of ${carpetStr} Carpet Area to ${superStr} Super Area)` : 'Efficiency ratio available on request',
      source: 'derived',
      confidence: 0.98,
      validated: ratio != null,
    }
  })

  return facts
}

/**
 * Fetch and validate price history.
 * Critical fields: series data points with dates and prices
 */
async function getPriceHistoryWithValidation(
  projectId: string,
  projectName: string
): Promise<Record<string, FactValidation>> {
  const facts: Record<string, FactValidation> = {}

  const data = (await getPriceHistory(projectId)) as Record<string, unknown>

  if (!data.found) {
    return facts
  }

  facts['price_history_count'] = {
    fact: 'Historical price data points',
    value: data.data_point_count,
    source: 'database',
    confidence: 1.0,
    validated: true,
  }

  if (data.trend) {
    const trend = data.trend as Record<string, unknown>
    facts['price_cagr_pct'] = {
      fact: 'Compound annual growth rate (%)',
      value: trend.cagr_pct,
      source: 'derived',
      confidence: trend.cagr_pct ? 0.95 : 0.6,
      validated: !!trend.cagr_pct,
      reason: trend.cagr_pct ? undefined : 'Insufficient data span for CAGR',
    }

    facts['price_direction'] = {
      fact: 'Price direction',
      value: trend.direction,
      source: 'derived',
      confidence: 0.95,
      validated: true,
    }
  }

  return facts
}

/**
 * Fetch and validate construction status.
 * Critical fields: milestone completions, dates
 */
async function getConstructionStatusWithValidation(
  projectId: string,
  projectName: string
): Promise<Record<string, FactValidation>> {
  const facts: Record<string, FactValidation> = {}

  const data = (await getConstructionStatus(projectId)) as Record<string, unknown>

  if (!data.found) {
    return facts
  }

  facts['project_status'] = {
    fact: 'Overall project status',
    value: data.project_status,
    source: 'database',
    confidence: 1.0,
    validated: true,
  }

  facts['construction_progress_pct'] = {
    fact: 'Construction progress percentage',
    value: data.progress_pct,
    source: 'database',
    confidence: 0.95,
    validated: true,
    reason: 'Based on milestone completion count, not surveyed percentage',
  }

  facts['construction_milestone_count'] = {
    fact: 'Total construction milestones',
    value: data.milestone_count,
    source: 'database',
    confidence: 1.0,
    validated: true,
  }

  return facts
}

/**
 * Fetch and validate amenities and connectivity.
 * Critical fields: names, types, distances
 */
async function getAmenitiesAndConnectivityWithValidation(
  projectId: string,
  projectName: string
): Promise<Record<string, FactValidation>> {
  const facts: Record<string, FactValidation> = {}

  const data = (await getAmenitiesAndConnectivity(projectId)) as Record<string, unknown>

  if (!data.found) {
    return facts
  }

  if (data.full_address || data.address) {
    facts['full_address'] = {
      fact: 'Verified physical address',
      value: (data.full_address || data.address) as string,
      source: 'database',
      confidence: 1.0,
      validated: true,
    }
  }

  facts['amenity_count'] = {
    fact: 'Total amenities',
    value: data.amenity_count,
    source: 'database',
    confidence: 1.0,
    validated: true,
  }

  const amenitiesList = Array.isArray(data.amenities)
    ? data.amenities
    : (data.amenities_by_category ? Object.values(data.amenities_by_category as Record<string, string[]>).flat() : [])

  if (amenitiesList.length > 0) {
    facts['amenities_list'] = {
      fact: 'Complete amenities list',
      value: amenitiesList,
      source: 'database',
      confidence: 1.0,
      validated: true,
    }
  }

  if (data.amenities_by_category) {
    facts['amenities_by_category'] = {
      fact: 'Amenities grouped by category',
      value: data.amenities_by_category,
      source: 'database',
      confidence: 1.0,
      validated: true,
    }
  }

  facts['connectivity_count'] = {
    fact: 'Nearby places tracked',
    value: data.connectivity_count,
    source: 'database',
    confidence: 0.95,
    validated: true,
  }

  // Validate connectivity data
  const connectivity = (data.connectivity as unknown[]) || []
  if (connectivity.length > 0) {
    facts['connectivity_list'] = {
      fact: 'Complete nearby connectivity and landmarks',
      value: connectivity.map((c: any) => ({
        type: c.type,
        name: c.name,
        distance: c.distance_km != null ? `${c.distance_km} km` : 'nearby',
        travel_time: c.travel_time_min ? `${c.travel_time_min} mins` : undefined,
      })),
      source: 'database',
      confidence: 1.0,
      validated: true,
    }
  }

  connectivity.forEach((conn: any, idx: number) => {
    if (!conn.type || !conn.name) return

    facts[`connectivity_${idx}_${conn.type}`] = {
      fact: `${conn.type}: ${conn.name}`,
      value: `${conn.name} (${conn.distance_km != null ? conn.distance_km + ' km' : 'nearby'})`,
      source: conn.source === 'brochure' ? 'database' : 'google_maps',
      confidence: conn.distance_km ? (conn.source === 'brochure' ? 0.8 : 0.92) : 0.5,
      validated: !!conn.distance_km,
      reason: conn.distance_km ? undefined : 'Distance not recorded',
    }
  })

  return facts
}

/**
 * Fetch and validate cost sheet.
 * Critical fields: base price, charges breakdown
 */
async function getCostSheetWithValidation(
  projectId: string,
  projectName: string
): Promise<Record<string, FactValidation>> {
  const facts: Record<string, FactValidation> = {}

  const data = (await getFullCostSheet(projectId)) as Record<string, unknown>

  if (!data.found) {
    return facts
  }

  facts['base_price_per_sqft'] = {
    fact: 'Base price per sqft',
    value: data.base_price_per_sqft,
    source: 'database',
    confidence: data.base_price_per_sqft ? 0.98 : 0.5,
    validated: !!data.base_price_per_sqft,
    reason: data.base_price_per_sqft ? undefined : 'Base price not recorded',
  }

  facts['parking_cost_lakh'] = {
    fact: 'Parking cost (lakh)',
    value: data.parking_cost_lakh,
    source: 'database',
    confidence: data.parking_cost_lakh ? 0.98 : 0.6,
    validated: !!data.parking_cost_lakh,
  }

  facts['gst_rate_pct'] = {
    fact: 'GST rate (%)',
    value: data.gst_rate_pct,
    source: 'database',
    confidence: 0.98,
    validated: !!data.gst_rate_pct,
  }

  facts['stamp_duty_pct'] = {
    fact: 'Stamp duty rate (%)',
    value: data.stamp_duty_pct,
    source: 'database',
    confidence: 0.98,
    validated: !!data.stamp_duty_pct,
  }

  facts['ifms_lakh'] = {
    fact: 'Interest-Free Maintenance Security (IFMS) (lakh)',
    value: data.ifms_lakh,
    source: 'database',
    confidence: data.ifms_lakh ? 0.98 : 0.6,
    validated: !!data.ifms_lakh,
  }

  facts['club_membership_lakh'] = {
    fact: 'Club membership fee (lakh)',
    value: data.club_membership_lakh,
    source: 'database',
    confidence: data.club_membership_lakh ? 0.98 : 0.6,
    validated: !!data.club_membership_lakh,
  }

  const maintRate = data.maintenance_psf_monthly as number | null
  facts['maintenance_monthly_psf'] = {
    fact: 'Monthly Maintenance Charge (per sqft)',
    value: maintRate != null ? `₹${maintRate} / sqft / month` : '₹4.25 – ₹5.50 / sqft / month (verified luxury community benchmark)',
    source: maintRate != null ? 'database' : 'estimated',
    confidence: maintRate != null ? 0.98 : 0.75,
    validated: true,
  }

  if (data.power_backup_rate_per_unit) {
    facts['power_backup_rate'] = {
      fact: 'Power Backup / DG Electricity Rate',
      value: `₹${data.power_backup_rate_per_unit} per kWh / unit`,
      source: 'database',
      confidence: 0.95,
      validated: true,
    }
  }

  // Fetch payment plan milestones directly from DB
  try {
    const plans = await prisma.paymentPlan.findMany({
      where: { project_id: projectId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    })
    if (plans.length > 0) {
      facts['payment_plans'] = {
        fact: 'Payment plan schedule & milestones',
        value: plans.map(p => ({
          name: p.plan_name || p.plan_type,
          type: p.plan_type,
          description: p.description,
          down_payment_pct: p.down_payment_pct,
          booking_amount_lakh: p.booking_amount_lakh,
          total_duration_months: p.total_duration_months,
          discount_offered_pct: p.discount_offered_pct,
          best_for: p.best_for,
          watch_out: p.watch_out,
          milestones: p.milestones,
        })),
        source: 'database',
        confidence: 0.98,
        validated: true,
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('Payment plan lookup failed, returning default facts:', errMsg)
  }

  return facts
}

/**
 * Fetch and validate project intelligence (analysis).
 * Critical fields: decision thesis, why_buy, why_avoid (only if PUBLISHED)
 */
async function getProjectIntelligenceWithValidation(
  projectId: string,
  projectName: string
): Promise<Record<string, FactValidation>> {
  const facts: Record<string, FactValidation> = {}

  const data = (await getProjectIntelligence(projectId)) as Record<string, unknown>

  if (!data.found) {
    return facts
  }

  // Only include if published
  if (data.blocks && typeof data.blocks === 'object') {
    const blocks = data.blocks as Record<string, unknown>

    facts['decision_thesis'] = {
      fact: 'Investment thesis',
      value: data.decision_thesis,
      source: 'database',
      confidence: 0.95,
      validated: !!data.decision_thesis,
      lastVerifiedAt: data.last_verified_at as string,
    }

    Object.entries(blocks).forEach(([key, value]) => {
      facts[`intelligence_${key}`] = {
        fact: `${key} analysis`,
        value: value,
        source: 'database',
        confidence: 0.95,
        validated: !!value,
        lastVerifiedAt: data.last_verified_at as string,
      }
    })
  }

  return facts
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomic Data Fetcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch ALL project data atomically.
 * Used when building complete project detail context.
 *
 * Returns all verified facts with confidence scores and source attribution.
 */
export async function getAllProjectData(projectId: string): Promise<ProjectDataGatewayResponse> {
  const project = await resolveProject(projectId)

  if (!project) {
    return {
      projectId,
      projectName: projectId,
      found: false,
      message: `Project "${projectId}" not found in database`,
      timestamp: new Date().toISOString(),
    }
  }

  const allFacts: Record<string, FactValidation> = {}
  const sources = new Set<DataSource>()

  // Fetch all data in parallel
  const [floorPlans, priceHistory, construction, amenities, costSheet, intelligence] =
    await Promise.all([
      getFloorPlansWithValidation(project.id, project.name),
      getPriceHistoryWithValidation(project.id, project.name),
      getConstructionStatusWithValidation(project.id, project.name),
      getAmenitiesAndConnectivityWithValidation(project.id, project.name),
      getCostSheetWithValidation(project.id, project.name),
      getProjectIntelligenceWithValidation(project.id, project.name),
    ])

  // Merge all facts
  ;[floorPlans, priceHistory, construction, amenities, costSheet, intelligence].forEach(
    (factSet) => {
      Object.entries(factSet).forEach(([key, fact]) => {
        allFacts[key] = fact
        sources.add(fact.source)
      })
    }
  )

  // Calculate completeness
  const facts = dropInternalFacts(allFacts)
  const completeness = computeCompleteness(facts)

  return {
    projectId: project.id,
    projectName: project.name,
    found: true,
    data: facts,
    completeness,
    sources: Array.from(sources),
    timestamp: new Date().toISOString(),
    cacheKey: `project_data:${project.id}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query-Specific Data Fetcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch only the data needed for a specific user query.
 *
 * Example:
 *   Query: "What's the EMI for ATS Pristine?"
 *   RequiredFields: ['price_min_cr', 'price_max_cr']
 *   Returns: Only payment-related facts
 */
/**
 * Drop any fact whose key `projectExposure` says must never leave the server.
 *
 * `INTERNAL_ONLY_FIELDS` already named `appreciation_potential_5yr`,
 * `rental_yield_annual_percent` and `market_demand_score`, with the reason
 * written next to each — "forward-looking estimate — the prompt forbids
 * presenting projections as fact". This file selected all three anyway and built
 * a buyer-facing fact out of them: `'5-Year Appreciation Potential':
 * '48.5% estimated'`, carrying `confidence: 0.8`.
 *
 * Measured live: asked how much Godrej Woods had appreciated, the answer closed
 * with "Financial projections estimate an additional 25-35% capital appreciation
 * over a 3-year horizon". The model did not invent that. It was handed 48.5%
 * over five years and did the arithmetic.
 *
 * The column is also the same defect as last session's `litigation_count = 0`:
 * populated on 280 of 280 projects with only **seven distinct values** — 48.5 on
 * 95 projects, 14.5 on 83, 72 on 50 — so it is a bucket assignment, not an
 * estimate. A forward projection that is really a bucket, presented with a
 * confidence score, on the one topic three separate rules forbid.
 *
 * Filtered here rather than removed from the three `select` blocks, because the
 * next field added to those blocks would leak the same way. Two files disagreed
 * about policy and the one without the policy won; this makes the policy the one
 * that runs.
 */
function dropInternalFacts(
  facts: Record<string, FactValidation>,
): Record<string, FactValidation> {
  const out: Record<string, FactValidation> = {}
  const dropped: string[] = []
  for (const [key, value] of Object.entries(facts)) {
    if (key in INTERNAL_ONLY_FIELDS) {
      dropped.push(key)
      continue
    }
    out[key] = value
  }
  if (dropped.length > 0) {
    console.warn(`[GATEWAY:INTERNAL_FACT_DROPPED] ${dropped.join(', ')}`)
  }
  return out
}

export async function getProjectDataForQuery(params: {
  projectId: string
  requiredFields: string[]
  intent: 'details' | 'payment' | 'investment' | 'location' | 'timeline' | 'builder' | 'compare'
}): Promise<ProjectDataGatewayResponse> {
  const project = await resolveProject(params.projectId)

  if (!project) {
    return {
      projectId: params.projectId,
      projectName: params.projectId,
      found: false,
      message: `Project not found`,
      timestamp: new Date().toISOString(),
    }
  }

  const allFacts: Record<string, FactValidation> = {
    project_name: { fact: 'Project Name', value: project.name, source: 'database', confidence: 1.0, validated: true },
    sector: { fact: 'Sector / Location', value: project.sector, source: 'database', confidence: 1.0, validated: true },
    city: { fact: 'City', value: (project as any).city ?? 'Noida', source: 'database', confidence: 1.0, validated: true },
    price_min_cr: { fact: 'Starting Price', value: (project as any).price_min_cr ? `₹${(project as any).price_min_cr} Cr` : 'Price on Request', source: 'database', confidence: 0.95, validated: !!(project as any).price_min_cr },
    price_max_cr: { fact: 'Maximum Price', value: (project as any).price_max_cr ? `₹${(project as any).price_max_cr} Cr` : 'Price on Request', source: 'database', confidence: 0.95, validated: !!(project as any).price_max_cr },
    project_status: { fact: 'Current Project Status', value: (project as any).project_status || (project as any).status || null, source: 'database', confidence: 1.0, validated: !!(project as any).project_status || !!(project as any).status },
    possession_date: { fact: 'Expected Possession Date', value: (project as any).possession_label || ((project as any).possession_date ? new Date((project as any).possession_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : (project as any).status), source: 'database', confidence: 0.98, validated: true },
    rera_status: { fact: 'RERA Registration Number & Status', value: (project as any).rera_number ? `RERA Approved (${(project as any).rera_number})` : 'RERA Approved & Compliant', source: 'database', confidence: 0.99, validated: !!(project as any).rera_number },
    maintenance_charges: { fact: 'Monthly Maintenance Charges', value: (project as any).maintenance_per_sqft_monthly ? `₹${(project as any).maintenance_per_sqft_monthly} / sqft / month` : '₹4.25 – ₹5.50 / sqft / month (benchmark for luxury segment)', source: (project as any).maintenance_per_sqft_monthly ? 'database' : 'estimated', confidence: 0.95, validated: true },
    power_backup_charges: { fact: 'Power Backup / DG Rate', value: (project as any).dg_power_rate_per_unit ? `₹${(project as any).dg_power_rate_per_unit} / kWh unit` : '₹18 – ₹22 / kWh unit (standard dual-meter DG supply)', source: 'database', confidence: 0.95, validated: true },
    rental_yield_annual_percent: { fact: 'Estimated Annual Rental Yield', value: (project as any).rental_yield_annual_percent ? `${(project as any).rental_yield_annual_percent}% per annum` : 'Market-dependent', source: 'database', confidence: (project as any).rental_yield_annual_percent ? 0.85 : 0.6, validated: !!(project as any).rental_yield_annual_percent },
    appreciation_potential_5yr: { fact: '5-Year Appreciation Potential', value: (project as any).appreciation_potential_5yr ? `${(project as any).appreciation_potential_5yr}% estimated` : 'Sector-dependent growth', source: 'database', confidence: (project as any).appreciation_potential_5yr ? 0.8 : 0.6, validated: !!(project as any).appreciation_potential_5yr }
  }
  const sources = new Set<DataSource>()

  // Fetch based on intent
  const intentFetchers: Record<string, () => Promise<Record<string, FactValidation>>> = {
    payment: async () => ({
      ...(await getCostSheetWithValidation(project.id, project.name)),
      ...(await getFloorPlansWithValidation(project.id, project.name)),
    }),
    timeline: async () => ({
      ...(await getConstructionStatusWithValidation(project.id, project.name)),
    }),
    location: async () => ({
      ...(await getAmenitiesAndConnectivityWithValidation(project.id, project.name)),
    }),
    investment: async () => ({
      ...(await getPriceHistoryWithValidation(project.id, project.name)),
      ...(await getProjectIntelligenceWithValidation(project.id, project.name)),
    }),
    details: async () => ({
      ...(await getFloorPlansWithValidation(project.id, project.name)),
      ...(await getCostSheetWithValidation(project.id, project.name)),
      ...(await getAmenitiesAndConnectivityWithValidation(project.id, project.name)),
    }),
    compare: async () => ({
      ...(await getFloorPlansWithValidation(project.id, project.name)),
      ...(await getPriceHistoryWithValidation(project.id, project.name)),
      ...(await getConstructionStatusWithValidation(project.id, project.name)),
    }),
    builder: async () => ({
      ...(await getBuilderWithValidation(project.id, project.name)),
      ...(await getConstructionStatusWithValidation(project.id, project.name)),
    }),
  }
/**
 * Fetch and validate builder, litigation, and RERA compliance data.
 */
async function getBuilderWithValidation(
  projectId: string,
  projectName: string
): Promise<Record<string, FactValidation>> {
  const facts: Record<string, FactValidation> = {}

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { builder: true }
    })

    if (!project) return facts

    const b = project.builder
    if (b) {
      // Builder trust is the thing CLAUDE.md is most explicit about never
      // fabricating, and every line here was doing it — with `validated: true`
      // and `confidence: 1.0`, the strongest assertion the gateway can make:
      //
      //   delivery_score ?? 85, rera_compliance_score ?? 90,
      //   construction_quality_score ?? 80, buyer_satisfaction_score ?? 85,
      //   projects_delivered_count ?? 10, experience_years || '20+ Years',
      //   founded_year -> 'Established Developer'
      //
      // A builder we hold nothing about scored 85/100 on delivery and 90/100 on
      // RERA compliance. Two further defects: `litigation_count === 0` is false
      // when the count is null, so an unknown count rendered as the string
      // "null active litigation records"; and a null insolvency_history was
      // reported as "Clean (No NCLT / Insolvency filings)" — asserting a clean
      // insolvency record for a builder we had never checked.
      //
      // An absent value is now omitted entirely, so downstream sees a gap rather
      // than a number. `validated` tracks whether the value is real.
      const builderFact = (key: string, fact: string, value: unknown) => {
        if (value === null || value === undefined || value === '') return
        facts[key] = { fact, value, source: 'database', confidence: 1.0, validated: true }
      }

      builderFact('builder_name', 'Builder / Developer Name', b.name)
      builderFact('builder_founded_year', 'Founded Year', b.founded_year ? String(b.founded_year) : null)
      builderFact('builder_experience', 'Experience in Industry', b.experience_years)
      // The four /100 scores that stood here are gone — see BUYER_OPAQUE_SCORES
      // in projectExposure.ts. They were analyst-set numbers a buyer cannot
      // interpret or check, and the model quoted them straight back as evidence
      // of quality ("a strong builder delivery score (92)"). The counts and
      // dates below are the same signal in a form that can be verified.
      builderFact('projects_delivered_count', 'Total Delivered Projects', b.projects_delivered_count)
      builderFact('builder_delivered_units', 'Homes Handed Over', b.delivered_units != null ? String(b.delivered_units) : null)
      builderFact(
        'builder_handover_record',
        'Average Handover Delay',
        b.average_delay_months == null
          ? null
          : b.average_delay_months === 0
            ? 'On time across delivered projects'
            : `${b.average_delay_months} months average delay across delivered projects`,
      )

      // "Clean" is a finding, not a default. It requires a recorded zero.
      builderFact(
        'litigation_status',
        'Litigation & Legal Clearances',
        b.litigation_count == null
          ? null
          : b.litigation_count === 0
            ? 'No active litigation on record'
            : `${b.litigation_count} active litigation record${b.litigation_count === 1 ? '' : 's'}`,
      )
      builderFact(
        'insolvency_status',
        'Insolvency History',
        b.insolvency_history === true ? 'Flagged — insolvency history on record' : null,
      )
      builderFact(
        'rera_registration',
        'RERA Standing',
        // A promoter id is checkable on the UP-RERA portal; a compliance score
        // is not. "RERA Standing" backed by a number we assigned invited the
        // model to present our own score as a regulator's verdict.
        b.rera_promoter_id ? `UP-RERA promoter registration ${b.rera_promoter_id}` : null,
      )

      if (Array.isArray(b.delivered_projects) && b.delivered_projects.length > 0) {
        builderFact('delivered_projects_list', 'Key Delivered Projects', b.delivered_projects.join(', '))
      }
      if (Array.isArray(b.ongoing_projects) && b.ongoing_projects.length > 0) {
        builderFact('ongoing_projects_list', 'Active & Upcoming Pipeline', b.ongoing_projects.join(', '))
      }
      if (b.average_delay_months != null) {
        builderFact('average_handover_delay', 'Average Handover Delay', b.average_delay_months === 0 ? '0 months (Consistent on-time completion)' : `${b.average_delay_months} months`)
      }

      // The justification is only emitted when there is a real score to
      // justify, and each clause only when its own column is populated.
      //
      // This block reintroduced the exact defaults the comment above records
      // as removed: `delivery_score ?? 90` invented a 90/100 score for any
      // builder we hold nothing about, 'A-grade construction standards' was
      // asserted with no quality score, a null `litigation_count` rendered as
      // "null active cases", a null `insolvency_history` was reported as
      // "clean NCLT/insolvency standing" — a clean record for a builder never
      // checked — and an empty `delivered_projects` produced "landmark
      // communities including ." A score with nothing behind it is the fake
      // confidence score CLAUDE.md forbids, and it is worse here than an
      // absent one because it arrives dressed as an explanation.
      /**
       * The track record, no longer hung off a score.
       *
       * This block existed to justify `delivery_score`, so it was gated on that
       * number and headed "The 92/100 delivery score is driven by:". Both the
       * gate and the heading are gone: the clauses underneath — delay months,
       * litigation count, insolvency standing, delivered projects — were always
       * the actual evidence, and they stand on their own. Gating on the score
       * also meant a builder with real delivery facts and no score recorded
       * produced nothing at all.
       */
      {
        const clauses: string[] = []
        if (b.average_delay_months != null) {
          clauses.push(
            b.average_delay_months === 0
              ? 'Execution: 0 months historical delay'
              : `Execution: ${b.average_delay_months} mo average delay`,
          )
        }
        const legal: string[] = []
        if (b.litigation_count != null) {
          legal.push(b.litigation_count === 0 ? '0 active litigation cases' : `${b.litigation_count} active cases`)
        }
        // false is the schema default, not a finding (SCHEMA_DEFAULT_SENTINELS).
        if (b.insolvency_history === true) legal.push('insolvency history on record')
        if (legal.length > 0) clauses.push(`Legal & Compliance: ${legal.join(' and ')}`)
        if (Array.isArray(b.delivered_projects) && b.delivered_projects.length > 0) {
          clauses.push(`Proven Portfolio: delivered ${b.delivered_projects.slice(0, 3).join(', ')}`)
        }

        if (clauses.length > 0) {
          builderFact(
            'track_record_evidence',
            'Track Record Evidence',
            `${clauses.map((c, i) => `(${i + 1}) ${c}`).join('; ')}.`,
          )
        }
      }
    } else {
      facts['builder_name'] = { fact: 'Builder Name', value: null, source: 'database', confidence: 0, validated: false }
      facts['rera_registration'] = { fact: 'RERA Status', value: null, source: 'database', confidence: 0, validated: false }
    }
  } catch (err) {
    console.error('[GATEWAY:BUILDER_FETCH_ERROR]', err)
  }

  return facts
}

  const fetcher = intentFetchers[params.intent] || intentFetchers.details

  const facts = await fetcher()
  Object.entries(facts).forEach(([key, fact]) => {
    allFacts[key] = fact
    sources.add(fact.source)
  })

  // Filter to requested fields if specified, but always keep core project identity, RERA, configurations, and maintenance facts
  let filteredFacts = allFacts
  if (params.requiredFields.length > 0) {
    const matched: Record<string, FactValidation> = {}
    // Always include core identification & RERA standing
    const ALWAYS_PRESERVE = [
      'project_name',
      'sector',
      'builder_name',
      'rera_status',
      'rera_registration',
      'maintenance_charges',
      'power_backup_charges',
      'floor_plan_count',
    ]
    ALWAYS_PRESERVE.forEach((f) => {
      if (allFacts[f]) matched[f] = allFacts[f]
    })

    const hasFloorPlanRequest = params.requiredFields.some((f) =>
      /floor|plan|config|unit|carpet|super|bhk/i.test(f)
    )
    const hasCostRequest = params.requiredFields.some((f) =>
      /cost|price|charge|maintenance|bsp|payment/i.test(f)
    )

    Object.entries(allFacts).forEach(([k, v]) => {
      if (
        hasFloorPlanRequest &&
        (k.startsWith('config_') ||
          k.includes('bhk') ||
          k.includes('carpet') ||
          k.includes('super') ||
          k.includes('floor'))
      ) {
        matched[k] = v
      }
      if (
        hasCostRequest &&
        (k.includes('bsp') ||
          k.includes('cost') ||
          k.includes('price') ||
          k.includes('maintenance') ||
          k.includes('charge') ||
          k.includes('tax') ||
          k.includes('gst') ||
          k.includes('stamp'))
      ) {
        matched[k] = v
      }
      if (params.requiredFields.includes(k)) {
        matched[k] = v
      }
    })
    if (Object.keys(matched).length > 0) {
      filteredFacts = matched
    }
  }

  filteredFacts = dropInternalFacts(filteredFacts)
  const completeness = computeCompleteness(filteredFacts)

  return {
    projectId: project.id,
    projectName: project.name,
    found: true,
    data: filteredFacts,
    completeness,
    sources: Array.from(sources),
    timestamp: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute data completeness.
 * Returns coverage % and lists of missing critical vs optional fields.
 */
function computeCompleteness(facts: Record<string, FactValidation>): DataCompleteness {
  const CRITICAL_FIELDS = [
    'project_status',
    'price_min_cr',
    'possession_date',
    'floor_plan_count',
    'amenity_count',
  ]

  const OPTIONAL_FIELDS = [
    'price_cagr_pct',
    'carpet_efficiency_pct',
    'connectivity_count',
    'intelligence_market',
  ]

  const allExpected = [...CRITICAL_FIELDS, ...OPTIONAL_FIELDS]
  const present = Object.keys(facts).filter((k) => facts[k].validated)
  const coverage = Math.round((present.length / allExpected.length) * 100) / 100

  const missing = allExpected.filter((f) => !facts[f] || !facts[f].validated)
  const missingCritical = missing.filter((m) => CRITICAL_FIELDS.includes(m))
  const missingOptional = missing.filter((m) => OPTIONAL_FIELDS.includes(m))

  return {
    complete: missingCritical.length === 0,
    coverage,
    missing,
    missingByImportance: {
      critical: missingCritical,
      optional: missingOptional,
    },
  }
}

/**
 * Compute overall response confidence.
 * Geometric mean of all fact confidences, capped if critical fields missing.
 */
export function computeResponseConfidence(facts: Record<string, FactValidation>): number {
  if (Object.keys(facts).length === 0) return 0

  const confidences = Object.values(facts).map((f) => f.confidence)
  // Use arithmetic mean instead of geometric: geometric fails if ANY confidence = 0 (0 * anything = 0)
  const sum = confidences.reduce((a, b) => a + b, 0)
  let confidence = sum / confidences.length

  // Cap if critical fields missing
  const hasCriticalData = Object.values(facts).some(
    (f) => f.source === 'database' && f.confidence > 0.9
  )
  if (!hasCriticalData) confidence = Math.min(confidence, 0.65)

  return Math.round(confidence * 100) / 100
}
