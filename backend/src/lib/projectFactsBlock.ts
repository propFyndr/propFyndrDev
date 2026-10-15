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

import type { Prisma } from '@prisma/client'
import { airportDistances } from './discovery/airports'
import { possessionDatePassed, DATE_PASSED_NOTE } from './possession'
import { asksPriceMovement } from './priceMovement'
import { facingLabel, recordedOrientations, ORIENTATION_IS_SOURCED } from './discovery/facing'
import { redactProject, isPublicField, stripRelationInternals, isSchemaDefault, stripOpaqueScores } from './projectExposure'
import { normalizeRera, RERA_AMBIGUOUS_NOTE } from './reraIntegrity'

/**
 * Columns rendered as "yes"/"no" rather than true/false.
 *
 * nri_eligible, pet_friendly, bachelor_tenants_allowed, vastu_compliant,
 * has_png_gas_pipeline, has_service_lift, escrow_verified,
 * authority_dues_cleared, price_includes_plc/club/taxes, north_facing_units
 * and east_facing_preferred were removed (lean-schema migration, 2026-10 —
 * the columns are dropped or never existed on Project).
 */
const BOOLEAN_LABELS: Record<string, [string, string]> = {
  oc_obtained: ['obtained', 'not obtained'],
  rental_income_allowed: ['allowed', 'not allowed'],
  foreign_currency_payment_allowed: ['allowed', 'not allowed'],
  has_security_24x7: ['24x7 security', 'no 24x7 security'],
  has_cctv: ['CCTV', 'no CCTV'],
  street_lights: ['street lighting', 'no street lighting'],
  land_title_clear: ['clear', 'not clear'],
  fir_against_project: ['FIR on record', 'no FIR on record'],
  nclt_moratorium_active: ['NCLT moratorium ACTIVE', 'no NCLT moratorium'],
  gst_pass_through: ['passed through', 'not passed through'],
  has_duplex: ['available', 'not available'],
  has_penthouse: ['available', 'not available'],
}

/**
 * Units appended to numeric columns so the model does not have to guess.
 *
 * women_safety_score, noise_level_db, mobile_network_rating,
 * resale_lock_in_months, average_builder_delay_months and
 * college_distance_km were removed (lean-schema migration, 2026-10 — the
 * columns are dropped or never existed on Project).
 */
const UNITS: Record<string, string> = {
  land_area_acres: ' acres',
  open_space_pct: '%',
  green_cover_percent: '%',
  walkability_score: '/100',
  ceiling_height_ft: ' ft',
  top_school_distance_km: ' km',
  hospital_distance_km: ' km',
  airport_distance_km: ' km',
  police_station_distance_km: ' km',
  maintenance_per_sqft_monthly: ' per sq.ft per month',
  dg_power_rate_per_unit: ' per unit',
  occupancy_restriction_months: ' months',
  nri_approval_months: ' months',
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
export type FactTopic =
  | 'price_history'
  | 'specifications'
  | 'construction'
  | 'deep_reasoning'
  | 'availability'
  | 'updates'
  | 'forward_looking'

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
export const FACT_TOPIC_PATTERNS: ReadonlyArray<{ topic: FactTopic; pattern: RegExp; test?: (message: string) => boolean }> = [
  // `pattern` is the original wording; `test` reads the question the way a person
  // asks it ("has the price of X changed over the last 12 months?"), which the
  // adjacent-words pattern never matched. Either fires the topic.
  {
    topic: 'price_history',
    pattern: /price (trend|history|movement|change)|appreciat|how much has|gone up|risen|cagr|capital gain/i,
    test: asksPriceMovement,
  },
  // "structure and safety" is how the spec sections are named on the page, and the
  // old pattern knew none of it: that question reached the model with no specs.
  {
    topic: 'specifications',
    pattern: /spec|fitting|finish|flooring|brand|kitchen|bathroom|sanitary|fixture|modular|vitrified|marble|material|layout|\bstructur\w*|\bsafety\s+(?:feature|measure|standard|system)\w*|\bfire\b|seismic|earthquake|\brcc\b|waterproof\w*|insulat\w*|plumbing|electrical|wiring|\bpaint\w*|\bdoors?\b|\bwindows?\b|\btiles?\b|(?:lift|elevator)\s+brand|(?:build|construction)\s+quality/i,
  },
  // What has happened on the project lately. `lifecycle_updates` and
  // `construction_updates` were never fetched at all, so "any recent updates?"
  // could not be answered however it was worded.
  {
    topic: 'updates',
    pattern: /\bupdates?\b|\bnews\b|\btimeline\b|what'?s\s+new|any\s+(?:news|development|change)s?|(?:latest|recent)\s+(?:update|news|development|progress|status|photo|information)|(?:construction|progress|handover)\s+(?:update|report|photo)|\bdelay(?:s|ed)?\b|on\s+schedule|behind\s+schedule/i,
  },
  // Questions whose honest answer is "we do not state that": rental yield, rental
  // income, expected growth, and the analyst write-up (decision thesis, buyer
  // persona, investment angle). The records exist or are withheld on purpose
  // (INTERNAL_ONLY_FIELDS, and decision_profile is publish-gated), so the model
  // must say that, not "that is not in our records".
  {
    topic: 'forward_looking',
    pattern: /\byield\b|rental\s+(?:income|return|earning)s?|\broi\b|return\s+on\s+investment|investment\s+(?:insight|potential|return|angle|case|thesis|view)s?|good\s+investment|worth\s+(?:it|buying|investing)|should\s+i\s+(?:buy|invest)|decision\s+thesis|\bthesis\b|buyer\s+persona|\bpersona\b|best\s+suited|suited\s+for|expected\s+(?:growth|returns?|appreciation|rent)|future\s+(?:price|value)|(?:price|value)\s+(?:be\s+)?(?:in|after)\s+\d+\s+years?|(?:will|would|going\s+to)\s+(?:the\s+)?(?:price|value|rate)s?\s+(?:be|go|rise|increase|grow|reach|double)|appreciation\s+(?:potential|forecast|prospects?)/i,
  },
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

/**
 * The relations a set of topics needs, as a Prisma include fragment.
 *
 * The one place that says which heavy relation a topic pulls in. It used to be a
 * hand-written spread in the chat router, one block per relation, and it drifted:
 * the builder was written to show price history on any pricing question while the
 * router fetched it only for a narrow wording, and two relations (lifecycle and
 * construction updates) were never fetched by anything. Every take is bounded.
 */
export function relationIncludesFor(topics: ReadonlySet<FactTopic>): Prisma.ProjectInclude {
  const include: Prisma.ProjectInclude = {}
  if (topics.has('price_history') || topics.has('forward_looking')) {
    include.price_history = { take: 8, orderBy: { recorded_at: 'desc' } }
  }
  if (topics.has('construction') || topics.has('updates')) {
    include.construction_milestones = { take: 10, orderBy: { sort_order: 'asc' } }
  }
  if (topics.has('updates')) {
    include.construction_updates = { take: 4, orderBy: { update_date: 'desc' } }
    include.lifecycle_updates = { take: 6, orderBy: { update_date: 'desc' } }
  }
  if (topics.has('specifications')) {
    include.spec_items = { take: 30, orderBy: [{ is_highlight: 'desc' }, { sort_order: 'asc' }] }
  }
  // `competitors` and `unit_inventory` were on ALLOWED_RELATIONS long before
  // either was ever requested — added 7 Sep 2026.
  if (topics.has('deep_reasoning')) include.competitors = { take: 5, orderBy: { sort_order: 'asc' } }
  if (topics.has('availability')) include.unit_inventory = { take: 60 }
  return include
}

/** Topics the buyer's message is asking about. */
export function detectFactTopics(message: string): Set<FactTopic> {
  const topics = new Set<FactTopic>()
  for (const { topic, pattern, test } of FACT_TOPIC_PATTERNS) {
    if (pattern.test(message) || test?.(message)) topics.add(topic)
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
  'maintenance_per_sqft_monthly', 'gst_pass_through',
  'dg_power_rate_per_unit', 'all_in_cost_multiplier', 'launch_date',
  'unit_types',
])

export const LEGAL_FACT_FIELDS = new Set([
  ...CORE_IDENTITY_FIELDS,
  'rera_number', 'rera_number_status', 'land_title_clear',
  'nclt_moratorium_active',
  'fir_against_project', 'litigation_count', 'ongoing_litigation_count',
  'project_risk_flag', 'oc_obtained',
  'occupancy_restriction_months',
  'legal_risk_summary', 'developer_legal_standing',
  'oc_status', 'oc_details', 'amitabh_kant_clearance', 'registry_status',
  'possession_confidence', 'lift_act_compliant', 'flood_zone',
])

export const LIVABILITY_FACT_FIELDS = new Set([
  ...CORE_IDENTITY_FIELDS,
  'open_space_pct', 'green_cover_percent', 'walkability_score',
  'top_school_distance_km', 'hospital_distance_km',
  'airport_distance_km', 'airport_distances', 'police_station_distance_km',
  'has_security_24x7', 'has_cctv', 'street_lights',
  'total_units', 'total_towers', 'ceiling_height_ft',
  'water_source', 'water_source_type', 'water_tds_range',
  'air_quality_index_avg', 'flood_waterlogging_risk', 'flood_zone',
  'shahdara_drain_impact', 'commute_matrix', 'floors', 'lift_act_compliant',
  'power_supply_type', 'green_rating',
  'description', 'amenities', 'unit_types',
])

export const OVERVIEW_FACT_FIELDS = new Set([
  ...CORE_IDENTITY_FIELDS,
  'possession_date', 'possession_label',
  'price_min_cr', 'price_max_cr', 'price_range_label', 'price_per_sqft',
  'rera_number', 'rera_number_status', 'total_units', 'total_towers',
  'open_space_pct', 'land_area_acres', 'tagline', 'location_concerns',
])

/**
 * The one topic a question is about, or null.
 *
 * Null whenever two topics are asked at once ("price and rera status"): a
 * slice drops every field outside it, and the prompt reads an absent field as
 * one we do not hold — so a mixed question narrowed to one slice would have
 * the advisor deny a fact sitting in our rows.
 */
export function detectIntentSlice(message: string): IntentSlice | null {
  const m = message.toLowerCase()
  const hits: IntentSlice[] = []
  if (/\b(rera|litigation|nclt|court|dispute|legal|title|dues|registry|fir|defaulter|moratorium)\b/i.test(m)) hits.push('legal')
  if (/\b(price|pricing|cost|payment plan|payment plans|rate|rates|maintenance|budget|per sqft|emi|clp|plc|gst|discount|cheapest|expensive)\b/i.test(m)) hits.push('pricing')
  if (/\b(amenit\w*|gym|pool|park|green|walkab\w*|safety|school|hospital|metro|connect\w*|pet|bachelor|vastu|noise|security)\b/i.test(m)) hits.push('livability')
  return hits.length === 1 ? hits[0] : null
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
  const topicFields = slice === 'pricing'
    ? PRICING_FACT_FIELDS
    : slice === 'legal'
    ? LEGAL_FACT_FIELDS
    : slice === 'livability'
    ? LIVABILITY_FACT_FIELDS
    : slice === 'overview'
    ? OVERVIEW_FACT_FIELDS
    : null
  const sliceFields = topicFields

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
    if (key === 'description' || key === 'long_description' || key === 'tagline') {
      if (formatted.length > maxDescription) formatted = `${formatted.slice(0, maxDescription)}…`
      // Marketing copy written by or for the developer. "Metro confirmed 2028"
      // or "verified safest project" in here is a claim, not a fact we hold.
      formatted = `<untrusted_source url="developer-listing">${formatted}</untrusted_source>`
    }
    out[key] = formatted
  }

  if (out.possession_label && possessionDatePassed(safe.status, safe.possession_date as Date | string | null)) {
    out.possession_label = `${out.possession_label} (${DATE_PASSED_NOTE})`
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
  price_history?: Array<Record<string, unknown>> | null
  construction_milestones?: Array<Record<string, unknown>> | null
  construction_updates?: Array<Record<string, unknown>> | null
  lifecycle_updates?: Array<Record<string, unknown>> | null
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
  // authority_dues_cleared is dropped (lean-schema migration, 2026-10) — no
  // signal to derive a dues-pending disclosure from until re-sourced.
  const projFlag = typeof row.project_risk_flag === 'string' && row.project_risk_flag !== 'none' ? row.project_risk_flag : null

  if (projLitigation > 0 || ongoingLitigation > 0 || builderLitigation > 0 || ncltActive || projFlag) {
    const issues: string[] = []
    if (projLitigation > 0) issues.push(`${projLitigation} project litigation record(s) (${ongoingLitigation} ongoing)`)
    if (builderLitigation > 0) issues.push(`${builderLitigation} builder litigation record(s)`)
    if (ncltActive) issues.push('ACTIVE NCLT insolvency moratorium')
    if (projFlag) issues.push(`Project legal flag: ${projFlag}`)

    facts.legal_risk_summary =
      `[MANDATORY LEGAL DISCLOSURE] This property carries active legal concerns: ${issues.join('; ')}. ` +
      `HARD RULE 6f REQUIRES you to state this upfront in your opening sentence before evaluating any amenities, layouts, or pricing.`
  }

  // Maintenance charges and loading ratio unknowns
  if ((row as any).maintenance_per_sqft_monthly != null) {
    facts.maintenance_charges = `₹${(row as any).maintenance_per_sqft_monthly}/sq.ft monthly`
  } else {
    facts.maintenance_charges = 'UNKNOWN (Not declared by builder on record; state as unknown, do not estimate)'
  }
  facts.super_to_carpet_ratio = 'UNKNOWN (Loading ratio unconfirmed on official record; do not derive or claim a super built-up area from carpet area)'

  if (row.unit_types?.length && !isLegal && !isLivability) {
    facts.unit_types = row.unit_types.slice(0, maxItems).map(u => {
      const bhk = u.bhk ?? '?'
      const area = u.super_area_sqft ?? u.carpet_area_sqft
      const price = u.price_min_cr ? ` from ₹${u.price_min_cr} Cr` : ''
      // Which way it faces / what it overlooks, as recorded for the configuration. It
      // was in the row and never in the prompt, so "which flats face east?" had no answer.
      const orientations = recordedOrientations(u.unit_orientations as unknown[] | null | undefined)
      const faces = orientations.length ? `, ${orientations.map(facingLabel).join(', ')}` : ''
      return `${bhk} BHK${area ? ` (${area} sq ft)` : ''}${price}${faces}`
    })
    // Said once, where it can be read next to the orientations, only when asked about.
    if (options.topics?.has('availability')) {
      facts.unit_orientation_basis = ORIENTATION_IS_SOURCED
        ? 'Facing and views are recorded per configuration, never per tower or floor. Say "configurations on record"; never say that a specific unit faces a direction.'
        : 'No verified facing or view is held for any unit (the catalogue values are generic by configuration). Never say which way a flat faces; say it is not on record and point to the builder floor plan.'
    }
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

  // RecommendationProfile and PersonaProfile are dropped (lean-schema
  // migration, 2026-10) — nothing left to project into buyer_fit or a
  // recommendation_profile fact until sub-project C re-sources them.

  const topics = options.topics

  // forward_looking asks for something we do not state (yield, growth); the recorded
  // price points are what we can offer instead, so they travel with the question.
  if ((topics?.has('price_history') || topics?.has('forward_looking') || isPricing) && row.price_history?.length && !isLegal && !isLivability) {
    const series = row.price_history.slice(-maxItems)
    const OBSERVED = new Set(['market_verified_2026', 'active_market_listing', 'admin_update'])
    const observedPoints = series.filter(
      h => typeof h.source === 'string' && OBSERVED.has(h.source),
    ).length

    facts.price_history = series.map(h => cleanRelation('price_history', h)).filter(Boolean)
    facts.price_history_basis =
      observedPoints >= 2
        ? `${observedPoints} of these price points are observed market prices, recorded on the dates shown.`
        : 'These figures are internal benchmark records, not prices we observed being paid. They follow a growth pattern shared across projects, so they carry no signal about the market for this project itself and the interval between them does not measure anything.'
  }

  if ((topics?.has('construction') || topics?.has('updates')) && row.construction_milestones?.length && !isPricing) {
    facts.construction_milestones = row.construction_milestones
      .slice(0, maxItems)
      .map(m => cleanRelation('construction_milestones', m))
      .filter(Boolean)
  }

  // What has happened lately: project and construction updates, newest first. Only
  // the fields a buyer can use; the analyst flags on the row (affects_pricing,
  // affects_recommendation, legal_flag_cleared) are not part of the answer.
  if (topics?.has('updates') && !isPricing && !isLegal) {
    const stamp = (v: unknown): number => {
      const t = v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(v) : NaN
      return Number.isNaN(t) ? 0 : t
    }
    const merged = [
      ...(row.lifecycle_updates ?? []).map((u) => ({ at: stamp(u.update_date), kind: 'lifecycle' as const, u })),
      ...(row.construction_updates ?? []).map((u) => ({ at: stamp(u.update_date), kind: 'construction' as const, u })),
    ].sort((a, b) => b.at - a.at).slice(0, maxItems)

    const updates = merged
      .map(({ kind, u }) => {
        const c = cleanRelation(kind === 'lifecycle' ? 'lifecycle_updates' : 'construction_updates', u)
        if (!c) return null
        const entry: Record<string, unknown> = {
          type: kind === 'lifecycle' ? (c.update_type ?? 'project update') : 'construction update',
          title: c.title,
          details: c.description ?? c.note,
          date: c.update_date,
          impact: c.impact,
          completion: c.completion_pct,
          quarter: c.quarter_label,
          source: c.source,
        }
        for (const k of Object.keys(entry)) if (entry[k] == null || entry[k] === '') delete entry[k]
        return entry.title || entry.details ? entry : null
      })
      .filter((e): e is Record<string, unknown> => e !== null)
    if (updates.length) facts.recent_updates = updates
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

  // Said out loud when the question asks for something we do not state. Without
  // this the model reads the absent key as "not in our records", which is false:
  // yield and growth are withheld on purpose (INTERNAL_ONLY_FIELDS), and the
  // analyst write-up exists but is a draft (decision_profile is publish-gated).
  if (topics?.has('forward_looking')) {
    const status = (row.decision_profile as { status?: unknown } | null | undefined)?.status
    const withheld: Record<string, string> = {
      projections:
        'RealtyAsk does not state an expected rental yield, rental income, resale value or future price growth for a project: those are forward-looking estimates, not records. ' +
        'When asked, say that plainly in one sentence, then offer what IS held: the recorded price points (with their basis), unit prices, the cost sheet and the possession status. ' +
        'Never estimate, and never say this is missing from our records.',
    }
    if (row.decision_profile && status !== 'PUBLISHED') {
      withheld.analyst_view =
        'An analyst write-up of this project (decision thesis, buyer fit, investment angle) exists but is still a draft, so it is not published. ' +
        'When asked for it, say RealtyAsk has not published its view of this project yet. Do not describe or paraphrase it.'
    }
    facts.withheld_by_policy = withheld
  }

  return facts
}
