/**
 * Component Specification System — AI returns JSON component specs, not prose.
 *
 * Frontend renders actual React components, not AI-generated text/charts.
 * This ensures quality, prevents hallucinations, and enables interactive features.
 *
 * Example:
 *   AI input: facts about ATS Pristine
 *   AI output:
 *     {
 *       summary: "ATS Pristine is a strong investment...",
 *       confidence: 0.92,
 *       components: [
 *         { type: "property-card", projectId: "ats-pristine" },
 *         { type: "emi-calculator", props: { price: 2100000 } },
 *         { type: "price-chart", projectId: "ats-pristine" }
 *       ]
 *     }
 *   Frontend: Renders each component with verified data
 */

import type { FactValidation, DataSource } from '../projectDataGateway'

export type { FactValidation, DataSource }

// ─────────────────────────────────────────────────────────────────────────────
// Component Types
// ─────────────────────────────────────────────────────────────────────────────

export type ComponentType =
  | 'property-card'         // Project summary (name, price, status)
  | 'price-chart'           // Historical price trend
  | 'emi-calculator'        // EMI breakdown (with draggable sliders)
  | 'map-view'              // Project location map
  | 'amenities-grid'        // Amenities by category
  | 'connectivity-list'     // Nearby places (metro, schools, hospitals)
  | 'builder-card'          // Builder info & reputation
  | 'timeline'              // Construction milestones
  | 'comparison-table'      // Side-by-side project metrics
  | 'payment-breakdown'     // Cost sheet components (base, GST, stamp duty)
  | 'location-scorecard'    // Location scores (walkability, safety, pollution)
  | 'investment-score'      // Investment recommendation
  | 'floor-plan-gallery'    // Floor plan images
  | 'decision-card'         // Decision summary (why buy / why avoid)
  | 'risk-meter'            // Project risk visualization
  | 'possession-timeline'   // Possession date & construction progress
  | 'society-stats'         // Society life data (power, water, lift, maintenance)
  | 'commute-card'          // Commute times to work/key locations
  | 'rental-yield-card'     // Rental yield calculation
  | 'nearby-projects'       // Competing projects in same sector
  | 'reviews-summary'       // Aggregated resident reviews
  | 'transaction-history'   // Recent sales in the project
  | 'lead-form'             // Contact / lead capture form for missing data

export interface ComponentSpec {
  type: ComponentType
  projectId?: string                      // For project-specific components
  props?: Record<string, unknown>          // Component-specific data
  confidence?: number                      // How confident are we about this component's data?
  error?: string                           // If data unavailable
  source?: string                          // Data source (database, maps, calculator, etc.)
}

export interface ComponentResponse {
  summary: string                          // AI-generated narrative summary
  confidence: number                       // 0-1: overall response confidence
  facts?: Record<string, FactValidation>   // Backing facts (optional, for debugging)
  components: ComponentSpec[]              // Components to render
  sources: string[]                        // Which data sources were used
  timestamp: string                        // ISO timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Requirements (What data each component needs)
// ─────────────────────────────────────────────────────────────────────────────

export const COMPONENT_REQUIREMENTS: Record<ComponentType, {
  required: string[]
  optional: string[]
  minConfidence: number
}> = {
  'property-card': {
    required: ['project_status', 'price_min_cr', 'project_name'],
    optional: ['possession_date', 'builder_name'],
    minConfidence: 0.7,
  },

  'price-chart': {
    required: ['price_cagr_pct', 'price_direction'],
    optional: ['price_history_count'],
    minConfidence: 0.75,
  },

  'emi-calculator': {
    required: ['price_min_cr', 'gst_rate_pct', 'stamp_duty_pct'],
    optional: ['parking_cost_lakh', 'ifms_lakh'],
    minConfidence: 0.9,
  },

  'map-view': {
    required: ['project_coordinates'],
    optional: ['nearest_metro', 'nearby_hospitals', 'nearby_schools'],
    minConfidence: 0.85,
  },

  'amenities-grid': {
    required: ['amenity_count'],
    optional: ['amenities_by_category'],
    minConfidence: 0.7,
  },

  'connectivity-list': {
    required: ['connectivity_count'],
    optional: ['connectivity_metro', 'connectivity_schools', 'connectivity_hospitals'],
    minConfidence: 0.75,
  },

  'builder-card': {
    required: ['builder_name', 'builder_delivery_score'],
    optional: ['builder_delivery_score', 'total_projects_count', 'delayed_projects_count'],
    minConfidence: 0.8,
  },

  'timeline': {
    required: ['project_status', 'construction_progress_pct'],
    optional: ['construction_milestone_count', 'currently_in_progress'],
    minConfidence: 0.75,
  },

  'comparison-table': {
    required: ['floor_plan_count', 'price_min_cr', 'construction_progress_pct'],
    optional: ['amenity_count', 'builder_delivery_score'],
    minConfidence: 0.8,
  },

  'payment-breakdown': {
    required: ['base_price_per_sqft', 'gst_rate_pct', 'stamp_duty_pct'],
    optional: ['parking_cost_lakh', 'ifms_lakh', 'club_membership_lakh'],
    minConfidence: 0.85,
  },

  'location-scorecard': {
    required: ['connectivity_count', 'amenity_count'],
    optional: ['walkability_score', 'safety_score', 'pollution_score'],
    minConfidence: 0.7,
  },

  'investment-score': {
    required: ['price_min_cr', 'price_cagr_pct', 'decision_thesis'],
    optional: ['builder_delivery_score', 'rental_yield'],
    minConfidence: 0.8,
  },

  'floor-plan-gallery': {
    required: ['floor_plan_count'],
    optional: [],
    minConfidence: 0.7,
  },

  'decision-card': {
    required: ['decision_thesis', 'why_buy'],
    optional: ['why_avoid', 'best_for'],
    minConfidence: 0.8,
  },

  'risk-meter': {
    required: ['project_risk_flag'],
    optional: [],
    minConfidence: 0.8,
  },

  'possession-timeline': {
    required: ['possession_date', 'construction_progress_pct'],
    optional: ['project_status'],
    minConfidence: 0.85,
  },

  'society-stats': {
    required: [],
    optional: ['power_backup', 'water_supply', 'lift_downtime', 'maintenance_quality'],
    minConfidence: 0.7,
  },

  'commute-card': {
    required: [],
    optional: ['commute_time_morning', 'commute_time_evening', 'cab_fare'],
    minConfidence: 0.75,
  },

  'rental-yield-card': {
    required: ['rental_yield_pct'],
    optional: [],
    minConfidence: 0.7,
  },

  'nearby-projects': {
    required: ['sector', 'city'],
    optional: ['nearby_projects_count'],
    minConfidence: 0.7,
  },

  'reviews-summary': {
    required: [],
    optional: ['reviews_count', 'average_rating'],
    minConfidence: 0.7,
  },

  'transaction-history': {
    required: [],
    optional: ['recent_transactions_count'],
    minConfidence: 0.7,
  },

  'lead-form': {
    required: [],
    optional: ['projectName', 'inquiryTopic'],
    minConfidence: 0.1,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Selection Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine which components to render based on available facts and intent.
 *
 * Follows principle: Only render components with required data present.
 */
export function selectComponents(params: {
  facts: Record<string, FactValidation>
  intent: 'payment' | 'investment' | 'location' | 'timeline' | 'builder' | 'details' | 'compare'
  confidence: number
  projectId: string
}): ComponentType[] {
  const { facts, intent, confidence, projectId } = params
  const selected: ComponentType[] = []

  // Always include property card for context
  if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['property-card'])) {
    selected.push('property-card')
  }

  // Intent-specific components
  switch (intent) {
    case 'payment':
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['emi-calculator'])) {
        selected.push('emi-calculator')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['payment-breakdown'])) {
        selected.push('payment-breakdown')
      }
      break

    case 'investment':
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['price-chart'])) {
        selected.push('price-chart')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['investment-score'])) {
        selected.push('investment-score')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['rental-yield-card'])) {
        selected.push('rental-yield-card')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['builder-card'])) {
        selected.push('builder-card')
      }
      break

    case 'location':
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['map-view'])) {
        selected.push('map-view')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['connectivity-list'])) {
        selected.push('connectivity-list')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['amenities-grid'])) {
        selected.push('amenities-grid')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['commute-card'])) {
        selected.push('commute-card')
      }
      break

    case 'timeline':
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['timeline'])) {
        selected.push('timeline')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['possession-timeline'])) {
        selected.push('possession-timeline')
      }
      break

    case 'builder':
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['builder-card'])) {
        selected.push('builder-card')
      }
      break

    case 'details':
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['floor-plan-gallery'])) {
        selected.push('floor-plan-gallery')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['amenities-grid'])) {
        selected.push('amenities-grid')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['connectivity-list'])) {
        selected.push('connectivity-list')
      }
      break

    case 'compare':
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['comparison-table'])) {
        selected.push('comparison-table')
      }
      if (hasRequiredFields(facts, COMPONENT_REQUIREMENTS['price-chart'])) {
        selected.push('price-chart')
      }
      break
  }

  return selected
}

/**
 * Check if all required fields are present in facts.
 */
function hasRequiredFields(
  facts: Record<string, FactValidation>,
  requirement: { required: string[] }
): boolean {
  return requirement.required.every((field) => facts[field] && facts[field].validated)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Props Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build component props from validated facts.
 * Each component type knows what props it needs.
 */
export function buildComponentProps(params: {
  type: ComponentType
  facts: Record<string, FactValidation>
  projectId: string
}): Record<string, unknown> | undefined {
  const { type, facts, projectId } = params

  switch (type) {
    case 'emi-calculator':
      return {
        price: facts['price_min_cr']?.value,
        gstRate: facts['gst_rate_pct']?.value,
        stampDutyRate: facts['stamp_duty_pct']?.value,
        parkingCost: facts['parking_cost_lakh']?.value,
      }

    case 'price-chart':
      return {
        projectId,
        cagrPct: facts['price_cagr_pct']?.value,
        direction: facts['price_direction']?.value,
      }

    case 'builder-card':
      return {
        builderName: facts['builder_name']?.value,
        deliveryScore: facts['builder_delivery_score']?.value,
        totalProjects: facts['total_projects_count']?.value,
        delayedProjects: facts['delayed_projects_count']?.value,
      }

    case 'timeline':
      return {
        projectId,
        progress: facts['construction_progress_pct']?.value,
        milestoneCount: facts['construction_milestone_count']?.value,
      }

    case 'payment-breakdown':
      return {
        basePriceSqft: facts['base_price_per_sqft']?.value,
        gstRate: facts['gst_rate_pct']?.value,
        stampDutyRate: facts['stamp_duty_pct']?.value,
        parking: facts['parking_cost_lakh']?.value,
        ifms: facts['ifms_lakh']?.value,
      }

    case 'investment-score':
      return {
        projectId,
        price: facts['price_min_cr']?.value,
        cagrPct: facts['price_cagr_pct']?.value,
        thesis: facts['decision_thesis']?.value,
        builderScore: facts['builder_delivery_score']?.value,
      }

    case 'map-view':
      return {
        projectId,
        latitude: facts['project_lat']?.value,
        longitude: facts['project_lng']?.value,
      }

    case 'connectivity-list':
      return {
        projectId,
        count: facts['connectivity_count']?.value,
      }

    case 'amenities-grid':
      return {
        projectId,
        count: facts['amenity_count']?.value,
        amenities: facts['amenities_list']?.value,
        categories: facts['amenities_by_category']?.value,
      }

    case 'floor-plan-gallery':
      return {
        projectId,
        count: facts['floor_plan_count']?.value,
      }

    case 'decision-card':
      return {
        thesis: facts['decision_thesis']?.value,
        whyBuy: facts['why_buy']?.value,
        whyAvoid: facts['why_avoid']?.value,
      }

    case 'property-card':
      return {
        projectId,
      }

    default:
      return {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build final ComponentResponse for frontend.
 * Called after LLM generates summary and confidence.
 */
export function buildComponentResponse(params: {
  summary: string
  confidence: number
  facts: Record<string, FactValidation>
  intent: 'payment' | 'investment' | 'location' | 'timeline' | 'builder' | 'details' | 'compare'
  projectId: string
  sources: string[]
}): ComponentResponse {
  const { summary, confidence, facts, intent, projectId, sources } = params

  // Select which components to render
  const componentTypes = selectComponents({
    facts,
    intent,
    confidence,
    projectId,
  })

  // Build each component
  const components: ComponentSpec[] = componentTypes.map((type) => ({
    type,
    projectId,
    props: buildComponentProps({ type, facts, projectId }),
    confidence,
    source: sources[0],
  }))

  return {
    summary,
    confidence,
    facts, // Optional: for debugging
    components,
    sources,
    timestamp: new Date().toISOString(),
  }
}
