// ── Decision Intelligence (from backend intelligence.ts) ─────────────────────

export interface DecisionDimension {
  key: string
  label: string
  score: number
  stars: number
  description: string
  basis: string
  status: 'Verified' | 'Estimated' | 'Unavailable'
}

export interface DecisionIntelligence {
  overallScore: number
  confidence: 'High' | 'Medium' | 'Low'
  tier: string
  dimensions: DecisionDimension[]
  topStrengths: string[]
  tradeoffs: string[]
  bottomLine: string
}

export interface WhyNot {
  reasons: Array<{ rank: number; label: string; detail: string }>
}

export interface IntelligenceCompleteness {
  builderTrust: 'Verified' | 'Estimated' | 'Unavailable'
  deliveryConfidence: 'Verified' | 'Estimated' | 'Unavailable'
  locationQuality: 'Verified' | 'Estimated' | 'Unavailable'
  valuePositioning: 'Verified' | 'Estimated' | 'Unavailable'
  lifestyleDepth: 'Verified' | 'Estimated' | 'Unavailable'
  legalStanding: 'Verified' | 'Estimated' | 'Unavailable'
  overallCoverage: 'Full' | 'Partial' | 'Limited'
  missingFields: string[]
}

export interface BuyerPersonaScore {
  type: 'Families' | 'Investors' | 'Luxury' | 'NRIs' | 'End Users'
  stars: number
  headline: string
  reasons: string[]
}

export interface DealBreaker {
  label: string
  detail: string
  severity: 'Caution' | 'Consider' | 'Dealbreaker'
}


export interface ProjectCard {
  id: string
  slug: string
  name: string
  tagline?: string | null
  matchScore?: number
  matchReason?: string
  matchReasons?: string[]
  concerns?: string[]
  budgetStatus?: 'within' | 'slightly_over' | 'over'

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
  best_for?: string | null
  status: 'under_construction' | 'ready_to_move' | 'new_launch'
  launch_date?: string | null

  possession_label?: string | null
  possession_date: string | null
  architect?: string | null
  interior_designer?: string | null
  floors?: string | null
  open_space_pct?: number | null
  green_rating?: string | null

  design_theme?: string | null
  marketing_claims: string[]
  hero_image_url?: string | null
  price_min_cr?: number | null
  price_max_cr?: number | null
  price_range_label: string
  /** "3 BHK" when the price above covers only that size, not the whole project. */
  price_for_bhk?: string
  /** Sizes the buyer asked for that this project does not offer. */
  missing_bhk?: number[]
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
  // Eager intelligence — computed server-side, included in discovery response
  decisionIntelligence?: DecisionIntelligence | null
  whyNot?: WhyNot | null
  intelligenceCompleteness?: IntelligenceCompleteness | null
  buyerPersonas?: BuyerPersonaScore[] | null
  dealBreakers?: DealBreaker[] | null
  // Spatial context: distance in km (for PROXIMITY/BROAD searches with radial ranking)
  distance_km?: number | null

  // Day 3 Forensic & Living Reality Badges
  oc_status?: 'not_applied' | 'applied' | 'partial' | 'received' | 'revoked' | 'exempt' | null
  amitabh_kant_clearance?: boolean | null
  water_source_type?: 'ganga_water' | 'groundwater_borewell' | 'mixed_tanker' | 'unknown' | null
  water_tds_range?: string | null
  shahdara_drain_impact?: boolean | null
  lift_act_compliant?: boolean | null
}

export interface UnitTypeSummary {
  id: string

  name: string
  bhk: number
  bathrooms: number | null
  super_area_sqft?: number | null
  carpet_area_sqft?: number | null
  balcony_area_sqft?: number | null
  price_min_cr?: number | null
  price_max_cr?: number | null
  price_label?: string | null
  subtitle?: string | null
  description?: string | null
  category_badge?: string | null
  inventory_left?: number | null
  perfect_for?: string[]
  key_highlights?: any
  whats_included?: any
  views?: any
  balconies?: number | null
  built_up_area_sqft?: number | null
  utility_area_sqft?: number | null
  efficiency_rating?: string | null
  tower_association?: string[]
  price_per_sqft?: number | null
}

export interface AmenitySummary {
  name: string
  category: 'sports' | 'lifestyle' | 'wellness' | 'kids' | 'security' | 'parking'
}

export interface ConnSummary {
  type: 'metro' | 'road' | 'expressway' | 'school' | 'hospital' | 'mall' | 'landmark' | 'airport' | 'university'

  name: string
  distance_km?: number | null
  data_source?: 'brochure' | 'google' | 'estimated' | 'manual' | null
}

export interface BuilderDetail {
  // Identity
  name: string
  slug: string
  tagline: string | null
  founder: string | null
  company_overview: string | null
  logo_url: string | null
  parent_group: string | null
  founded_year: number | null
  headquarters: string | null
  website: string | null
  email: string | null
  phone: string | null
  description: string | null
  // Track Record
  total_projects_count: number | null
  delivered_units: number | null
  delivered_projects: string[]
  ongoing_projects: string[]
  delayed_projects_count: number | null
  average_delay_months: number | null
  delivery_score: number | null
  // Quality
  construction_quality_score: number | null
  after_sales_score: number | null
  buyer_satisfaction_score: number | null
  // Compliance
  rera_compliance_score: number | null
  litigation_count: number | null
  insolvency_history: boolean
  legal_flag: string | null
  cin: string | null
  rera_promoter_id: string | null
  financial_hygiene_score: number | null
  outstanding_dues_cr: number | null
  legal_entities: { name: string; cin: string; role: string }[] | null
  executives: { name: string; designation: string }[] | null
  funding_banks: string[]
  audit_flags_log: string | null
  // Market Position
  luxury_specialization: boolean
  township_specialization: boolean
  affordable_specialization: boolean
  average_project_size: number | null
  // Recognition
  awards: string[]
  awards_count: number | null
  certifications: string[]
  credai_member: boolean
  iso_certified: boolean
  // Confidence
  verification_level: string | null
  last_verified_at: string | null
  data_source: string | null
  intelligence_completeness: number | null

}

export interface ProjectDetail extends ProjectCard {
  long_description: string | null
  design_theme: string | null
  total_units: number | null
  has_penthouse?: boolean | null
  has_duplex?: boolean | null
  vastu_compliant?: boolean | null
  price_per_sqft_current?: number | null
  appreciation_potential_5yr?: number | null
  rental_yield_annual_percent?: number | null
  resale_lock_in_months?: number | null
  market_demand_score?: number | null
  competing_projects_nearby?: number | null
  nri_eligible?: boolean | null
  is_rera_approved?: boolean | null
  nclt_moratorium_active?: boolean | null
  escrow_verified?: boolean | null
  escrow_bank_name?: string | null
  land_title_clear?: boolean | null
  litigation_count?: number | null
  marketing_claims: string[]
  all_amenities: { name: string; category: string }[]
  all_connectivity: { type: string; name: string; distance_km: number | null; data_source?: string | null }[]
  unit_inventory: { unit_type_id: string; tower_name: string; floor_number: number; unit_number: string; facing: string | null; view: string | null; status: string }[]
  channel_partners: { name: string; type: string; is_verified: boolean }[]
  spec_items: { label: string; value: string; brand?: string | null; tier?: string | null; category: string; verified_at?: Date | null }[]
  builder_detail: BuilderDetail
  dna:                    ProjectDnaPublic | null
  decision_profile:       DecisionProfilePublic | null
  persona_profile:        PersonaProfile | null
  recommendation_profile: RecommendationProfilePublic | null
  competitors:            CompetitorSummary[]
  recommendation_score:   RecommendationScore | null
  promotions: Promotion[]
  payment_plan: PaymentPlan | null
  payment_plans: PaymentPlan[]
  cost_sheet: CostSheet | null

  // ── Disclosure ────────────────────────────────────────────────────────────
  // The API has always returned these — the detail route spreads the whole
  // project row — but nothing in the frontend read them, so the page showed the
  // amenities and the price and silently dropped everything a cautious buyer
  // would want. CLAUDE.md: never hide property weaknesses.

  /** What the headline price does and does not include. */
  price_includes_plc?: boolean | null
  price_includes_club?: boolean | null
  price_includes_taxes?: boolean | null

  /** Occupancy Certificate — drives GST rate and bank lending. */
  oc_obtained?: boolean | null
  oc_obtained_date?: string | null
  oc_valid_until?: string | null
  oc_restrictions?: string | null
  occupancy_certificate_status?: string | null
  oc_status?: 'not_applied' | 'applied' | 'partial' | 'received' | 'revoked' | 'exempt' | null
  oc_details?: string | null

  /** Living Quality & Operational Costs */
  water_source_type?: 'ganga_water' | 'groundwater_borewell' | 'mixed_tanker' | 'unknown' | null
  water_tds_range?: string | null
  power_supply_type?: 'single_point' | 'dual_prepaid' | 'direct_grid' | 'mixed' | null
  dg_power_rate_per_unit?: number | null
  maintenance_per_sqft_monthly?: number | null
  amitabh_kant_clearance?: boolean | null
  bank_apf_codes?: Record<string, string> | any | null
  shahdara_drain_impact?: boolean | null
  lift_act_compliant?: boolean | null
  all_in_cost_multiplier?: number | null

  /** RERA standing. */
  rera_valid_until?: string | null
  rera_compliance_score?: number | null

  /** How much to trust the possession date. */
  possession_confidence?: string | null
  possession_confidence_note?: string | null
  expected_handover_quarter?: string | null
  average_builder_delay_months?: number | null

  /** Legal and registry standing. */
  legal_flag?: string | null
  legal_flag_detail?: string | null
  project_risk_flag?: string | null
  registry_status?: string | null
  registry_embargo_reasons?: string[] | null
  ongoing_litigation_count?: number | null
  litigation_types?: string[] | null
  nclt_status?: string | null
  fir_against_project?: boolean | null
  authority_dues_cleared?: boolean | null

  /** Location analysis — advantages must never appear without concerns. */
  location_advantages?: unknown
  location_concerns?: string[] | null
  location_verdict?: string | null
  walkability_score?: number | null

  /** Environmental risk. */
  flood_waterlogging_risk?: string | null
  flood_zone?: string | null
  aqi_annual_avg?: number | null
  air_quality_index_avg?: number | null
  noise_level_db?: number | null

  project_type?: string | null
}

// ── Intelligence Engine Types ─────────────────────────────────────────

export type IntelligenceStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED'
export type RecommendationTier = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'WATCH' | 'AVOID'
export type BuyerPersona = 'FAMILY' | 'PROFESSIONAL' | 'INVESTOR' | 'NRI' | 'UPGRADER' | 'RETIREE'
export type RiskAppetite = 'LOW' | 'MEDIUM' | 'HIGH'
export type ConfidenceSource = 'RERA' | 'Project Documents' | 'Site Visit' | 'Builder Claim' | 'Estimated'

export interface ProjectDnaPublic {
  builder_track_record_label: string | null
  price_position_label:       string | null
  locality_label:             string | null
  rera_compliance_label:      string | null
  amenity_depth_label:        string | null
  possession_certainty_label: string | null
  last_verified_at:           string | null
}

export interface DecisionProfilePublic {
  status:             IntelligenceStatus
  decision_thesis:    string | null
  why_buy:            string[]
  why_avoid:          string[]
  best_for:           string | null
  not_ideal_for:      string | null
  confidence_sources: ConfidenceSource[]
  intelligence_data?: any
  last_verified_at:   string | null
}

export interface PersonaProfile {
  primary_persona:    BuyerPersona | null
  secondary_personas: BuyerPersona[]
  persona_descriptions: Record<string, string> | null
  income_range:       string | null
  family_stage:       string | null
  work_location:      string | null
  risk_appetite:      RiskAppetite | null
  timeline_horizon:   string | null
  motivation_note:    string | null
}

export interface RecommendationProfilePublic {
  status:               IntelligenceStatus
  tier:                 RecommendationTier | null
  primary_thesis:       string | null
  walk_away_conditions: string[]
  timeline_advice:      string | null
  negotiation_leverage: string[]
  last_verified_at:     string | null
}

export interface ScoreDimension {
  key:         string
  label:       string
  weight:      number
  raw:         number
  weighted:    number
  description: string
}

export interface RecommendationScore {
  total:      number
  tier:       string
  dimensions: ScoreDimension[]
}

export interface PaymentPlan {
  id: string
  plan_type: string
  plan_name: string | null
  description: string | null
  milestones: Array<{ label: string; percent: number; due?: string }>
  down_payment_pct: number | null
  booking_amount_lakh: number | null
  total_duration_months: number | null
  discount_offered_pct: number | null
  best_for: string | null
  watch_out: string | null
  sort_order: number
}

export interface CostSheet {
  id: string
  base_price_per_sqft: number | null
  base_cost_cr: number | null
  floor_rise_per_floor: number | null
  plc_charges: Array<{ label: string; amount?: number; percent?: number }>
  parking_cost: number | null
  ifms: number | null
  club_membership: number | null
  other_charges: Array<{ label: string; amount?: number; percent?: number }>
  gst_applicable: boolean | null
  gst_rate_pct: number
  gst_note: string | null
  stamp_duty_pct: number
  registration_pct: number
  base_interest_rate: number | null
  electricity_connection: number | null
  water_sewer_connection: number | null
  maintenance_psf_monthly: number | null
  all_inclusive_price_cr: number | null
  all_inclusive_per_sqft: number | null
  assumptions: string[]
  verified_at: string | null
}

export interface Promotion {
  id: string
  title: string
  description: string | null
  type: 'button' | 'toast_text' | 'news_feature'
  content: string
  image_url: string | null
  icon_url: string | null
  starts_at: string
  ends_at: string
}

export interface CompetitorSummary {
  id:                     string
  competitor_name:        string
  competitor_slug:        string | null
  this_project_advantage: string | null
  competitor_advantage:   string | null
  verdict:                string | null
  price_delta_note:       string | null
  sort_order:             number

}
