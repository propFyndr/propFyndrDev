/**
 * How a fact is allowed to be presented to a buyer.
 *
 * Several chat handlers used to fill a gap in the database with a plausible
 * literal and ship it under a "Verified …" heading with confidence: 'HIGH' —
 * e.g. answering "does it have a pool?" with "**Yes**, <project> features an
 * Olympic-Size Swimming Pool" when the project had no amenity rows at all, or
 * printing "₹3,50,000 (Covered)" as a specific project's parking charge.
 *
 * CLAUDE.md is explicit: never invent data, never guess unavailable
 * information, never use fake confidence scores. This module is the one place
 * that decides what to say instead, so the decision cannot drift per handler.
 *
 * Four tiers, and the distinction that matters is per-project vs. market-wide:
 *
 *   verified   read from the database for THIS project. State it plainly.
 *   statutory  fixed by law and identical for every project (UP stamp duty,
 *              registration, GST). Safe to state without a project lookup.
 *   market     genuinely typical for Noida but NOT verified for this project.
 *              Usable, but must carry its qualifier every single time.
 *   missing    we do not hold it. Say so and offer the advisory handoff.
 *
 * A project-specific yes/no — does this building have a pool, what does its
 * parking cost — has no market tier. A market average cannot answer it, and a
 * wrong "yes" is discovered on the site visit, which is exactly the trust
 * failure the product exists to avoid.
 */

export type FactTier = 'verified' | 'statutory' | 'market' | 'missing'

/** Qualifier that must accompany any market-tier figure. */
export const MARKET_QUALIFIER = 'typical for Noida — not verified for this project'

/**
 * Honest line for a fact we do not hold, with the handoff.
 *
 * `topic` should read naturally after "the": "cost sheet", "payment plans".
 */
export function unverified(topic: string, projectName?: string): string {
  const scope = projectName ? ` for ${projectName}` : ''
  return `We don't have the ${topic}${scope} verified in our records yet. Our advisory team can pull the developer's official figures — want me to arrange that?`
}

/**
 * Honest answer to a project-specific yes/no we cannot confirm.
 *
 * Deliberately never guesses. "Probably" on an amenity is the same failure as
 * "yes": the buyer plans around it either way.
 */
export function unverifiedFeature(feature: string, projectName: string): string {
  return `Our records for ${projectName} don't list ${feature} either way — the amenity list we hold is incomplete rather than confirmed-absent. Worth checking on a site visit, or our team can confirm with the developer.`
}

/** Renders a market-tier figure with its qualifier attached. */
export function marketFigure(label: string, value: string): string {
  return `${label}: ${value} (${MARKET_QUALIFIER})`
}

/**
 * Confidence to report alongside an answer.
 *
 * Handlers hardcoded confidence: 'HIGH' even on fabricated content, which made
 * the signal worthless. Confidence follows the weakest tier actually used.
 */
export function confidenceFor(tiers: FactTier[]): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (tiers.includes('missing')) return 'LOW'
  if (tiers.includes('market')) return 'MEDIUM'
  return 'HIGH'
}

/**
 * Heading for an answer, honest about what backs it.
 *
 * "Verified X" is reserved for answers built only from this project's own rows.
 */
export function headingFor(topic: string, projectName: string, tiers: FactTier[]): string {
  const confidence = confidenceFor(tiers)
  if (confidence === 'HIGH') return `Verified ${topic}: ${projectName}`
  if (confidence === 'MEDIUM') return `${topic}: ${projectName} (partly market-typical)`
  return `${topic}: ${projectName} (limited verified data)`
}

/**
 * Statutory rates for Uttar Pradesh. Fixed by law, identical for every project,
 * so quoting them without a project lookup is not a guess.
 *
 * Rates change with state budgets — this is the single place to update them.
 * Last reviewed: 2026-08.
 */
export const UP_STATUTORY = {
  stampDutyPct: 7,
  stampDutyFemalePct: 6,
  stampDutyFemaleConcessionCapInr: 10_000,
  registrationPct: 1,
  registrationCapInr: 30_000,
  gstUnderConstructionPct: 5,
  gstReadyToMovePct: 0,
  tdsThresholdInr: 5_000_000,
  tdsPct: 1,
  // GST on society maintenance (central GST law, not UP-specific, but equally
  // fixed): once a member's monthly contribution exceeds the threshold, GST
  // applies to the WHOLE amount, not just the excess.
  maintenanceGstPct: 18,
  maintenanceGstThresholdInr: 7_500,
} as const

/**
 * Ranges that are genuinely market-wide for Noida rather than project-specific.
 *
 * Every consumer must render these through `marketFigure()` so the qualifier
 * travels with the number. They are NOT a substitute for a project's own cost
 * sheet: when we hold one, use it; when we do not, `unverified()` is the answer
 * for the project-specific question, and these may be offered as context only.
 */
export const NOIDA_MARKET_RANGES = {
  coveredParkingInr: '₹3.5–5 Lakh',
  clubMembershipInr: '₹1.5–3 Lakh',
  ifmsPerSqft: '₹50–100 / sq.ft',
  powerBackupInr: '₹1.25–2 Lakh',
  allInclusiveLoadUnderConstructionPct: '12–14% above base price',
  allInclusiveLoadReadyToMovePct: '8–9% above base price',
  // Monthly CAM (common area maintenance), billed on super area.
  maintenancePerSqftMonthly: '₹2.5–4.5 / sq.ft per month on super area',
} as const

/**
 * How Noida property is actually held, and what that costs.
 *
 * The 109-question buyer corpus in /QueriesAndKeywords put ~20 questions here —
 * leasehold vs freehold, Transfer Memorandum, one-time lease rent, why a
 * registry stalls, whether a bank will lend — and we held nothing. Those turns
 * fell to web grounding, which is the same source that once told a buyer
 * Supertech Supernova had "zero litigation and clear title" while our own rows
 * said litigation_count 14 and NCLT_INSOLVENCY.
 *
 * So these live here, as code, for the same reason UP_STATUTORY does.
 *
 * The split below is the whole point and must be preserved when editing:
 *
 *   STRUCTURE  How the tenure works. Fixed by how the authorities allot land,
 *              identical for every project under that authority, and stable
 *              across years. Statutory tier — state it plainly.
 *   BANDS      Real charges whose rate is set per authority circular, per
 *              scheme, and revised. We do NOT hold the current figure for any
 *              specific project. Market tier — every one of these must be
 *              rendered through marketFigure() and must carry the instruction
 *              to confirm the live rate before budgeting on it.
 *
 * A number moved from BANDS to STRUCTURE because it "seems stable" is how a
 * stale transfer-charge percentage ends up quoted to a buyer as fact.
 *
 * Last reviewed: 2026-09. See authorityFacts.test.ts — it fails when this date
 * goes more than twelve months stale, because an unreviewed rate presented with
 * confidence is the failure mode this whole module exists to prevent.
 */
export const AUTHORITY_FACTS_LAST_REVIEWED = '2026-09'

export const NOIDA_AUTHORITY = {
  /** Statutory tier — how the tenure itself works. */
  structure: {
    tenureYears: 90,
    authorities: ['NOIDA', 'GNIDA (Greater Noida)', 'YEIDA (Yamuna Expressway)'] as const,
    /** What the buyer of a flat actually receives. */
    buyerInstrument: 'sub-lease deed',
    /** What they do not receive, however the sales pitch is phrased. */
    notFreehold: true,
  },

  /** Market tier — real, but the rate is per authority circular and is revised. */
  bands: {
    transferChargesPct: '1–5% of current authority premium',
    oneTimeLeaseRentPct: 'about 10% of land premium',
    allInTransactionCostPct: '10–13% of transaction value',
  },
} as const

/**
 * The instruction that must travel with every NOIDA_AUTHORITY.bands figure.
 *
 * Stronger than MARKET_QUALIFIER on purpose: a market range for parking is a
 * budgeting aid, whereas a wrong transfer-charge percentage is money the buyer
 * has to find on the day of registry.
 */
export const AUTHORITY_RATE_CAVEAT =
  'set by authority circular and revised periodically — confirm the current rate with the allotting authority before budgeting on it'
