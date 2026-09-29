/**
 * Builds the "verified facts" block handed to the model for a project question.
 *
 * The chat handler used to hand-pick eleven fields — name, builder, location,
 * status, rera_number, price_range, launch_date, possession_date, description,
 * payment plan names, unit types, and the first ten amenities. Project has
 * around 150 columns, and the row was already fetched with all of them, so
 * everything else was invisible to the model purely because nobody projected it:
 * maintenance per sq.ft, pet policy, airport and school distances, flood risk,
 * AQI, walkability, lift count, water source, ceiling height, land tenure, OC
 * status, litigation counts, escrow and registry standing, NRI eligibility,
 * resale lock-in. Asked about any of them the model had nothing and either
 * deflected or guessed.
 *
 * This module projects the whole public allowlist instead, so a field becomes
 * answerable the moment it is populated — no new branch, no new tool.
 *
 * Two rules make that affordable and safe:
 *   - Empty values are omitted entirely. Most columns are null for most
 *     projects, so a full block stays small in practice, and an absent key is
 *     an honest signal to the model that we do not hold the fact.
 *   - The field set comes from projectExposure, so nothing internal can leak in
 *     by being added to the schema later.
 */

import { airportDistances } from './discovery/airports'
import { redactProject, isPublicField, stripRelationInternals, isSchemaDefault, stripOpaqueScores } from './projectExposure'
import { normalizeRera, RERA_AMBIGUOUS_NOTE } from './reraIntegrity'

/** Columns rendered as "yes"/"no" rather than true/false. */
const BOOLEAN_LABELS: Record<string, [string, string]> = {
  oc_obtained: ['obtained', 'not obtained'],
  nri_eligible: ['eligible', 'not eligible'],
  rental_income_allowed: ['allowed', 'not allowed'],
  foreign_currency_payment_allowed: ['allowed', 'not allowed'],
  pet_friendly: ['pet friendly', 'pets not allowed'],
  bachelor_tenants_allowed: ['allowed', 'not allowed'],
  vastu_compliant: ['vastu compliant', 'not vastu compliant'],
  has_security_24x7: ['24x7 security', 'no 24x7 security'],
  has_cctv: ['CCTV', 'no CCTV'],
  street_lights: ['street lighting', 'no street lighting'],
  has_png_gas_pipeline: ['piped gas', 'no piped gas'],
  has_service_lift: ['service lift', 'no service lift'],
  land_title_clear: ['clear', 'not clear'],
  fir_against_project: ['FIR on record', 'no FIR on record'],
  escrow_verified: ['escrow verified', 'escrow not verified'],
  nclt_moratorium_active: ['NCLT moratorium ACTIVE', 'no NCLT moratorium'],
  authority_dues_cleared: ['cleared', 'not cleared'],
  gst_pass_through: ['passed through', 'not passed through'],
  price_includes_plc: ['included', 'not included'],
  price_includes_club: ['included', 'not included'],
  price_includes_taxes: ['included', 'not included'],
  has_duplex: ['available', 'not available'],
  has_penthouse: ['available', 'not available'],
  north_facing_units: ['available', 'not available'],
  east_facing_preferred: ['yes', 'no'],
}

/** Units appended to numeric columns so the model does not have to guess. */
const UNITS: Record<string, string> = {
  land_area_acres: ' acres',
  open_space_pct: '%',
  green_cover_percent: '%',
  walkability_score: '/100',
  women_safety_score: '/100',
  construction_quality_rating: '/5',
  buyer_satisfaction_rating: '/5',
  handover_defect_rate: '%',
  noise_level_db: ' dB',
  ceiling_height_ft: ' ft',
  mobile_network_rating: '/5',
  top_school_distance_km: ' km',
  college_distance_km: ' km',
  hospital_distance_km: ' km',
  airport_distance_km: ' km',
  police_station_distance_km: ' km',
  maintenance_per_sqft_monthly: ' per sq.ft per month',
  dg_power_rate_per_unit: ' per unit',
  resale_lock_in_months: ' months',
  occupancy_restriction_months: ' months',
  nri_approval_months: ' months',
  average_builder_delay_months: ' months',
  price_min_cr: ' Cr',
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    return Object.keys(value as object).length === 0
  }
  return false
}

function formatValue(key: string, value: unknown): string | null {
  if (isEmpty(value)) return null

  if (typeof value === 'boolean') {
    const labels = BOOLEAN_LABELS[key]
    return labels ? (value ? labels[0] : labels[1]) : value ? 'yes' : 'no'
  }
  if (value instanceof Date) return value.toISOString().split('T')[0]
  if (typeof value === 'number') return `${value}${UNITS[key] ?? ''}`
  if (Array.isArray(value)) {
    const items = value.filter(v => !isEmpty(v)).slice(0, 12)
    return items.length ? items.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join('; ') : null
  }
  if (typeof value === 'object') return JSON.stringify(value)

  const text = String(value).trim()
  return text.length ? text : null
}

/**
 * Relations heavy enough to be worth fetching only when the question is about
 * them. Measured on a fully-seeded record, these three were 2,857 of 8,201
 * characters — 35% of the block for detail almost no turn asks for.
 */
export type FactTopic = 'price_history' | 'specifications' | 'construction' | 'deep_reasoning' | 'availability'

/**
 * Sub-fields of decision_profile that only a genuinely analytical turn needs.
 *
 * Everything else in the profile is named by a prompt rule and stays in the
 * default block. These four are long-form narrative that no rule references.
 */
const DEEP_NARRATIVE_KEYS = new Set([
  'market_intelligence',
  'financial_intelligence',
  'property_intelligence',
  'builder_intelligence',
])

/**
 * Which phrasings pull in a heavy relation.
 *
 * A declarative table rather than an if-chain so the routing stays reviewable
 * and testable in one place, the same way FEATURE_PROBES works for amenities.
 */
export const FACT_TOPIC_PATTERNS: ReadonlyArray<{ topic: FactTopic; pattern: RegExp }> = [
  { topic: 'price_history', pattern: /price (trend|history|movement|change)|appreciat|how much has|gone up|risen|cagr|capital gain/i },
  { topic: 'specifications', pattern: /spec|fitting|finish|flooring|brand|kitchen|bathroom|sanitary|fixture|modular|vitrified|marble|material|layout/i },
  // "how far along", not a bare "how far" — "how far is the airport" is a
  // distance question and must not drag in the construction timeline.
  { topic: 'construction', pattern: /construction|progress|milestone|slab|superstructure|how far along|what stage|excavat|foundation|completion status|handover|delivery date|when.*(ready|delivered)/i },
  // Deliberately narrow. This gate decides whether the analyst narratives are
  // billed, so it must fire on questions that genuinely want a thesis —
  // comparisons, investment judgement, risk — and not on "does it have a gym".
  // It mirrors the reasoning/advisory shapes in inferenceProfile.ts, which is
  // the other place a question is judged to be worth spending on.
  {
    topic: 'deep_reasoning',
    pattern: /\bvs\b|\bversus\b|compare|better (than|for)|which (one|is better)|trade[- ]?offs?|worth (it|buying)|should i (buy|invest)|investment|appreciat|resale|rental yield|risk|long[- ]term|5[- ]year|why (buy|avoid)|pros and cons|good (option|choice|bet)|safe (option|choice|bet|to buy)|safest bet|is this (good|safe)/i,
  },
  // Unit-level detail — added 7 Sep 2026 alongside wiring `unit_inventory` into
  // the facts block for the first time. Gated the same reason price_history
  // and specifications are: a large project can carry hundreds of individual
  // unit rows, and almost no turn asks about a specific one.
  {
    topic: 'availability',
    pattern: /which (unit|units|floor|flat)|specific unit|unit number|which tower|facing (north|south|east|west|ne|nw|se|sw)|corner unit|corner\b|available units?|unsold units?|top floor|highest floor/i,
  },
]

/** Topics the buyer's message is asking about. */
export function detectFactTopics(message: string): Set<FactTopic> {
  const topics = new Set<FactTopic>()
  for (const { topic, pattern } of FACT_TOPIC_PATTERNS) {
    if (pattern.test(message)) topics.add(topic)
  }
  return topics
}

export interface ProjectFactsOptions {
  /**
   * Registration numbers claimed by more than one project.
   */
  ambiguousRera?: ReadonlySet<string>
  /** Cap on the long prose columns, which dominate the token cost. */
  maxDescriptionChars?: number
  /** Cap on list relations such as amenities. */
  maxListItems?: number
  /** Heavy relations to include. */
  topics?: Set<FactTopic>
  /** Shortlist mode. */
  shortlist?: boolean
  /** Intent-scoped JIT fact projection slice. */
  intentSlice?: IntentSlice
}

/**
 * Fields kept in shortlist mode, in the order a buyer scans them.
 *
 * Deliberately short. Anything not here is still one question away — the
 * project lane refetches in full the moment a project is in focus.
 */
const SHORTLIST_FIELDS = new Set([
  'name', 'sector', 'city', 'status', 'possession_date', 'possession_label',
  'price_min_cr', 'price_max_cr', 'price_range_label', 'price_per_sqft',
  'rera_number', 'total_units', 'total_towers', 'open_space_pct',
  'land_area_acres', 'tagline', 'location_concerns',
])

export type IntentSlice = 'pricing' | 'legal' | 'livability' | 'overview' | 'all'

/** Common baseline identity fields always preserved in all slices */
export const CORE_IDENTITY_FIELDS = new Set([
  'name', 'builder', 'sector', 'city', 'status', 'slug', 'project_name',
])

export const PRICING_FACT_FIELDS = new Set([
  ...CORE_IDENTITY_FIELDS,
  'possession_date', 'possession_label',
  'price_min_cr', 'price_max_cr', 'price_range_label', 'price_per_sqft',
  'maintenance_per_sqft_monthly', 'gst_pass_through', 'price_includes_plc',
  'price_includes_club', 'price_includes_taxes', 'dg_power_rate_per_unit',
  'resale_lock_in_months',
])

export const LEGAL_FACT_FIELDS = new Set([
  ...CORE_IDENTITY_FIELDS,
  'rera_number', 'rera_number_status', 'land_title_clear',
  'nclt_moratorium_active', 'nclt_status', 'authority_dues_cleared',
  'fir_against_project', 'litigation_count', 'ongoing_litigation_count',
  'legal_flag', 'project_risk_flag', 'escrow_verified', 'oc_obtained',
  'land_tenure', 'resale_lock_in_months', 'occupancy_restriction_months',
  'legal_risk_summary', 'developer_legal_standing',
])

export const LIVABILITY_FACT_FIELDS = new Set([
  ...CORE_IDENTITY_FIELDS,
  'open_space_pct', 'green_cover_percent', 'walkability_score',
  'women_safety_score', 'construction_quality_rating', 'buyer_satisfaction_rating',
  'noise_level_db', 'pet_friendly', 'bachelor_tenants_allowed', 'vastu_compliant',
  'top_school_distance_km', 'college_distance_km', 'hospital_distance_km',
  'airport_distance_km', 'airport_distances', 'police_station_distance_km',
  'has_security_24x7', 'has_cctv', 'street_lights', 'has_png_gas_pipeline',
  'has_service_lift', 'total_units', 'total_towers', 'ceiling_height_ft',
  'density_units_per_acre',
])

export const OVERVIEW_FACT_FIELDS = new Set([
  ...CORE_IDENTITY_FIELDS,
  'possession_date', 'possession_label',
  'price_min_cr', 'price_max_cr', 'price_range_label', 'price_per_sqft',
  'rera_number', 'rera_number_status', 'total_units', 'total_towers',
  'open_space_pct', 'land_area_acres', 'tagline', 'location_concerns',
])

export function detectIntentSlice(message: string): IntentSlice | null {
  const m = message.toLowerCase()
  if (/\b(rera|litigation|nclt|court|dispute|legal|title|dues|registry|fir|defaulter|moratorium)\b/i.test(m)) {
    return 'legal'
  }
  if (/\b(price|pricing|cost|payment plan|payment plans|rate|rates|maintenance|budget|per sqft|emi|clp|plc|gst|discount|cheapest|expensive)\b/i.test(m)) {
    return 'pricing'
  }
  if (/\b(amenit|gym|pool|park|green|walkab|safety|school|hospital|metro|connect|pet|bachelor|vastu|noise|security)\b/i.test(m)) {
    return 'livability'
  }
  return null
}


/**
 * Flattens one project row into `key: value` lines, omitting everything empty.
 *
 * Accepts a row fetched with any include: redactProject drops the internal
 * columns, and relation shapes are summarised by the caller (see
 * buildProjectFacts) rather than dumped raw.
 */
/**
 * Public fields that are buyer-facing on a page but have no business in a prompt.
 *
 * Being in the exposure allowlist means a field may reach the buyer. It does not
 * mean it should reach the MODEL — these three are billed on every turn and each
 * is either unusable or a liability:
 *
 * `rera_url` is the worst of them. Prompt rule 17 forbids sending a buyer off
 * the platform and `EXTERNAL_URL_PATTERNS` strips up-rera.in from the output,
 * yet the facts block was handing the model that exact link on every project
 * turn — the rule said don't, and the data said here it is. The RERA number, its
 * validity and the construction timeline are all in our own rows.
 *
 * `hero_image_url` cannot be quoted in prose; the property cards carry images.
 *
 * `marketing_claims` is developer copy — "Ultra-Luxury", "Prime Residential
 * Living", "85%+ Open Space" — and no prompt rule names it. Handing puffery to
 * an advisor whose first principle is not exaggerating is the same mistake as
 * the rera_url one: the prompt forbids the register that the data supplies.
 *
 * Trimming these is also what keeps the block inside its token budget without
 * raising the budget, which masterDataCoverage.test.ts deliberately makes hard.
 */
export const PROMPT_EXCLUDED_FIELDS = new Set(['rera_url', 'hero_image_url', 'marketing_claims'])

export function projectScalarFacts(
  row: Record<string, unknown>,
  options: ProjectFactsOptions = {},
): Record<string, string> {
  const maxDescription = options.maxDescriptionChars ?? 400
  const safe = redactProject(row) as Record<string, unknown>
  const out: Record<string, string> = {}

  const slice = options.intentSlice
  const sliceFields = slice === 'pricing'
    ? PRICING_FACT_FIELDS
    : slice === 'legal'
    ? LEGAL_FACT_FIELDS
    : slice === 'livability'
    ? LIVABILITY_FACT_FIELDS
    : slice === 'overview'
    ? OVERVIEW_FACT_FIELDS
    : null

  for (const [key, value] of Object.entries(safe)) {
    if (!isPublicField(key)) continue // relations are handled separately
    if (PROMPT_EXCLUDED_FIELDS.has(key)) continue
    if (isSchemaDefault(key, value)) continue
    if (key === 'rera_number' && options.ambiguousRera) {
      const norm = normalizeRera(value)
      if (norm && options.ambiguousRera.has(norm)) {
        out.rera_number_status = RERA_AMBIGUOUS_NOTE
        continue
      }
    }
    if (options.shortlist && !SHORTLIST_FIELDS.has(key)) continue
    if (sliceFields && !sliceFields.has(key)) continue
    let formatted = formatValue(key, value)
    if (formatted === null) continue
    if ((key === 'description' || key === 'long_description') && formatted.length > maxDescription) {
      formatted = `${formatted.slice(0, maxDescription)}…`
    }
    out[key] = formatted
  }

  // Both airports, computed from this project's own coordinates.
  if (!sliceFields || sliceFields.has('airport_distances') || sliceFields.has('airport_distance_km')) {
    const distances = airportDistances(
      (safe.lat as number | null) ?? null,
      (safe.lng as number | null) ?? null,
    )
    if (distances.length) {
      out.airport_distances = distances
        .map((d) => `${d.airport} ${d.km} km`)
        .join('; ') + ' (straight line)'
    }
  }

  return out
}

interface RelationShapes {
  builder?: Record<string, unknown> | null
  unit_types?: Array<Record<string, unknown>> | null
  amenities?: Array<{ name?: string | null; category?: string | null }> | null
  connectivity?: Array<{ name?: string | null; type?: string | null; distance_km?: number | null; travel_time_min?: number | null }> | null
  payment_plans?: Array<Record<string, unknown>> | null
  cost_sheet?: Record<string, unknown> | null
  decision_profile?: Record<string, unknown> | null
  recommendation_profile?: Record<string, unknown> | null
  persona_profile?: Record<string, unknown> | null
  price_history?: Array<Record<string, unknown>> | null
  construction_milestones?: Array<Record<string, unknown>> | null
  spec_items?: Array<Record<string, unknown>> | null
  competitors?: Array<Record<string, unknown>> | null
  unit_inventory?: Array<Record<string, unknown>> | null
  channel_partners?: Array<{ is_featured?: boolean | null; channel_partner?: Record<string, unknown> | null }> | null
}

/** Applies the relation policy and drops anything that came back empty. */
function cleanRelation(name: string, row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!row) return null
  // Applied to every relation, not only builder: an opaque 0-100 analyst score
  // on any current or future relation is the same fake-confidence problem
  // BUYER_OPAQUE_SCORES already names, and stripping it here means a relation
  // added later inherits the policy instead of needing its own reminder to.
  const stripped = stripRelationInternals(name, stripOpaqueScores(row))
  if (!stripped) return null
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(stripped)) {
    const formatted = formatValue(key, value)
    if (formatted !== null) out[key] = formatted
  }
  return Object.keys(out).length ? out : null
}

/**
 * The full fact set for one project: every populated public scalar, plus the
 * relations summarised in a form the model can quote.
 *
 * Returns a plain object so the caller can JSON.stringify it into the prompt.
 */
export function buildProjectFacts(
  row: Record<string, unknown> & RelationShapes,
  rawOptions: ProjectFactsOptions | string = {},
): Record<string, unknown> {
  const options: ProjectFactsOptions = typeof rawOptions === 'string'
    ? { topics: detectFactTopics(rawOptions) }
    : (rawOptions ?? {})

  const shortlist = options.shortlist === true
  const maxItems = options.maxListItems ?? (shortlist ? 4 : 15)
  const facts: Record<string, unknown> = projectScalarFacts(row, options)

  const slice = options.intentSlice
  const isPricing = slice === 'pricing'
  const isLegal = slice === 'legal'
  const isLivability = slice === 'livability'
  const isOverview = slice === 'overview'

  const builderFacts = cleanRelation('builder', row.builder)
  if (builderFacts) {
    delete builderFacts.slug
    delete builderFacts.logo_url
    facts.builder = builderFacts
  }

  const insolvent = row.builder?.insolvency_history === true
  const builderFlag = typeof row.builder?.legal_flag === 'string' ? row.builder.legal_flag : null
  if (insolvent || builderFlag) {
    facts.developer_legal_standing =
      `${row.builder?.name ?? 'This developer'} carries ` +
      `${insolvent ? 'insolvency history on record' : ''}` +
      `${insolvent && builderFlag ? ' and ' : ''}` +
      `${builderFlag ? `a legal flag: ${builderFlag}` : ''}. ` +
      `Treat any project-level "clean" or "low risk" marker for this developer as unreliable — ` +
      `say plainly that the developer is under insolvency or legal supervision and that the ` +
      `advisory team should confirm the current position before any commitment.`
    for (const contradicted of ['legal_flag', 'project_risk_flag', 'nclt_moratorium_active', 'nclt_status', 'approvals_status']) {
      delete facts[contradicted]
    }
  }

  // Synthesize unambiguous legal risk summary for the prompt
  const projLitigation = Number(row.litigation_count) || 0
  const ongoingLitigation = Number(row.ongoing_litigation_count) || 0
  const builderLitigation = Number((row.builder as any)?.litigation_count) || 0
  const ncltActive = row.nclt_moratorium_active === true
  const duesPending = row.authority_dues_cleared === false
  const projFlag = typeof row.legal_flag === 'string' && row.legal_flag !== 'none' ? row.legal_flag : null

  if (projLitigation > 0 || ongoingLitigation > 0 || builderLitigation > 0 || ncltActive || duesPending || projFlag) {
    const issues: string[] = []
    if (projLitigation > 0) issues.push(`${projLitigation} project litigation record(s) (${ongoingLitigation} ongoing)`)
    if (builderLitigation > 0) issues.push(`${builderLitigation} builder litigation record(s)`)
    if (ncltActive) issues.push('ACTIVE NCLT insolvency moratorium')
    if (duesPending) issues.push('Uncleared Noida/Greater Noida Authority land dues (sub-lease deed registry may be blocked)')
    if (projFlag) issues.push(`Project legal flag: ${projFlag}`)

    facts.legal_risk_summary =
      `[MANDATORY LEGAL DISCLOSURE] This property carries active legal concerns: ${issues.join('; ')}. ` +
      `HARD RULE 6f REQUIRES you to state this upfront in your opening sentence before evaluating any amenities, layouts, or pricing.`
  }

  if (row.unit_types?.length && !isLegal && !isLivability) {
    facts.unit_types = row.unit_types.slice(0, maxItems).map(u => {
      const bhk = u.bhk ?? '?'
      const area = u.super_area_sqft ?? u.carpet_area_sqft
      const price = u.price_min_cr ? ` from ₹${u.price_min_cr} Cr` : ''
      return `${bhk} BHK${area ? ` (${area} sq ft)` : ''}${price}`
    })
  }

  if (row.amenities?.length && !isPricing && !isLegal) {
    facts.amenities = row.amenities.slice(0, shortlist ? 8 : 40).map(a => a.name).filter(Boolean)
  }

  if (row.connectivity?.length && !isPricing && !isLegal) {
    facts.connectivity = row.connectivity.slice(0, maxItems).map(c => {
      const distance = c.distance_km != null ? `${c.distance_km} km` : ''
      const time = c.travel_time_min != null ? `, ${c.travel_time_min} min` : ''
      return `${c.name ?? c.type ?? 'nearby'}${distance ? ` — ${distance}${time}` : ''}`
    })
  }

  if (row.payment_plans?.length && !isLegal && !isLivability) {
    facts.payment_plans = row.payment_plans.slice(0, maxItems).map((p: any) => {
      const milestones = Array.isArray(p.milestones) && p.milestones.length > 0
        ? ' [Milestones: ' + p.milestones.map((m: any) => {
            const name = m.milestone || m.name || `Stage ${m.stage || ''}`
            const pct = m.pct != null ? `${m.pct}%` : m.percentage != null ? `${m.percentage}%` : ''
            const timeline = m.due || m.timeline || m.trigger || ''
            return `${name}${pct ? ` (${pct})` : ''}${timeline ? ` — ${timeline}` : ''}`
          }).join(' → ') + ']'
        : ''
      const desc = p.description ? `: ${p.description}` : ''
      return `${p.plan_name}${desc}${milestones}`
    })
  }

  if (!isLegal && !isLivability && !isOverview) {
    const sheet = cleanRelation('cost_sheet', row.cost_sheet)
    if (sheet) facts.cost_sheet = sheet
  }

  const decision = cleanRelation('decision_profile', row.decision_profile)
  if (decision && !isPricing && !isLegal && !isOverview) {
    facts.decision_profile = options.topics?.has('deep_reasoning')
      ? decision
      : Object.fromEntries(Object.entries(decision).filter(([k]) => !DEEP_NARRATIVE_KEYS.has(k)))
  } else if (decision && options.topics?.has('deep_reasoning')) {
    facts.decision_profile = decision
  }

  if (!isPricing && !isLegal) {
    const recommendation = cleanRelation('recommendation_profile', row.recommendation_profile)
    if (recommendation) facts.recommendation_profile = recommendation
  }

  if (!isPricing && !isLegal) {
    const persona = cleanRelation('persona_profile', row.persona_profile)
    if (persona) facts.buyer_fit = persona
  }

  const topics = options.topics

  if ((topics?.has('price_history') || isPricing) && row.price_history?.length && !isLegal && !isLivability) {
    const series = row.price_history.slice(-maxItems)
    const OBSERVED = new Set(['market_verified_2026', 'active_market_listing', 'admin_update'])
    const observedPoints = series.filter(
      h => typeof h.source === 'string' && OBSERVED.has(h.source),
    ).length

    facts.price_history = series.map(h => cleanRelation('price_history', h)).filter(Boolean)
    facts.price_history_basis =
      observedPoints >= 2
        ? `${observedPoints} of these price points are observed market prices, recorded on the dates shown.`
        : 'These figures are internal benchmark records, not prices we observed being paid. They were generated on a fixed step and carry no market signal, so the interval between them does not measure anything.'
  }

  if (topics?.has('construction') && row.construction_milestones?.length && !isPricing) {
    facts.construction_milestones = row.construction_milestones
      .slice(0, maxItems)
      .map(m => cleanRelation('construction_milestones', m))
      .filter(Boolean)
  }

  if (topics?.has('specifications') && row.spec_items?.length && !isPricing && !isLegal) {
    facts.specifications = row.spec_items.slice(0, 30).map(s => {
      const brand = s.brand ? ` (${s.brand})` : ''
      return `${s.category ? `${s.category}: ` : ''}${s.label} — ${s.value}${brand}`
    })
  }

  if (topics?.has('deep_reasoning') && row.competitors?.length) {
    facts.competitors = row.competitors
      .slice(0, 5)
      .map(c => cleanRelation('competitors', c))
      .filter(Boolean)
  }

  if (row.channel_partners?.length && !isLegal && !isLivability) {
    const partners = row.channel_partners
      .map(pcp => {
        const cleaned = cleanRelation('channel_partner', pcp.channel_partner)
        if (!cleaned) return null
        return pcp.is_featured ? { ...cleaned, featured: 'yes' } : cleaned
      })
      .filter((p): p is Record<string, unknown> => p !== null)
    if (partners.length) facts.channel_partners = partners
  }

  if (topics?.has('availability') && row.unit_inventory?.length && !isPricing && !isLegal) {
    facts.unit_inventory = row.unit_inventory
      .slice(0, maxItems)
      .map(u => cleanRelation('unit_inventory', u))
      .filter(Boolean)
  }

  return facts
}
