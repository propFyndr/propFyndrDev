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
export const FORBIDDEN_RELATIONS = ['saved_by', 'chat_sessions', 'property_feedback'] as const

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
  market_demand_score: 'internal analyst score; V1 scope excludes investment analysis',
  appreciation_potential_5yr: 'forward-looking estimate — the prompt forbids presenting projections as fact',
  rental_yield_annual_percent: 'forward-looking estimate — same rule',
  competing_projects_nearby: 'internal ranking input',
  rera_compliance_score:
    'analyst-set 0-100 number — a buyer cannot check it and reads it as the regulator’s verdict; ' +
    'rera_number and rera_url are the checkable facts. See BUYER_OPAQUE_SCORES.',

  // ─── Batch-templated columns, found by `npm run audit:synthetic` ─────────
  //
  // Every entry below carries one value across effectively every populated row.
  // A column that does not vary is not a measurement, whatever its name says,
  // and rendering one hands a buyer a specific figure nobody took.
  //
  // The first two are the reason this sweep exists at all, and they are legal
  // claims rather than conveniences:
  nclt_status:
    'reads "Clean - No NCLT Moratorium" on 100% of the 94 populated rows — INCLUDING Amrapali projects, ' +
    'whose own builder record in this database says "Amrapali Group (NBCC Supervised)". The Supreme Court ' +
    'cancelled Amrapali\'s RERA registrations in 2019 and handed the projects to NBCC. Measured live before ' +
    'withholding: the chat told a buyer Amrapali Crystal Homes "has a clean legal standing with no active ' +
    'NCLT insolvency proceedings". `nclt_moratorium_active` is the real column and stays exposed.',
  approvals_status:
    'reads "Fully RERA & Authority Approved" on 100% of the 207 populated rows, Amrapali and Jaypee included. ' +
    'A blanket approval claim across two thirds of inventory is not an approval record.',

  // Physical and environmental measurements nobody took:
  handover_defect_rate: 'exactly 1.2 on all 91 populated rows — one value, so not a measurement',
  noise_level_db: '48 dB on 93 of 95 populated rows — a specific acoustic reading, taken once and copied',
  construction_quality_rating: '4.6 on 92 of 94 populated rows — the same shape as buyer_satisfaction_rating',
  college_distance_km: 'exactly 5 km on all 91 populated rows',
  proximity_to_industrial: '"Clean Zone (3+ km from industrial belt)" on all 91 populated rows',
  shared_walls_type: 'one layout claim on 91% of all 280 rows',
  women_safety_score: 'two values across all 280 rows (85 and 90) — a score with two possible values is not a score',

  // Contractual terms nobody checked:
  resale_lock_in_months: 'exactly 36 on all 95 populated rows',
  occupancy_restriction_months: 'exactly 0 on all 91 populated rows',
  nri_approval_months: 'exactly 1 on all 91 populated rows',

  // The nearby counts are one import repeated: 81 of the 91 populated rows
  // carry the identical set — 8 schools, 5 hospitals, 20 restaurants, 10 IT
  // parks, 12 banks, 4 shopping. The `connectivity` relation holds the real,
  // per-project landmarks with distances and is unaffected.
  schools_nearby_count: 'value 8 on 81 of 91 populated rows — one import repeated',
  hospitals_nearby_count: 'value 5 on 81 of 91 populated rows — one import repeated',
  restaurants_nearby_count: 'value 20 on 81 of 91 populated rows — one import repeated',
  it_parks_nearby_count: 'value 10 on 81 of 91 populated rows — one import repeated',
  banks_nearby_count: 'value 12 on 81 of 91 populated rows — one import repeated',
  shopping_nearby_count: 'value 4 on 81 of 91 populated rows — one import repeated',
  //
  // DELIBERATELY NOT WITHHELD, and the distinction is the point:
  //   ongoing_litigation_count  0×239, 3×19, 5×11, 6×8, 2×2, 4×1
  //   litigation_count          same shape
  //   average_builder_delay_months  0×62, 3×29
  // Concentrated because most projects genuinely have no litigation and most
  // builders genuinely deliver on time. Withholding those would hide good news
  // a buyer is entitled to, which is the opposite error and just as real.
  buyer_satisfaction_rating:
    'batch-templated default, not a survey — 92 of the 94 populated rows are exactly 4.7 ' +
    '(measured 4 Sep 2026). Presenting it implies buyer research we never did. See SYNTHETIC_FIELDS.',
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
  expected_handover_quarter: false,
  foundation_stone_date: true,
  average_builder_delay_months: true,

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
  legal_flag: true,
  legal_flag_detail: true,
  litigation_count: true,
  ongoing_litigation_count: true,
  litigation_types: true,
  nclt_moratorium_active: true,
  project_risk_flag: true,
  escrow_verified: true,
  escrow_bank_name: true,
  registry_status: true,
  registry_embargo_reasons: true,
  land_title_clear: true,
  fir_against_project: true,
  authority_dues_cleared: true,
  land_tenure: true,
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
  aqi_annual_avg: true,
  air_quality_index_avg: true,
  green_cover_percent: true,
  has_security_24x7: true,
  has_cctv: true,
  street_lights: true,

  // Pricing (headline only — the cost sheet relation carries the breakdown)
  price_min_cr: true,
  price_range_label: true,
  price_includes_plc: true,
  price_includes_club: true,
  price_includes_taxes: true,

  // Ownership & eligibility terms
  rental_income_allowed: true,
  nri_eligible: true,
  foreign_currency_payment_allowed: true,
  pet_friendly: true,
  bachelor_tenants_allowed: true,

  // Build quality
  // buyer_satisfaction_rating is deliberately absent — see SYNTHETIC_FIELDS.

  // Vastu & orientation
  vastu_compliant: true,
  north_facing_units: true,
  east_facing_preferred: true,

  // Utilities & living standards
  water_source: true,
  dg_power_rate_per_unit: true,
  maintenance_per_sqft_monthly: true,
  has_png_gas_pipeline: true,
  mobile_network_rating: true,
  ceiling_height_ft: true,
  lifts_per_tower: true,
  has_service_lift: true,
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
  'persona_profile',
  'recommendation_profile',
  'dna',
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
 * Relation keys on ALLOWED_RELATIONS are preserved untouched — they carry their
 * own shapes and are filtered by their own resolvers.
 */
export function redactProject<T extends Record<string, unknown>>(row: T): Partial<T> {
  const allowedRelations: ReadonlySet<string> = new Set(ALLOWED_RELATIONS)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (PUBLIC_FIELD_SET.has(key) || allowedRelations.has(key)) {
      out[key] = value
    }
  }
  return out as Partial<T>
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
  recommendation_profile: ['internal_confidence', 'admin_notes', 'verified_by', 'last_verified_at', 'status', 'tier'],
  persona_profile: ['verified_by', 'last_verified_at'],
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
    'cin', 'legal_entities', 'executives', 'outstanding_dues_cr',
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
 * ProjectDna is a set of manually-entered 0-100 analyst scores with
 * last_verified_at commonly null. Handing the model "builder_score: 95" invites
 * it to present an unverified internal number as a rating, which is precisely
 * the "fake confidence score" CLAUDE.md forbids. The buyer-facing narrative
 * lives in decision_profile and recommendation_profile instead; DNA stays an
 * input to ranking.
 */
export const INTERNAL_ONLY_RELATIONS = ['dna'] as const

/**
 * Relations carrying an IntelligenceStatus. Analyst content is DRAFT until
 * someone publishes it, and only PUBLISHED may reach a buyer — nothing in the
 * chat path enforced that, so unreviewed opinion could be quoted as advisory.
 */
export const PUBLISH_GATED_RELATIONS = ['decision_profile', 'recommendation_profile'] as const

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
 */
export const SYNTHETIC_FIELDS = [
  'recommendation_profile.tier',
  'Project.buyer_satisfaction_rating',
] as const

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
export const SCHEMA_DEFAULT_SENTINELS: Record<string, number> = {
  ceiling_height_ft: 10.2,
  mobile_network_rating: 4,
  lifts_per_tower: 3,
}

/**
 * True when this value carries no provenance beyond a schema default.
 *
 * Float comparison is deliberate and safe here: the sentinel is the literal
 * that Postgres wrote, so an untouched row holds exactly it.
 */
export function isSchemaDefault(field: string, value: unknown): boolean {
  const sentinel = SCHEMA_DEFAULT_SENTINELS[field]
  return sentinel !== undefined && typeof value === 'number' && value === sentinel
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
export const BUYER_OPAQUE_SCORES = [
  'delivery_score',
  'construction_quality_score',
  'after_sales_score',
  'buyer_satisfaction_score',
  'rera_compliance_score',
  'overall_score',
  'internal_confidence',
  // Builder-level, added 7 Sep 2026 alongside RELATION_INTERNAL_FIELDS.builder —
  // same class as rera_compliance_score above: an analyst-set 0-100 number
  // about the exact developer a buyer is trying to assess, with nothing a
  // buyer can check behind it.
  'financial_hygiene_score',
] as const

/** Drops every opaque score from an object bound for a prompt or a response. */
export function stripOpaqueScores<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Record<string, unknown> = { ...row }
  for (const field of BUYER_OPAQUE_SCORES) delete out[field]
  return out as Partial<T>
}
