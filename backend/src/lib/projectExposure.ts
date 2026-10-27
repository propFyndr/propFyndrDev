/**
 * Field exposure policy for Project data leaving the server.
 *
 * Every handler that reads a project and puts any part of it into an LLM prompt
 * or an SSE frame must go through here. Two problems this exists to stop:
 *
 * 1. PII / cross-tenant leaks. `Project` has relations to other people's data —
 *    `saved_by` (SavedProperty), `chat_sessions` (ChatSession) and
 *    `property_feedback` (PropertyFeedback). A single `include: { saved_by: true }`
 *    in a future handler would put other users' records into a prompt. Nothing
 *    prevented that before; FORBIDDEN_RELATIONS + assertNoForbiddenRelations do.
 *
 * 2. Internal mechanics leaking. `embedding` is a pgvector column (enormous, and
 *    it would be shredded into tokens), `ai_search_keywords` exposes how ranking
 *    and matching work, and `builder_theme` carries a commercial branding
 *    arrangement including `active_until`. None of these belong in an answer.
 *
 * The allowlist is a Prisma `select`, so enforcement happens at query time and
 * the forbidden columns are never read at all. `redactProject` is defence in
 * depth for rows that arrive from somewhere else.
 *
 * Adding a column to schema.prisma does NOT automatically expose it: it is
 * absent from PROJECT_PUBLIC_SELECT until someone classifies it here, and
 * projectExposure.test.ts fails on any unclassified column so that decision
 * cannot be skipped.
 */

/**
 * Project relations that point at other users' data. Never selectable in any
 * query whose result reaches a prompt or a response body.
 */
// field_drafts holds proposed, unreviewed values with their sources. A draft is not a fact
// until a person promotes it, so it must never reach a buyer or a prompt.
export const FORBIDDEN_RELATIONS = ['saved_by', 'chat_sessions', 'property_feedback', 'field_drafts'] as const

/**
 * Scalar columns that must never leave the server, with the reason. Kept as a
 * map rather than a list so the test can report *why* when one is exposed.
 */
export const INTERNAL_ONLY_FIELDS: Record<string, string> = {
  embedding: 'pgvector column — enormous, and meaningless as prompt text',
  ai_search_keywords: 'internal retrieval keywords — reveals how matching works',
  builder_theme: 'commercial branding arrangement, includes active_until',
  builder_id: 'raw foreign key — the builder relation carries the usable data',
  created_at: 'row bookkeeping, not a project fact',
  updated_at: 'row bookkeeping, not a project fact',
  publish_status: 'publish-gate lifecycle (draft/live), not a project fact a buyer asked about',
  archived_duplicate_of: 'record-lifecycle bookkeeping from the dedup migration, not a project fact a buyer asked about',
  // Everything else that used to sit here (templated columns, analyst scores, forward-looking
  // estimates) is now public: owner policy 2026-10-27, see PROJECT_PUBLIC_SELECT.
}

/**
 * Every Project scalar the buyer may see. Passed straight to Prisma as a
 * `select`, so anything absent is never fetched.
 */
export const PROJECT_PUBLIC_SELECT = {
  // Identity & location
  id: true,
  slug: true,
  name: true,
  tagline: true,
  city: true,
  state: true,
  country: true,
  sector: true,
  address: true,
  lat: true,
  lng: true,

  // Physical description
  land_area_acres: true,
  total_units: true,
  total_towers: true,
  floors: true,
  open_space_pct: true,
  green_rating: true,
  has_duplex: true,
  has_penthouse: true,
  project_type: true,
  design_theme: true,
  architect: true,
  interior_designer: true,
  description: true,
  long_description: true,
  hero_image_url: true,
  marketing_claims: true,

  // Nearby counts

  // Status & possession
  status: true,
  launch_date: true,
  possession_date: true,
  possession_label: true,
  possession_confidence: true,
  possession_confidence_note: true,
  /**
   * Withheld: the column holds a placeholder, not a handover date.
   *
   * Across 280 projects it takes exactly three values — null on 189,
   * "Delivered" on 62, and "Q4 2026" on 29. On 23 of those 29 it contradicts
   * the project's own `possession_date` by up to 29 months, and both were being
   * shown to the buyer in the same answer. `possession_date` and
   * `possession_label` already carry the real answer.
   *
   * Set back to `true` once the values are real; `npm run audit:data` fails
   * while any of them still disagree.
   */
  expected_handover_quarter: true,
  foundation_stone_date: true,

  // Legal, compliance, disclosure — buyers are entitled to all of this
  rera_number: true,
  rera_url: true,
  rera_valid_until: true,
  oc_obtained: true,
  oc_obtained_date: true,
  oc_valid_until: true,
  oc_restrictions: true,
  occupancy_certificate_status: true,
  occupancy_expected_date: true,
  legal_flag_detail: true,
  litigation_count: true,
  ongoing_litigation_count: true,
  litigation_types: true,
  nclt_moratorium_active: true,
  project_risk_flag: true,
  escrow_bank_name: true,
  registry_status: true,
  registry_embargo_reasons: true,
  land_title_clear: true,
  fir_against_project: true,
  gst_pass_through: true,

  // Location intelligence
  location_advantages: true,
  location_concerns: true,
  location_verdict: true,
  walkability_score: true,
  commute_matrix: true,
  top_school_distance_km: true,
  hospital_distance_km: true,
  airport_distance_km: true,
  police_station_distance_km: true,

  // Environment & safety
  flood_waterlogging_risk: true,
  flood_zone: true,
  air_quality_index_avg: true,
  green_cover_percent: true,
  has_security_24x7: true,
  has_cctv: true,
  street_lights: true,

  // Pricing (headline only — the cost sheet relation carries the breakdown)
  price_min_cr: true,
  price_range_label: true,

  // Ownership & eligibility terms
  rental_income_allowed: true,
  foreign_currency_payment_allowed: true,

  // Build quality
  // buyer_satisfaction_rating is deliberately absent — see SYNTHETIC_FIELDS.

  // Utilities & living standards
  water_source: true,
  dg_power_rate_per_unit: true,
  maintenance_per_sqft_monthly: true,
  ceiling_height_ft: true,
  lifts_per_tower: true,

  // Forensic Due Diligence & Living Quality (Day 3 Expansion)
  oc_status: true,
  oc_details: true,
  amitabh_kant_clearance: true,
  bank_apf_codes: true,
  water_source_type: true,
  water_tds_range: true,
  shahdara_drain_impact: true,
  lift_act_compliant: true,
  power_supply_type: true,
  all_in_cost_multiplier: true,

  // Owner policy (2026-10-27): every project fact we hold is answered as stored, whoever wrote
  // it. These were withheld as templated, analyst-set or forward-looking; they are stated now.
  market_demand_score: true,
  appreciation_potential_5yr: true,
  rental_yield_annual_percent: true,
  competing_projects_nearby: true,
  rera_compliance_score: true,
  nclt_status: true,
  approvals_status: true,
  handover_defect_rate: true,
  noise_level_db: true,
  construction_quality_rating: true,
  college_distance_km: true,
  proximity_to_industrial: true,
  shared_walls_type: true,
  women_safety_score: true,
  resale_lock_in_months: true,
  occupancy_restriction_months: true,
  nri_approval_months: true,
  schools_nearby_count: true,
  hospitals_nearby_count: true,
  restaurants_nearby_count: true,
  it_parks_nearby_count: true,
  banks_nearby_count: true,
  shopping_nearby_count: true,
  buyer_satisfaction_rating: true,
} as const

export type PublicProjectField = keyof typeof PROJECT_PUBLIC_SELECT

const PUBLIC_FIELD_SET: ReadonlySet<string> = new Set(Object.keys(PROJECT_PUBLIC_SELECT))

/**
 * Relations that are safe to include alongside the public select. Listed
 * explicitly so `assertNoForbiddenRelations` can tell "not allowed" from
 * "not yet classified".
 */
export const ALLOWED_RELATIONS = [
  'builder',
  'rera_registrations',
  'videos',
  'amenities',
  'connectivity',
  'unit_types',
  'payment_plans',
  'cost_sheet',
  'price_history',
  'construction_milestones',
  'construction_updates',
  'lifecycle_updates',
  'unit_inventory',
  'images',
  'spec_items',
  'channel_partners',
  'competitors',
  'referenced_as_competitor',
  'decision_profile',
] as const

/**
 * Throws if a Prisma include/select object asks for a relation carrying other
 * users' data. Call it on any dynamically-built include.
 */
export function assertNoForbiddenRelations(shape: Record<string, unknown>): void {
  for (const relation of FORBIDDEN_RELATIONS) {
    if (shape[relation]) {
      throw new Error(
        `projectExposure: relation "${relation}" holds other users' data and must never be selected into a prompt or response.`,
      )
    }
  }
}

/**
 * Strips every key that is not on the public allowlist.
 *
 * Defence in depth: use the select at query time wherever possible, and run
 * this on any project row that arrived from a wider query, a cache, or JSON
 * persisted on a previous turn.
 *
 * Relation keys on ALLOWED_RELATIONS are kept but cleaned: `dna` dropped,
 * unpublished decision/recommendation profiles dropped, each relation's
 * analyst-only fields (RELATION_INTERNAL_FIELDS) and opaque scores removed.
 * They used to be "preserved untouched", which sent a `builder: true` row's
 * `outstanding_dues_cr`, `executives` and `portal_subdomain`, draft profiles'
 * `admin_notes`, and channel partners' commission rates to buyers on every
 * card emit. Row ids are kept — the frontend keys lists on them, and an id is
 * not a disclosure.
 */
export function redactProject<T extends Record<string, unknown>>(row: T): Partial<T> {
  const allowedRelations: ReadonlySet<string> = new Set(ALLOWED_RELATIONS)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (PUBLIC_FIELD_SET.has(key)) {
      out[key] = value
    } else if (allowedRelations.has(key)) {
      const cleaned = redactRelation(key, value)
      if (cleaned !== undefined) out[key] = cleaned
    }
  }
  return stripOpaqueScores(out) as Partial<T>
}

/**
 * For card payloads leaving the server. Unlike `redactProject` this is a
 * blocklist: card objects carry ranker output (reasons, distances, match
 * labels) that is not a column and must survive. It removes internal-only
 * columns, relations holding other users' data, synthetic constants and
 * opaque scores, and cleans every allowed relation the same way.
 */
export function redactForResponse<T extends Record<string, unknown>>(row: T): Partial<T> {
  const allowedRelations: ReadonlySet<string> = new Set(ALLOWED_RELATIONS)
  const drop = new Set<string>([
    ...Object.keys(INTERNAL_ONLY_FIELDS).filter((k) => k !== 'created_at' && k !== 'updated_at' && k !== 'builder_id'),
    ...FORBIDDEN_RELATIONS,
    // A relation in this list is, by definition, never on ALLOWED_RELATIONS —
    // so without this, redactForResponse's blocklist (fail-open by design,
    // unlike redactProject's allowlist) would pass a stray key like `dna`
    // straight through instead of stripping it.
    ...INTERNAL_ONLY_RELATIONS,
    ...SYNTHETIC_FIELDS.filter((f) => f.startsWith('Project.')).map((f) => f.slice('Project.'.length)),
  ])
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (drop.has(key)) continue
    if (allowedRelations.has(key)) {
      const cleaned = redactRelation(key, value)
      if (cleaned !== undefined) out[key] = cleaned
      continue
    }
    out[key] = value
  }
  return stripOpaqueScores(out) as Partial<T>
}

function redactRelation(relation: string, value: unknown): unknown {
  if ((INTERNAL_ONLY_RELATIONS as readonly string[]).includes(relation)) return undefined
  if (Array.isArray(value)) {
    return value.map((v) => redactRelation(relation, v)).filter((v) => v !== undefined && v !== null)
  }
  if (!value || typeof value !== 'object') return value
  if ((PUBLISH_GATED_RELATIONS as readonly string[]).includes(relation) && !isPublished(value)) return null
  const banned = new Set<string>([
    ...(RELATION_INTERNAL_FIELDS[relation] ?? []),
    ...SYNTHETIC_FIELDS.filter((f) => f.startsWith(`${relation}.`)).map((f) => f.slice(relation.length + 1)),
  ])
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (banned.has(k)) continue
    // The junction row nests the partner itself under `channel_partner`.
    clean[k] = k === 'channel_partner' ? redactRelation('channel_partner', v) : v
  }
  return stripOpaqueScores(clean)
}

/** True when the column may be shown to a buyer. */
export function isPublicField(field: string): boolean {
  return PUBLIC_FIELD_SET.has(field)
}

// ─────────────────────────────────────────────────────────────────────────────
// Relation-level policy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bookkeeping present on effectively every relation row. Stripped everywhere —
 * a buyer has no use for a uuid, and a raw foreign key invites the model to
 * echo it.
 */
export const UNIVERSAL_INTERNAL = ['id', 'project_id', 'unit_type_id', 'channel_partner_id', 'created_at', 'updated_at']

/**
 * Per-relation fields that are analyst- or operator-facing only.
 *
 * `advisor_notes`, `admin_notes` and `internal_confidence` are where an analyst
 * records hedges and internal reasoning. They are written for the sales desk,
 * not the buyer, and putting them in a prompt is how they end up quoted back.
 */
export const RELATION_INTERNAL_FIELDS: Record<string, readonly string[]> = {
  decision_profile: ['advisor_notes', 'recommendation_notes', 'confidence_sources', 'verified_by', 'last_verified_at', 'status'],
  cost_sheet: ['verified_by', 'verified_at'],
  payment_plans: ['verified_by', 'verified_at', 'notes'],
  spec_items: ['verified_by', 'verified_at', 'notes'],
  price_history: ['verified_by', 'verified_at', 'notes'],
  construction_milestones: ['verified_by', 'verified_at', 'notes'],
  construction_updates: ['verified_by', 'verified_at'],
  lifecycle_updates: ['verified_by', 'verified_at'],
  /**
   * Added 7 Sep 2026 — `buildProjectFacts` used to project `builder.name` and
   * nothing else, which is why `builderReputationHandler` (215 lines of
   * hand-built table) exists at all: it was the only way to answer a builder
   * question, because the generic facts block had nothing to answer it with.
   * Widening this relation is what lets the generic path retire that handler.
   *
   * The opaque 0-100 analyst scores (delivery_score, construction_quality_score,
   * rera_compliance_score, financial_hygiene_score) are stripped by
   * `stripOpaqueScores`, not listed here — same reason as BUYER_OPAQUE_SCORES
   * everywhere else: a number a buyer cannot check, about the exact developer
   * they are trying to assess, reads as a rating. `cin`, `legal_entities` and
   * `executives` are corporate-registry detail with no buyer-facing use case in
   * this product. `outstanding_dues_cr` is the builder's own financial distress
   * figure — the kind of thing that needs full context to state responsibly,
   * which a bare number in a facts block does not provide; `insolvency_history`
   * and `legal_flag` already carry the buyer-facing version of this signal.
   * `audit_flags_log`, `verification_level`, `data_source` and
   * `intelligence_completeness` are about our own process, not a fact about the
   * developer.
   */
  builder: [
    // cin, legal_entities, executives and outstanding_dues_cr are stated (owner policy 2026-10-27).
    'audit_flags_log', 'verification_level', 'data_source', 'intelligence_completeness',
    // Same rule as decision_profile / recommendation_profile / persona_profile
    // above: when we last checked a record is our own process detail, not a
    // fact about the developer.
    'last_verified_at',
    // The host a builder's own console answers on. It says who has a portal
    // with us — a commercial-relationship detail — and answers a question no
    // buyer asked. Nothing buyer-facing reads it; the tenant routing resolves
    // it from the request host on the server.
    'portal_subdomain',
  ],
  /**
   * `ProjectCompetitor` rows — added 7 Sep 2026 alongside `channel_partner`
   * below, wiring `ALLOWED_RELATIONS` entries that were permitted but never
   * requested. `competitor_slug` is the same class of waste as builder's own
   * `slug` — an internal identifier no prompt rule reads — and
   * `competitor_project_id` is a raw foreign key, the same reason
   * `builder_id` stays off `Project` itself.
   */
  competitors: ['competitor_slug', 'competitor_project_id'],
  /**
   * `ChannelPartner`, nested inside the `ProjectChannelPartner` junction row a
   * project's `channel_partners` relation actually returns. `total_leads`,
   * `total_conversions`, `conversion_rate_pct`, `commission_rate_pct` and
   * `payment_terms` are our own commercial arrangement with the partner —
   * what we pay them and how well they convert for us — not a fact about the
   * partner a buyer has any business seeing. `verification_date` and
   * `is_active` are process state, same reason as `builder.last_verified_at`.
   */
  channel_partner: [
    'slug', 'total_leads', 'total_conversions', 'conversion_rate_pct',
    'commission_rate_pct', 'payment_terms', 'verification_date', 'is_active',
  ],
}

/**
 * Relations excluded from buyer-facing output entirely.
 *
 * `dna`, `persona_profile` and `recommendation_profile` were dropped from the
 * schema entirely in the lean-schema migration (2026-10) — a set of
 * manually-entered 0-100 analyst scores and a tier that was STRONG_BUY on all
 * 395 rows, with no real signal. No live Prisma query can produce a row
 * carrying any of these three keys any more. They stay listed here anyway:
 * this module's own docstring is explicit that `redactProject`/
 * `redactForResponse` exist as defence in depth for "any project row that
 * arrived from a wider query, a cache, or JSON persisted on a previous
 * turn" — a row cached or session-persisted from before this migration can
 * still carry one of these keys, and dropping them from this list would
 * silently stop stripping it.
 */
export const INTERNAL_ONLY_RELATIONS = ['dna', 'persona_profile', 'recommendation_profile'] as const

/**
 * Relations carrying an IntelligenceStatus. Analyst content is DRAFT until
 * someone publishes it, and only PUBLISHED may reach a buyer — nothing in the
 * chat path enforced that, so unreviewed opinion could be quoted as advisory.
 */
export const PUBLISH_GATED_RELATIONS = ['decision_profile'] as const

/** True when a publish-gated relation row is cleared for buyer-facing use. */
export function isPublished(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false
  const status = (row as { status?: unknown }).status
  // A relation with no status column is not gated; treat it as visible.
  return status === undefined || status === null || status === 'PUBLISHED'
}

/**
 * Strips bookkeeping and analyst-only fields from one relation row.
 * Returns null when the row is publish-gated and not yet PUBLISHED.
 */
export function stripRelationInternals<T extends Record<string, unknown>>(
  relation: string,
  row: T,
): Partial<T> | null {
  if ((INTERNAL_ONLY_RELATIONS as readonly string[]).includes(relation)) return null
  if ((PUBLISH_GATED_RELATIONS as readonly string[]).includes(relation) && !isPublished(row)) return null

  const banned = new Set<string>([...UNIVERSAL_INTERNAL, ...(RELATION_INTERNAL_FIELDS[relation] ?? [])])
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (banned.has(key)) continue
    out[key] = value
  }
  return out as Partial<T>
}

/**
 * Fields that exist, are populated, are marked PUBLISHED — and still carry no
 * information, because every row holds the same value.
 *
 * This is a different failure from a missing field, and more dangerous. A gap
 * is visible: the answer says we do not hold it. A batch-templated default is
 * invisible: it renders as a confident, specific figure, it passes the publish
 * gate, and nothing downstream can tell it from a researched one.
 *
 * Measured against the live database on 4 Sep 2026, both after a buyer was
 * shown them verbatim in one answer — "the project holds a STRONG_BUY
 * recommendation tier with a buyer satisfaction rating of 4.7 out of 5":
 *
 *   recommendation_profile.tier      280 rows, 280 of them STRONG_BUY
 *   Project.buyer_satisfaction_rating 94 populated, 92 of them exactly 4.7
 *
 * A tier that is STRONG_BUY for every project we hold is not a recommendation,
 * it is a constant. A satisfaction rating identical to two significant figures
 * across ninety-two projects was not collected from ninety-two sets of buyers.
 * Presenting either is the fake confidence score CLAUDE.md forbids, and the
 * second one additionally implies a survey we never ran.
 *
 * Both are withheld at the exposure layer rather than patched out of one
 * renderer, because the leak was in the generic facts block — which projects
 * the whole allowlist and would have found them again through any new path.
 *
 * TO REVERSE THIS: re-measure. If a field has become genuinely differentiated,
 * remove it from this list in the same commit that shows the new distribution.
 * `projectExposure.test.ts` pins the reasoning, not the values, so a real
 * spread of tiers is a deliberate re-exposure and not an accident.
 *
 * Empty since the lean-schema migration (2026-10): both original entries
 * named a column the migration dropped from the schema entirely —
 * `recommendation_profile.tier` with its whole relation, and
 * `Project.buyer_satisfaction_rating` directly. Kept as a typed empty tuple
 * for the same reason INTERNAL_ONLY_RELATIONS is above: the call sites that
 * filter against it don't need a follow-up edit the next time a real
 * batch-templated field is found.
 */
export const SYNTHETIC_FIELDS: readonly string[] = []

/**
 * Columns whose schema default is a specific, checkable, invented figure — and
 * the value that means "nobody filled this in".
 *
 * Found while removing `Builder.projects_delivered_count @default(18)`. That
 * one had never fired. These three had:
 *
 *   Project.ceiling_height_ft      190 of 280 rows are exactly 10.2
 *   Project.mobile_network_rating  219 of 280 rows are exactly 4
 *   Project.lifts_per_tower        166 of 280 rows are exactly 3
 *
 * Unlike `SYNTHETIC_FIELDS` these are not constants — around a third of each
 * column is real, researched data. That is what makes them worse to render
 * rather than better: for any single project the default is indistinguishable
 * from a measurement, so "10.2 ft ceilings" reads as a verified spec on two
 * projects out of three where nobody ever measured. A buyer plans around a
 * ceiling height and discovers it on the site visit.
 *
 * The defaults are removed from `schema.prisma` so no future row inherits one.
 * For rows that already have one, the value is withheld — a fact whose only
 * provenance is a schema line is the `missing` tier, not the `verified` one.
 *
 * The cost is real and accepted: a project genuinely built to 10.2 ft loses a
 * true fact. Saying "not recorded" about something true is recoverable on the
 * site visit; asserting a specific wrong measurement is not.
 */
// Owner policy (2026-10-27): a stored value is stated even when it equals the column default
// (ceiling_height_ft 10.2, lifts_per_tower 3, insolvency_history false). Kept as the hook.
export const SCHEMA_DEFAULT_SENTINELS: Record<string, number | boolean | string> = {}

/**
 * True when this value carries no provenance beyond a schema default.
 *
 * Float comparison is deliberate and safe here: the sentinel is the literal
 * that Postgres wrote, so an untouched row holds exactly it.
 */
export function isSchemaDefault(field: string, value: unknown): boolean {
  const sentinel = SCHEMA_DEFAULT_SENTINELS[field]
  return sentinel !== undefined && typeof value === typeof sentinel && value === sentinel
}

/**
 * Analyst-set 0–100 numbers that must never reach a buyer.
 *
 * Every one of these is entered by hand, frequently unverified, and — this is
 * the part that matters — indistinguishable to a buyer from a measured rating.
 * `routes/builders.ts` already reasoned this out for `rera_compliance_score`
 * and left it unselected; the chat path never followed, so six siblings kept
 * flowing into prompts and onto the screen.
 *
 * Measured in the demo replay: "Show me the best projects between 1 and 2
 * crore" came back citing "a strong builder delivery score (92)", "a high
 * overall score (89)" and "a moderate delivery score (87)". A buyer cannot tell
 * what 87 is out of, who set it, or what separates it from 92 — which is
 * exactly the fake confidence score CLAUDE.md forbids, arriving by a route
 * nobody had closed.
 *
 * They remain useful and remain in use: `scoringEngine`, `cityShelf` and
 * `discovery/projects` all rank on them. Ranking with a number is fine.
 * Printing it is not. The interpretable facts underneath — projects delivered,
 * average handover delay, litigation count, RERA promoter id, legal flag —
 * are what a buyer can actually check, and they stay.
 */
// Owner policy (2026-10-27): analyst scores are stated as stored. Kept as the hook.
export const BUYER_OPAQUE_SCORES: readonly string[] = []

/** Drops every opaque score from an object bound for a prompt or a response. */
export function stripOpaqueScores<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Record<string, unknown> = { ...row }
  for (const field of BUYER_OPAQUE_SCORES) delete out[field]
  return out as Partial<T>
}
