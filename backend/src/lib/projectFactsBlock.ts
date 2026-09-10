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
    pattern: /\bvs\b|\bversus\b|compare|better (than|for)|which (one|is better)|trade[- ]?offs?|worth (it|buying)|should i (buy|invest)|investment|appreciat|resale|rental yield|risk|long[- ]term|5[- ]year|why (buy|avoid)|pros and cons/i,
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
   *
   * Measured 4 Sep 2026: 19 numbers are shared, across 43 projects — 15% of
   * inventory. Mostly different projects from different builders, not duplicate
   * rows: UPRERAPRJ1504 sits on both Godrej Palm Retreat and Apex Golf Avenue,
   * UPRERAPRJ1001 on three projects.
   *
   * The registration number is the one fact we tell buyers to verify for
   * themselves, so a wrong one does more damage than any other field: the buyer
   * looks it up, finds a different development, and correctly concludes we
   * invent data — which makes every other figure in the answer suspect too.
   *
   * We cannot tell which project owns which number, so the number is withheld
   * rather than guessed. Pass the set from `ambiguousReraNumbers()`; omitting it
   * renders every number as before, which is the right default for a caller
   * that has not loaded it.
   */
  ambiguousRera?: ReadonlySet<string>
  /** Cap on the long prose columns, which dominate the token cost. */
  maxDescriptionChars?: number
  /** Cap on list relations such as amenities. */
  maxListItems?: number
  /**
   * Heavy relations to include. Omit for the default core set; pass the result
   * of detectFactTopics(message) to add the ones the question actually needs.
   */
  topics?: Set<FactTopic>
  /**
   * Shortlist mode: the fields that separate one project from another, only.
   *
   * The full block is ~6.4 KB per project, which is right for a drilldown and
   * ruinous for a shortlist. Measured on a six-project Sector 150 search: the
   * facts came to 38,682 characters against a 33,313-character system prompt —
   * the projects were bigger than the entire instruction set — and the turn
   * took 11.1 seconds to its FIRST token on gemini-3.6-flash. Time to first
   * token tracked input size, not output: the same call emitted only 262
   * characters.
   *
   * A buyer comparing six wants price, size, status, builder, location and the
   * one or two things that distinguish them. Nobody is reading six water
   * sources. When they pick one, the drilldown fetches everything.
   */
  shortlist?: boolean
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

  for (const [key, value] of Object.entries(safe)) {
    if (!isPublicField(key)) continue // relations are handled separately
    if (PROMPT_EXCLUDED_FIELDS.has(key)) continue
    /**
     * A value whose only provenance is a schema default is not a fact.
     *
     * Measured 4 Sep 2026: 190 of 280 projects carried ceiling_height_ft
     * exactly 10.2, 219 carried mobile_network_rating exactly 4, and 166
     * carried lifts_per_tower exactly 3 — the literals Postgres wrote because
     * nobody filled the column in. A third of each column is real, which is
     * what makes rendering them worse rather than better: for one project the
     * default is indistinguishable from a measurement, and a buyer plans around
     * a ceiling height. Withheld here rather than at the select, because the
     * column is genuinely useful on the rows where it was researched.
     */
    if (isSchemaDefault(key, value)) continue
    /**
     * A registration number two projects claim is not this project's number.
     *
     * Replaced with a note rather than silently dropped: an absent
     * `rera_number` reads as "unregistered", which is a different and worse
     * claim about a project than "we cannot confirm which number is yours".
     */
    if (key === 'rera_number' && options.ambiguousRera) {
      const norm = normalizeRera(value)
      if (norm && options.ambiguousRera.has(norm)) {
        out.rera_number_status = RERA_AMBIGUOUS_NOTE
        continue
      }
    }
    if (options.shortlist && !SHORTLIST_FIELDS.has(key)) continue
    let formatted = formatValue(key, value)
    if (formatted === null) continue
    if ((key === 'description' || key === 'long_description') && formatted.length > maxDescription) {
      formatted = `${formatted.slice(0, maxDescription)}…`
    }
    out[key] = formatted
  }

  // Both airports, computed from this project's own coordinates.
  //
  // `airport_distance_km` is a single stored number and nothing records which
  // airport it means. Checked against our coordinates it is Jewar — a real
  // measurement, median error 5.5km — but a buyer asking "how far is the
  // airport" today usually means Delhi, and answering with the other one
  // without saying so is a confident wrong number.
  //
  // Naming both removes the ambiguity instead of picking a side, and the
  // stored column stays where it is for anything that already reads it.
  const distances = airportDistances(
    (safe.lat as number | null) ?? null,
    (safe.lng as number | null) ?? null,
  )
  if (distances.length) {
    out.airport_distances = distances
      .map((d) => `${d.airport} ${d.km} km`)
      .join('; ') + ' (straight line)'
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
  options: ProjectFactsOptions = {},
): Record<string, unknown> {
  // In shortlist mode the relations are capped hard too: a comparison needs the
  // configurations and a handful of amenities, not forty of each across six
  // projects. Amenity lists and connectivity rows are the other half of the
  // 6.4 KB-per-project cost the scalar allowlist alone does not reach.
  const shortlist = options.shortlist === true
  const maxItems = options.maxListItems ?? (shortlist ? 4 : 15)
  const facts: Record<string, unknown> = projectScalarFacts(row, options)

  /**
   * Was `row.builder.name` alone until 7 Sep 2026 — a bare string, the same
   * question "which fields may a relation carry" that RELATION_INTERNAL_FIELDS
   * already answers for cost_sheet, decision_profile and the rest. `builder`
   * had simply never been given an entry, so nothing beyond the name reached
   * the model: not founded_year, not delivered units, not the average handover
   * delay, not RERA promoter id, not awards or CREDAI membership — all facts a
   * buyer can genuinely ask about, and all already vetted safe for exactly this
   * purpose by `builderReputationHandler`, the 215-line handler that exists
   * because this projection had nothing to answer a builder question with.
   *
   * `cleanRelation` is the same helper cost_sheet/decision_profile/etc. already
   * go through — it applies stripOpaqueScores (drops the analyst-set 0-100
   * scores) and stripRelationInternals (drops cin/legal_entities/executives/
   * outstanding_dues_cr/audit_flags_log/verification_level/data_source/
   * intelligence_completeness, per the builder entry in RELATION_INTERNAL_FIELDS)
   * before anything reaches the prompt.
   *
   * `slug` and `logo_url` are safe (they are in KNOWN_PUBLIC_BUILDER_FIELDS in
   * the exposure test) but pure waste as prompt text — the same reason
   * PROMPT_EXCLUDED_FIELDS withholds Project's own `hero_image_url` and
   * `rera_url`. Not added to that shared Set: Project already uses `slug` for
   * links, so a name collision there would drop the wrong field. Measured on
   * a real seeded builder: dropping these two is 104 of the object's 1,092
   * characters before either was even the largest line — a URL the model
   * cannot render and an identifier no prompt rule ever reads.
   */
  const builderFacts = cleanRelation('builder', row.builder)
  if (builderFacts) {
    delete builderFacts.slug
    delete builderFacts.logo_url
    facts.builder = builderFacts
  }

  /**
   * A developer's insolvency outranks the project's own "clean" markers.
   *
   * Measured on Amrapali Crystal Homes, and the database contradicts itself:
   *
   *   builder.insolvency_history   true
   *   legal_flag                   "none"
   *   project_risk_flag            "low_risk"
   *   nclt_status                  "Clean - No NCLT Moratorium"
   *
   * Only the first is right. The Supreme Court cancelled Amrapali's RERA
   * registrations in 2019 and handed the projects to NBCC. The project-level
   * markers are batch-templated — `legal_flag` is "none" on all 94 of its
   * populated rows — and none of them had ever reached the prompt anyway,
   * because only `builder.name` was projected from the relation. So the model
   * had the reassuring half of the record and not the disqualifying half, and
   * told a buyer the project "has a clean legal standing with no active NCLT
   * insolvency proceedings".
   *
   * Two changes, and the order matters. Surface the insolvency, because it is
   * the single most consequential thing a buyer can know about a developer. And
   * suppress the project-level markers that contradict it, because leaving both
   * in the prompt asks the model to arbitrate between two of our own facts —
   * which is how the wrong one gets picked.
   */
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

  if (row.unit_types?.length) {
    facts.unit_types = row.unit_types.slice(0, maxItems).map(u => {
      const bhk = u.bhk ?? '?'
      const area = u.super_area_sqft ?? u.carpet_area_sqft
      const price = u.price_min_cr ? ` from ₹${u.price_min_cr} Cr` : ''
      return `${bhk} BHK${area ? ` (${area} sq ft)` : ''}${price}`
    })
  }

  if (row.amenities?.length) {
    facts.amenities = row.amenities.slice(0, shortlist ? 8 : 40).map(a => a.name).filter(Boolean)
  }

  if (row.connectivity?.length) {
    facts.connectivity = row.connectivity.slice(0, maxItems).map(c => {
      const distance = c.distance_km != null ? `${c.distance_km} km` : ''
      const time = c.travel_time_min != null ? `, ${c.travel_time_min} min` : ''
      return `${c.name ?? c.type ?? 'nearby'}${distance ? ` — ${distance}${time}` : ''}`
    })
  }

  if (row.payment_plans?.length) {
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

  const sheet = cleanRelation('cost_sheet', row.cost_sheet)
  if (sheet) facts.cost_sheet = sheet

  // ── Analyst intelligence ───────────────────────────────────────────────────
  // base.ts rules 13-15 instruct the model to reason from decision_thesis,
  // why_buy, why_avoid, tier and walk_away_conditions — and none of them were
  // ever put in the prompt, so the model was told to use data it never received.
  // stripRelationInternals also enforces the PUBLISHED gate here: DRAFT and
  // IN_REVIEW analyst opinion must not reach a buyer.
  const decision = cleanRelation('decision_profile', row.decision_profile)
  if (decision) {
    // The four *_intelligence narratives are the largest single item in the
    // block — 1,556 of 2,514 characters of decision_profile on a fully-seeded
    // record, ~19% of the whole thing — and no prompt rule names any of them.
    // Rules 13-15 name decision_thesis, why_buy, why_avoid, tier and
    // walk_away_conditions; best_for / not_ideal_for feed persona matching.
    //
    // They became a per-turn cost on 30 Aug, when a bulk pass filled
    // decision_profile for the 189 projects that had none. Before that the
    // majority of turns never carried them and the budget was never tested.
    //
    // So they follow the same rule as price_history and specifications: pulled
    // in when the question is actually asking for that depth. `deep_reasoning`
    // is set for comparisons and multi-constraint advisory turns, which is
    // exactly where a market or financial narrative earns its tokens.
    facts.decision_profile = options.topics?.has('deep_reasoning')
      ? decision
      : Object.fromEntries(Object.entries(decision).filter(([k]) => !DEEP_NARRATIVE_KEYS.has(k)))
  }

  const recommendation = cleanRelation('recommendation_profile', row.recommendation_profile)
  if (recommendation) facts.recommendation_profile = recommendation

  const persona = cleanRelation('persona_profile', row.persona_profile)
  if (persona) facts.buyer_fit = persona

  // ── Heavy, topic-gated relations ───────────────────────────────────────────
  // Included only when the question is about them. On a fully-seeded record
  // these three are ~35% of the block, and a turn asking "is it pet friendly"
  // has no use for six price snapshots and thirty fittings.
  const topics = options.topics

  /**
   * Price history, carrying whether the points were observed.
   *
   * 1,400 of our 1,680 `price_history` rows have `source:
   * 'historical_benchmark'` and step by an identical amount each quarter — 8,990,
   * 10,540, 12,090 — which is a generated arithmetic series, not a market
   * observation. Handed to the model as bare numbers it does exactly what the
   * numbers invite: measured live, "how much has Godrej Woods appreciated"
   * returned "a 72.44% appreciation … a strong 5-year CAGR supported by metro and
   * expressway upgrades", every digit of it derived from a constant.
   *
   * So the block states what the series is. An unobserved series arrives with an
   * explicit instruction not to derive a rate from it, because the alternative —
   * withholding the rows — loses the honest answer too: the buyer asked what we
   * hold, and we do hold these numbers. Showing the points and withholding the
   * conclusion is the shape `yieldTable.renderPriceChangeTable` uses, and the two
   * must not disagree.
   */
  if (topics?.has('price_history') && row.price_history?.length) {
    const series = row.price_history.slice(-maxItems)
    const OBSERVED = new Set(['market_verified_2026', 'active_market_listing', 'admin_update'])
    const observedPoints = series.filter(
      h => typeof h.source === 'string' && OBSERVED.has(h.source),
    ).length

    facts.price_history = series.map(h => cleanRelation('price_history', h)).filter(Boolean)
    /**
     * A STATEMENT about the data, never an instruction to the model.
     *
     * The first version read "Do NOT compute or state a percentage change, a
     * CAGR, or an annual growth rate from them" — and the model printed that
     * sentence to the buyer verbatim as the body of its answer. Everything in
     * this block is quotable by design: it is the facts block, and the whole
     * point is that the model repeats what is in it. An imperative dropped in
     * here is an internal prompt handed to the buyer, which the security rules
     * forbid outright.
     *
     * So it describes what the numbers ARE. A model that repeats this one has
     * said something true and useful. Handling rules belong in the system prompt
     * — `YIELD_TABLE_SHOWN` in `prompts/base.ts` carries them.
     */
    facts.price_history_basis =
      observedPoints >= 2
        ? `${observedPoints} of these price points are observed market prices, recorded on the dates shown.`
        : 'These figures are internal benchmark records, not prices we observed being paid. They were generated on a fixed step and carry no market signal, so the interval between them does not measure anything.'
  }

  if (topics?.has('construction') && row.construction_milestones?.length) {
    facts.construction_milestones = row.construction_milestones
      .slice(0, maxItems)
      .map(m => cleanRelation('construction_milestones', m))
      .filter(Boolean)
  }

  // Fittings and finishes: brand-level detail buyers ask about by name.
  if (topics?.has('specifications') && row.spec_items?.length) {
    facts.specifications = row.spec_items.slice(0, 30).map(s => {
      const brand = s.brand ? ` (${s.brand})` : ''
      return `${s.category ? `${s.category}: ` : ''}${s.label} — ${s.value}${brand}`
    })
  }

  /**
   * Three relations `ALLOWED_RELATIONS` has permitted since before this file
   * existed, and nothing had ever asked the database for them — added 7 Sep
   * 2026. Each backs a real section of the project detail page that the chat
   * could not previously discuss at all.
   */

  // Competitor comparisons — small, per-project, and inherently comparison
  // content, so gated the same as decision_profile's narrative fields rather
  // than shipped on every ordinary turn. `project_competitors` is still a
  // real tool for a turn that has no facts block at all; this is the fast
  // path when one is already being built.
  if (topics?.has('deep_reasoning') && row.competitors?.length) {
    facts.competitors = row.competitors
      .slice(0, 5)
      .map(c => cleanRelation('competitors', c))
      .filter(Boolean)
  }

  // Channel partners — small (a handful per project at most), so included
  // unconditionally like builder. The interesting data is nested one level
  // down inside the junction row; cleaning the junction row alone would
  // JSON.stringify the nested channel_partner object whole, which would ship
  // its commission rate and lead-conversion numbers verbatim. Cleaned
  // separately, then merged back in.
  if (row.channel_partners?.length) {
    const partners = row.channel_partners
      .map(pcp => {
        const cleaned = cleanRelation('channel_partner', pcp.channel_partner)
        if (!cleaned) return null
        return pcp.is_featured ? { ...cleaned, featured: 'yes' } : cleaned
      })
      .filter((p): p is Record<string, unknown> => p !== null)
    if (partners.length) facts.channel_partners = partners
  }

  // Unit-level availability — can be hundreds of rows on a large project, so
  // topic-gated behind an explicit ask rather than shipped by default. No
  // RELATION_INTERNAL_FIELDS entry needed: UNIVERSAL_INTERNAL already covers
  // every bookkeeping column this relation carries (id, project_id,
  // unit_type_id, created_at) and nothing else on it is internal.
  if (topics?.has('availability') && row.unit_inventory?.length) {
    facts.unit_inventory = row.unit_inventory
      .slice(0, maxItems)
      .map(u => cleanRelation('unit_inventory', u))
      .filter(Boolean)
  }

  return facts
}
