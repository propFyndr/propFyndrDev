import type { ProjectCard } from './project'

export interface NearbyExpansion {
  requestedSector: string
  searchedSectors: string[]
  reason: 'no_results_in_requested_sector' | 'no_inventory_in_exact_sector_nofallback'
}

export interface Sector {
  id: string;
  city: string;
  name: string;
  avg_price_low: number;
  avg_price_high: number;
  demand_level: 'low' | 'medium' | 'high';
  supply_level: 'low' | 'medium' | 'high';
  volatility_flag: boolean;
}

export interface PropertyValidation {
  market_range: { low: number; high: number };
  verdict: 'Within market' | 'Slightly high' | 'Aggressive' | 'Market range only';
  risk_flag: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence_level?: string;
  reason_codes: string[];
}

export interface PropertyImage {
  id: string;
  image_url: string;
  image_type: 'exterior' | 'interior' | 'floor_plan' | 'amenity' | 'view';
  caption?: string | null;
  sort_order: number;
}

export interface PropertyDna {
  rera_compliance_label?: string | null;
  builder_track_record_label?: string | null;
}

export interface Property {
  id: string;
  sector_id: string;
  property_type: 'flat' | 'plot';
  bhk: number;
  size_sqft: number;
  price: number;
  price_per_sqft: number;
  builder: string | { name: string };
  project_name?: string | null;
  image_url?: string | null;
  images?: Array<string | { url?: string; image_url?: string }>;
  floor: number | null;
  status: 'under_construction' | 'ready_to_move' | 'new_launch';
  amenities: string[];
  bathrooms?: number | null;
  balconies?: number | null;
  highlights?: string[];
  sector: Sector;
  score?: number;
  match_score?: number;
  property_index?: number;
  property_reference?: string;
  validation?: PropertyValidation | null;
  tier?: string | null;
  address?: string | null;
  dna?: PropertyDna | null;
  minPrice?: number;
  maxPrice?: number;
  possession_date?: string | null;
  possession_label?: string | null;

  // Phase 5: Comprehensive Property Decision Factors
  // 1. Resale & Investment Terms
  resale_lock_in_months?: number | null;
  rental_income_allowed?: boolean | null;
  occupancy_restriction_months?: number | null;

  // 2. NRI & Eligibility
  nri_eligible?: boolean | null;
  nri_approval_months?: number | null;
  foreign_currency_payment_allowed?: boolean | null;

  // 3. Legal & Compliance Additions
  occupancy_certificate_status?: string | null;
  occupancy_expected_date?: string | null;
  ongoing_litigation_count?: number | null;
  litigation_types?: string[];
  nclt_status?: string | null;

  // 4. Quality & Reputation
  construction_quality_rating?: number | null;
  buyer_satisfaction_rating?: number | null;
  handover_defect_rate?: number | null;

  // 5. Lifestyle & Safety
  women_safety_score?: number | null;
  has_security_24x7?: boolean | null;
  has_cctv?: boolean | null;
  police_station_distance_km?: number | null;
  street_lights?: boolean | null;

  // 6. Vastu & Preferences
  vastu_compliant?: boolean | null;
  north_facing_units?: boolean | null;
  east_facing_preferred?: boolean | null;

  // 7. Environmental & Area Quality
  air_quality_index_avg?: number | null;
  noise_level_db?: number | null;
  flood_zone?: string | null;
  proximity_to_industrial?: string | null;
  green_cover_percent?: number | null;

  // 8. Education & Connectivity
  top_school_distance_km?: number | null;
  college_distance_km?: number | null;
  hospital_distance_km?: number | null;
  airport_distance_km?: number | null;

  // 9. Market & Pricing
  market_demand_score?: number | null;
  appreciation_potential_5yr?: number | null;
  rental_yield_annual_percent?: number | null;
  competing_projects_nearby?: number | null;

  // 10. Possession & Timeline
  foundation_stone_date?: string | null;
  expected_handover_quarter?: string | null;
  average_builder_delay_months?: number | null;

  // 11. Regulatory & Compliance
  gst_pass_through?: boolean | null;
  land_title_clear?: boolean | null;
  fir_against_project?: boolean | null;
  approvals_status?: string | null;
}

export interface PropertyDetail {
  id: string;
  project_name: string;
  bhk: number;
  size_sqft: number;
  price: number;
  bathrooms?: number;
  balconies?: number;
  status: string;
  builder: string;
  amenities: string[];
  highlights: string[];
  images: { url: string; caption?: string; type: string }[];
}

export type ComponentType =
  | 'property-card' | 'price-chart' | 'emi-calculator' | 'map-view'
  | 'amenities-grid' | 'connectivity-list' | 'builder-card' | 'timeline'
  | 'comparison-table' | 'payment-breakdown' | 'location-scorecard'
  | 'investment-score' | 'floor-plan-gallery' | 'decision-card'
  | 'confidence-badge' | 'risk-meter' | 'possession-timeline'
  | 'society-stats' | 'commute-card' | 'rental-yield-card'
  | 'nearby-projects' | 'reviews-summary' | 'transaction-history' | 'lead-form'

export type QueryIntent = 'payment' | 'investment' | 'location' | 'timeline' | 'builder' | 'details' | 'compare'

export interface FactValidation {
  fact: string;
  value: unknown;
  source: 'database' | 'google_maps' | 'calculator' | 'estimated' | 'derived';
  confidence: number;
  validated: boolean;
  reason?: string;
  dataAge?: number;
  lastVerifiedAt?: string;
}

export interface ComponentSpec {
  type: ComponentType;
  props: Record<string, any>;
  title?: string;
  description?: string;
}

export interface ComponentResponse {
  summary: string;
  confidence: number;
  components: ComponentSpec[];
  sources: string[];
  intent?: QueryIntent;
  projectId?: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  properties?: ProjectCard[];
  exactResults?: ProjectCard[];
  nearbyResults?: ProjectCard[];
  expansion?: NearbyExpansion | null;
  spatialContext?: {
    anchorSector?: string;
    anchorCoords?: { lat: number; lng: number };
    radiusKm?: number;
    spatialScope?: 'EXACT' | 'PROXIMITY' | 'BROAD';
  } | null;
  images?: { url: string; caption?: string; type: string }[];
  highlights?: string[];
  amenities?: string[];
  propertyDetail?: PropertyDetail;
  showSectorIntelligence?: boolean;
  showComparisonTable?: boolean;
  comparisonProjects?: ProjectCard[];
  isSearching?: boolean;
  searchingTool?: 'search_properties' | 'search_web' | 'commute' | 'rera';
  userQuery?: string;
  timestamp: string;
  // Response mode — drives which UI components render (mutually exclusive)
  responseMode?: 'search' | 'comparison' | 'chat' | 'components' | 'database';
  // Component response — verified data pipeline for project details
  componentResponse?: ComponentResponse;
  // Database-backed response — 80% DB, 20% LLM formatting
  chatResponse?: import('./chat').ChatResponse;
  // Inline thinking UI — tracks which phase the streaming message is in
  streamingPhase?: 'extracting' | 'searching' | 'generating' | null;
  streamingIntent?: Record<string, unknown> | null;
  streamingIntentState?: string | null;
  streamingResultCount?: number | null;
  /** Epoch ms the turn started. Drives the measured "Thought for Ns". */
  streamingStartedAt?: number | null;
  /** Seconds the turn took, fixed at `done`. Absent means never measured. */
  streamingElapsedSeconds?: number | null;
  missingDimension?: 'budget' | 'bhk' | 'location' | null;
  suggestedChips?: Array<{ emoji: string; label: string; msg: string }>;
  intent?: {
    completenessScore?: number;
    bhk?: number;
    budget?: {
      min?: number;
      max?: number;
      flexibility?: string;
    };
    purpose?: string;
    is_general_query?: boolean;
  };
  chips?: unknown[]; // ChipAction[] from backend
  is_verified?: boolean; // true if from database, false if from AI fallback provider
}
