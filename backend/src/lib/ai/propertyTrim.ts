import { costSheetForPrompt } from '../factPresentation'
/**
 * Trim property objects to the fields the system prompt actually renders.
 *
 * The contract: keep everything serializeProjects() in prompts/blocks.ts reads,
 * drop everything it does not. Previously this dropped fields the serializer
 * renders — unit_types, rera_number, dna, decision_profile, competitors — so
 * those spreads silently produced nothing and the prompt claimed we had no RERA
 * number for projects where one is stored.
 *
 * Deep detail (full amenity lists, floor-plan dimensions, price history,
 * construction milestones, cost-sheet charges, the six intelligence blocks) is
 * deliberately NOT here. It reaches the buyer through the on-demand lookup tools
 * in lib/projectFacts.ts, so it is fetched only when asked for rather than
 * padding every prompt.
 */

interface ProjectInput {
  id?: string
  name?: string
  sector?: string | { name: string }
  city?: string
  address?: string
  status?: string
  price_range_label?: string
  price_min_cr?: number
  possession_status?: string
  possession_label?: string
  concerns?: string[]
  bhk?: number
  builder?: { name: string }
  rera_number?: string
  project_risk_flag?: string
  registry_status?: string
  nclt_moratorium_active?: boolean
  unit_types?: Array<{ bhk: number; carpet_area_sqft?: number }>
  top_amenities?: Array<{ name: string }>
  top_connectivity?: Array<{ name: string; distance_km?: number }>
  payment_plans?: unknown[]
  payment_plan?: unknown
  [key: string]: unknown
}

interface PaymentPlan {
  [key: string]: unknown
}

export interface TrimmedProperty {
  id: string;
  name: string;
  sector?: { name: string } | null;
  city?: string | null;
  address?: string | null;
  status?: string | null;
  price_range_label?: string | null;
  price_min_cr?: number | null;
  possession_status?: string | null;
  possession_label?: string | null;
  concerns?: string[] | null;
  bhk?: number | null;
  builder?: { name: string } | null;

  // Regulatory / risk — must survive the trim. A missing rera_number here makes
  // the prompt emit the NOT_IN_DATABASE sentinel, which forces the advisor to
  // say it cannot verify the registration even when we hold the number.
  rera_number?: string | null;
  project_risk_flag?: string | null;
  registry_status?: string | null;
  nclt_moratorium_active?: boolean | null;

  // Configurations — drives bhk_options and the carpet-area range.
  unit_types?: { bhk: number; carpet_area_sqft?: number | null }[] | null;

  // Short previews. Full lists come from amenities_lookup on request.
  top_amenities?: { name: string }[] | null;
  top_connectivity?: { name: string; distance_km?: number | null }[] | null;

  // Scored-project fields added by the discovery layer.
  matchReason?: string | null;
  matchScore?: number | null;
  budgetStatus?: string | null;

  // Verified intelligence the advisor reasons with. Deliberately the summary
  // level only — the detailed blocks come from project_intelligence on request.
  dna?: {
    overall_score?: number | null;
    builder_score?: number | null;
    price_score?: number | null;
    location_score?: number | null;
    legal_score?: number | null;
    amenity_score?: number | null;
    possession_score?: number | null;
  } | null;
  decision_profile?: {
    decision_thesis?: string | null;
    why_buy?: string[] | null;
    why_avoid?: string[] | null;
    best_for?: string | null;
    not_ideal_for?: string | null;
  } | null;
  recommendation_profile?: {
    tier?: string | null;
    primary_thesis?: string | null;
    walk_away_conditions?: string[] | null;
  } | null;
  persona_profile?: { primary_persona?: string | null } | null;
  competitors?: {
    competitor_name: string;
    this_project_advantage?: string | null;
    competitor_advantage?: string | null;
    verdict?: string | null;
  }[] | null;
  decisionIntelligence?: unknown;

  payment_plans?: {
    plan_type?: string | null;
    plan_name?: string | null;
    milestones?: unknown;
    notes?: string | null;
  }[] | null;
  cost_sheet?: {
    base_price_per_sqft?: number | null;
    // UP law, from UP_STATUTORY; the row's tax columns are schema defaults.
    statutory_rates?: Record<string, number>;
  } | null;
}

function normalisePaymentPlans(project: any): any[] {
  if (Array.isArray(project.payment_plans)) return project.payment_plans;
  if (project.payment_plan) return [project.payment_plan];
  return [];
}

export function trimPropertyForPrompt(project: any): TrimmedProperty {
  return {
    id: project.id,
    name: project.name,
    // Project.sector is a String column, but callers sometimes hand us a joined
    // object. Normalise to { name } — sanitizeForPrompt in blocks.ts reads .name,
    // and this keeps coordinates/ids out of the prompt payload.
    sector: project.sector
      ? { name: typeof project.sector === 'string' ? project.sector : project.sector.name }
      : null,
    city: project.city ?? null,
    address: project.address ?? null,
    status: project.status ?? null,
    price_range_label: project.price_range_label,
    price_min_cr: project.price_min_cr ?? null,
    possession_status: project.possession_status,
    possession_label: project.possession_label,
    concerns: project.concerns,
    bhk: project.bhk,
    builder: project.builder
      ? { name: typeof project.builder === 'string' ? project.builder : project.builder.name }
      : null,

    rera_number: project.rera_number ?? null,
    project_risk_flag: project.project_risk_flag ?? null,
    registry_status: project.registry_status ?? null,
    nclt_moratorium_active: project.nclt_moratorium_active ?? null,

    // Only the two fields the serializer reads, not the whole unit_types row.
    unit_types: Array.isArray(project.unit_types)
      ? project.unit_types.map((u: any) => ({ bhk: u.bhk, carpet_area_sqft: u.carpet_area_sqft ?? null }))
      : null,

    top_amenities: Array.isArray(project.top_amenities)
      ? project.top_amenities.slice(0, 10).map((a: any) => ({ name: a.name }))
      : null,
    top_connectivity: Array.isArray(project.top_connectivity)
      ? project.top_connectivity.slice(0, 5).map((c: any) => ({ name: c.name, distance_km: c.distance_km ?? null }))
      : null,

    matchReason: project.matchReason ?? null,
    matchScore: project.matchScore ?? null,
    budgetStatus: project.budgetStatus ?? null,

    dna: project.dna ?? null,
    decision_profile: project.decision_profile
      ? {
          decision_thesis: project.decision_profile.decision_thesis ?? null,
          why_buy: project.decision_profile.why_buy ?? null,
          why_avoid: project.decision_profile.why_avoid ?? null,
          best_for: project.decision_profile.best_for ?? null,
          not_ideal_for: project.decision_profile.not_ideal_for ?? null,
        }
      : null,
    recommendation_profile: project.recommendation_profile
      ? {
          // tier omitted — 280/280 rows are STRONG_BUY. See SYNTHETIC_FIELDS.
          primary_thesis: project.recommendation_profile.primary_thesis ?? null,
          walk_away_conditions: project.recommendation_profile.walk_away_conditions ?? null,
        }
      : null,
    persona_profile: project.persona_profile
      ? { primary_persona: project.persona_profile.primary_persona ?? null }
      : null,
    competitors: Array.isArray(project.competitors)
      ? project.competitors.map((c: any) => ({
          competitor_name: c.competitor_name,
          this_project_advantage: c.this_project_advantage ?? null,
          competitor_advantage: c.competitor_advantage ?? null,
          verdict: c.verdict ?? null,
        }))
      : null,
    decisionIntelligence: project.decisionIntelligence ?? null,

    // Accepts either the new payment_plans array or a legacy single payment_plan.
    payment_plans: normalisePaymentPlans(project).map((p: any) => ({
      plan_type: p.plan_type ?? null,
      plan_name: p.plan_name ?? null,
      milestones: p.milestones,
      notes: p.notes ?? null,
    })),
    cost_sheet: project.cost_sheet
      ? {
          base_price_per_sqft: project.cost_sheet.base_price_per_sqft,
          // The tax columns are schema defaults (stamp duty 6.0); see costSheetForPrompt.
          statutory_rates: costSheetForPrompt({})!.statutory_rates as Record<string, number>,
        }
      : null,
  };
}

export function trimPropertiesForPrompt(projects: any[]): TrimmedProperty[] {
  return projects.map(trimPropertyForPrompt);
}
