// backend/src/lib/discovery/types.ts
export type { DecisionIntelligence, WhyNot, IntelligenceCompleteness, BuyerPersona, DealBreaker } from '../ai/intelligence'

export interface Intent {
  bhk?: number[]
  budgetMin?: number
  budgetMax?: number
  possession?: 'immediate' | '1year' | '2year' | '3year+'
  sector?: string
  city?: string
  areaMin?: number
  areaMax?: number
  purpose?: 'endUse' | 'investment'
  builderName?: string
  lifestyleKeywords?: string[]
  projectNames?: string[]
  riskProfile?: 'nri' | 'retiree' | 'risk_averse' | 'first_time_buyer'
  is_comparison_query?: boolean   // explicit: user asked to compare named projects
  gathering_loop_count?: number
  legal_check?: boolean
  journeyStage?: 'relocation' | 'first_time_buyer' | 'yield_investor' | 'nri_investor' | 'upgrader' | 'market_evaluator' | 'general'

  // Phase 0: Query classification
  queryKind?: 'DISCOVERY' | 'DRILLDOWN' | 'RANKING' | 'COMPARISON' | 'SUMMARY' | 'ADVISORY' | 'CLARIFY' | 'OPEN'

  // Spatial scope: disambiguate "in Sector 75" (EXACT) vs "near Sector 75" (PROXIMITY)
  spatialScope?: 'EXACT' | 'PROXIMITY' | 'BROAD'
  radiusKm?: number

  /**
   * Where the buyer WORKS. Never a search filter.
   *
   * `sector` is where they want to live; this is the place they travel to, and
   * conflating the two broke the funnel on a measured run: "sector 63 ... for
   * office" became `sector: Sector 63`, the sector lane found no residential
   * inventory in a commercial district, and the buyer was handed off to the
   * advisory team. See `discovery/commuteAnchor.ts`.
   */
  workplace?: string
  /** Residential sectors to search instead, commute-closest first. */
  workplace_belt?: string[]

  /**
   * Every budget the buyer has stated this session, oldest first.
   *
   * "What was my first budget again?" returned the latest one, because a single
   * current value cannot answer a question about what changed. Maintained by
   * `hydrateIntentFromMemory`, which is the only place that sees the stored and
   * incoming values together.
   */
  budgetHistory?: number[]
  /** Every sector the buyer has searched this session, oldest first. */
  sectorHistory?: string[]

  /**
   * Every sector named THIS turn, in the order they appeared.
   *
   * `sector` is singular by construction — deliberately narrowed to
   * `sectors[0]` in `ai/intent.ts` for every call site that only ever
   * expected one place. "Tell me about sector 1 and 2" set `sector: "Sector
   * 1"` and this to `["Sector 1", "Sector 2"]`; retrieval used only the
   * former, so Sector 2 was recognised and then silently dropped before any
   * database query ran. Read this whenever more than one sector is
   * genuinely part of the question — a comparison, a "which of these",
   * discovery across a named group — not just `sector`.
   */
  sectorsMentioned?: string[]
}

export type IntentState = 'COLD' | 'GATHERING' | 'READY_TO_SEARCH' | 'SHORTLISTED'

export type BudgetStatus = 'within' | 'slightly_over' | 'over'

export interface NearbyExpansion {
  requestedSector: string
  searchedSectors: string[]
  reason:
    | 'no_results_in_requested_sector'
    | 'no_inventory_in_exact_sector_nofallback'
    /**
     * No sector was asked for at all — a citywide question. Distinct from
     * `no_results_in_requested_sector`, which means we looked somewhere and
     * found nothing. Conflating the two is how a citywide "which is the best
     * project" was reported to the buyer as a failed sector search.
     */
    | 'citywide_band_spread'
}

export interface UnitTypeSummary {
  name: string
  bhk: number
  bathrooms: number | null
  super_area_sqft?: number | null
  carpet_area_sqft?: number | null
  price_min_cr?: number | null
  price_max_cr?: number | null
  price_label?: string | null
  inventory_left?: number | null
}

export interface AmenitySummary {
  name: string
  category: string
}

export interface ConnSummary {
  type: string
  name: string
  distance_km?: number | null
}

export interface ScoredProject {
  id: string
  slug: string
  name: string
  tagline?: string | null
  builder: { name: string; slug: string }
  rera_number?: string | null
  rera_url?: string | null
  lat?: number | null
  lng?: number | null
  sector: string
  city: string
  address?: string | null
  land_area_acres?: number | null
  total_towers?: number | null
  status: string
  launch_date?: string | null
  possession_label?: string | null
  possession_date: string | null
  architect?: string | null
  interior_designer?: string | null
  design_theme?: string | null
  project_risk_flag?: string | null
  nclt_moratorium_active?: boolean | null
  registry_status?: string | null
  marketing_claims: string[]
  hero_image_url?: string | null
  price_min_cr?: number | null
  price_max_cr?: number | null
  /**
   * The price to show. Narrowed to the configuration the buyer asked for.
   *
   * Someone who said "3 BHK" is quoted the 3 BHK range, not the project's whole
   * spread from its smallest 2 BHK to its largest penthouse — a span that can
   * be 3x wide and answers a question they did not ask.
   */
  price_range_label: string
  /** "3 BHK" when the label above covers only that size; absent when it is the whole project. */
  price_for_bhk?: string
  /** Sizes the buyer asked for that this project does not offer at all. */
  missing_bhk?: number[]
  floor_plan_count: number
  project_status?: string
  amenity_count: number
  construction_progress_pct: number
  unit_types: UnitTypeSummary[]
  top_amenities: AmenitySummary[]
  top_connectivity: ConnSummary[]
  images: Array<{
    id: string
    url: string
    type: string
    caption: string | null
    bhk: number | null
    size_sqft: number | null
    sort_order: number
  }>
  matchScore: number
  matchReason: string
  matchReasons: string[]
  concerns: string[]
  budgetStatus?: BudgetStatus
  /**
   * True when this project only appears because nothing cleared
   * SCORE_THRESHOLD and scoreAndSort fell back to MIN_SCORE_FLOOR — the
   * closest thing available, not a genuine match. Set in scoreAndSort
   * (discovery/projects.ts). Not yet consumed anywhere downstream — the
   * prompt layer does not read this field yet. See PROGRESS notes.
   */
  isFallbackMatch?: boolean
  /**
   * True when the buyer stated a possession timeline (intent.possession) and
   * this project's own possession_date falls clearly outside it — the
   * "poor fit" branch of the possession-fit scoring in scoreProject, not the
   * "no date on record" case, which is unknown rather than off-timeline. Set
   * in mapToScored (discovery/projects.ts). Not yet consumed anywhere
   * downstream — the prompt layer does not read this field yet.
   */
  possessionOutsideTimeline?: boolean
  market_tier?: 'budget' | 'mid' | 'premium' | 'luxury' // Phase 5: market tier tag
  /** Fix 6: set when persisted via last_projects — distinguishes exact vs nearby results on cache restore */
  cacheSource?: 'exact' | 'nearby'
  best_for?: string | null
  recommendation_profile?: {
    tier?: string | null
    primary_thesis?: string | null
    walk_away_conditions?: string[]
    timeline_advice?: string | null
  } | null
  decision_profile?: {
    decision_thesis?: string | null
    why_buy?: string[]
    why_avoid?: string[]
    best_for?: string | null
    confidence_sources?: string[]
    not_ideal_for?: string | null
  } | null
  persona_profile?: {
    primary_persona?: string | null
    secondary_personas?: string[]
    income_range?: string | null
    family_stage?: string | null
    risk_appetite?: string | null
    timeline_horizon?: string | null
  } | null
  competitors?: Array<{
    competitor_name: string
    this_project_advantage?: string | null
    competitor_advantage?: string | null
    verdict?: string | null
  }>
  dna?: {
    overall_score?: number | null
    builder_score?: number | null
    price_score?: number | null
    location_score?: number | null
    legal_score?: number | null
    amenity_score?: number | null
    possession_score?: number | null
  } | null
  // Eager intelligence — computed sync in mapToScored(), zero extra DB cost
  decisionIntelligence?: import('../ai/intelligence').DecisionIntelligence | null
  whyNot?: import('../ai/intelligence').WhyNot | null
  intelligenceCompleteness?: import('../ai/intelligence').IntelligenceCompleteness | null
  buyerPersonas?: import('../ai/intelligence').BuyerPersona[] | null
  dealBreakers?: import('../ai/intelligence').DealBreaker[] | null
  distance_km?: number | null
}

export interface DiscoveryResult {
  exactResults: ScoredProject[]
  nearbyResults: ScoredProject[]
  expansion?: NearbyExpansion
  /** Names from intent.projectNames that had no match in the DB. */
  notFoundNames?: string[]
  /** Single search term matched multiple distinct projects — ask the user which one. */
  disambiguation?: {
    query: string
    candidates: Array<{ name: string; sector: string; builder: string }>
  }
  /** Sector term matched multiple distinct sectors (e.g., Sector 10 Noida vs Sector 10 Greater Noida). */
  sectorDisambiguation?: {
    query: string
    candidates: string[]
  }
  /** Sector-only query matches same sector in multiple cities — ask which city. */
  cityDisambiguation?: {
    query: string
    candidates: Array<{ city: string; label: string }>
  }
  /** Pagination info for exactResults + nearbyResults combined */
  // Required, not optional: four return paths (name lookup + the three
  // disambiguation branches) used to omit these, and the results are cached — so a
  // consumer reading `hasMore` after a disambiguation got undefined. Keeping them
  // mandatory makes tsc reject any new return path that forgets them.
  pageIndex: number
  totalCount: number
  hasMore: boolean
  /** Spatial context: sector anchor, coordinates, search radius used */
  spatialContext?: {
    anchorSector?: string
    anchorCoords?: { lat: number; lng: number }
    radiusKm?: number
    spatialScope?: 'EXACT' | 'PROXIMITY' | 'BROAD'
  }
}

export interface SectorContext {
  sector: string
  projectCount: number
  priceMinCr: number | null
  priceMaxCr: number | null
  rtmCount: number
  ucCount: number
  metroStations: string[]
  keyRoads: string[]
  nearbyLandmarks: string[]
}

export interface SectorOverview {
  sector: string
  projectCount: number
  priceMinCr: number | null
  priceMaxCr: number | null
  rtmCount: number
  ucCount: number
  topAmenities: string[]
  metroStations: string[]
}

// Database-backed chat responses (Phase 1)
export type ConversationStage = 'CLARIFYING' | 'SEARCHING' | 'COMPARING' | 'DECIDING'

export interface ConversationMemory {
  user_budget_min_cr?: number
  user_budget_max_cr?: number
  user_timeline?: string
  user_pain_points: string[]
  user_priorities: string[]
  projects_discussed: string[]
  stage: ConversationStage
  confident_facts: Record<string, { value: any; source: string; confidence: number }>
}

export interface ConfidenceScore {
  payment_plans: number
  builder_history: number
  location: number
  possession: number
  overall: number
}

export interface ComparisonDimension {
  name: string
  weight: number
  format: 'currency' | 'percentage' | 'months' | 'text'
  better_is: 'lower' | 'higher'
}

export interface ComparisonRow {
  name: string
  values: (number | string)[]
  score?: number
}

export interface ComparisonMatrix {
  dimensions: ComparisonDimension[]
  rows: ComparisonRow[]
  weighted_rank: number[]
}

export interface ChatResponse {
  message: string
  memory_context: {
    user_stated_facts: Record<string, { value: any; source: string; confidence: number }>
    inferred_preferences: string[]
    open_questions: string[]
  }
  comparison?: {
    matrix: ComparisonMatrix
    winner: string
    reason: string
  }
  confidence: ConfidenceScore
  chips: any[]
  data_freshness: Record<string, string>
  missing_data: string[]
}

export interface DataSource {
  name: 'payment_plans' | 'cost_sheet' | 'builder' | 'location' | 'possession'
  base_confidence: number
  freshness_penalty_per_week: number
}
