// backend/src/lib/ai/marketTable.ts
import { priceLabelFor } from '../discovery/scoring'

import type { MicroMarketSummary } from '../discovery/sectorDataGateway'

/** Formats an integer rupee figure the way an Indian buyer reads it. */
function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

/** The sentinel for a cell we hold no value for. */
const ABSENT = 'Not recorded'

/** Escapes a pipe so a value containing one cannot break the row. */
const cell = (s: unknown) => (s == null ? '' : String(s)).replace(/\|/g, '\\|').trim() || ABSENT

export interface MarketTableOptions {
  /** Cap on rows. */
  limit?: number
  /** Ordering. Price ascending suits a budget question, descending a premium one. */
  order?: 'price_asc' | 'price_desc'
  /**
   * Sectors the buyer actually named, if any. When set, the table is scoped to
   * the micro-markets those sectors belong to instead of the whole city.
   */
  focusSectors?: string[]
}

/** "Sector 74", "sector-74" and "74" are the same place. */
function sameSector(a: string, b: string): boolean {
  const key = (s: string) => s.toLowerCase().replace(/sector/g, '').replace(/[^a-z0-9]/g, '')
  return key(a) === key(b)
}

/** The Noida micro-market table, from our own rows. */
export function renderMicroMarketTable(
  markets: MicroMarketSummary[],
  options: MarketTableOptions = {},
): string {
  const { limit = 6, order = 'price_asc', focusSectors } = options
  if (!markets || markets.length < 2) return ''

  // A buyer who names sectors is asking about those sectors.
  //
  // "Which is better for a family: Sector 74, 75, 76 or 78?" rendered the full
  // city table — six micro-markets, one of them twenty sectors wide, and not
  // one of 75, 76 or 78 in it. The prose underneath then quoted ₹12,200/sqft
  // for Sector 78 while the table above said ₹9,500 for the band containing 74.
  // Two different answers to the same question, stacked.
  //
  // So: keep only the micro-markets the named sectors actually fall in. If
  // fewer than two survive there is no comparison left to draw, and a
  // one-row table is worse than no table — the prose already covers it.
  const focused = focusSectors?.length
    ? markets.filter((m) => m.sectors?.some((s) => focusSectors.some((f) => sameSector(s, f))))
    : markets
  if (focusSectors?.length && focused.length < 2) return ''

  const rows = [...focused]
    .filter((m) => m.microMarket)
    .sort((a, b) =>
      order === 'price_desc'
        ? (b.avgPricePerSqft ?? 0) - (a.avgPricePerSqft ?? 0)
        : (a.avgPricePerSqft ?? 0) - (b.avgPricePerSqft ?? 0),
    )
    .slice(0, limit)

  if (rows.length < 2) return ''

  const header =
    '| Micro-market | Sectors | Avg rate | Range | Character |\n' +
    '| :--- | :--- | ---: | :--- | :--- |'

  const body = rows.map((m) => {
    const rate = m.avgPricePerSqft ? `${rupees(m.avgPricePerSqft)}/sqft` : ABSENT
    // A range whose ends are equal is not a range. Four of six rows printed
    // "₹8,800 – ₹8,800", which reads as a measurement spread when it is one
    // observation — and on the twenty-sector row it implied twenty sectors
    // priced identically to the rupee.
    const range =
      m.priceRange?.min && m.priceRange?.max
        ? m.priceRange.min === m.priceRange.max
          ? rupees(m.priceRange.min)
          : `${rupees(m.priceRange.min)} – ${rupees(m.priceRange.max)}`
        : ABSENT
    // One characterising phrase, not the full tag list: a table the buyer has
    // to scroll sideways on a phone is not a table they read.
    const character = m.dominantSegment || m.lifestyleTags?.slice(0, 2).join(', ') || ABSENT
    return `| **${cell(m.microMarket)}** | ${cell(m.sectors?.join(', ') ?? '')} | ${cell(rate)} | ${cell(range)} | ${cell(character)} |`
  })

  return `${header}\n${body.join('\n')}`
}

/** A sector we can describe from project rows but have no curated row for. */
export interface DerivedSectorRow {
  sector: string
  projectCount: number
  readyCount: number
  priceMinCr: number | null
  priceMaxCr: number | null
}

/** Sectors we hold projects in but no sector intelligence for. */
export function renderDerivedSectorTable(rows: DerivedSectorRow[], limit = 8): string {
  if (!rows || rows.length < 2) return ''
  const top = rows.slice(0, limit)

  const header =
    '| Sector | Projects | Ready to move | Price from |\n' +
    '| :--- | ---: | ---: | :--- |'

  const body = top.map((r) => {
    const price =
      r.priceMinCr != null
        ? r.priceMaxCr != null && r.priceMaxCr !== r.priceMinCr
          ? `₹${r.priceMinCr} – ${r.priceMaxCr} Cr`
          : `₹${r.priceMinCr} Cr`
        : ABSENT
    return `| **${cell(r.sector)}** | ${r.projectCount} | ${r.readyCount} | ${cell(price)} |`
  })

  return `${header}\n${body.join('\n')}`
}

/** The subset of a trimmed project this table needs. */
export interface ProjectRow {
  name?: string
  sector?: string | { name: string }
  status?: string
  price_range_label?: string
  price_min_cr?: number | null
  price_max_cr?: number | null
  unit_types?: Array<{ price_min_cr?: number | null; price_max_cr?: number | null }> | null
  possession_label?: string
  builder?: { name: string } | null
}

const sectorName = (s: ProjectRow['sector']): string =>
  typeof s === 'string' ? s : (s?.name ?? '')

/** The project shortlist table, from the rows discovery already returned. */
export function renderProjectTable(projects: ProjectRow[], limit = 6): string {
  if (!projects || projects.length < 2) return ''

  const rows = projects.filter((p) => p?.name).slice(0, limit)
  if (rows.length < 2) return ''

  const header =
    '| Project | Builder | Sector | Price | Status |\n' +
    '| :--- | :--- | :--- | :--- | :--- |'

  const body = rows.map((p) => {
    // Units first: the stored label disagrees with them on over half our rows.
    const price =
      priceLabelFor(p) !== 'Price on request'
        ? priceLabelFor(p)
        : (typeof p.price_min_cr === 'number' ? `from ₹${p.price_min_cr} Cr` : ABSENT)
    const status = p.possession_label ?? p.status ?? ABSENT
    return `| **${cell(p.name ?? '')}** | ${cell(p.builder?.name ?? '')} | ${cell(sectorName(p.sector))} | ${cell(price)} | ${cell(status)} |`
  })

  return `${header}\n${body.join('\n')}`
}

/** A project offering the configuration the buyer asked for, and what it costs. */
export interface AlternativeRow {
  name?: string
  sector?: string | { name: string }
  builder?: { name: string } | null
  possession_label?: string | null
  status?: string
  unit_types?: Array<{ bhk: number; price_min_cr?: number | null; price_max_cr?: number | null; carpet_area_sqft?: number | null }> | null
}

/**
 * What else in the area actually has the size the buyer wanted.
 *
 * Shown when a named project does not build that configuration. "Ace Hanei has
 * no 3 BHK" is the honest answer and a dead end; the same sentence with three
 * nearby projects that do is an answer they can act on. Prices are for the
 * asked-for size only — quoting a project's full spread here would repeat the
 * mistake this table exists to correct.
 */
export function renderAlternativesTable(
  projects: AlternativeRow[],
  bhk: number[],
  limit = 5,
): string {
  if (!projects?.length || !bhk.length) return ''

  const rows = projects
    .map((p) => {
      const units = (p.unit_types ?? []).filter((u) => bhk.includes(u.bhk))
      if (units.length === 0) return null
      const mins = units.map((u) => u.price_min_cr).filter((n): n is number => n != null)
      const maxs = units.map((u) => u.price_max_cr).filter((n): n is number => n != null)
      const areas = units.map((u) => u.carpet_area_sqft).filter((n): n is number => n != null)
      const price = mins.length
        ? maxs.length && Math.max(...maxs) > Math.min(...mins)
          ? `₹${Math.min(...mins).toFixed(2)}–${Math.max(...maxs).toFixed(2)} Cr`
          : `₹${Math.min(...mins).toFixed(2)} Cr+`
        : ABSENT
      return { p, price, area: areas.length ? `${Math.min(...areas)} sqft` : ABSENT }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, limit)

  if (rows.length === 0) return ''

  const size = [...new Set(bhk)].sort((a, b) => a - b).join('/')
  const header =
    `| Project | Sector | ${size} BHK price | Carpet | Possession |\n` +
    '| :--- | :--- | ---: | ---: | :--- |'
  const body = rows.map(({ p, price, area }) =>
    `| **${cell(p.name ?? '')}** | ${cell(sectorName(p.sector))} | ${cell(price)} | ${cell(area)} | ${cell(p.possession_label ?? p.status ?? '')} |`,
  )
  return `${header}\n${body.join('\n')}`
}

// ── Project-vs-project comparison ────────────────────────────────────────────

/** The subset of a project a side-by-side comparison needs. */
export interface ComparisonRow {
  name?: string
  sector?: string | { name: string }
  status?: string
  possession_label?: string | null
  price_min_cr?: number | null
  price_max_cr?: number | null
  builder?: { name: string } | null
  rera_number?: string | null
  unit_types?: Array<{ bhk: number }> | null
}

/**
 * "Compare A vs B" as a table, from the projects' own rows.
 *
 * Left for the model until now: "not just 'A vs B' but 'A chosen because
 * metro + budget, B lacks metro but better schools'" is the reasoning half —
 * this is the table half, and it belongs here for the same reason every
 * other table in this file does. Left to the model, a two-project comparison
 * is exactly the shape most likely to invent a differentiator neither project
 * actually has, because the buyer is visibly asking for a verdict.
 *
 * Transposed on purpose — attributes down, projects across — because that is
 * how a buyer actually reads a comparison: down one row to see who wins it,
 * not across one project's whole record before starting the next.
 */
export function renderProjectComparisonTable(projects: ComparisonRow[]): string {
  const rows = projects.filter((p) => p?.name).slice(0, 3)
  if (rows.length < 2) return ''

  const bhkRange = (p: ComparisonRow): string => {
    const sizes = [...new Set((p.unit_types ?? []).map((u) => u.bhk).filter((n): n is number => typeof n === 'number'))].sort((a, b) => a - b)
    return sizes.length ? `${sizes.join('/')} BHK` : ABSENT
  }
  const priceOf = (p: ComparisonRow): string =>
    p.price_min_cr != null
      ? p.price_max_cr != null && p.price_max_cr !== p.price_min_cr
        ? `₹${p.price_min_cr}–${p.price_max_cr} Cr`
        : `₹${p.price_min_cr} Cr+`
      : ABSENT

  const header = `|  | ${rows.map((p) => `**${cell(p.name ?? '')}**`).join(' | ')} |\n| :--- | ${rows.map(() => ':---').join(' | ')} |`
  const line = (label: string, values: string[]) => `| ${label} | ${values.join(' | ')} |`

  const body = [
    line('Builder', rows.map((p) => cell(p.builder?.name ?? ''))),
    line('Sector', rows.map((p) => cell(sectorName(p.sector)))),
    line('Price', rows.map((p) => cell(priceOf(p)))),
    line('Configurations', rows.map((p) => cell(bhkRange(p)))),
    line('Possession', rows.map((p) => cell(p.possession_label ?? p.status ?? ''))),
    line('RERA', rows.map((p) => cell(p.rera_number ?? ''))),
  ]

  return `${header}\n${body.join('\n')}`
}

// ── Payment schedule ─────────────────────────────────────────────────────────

export interface PaymentPlanRow {
  plan_name?: string | null
  plan_type?: string | null
  down_payment_pct?: number | null
  booking_amount_lakh?: number | null
  total_duration_months?: number | null
  discount_offered_pct?: number | null
  best_for?: string | null
  watch_out?: string | null
  milestones?: unknown
  /** Null on every one of the 620 rows we hold — see PAYMENT_PLAN_PROVENANCE. */
  verified_at?: Date | string | null
  source?: string | null
}

/**
 * What a payment schedule we have not verified is allowed to claim.
 *
 * Measured against the live database on 4 Sep 2026, after `claudeResponse.md`
 * asserted the plans were batch-templated:
 *
 *   620 PaymentPlan rows
 *   14 distinct plan_name + description pairs — four templates, 95 rows each
 *   13 distinct milestone shapes, six of which cover ~550 of the 620 rows
 *   verified_at: NULL on all 620
 *   source:      NULL on all 620
 *
 * The shapes themselves are plausible — 10:80:10 and 10:20:40:30 are real
 * industry structures, and they do differ between projects, so this is not the
 * degenerate-constant case that `SYNTHETIC_FIELDS` covers. But we render them
 * under a project's own name, as a milestone table, with no qualifier — and a
 * buyer takes that table to the developer. Nothing on the row says anyone
 * checked it against this developer's actual terms, because nobody did.
 *
 * This is the `market` tier that CLAUDE.md already defines, being rendered as
 * `verified`. The fix is the qualifier the tier requires, not deletion: a
 * standard structure is genuinely useful for planning cash flow, and suppressing
 * it would answer "what's the payment plan" with nothing.
 *
 * The gate is per-row, so the moment an analyst stamps `verified_at` on a plan
 * the qualifier disappears for that project without anyone editing this file.
 */

/** Source strings that mean "we filled this in ourselves", not a real source. */
const OUR_OWN_DEFAULT = /inferred|default|template|seed|placeholder/i

/**
 * True when a payment plan carries provenance a buyer could rely on.
 *
 * Deliberately positive. Absence of a source is not evidence of one, and a
 * label recording that a row IS a template must not read as provenance.
 */
function hasRealProvenance(p: PaymentPlanRow): boolean {
  if (p.verified_at) return true
  return Boolean(p.source && !OUR_OWN_DEFAULT.test(p.source))
}

export const PAYMENT_PLAN_PROVENANCE =
  '_These are the standard schemes on file for this project and have not been ' +
  'confirmed against the developer\'s current terms. Treat the stage percentages ' +
  'as the shape to expect, and get the figures in writing before you pay._'

/** "construction_linked" reads badly in a cell the buyer is scanning. */
const humanPlanType = (t?: string | null) =>
  (t ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()

/** One instalment of a developer's schedule, as stored on `PaymentPlan.milestones`. */
interface Milestone {
  stage?: string
  milestone?: string
  pct?: string | number
  amt?: string | number
  due?: string
  timeline?: string
}

/** The rows are JSON, so nothing about their shape is guaranteed. */
function milestonesOf(p: PaymentPlanRow): Milestone[] {
  return Array.isArray(p.milestones) ? (p.milestones as Milestone[]) : []
}

const asText = (v: string | number | undefined): string =>
  v === undefined || v === null || v === '' ? ABSENT : String(v)

/**
 * When the buyer has to pay, and how much.
 *
 * The first version of this listed only `booking_amount_lakh`,
 * `down_payment_pct`, `total_duration_months` and `watch_out` — four summary
 * columns that are null on most rows, while the schedule itself sat unread in
 * `milestones`. A buyer asking for the payment plan of Maxblis White House II
 * got two lines saying "Available", against five stored instalments naming the
 * stage, the share and the rupee amount of each. The answer to "what is the
 * payment plan" is the schedule; the summary is a footnote to it.
 */
export function renderPaymentPlanTable(plans: PaymentPlanRow[], limit = 5): string {
  if (!plans || plans.length === 0) return ''
  const rows = plans.slice(0, limit)

  // 1. Clean Summary Comparison Table of all available schemes
  // `watch_out` has its own column, restored: the rewrite that added the
  // milestone breakdown dropped it, and a payment schedule shown without its
  // catch is exactly the one-sided answer the trade-off rule forbids. It is
  // also the field the model omitted most often back when it drew this itself,
  // which is why rendering it in code was the point.
  const summaryHeader =
    '| Payment Scheme | Milestone Structure | Discount / Key Benefit | Watch out |\n' +
    '| :--- | :--- | :--- | :--- |'

  const summaryBody = rows.map((p) => {
    const name = p.plan_name || humanPlanType(p.plan_type)
    const ms = milestonesOf(p)
    // 'RERA Phased' and 'Standard Tranches' were the fallbacks here. Both name a
    // structure we do not hold — a buyer reads "Standard Tranches" as a fact
    // about this developer's terms. A gap prints ABSENT.
    const structure = ms.length > 0
      ? ms.map((m) => (m.pct != null ? `${String(m.pct).replace(/%+$/, '')}%` : '')).filter(Boolean).join(' : ') || `${ms.length} Stages`
      : p.total_duration_months ? `${p.total_duration_months} Months` : ABSENT
    const discount = p.discount_offered_pct
      ? `**${p.discount_offered_pct}% BSP Discount**`
      : p.down_payment_pct
        ? `${p.down_payment_pct}% Down Payment`
        : p.booking_amount_lakh
          ? `₹${p.booking_amount_lakh} lakh booking`
          : ABSENT
    return `| **${cell(name)}** | ${cell(structure)} | ${cell(discount)} | ${cell(p.watch_out)} |`
  })

  // 2. Compact Milestone Breakdown for the top 2 primary plans (avoids endless mobile scroll)
  const scheduled = rows.filter((p) => milestonesOf(p).length > 0).slice(0, 2)
  const detailBlocks = scheduled.map((p) => {
    const name = p.plan_name || humanPlanType(p.plan_type)
    // `amt` is the instalment in rupees, and it is the number a buyer is
    // actually planning around — "10% on booking" does not tell them what to
    // transfer. It was stored on the milestone and dropped by the renderer.
    const header =
      '| Stage / Milestone | Timeline / Trigger | Share | Amount |\n' +
      '| :--- | :--- | ---: | ---: |'
    const body = milestonesOf(p).map((m) => {
      const stage = m.milestone || (m.stage != null ? `Stage ${m.stage}` : ABSENT)
      const when = m.timeline || m.due || ABSENT
      const pct = m.pct != null ? `${String(m.pct).replace(/%+$/, '')}%` : ABSENT
      return `| ${cell(stage)} | ${cell(when)} | ${cell(pct)} | ${cell(m.amt)} |`
    })
    return `#### ${name}\n\n${header}\n${body.join('\n')}`
  })

  /**
   * Real provenance, not merely a non-empty column.
   *
   * The gate was `!verified_at && !source`, which breaks the moment the
   * templated rows are labelled: setting `source = 'inferred_default'` — a
   * statement that we know these are templates — would have SILENCED the
   * qualifier, which is the opposite of what labelling them is for.
   *
   * So the test is positive: a plan has provenance when someone verified it, or
   * when its source names something other than our own defaulting. Measured
   * 4 Sep 2026, 608 of 620 plans are mass-duplicated (identical name AND
   * identical milestone detail across ten or more projects), and `watch_out`
   * and `best_for` are null on all 620 — so today every plan takes the
   * qualifier, and one researched plan will drop it for its own project.
   */
  const unverified = rows.every((p) => !hasRealProvenance(p))
  const provenance = unverified ? `\n\n${PAYMENT_PLAN_PROVENANCE}` : ''
  return `### Available Payment Schemes\n\n${summaryHeader}\n${summaryBody.join('\n')}\n\n${detailBlocks.join('\n\n')}${provenance}`
}

// ── Cost sheet ───────────────────────────────────────────────────────────────

export interface CostSheetRow {
  base_price_per_sqft?: number | null
  base_cost_cr?: number | null
  /** These three are RUPEES, not lakhs — see the warning on the CostSheet model */
  parking_cost?: number | null
  ifms?: number | null
  club_membership?: number | null
  gst_applicable?: boolean | null
  gst_rate_pct?: number | null
  stamp_duty_pct?: number | null
  registration_pct?: number | null
  all_inclusive_price_cr?: number | null
}

/** Rupee amounts stored raw, shown at whatever scale reads naturally. */
function fromRupees(n?: number | null): string {
  if (typeof n !== 'number' || n <= 0) return ABSENT
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} lakh`
  return rupees(n)
}

/** What the flat actually costs, line by line. */
export function renderCostSheetTable(
  sheet: CostSheetRow | null | undefined,
  projectInfo?: { name?: string; price_range_label?: string | null; status?: string | null }
): string {
  const isRtm = projectInfo?.status === 'ready_to_move'
  const lines: Array<[string, string, string]> = []

  // Every developer charge below used to carry a fallback range —
  // '₹6,500 – ₹8,500 / sq.ft' BSP, '₹3.50 – ₹4.50 Lakh' parking,
  // '₹1.50 – ₹2.50 Lakh' club, '₹50 – ₹75 / sq.ft' IFMS — and the power-backup
  // row printed '₹1.25 – ₹1.75 Lakh' unconditionally for a field this interface
  // does not even carry. So a project whose cost sheet we hold nothing about
  // still rendered a complete, confident, entirely invented bill of costs. A
  // charge with no figure gets no row: the omission is the signal.
  //
  // `projectSpecificFigures` counts how many of these came from the row, and
  // the table is suppressed below two. A single BSP under a "Cost Component"
  // header padded out with statutory rates is not a cost sheet, and rendering
  // one tells the model a breakdown is on screen when it is not.
  let projectSpecificFigures = 0

  // 1. Base Price
  if (typeof sheet?.base_price_per_sqft === 'number') {
    lines.push(['Base Selling Price (BSP)', `${rupees(sheet.base_price_per_sqft)}/sqft`, 'Verified base rate'])
    projectSpecificFigures += 1
  } else if (projectInfo?.price_range_label) {
    lines.push(['Base Selling Price (BSP)', projectInfo.price_range_label, 'Starting unit rate'])
    projectSpecificFigures += 1
  } else if (typeof sheet?.base_cost_cr === 'number') {
    lines.push(['Base Cost', `₹${sheet.base_cost_cr} Cr`, 'Starting ticket size'])
    projectSpecificFigures += 1
  }

  // 2. Developer charges — only the ones this project's row actually holds.
  const charge = (label: string, value: number | null | undefined, note: string) => {
    if (typeof value !== 'number' || value <= 0) return
    lines.push([label, fromRupees(value), note])
    projectSpecificFigures += 1
  }
  charge('Covered Car Parking', sheet?.parking_cost, 'Dedicated basement parking')
  charge('Club Membership', sheet?.club_membership, 'Access to clubhouse & amenities')
  /**
   * IFMS is quoted per square foot in the rows we hold, not as a total.
   *
   * The schema comment says these columns store rupees, and `fromRupees`
   * honoured that literally: ACE Parkway's stored 85 printed as "₹85" in a cost
   * sheet whose all-inclusive total is ₹3.35 Cr. An ₹85 one-time refundable
   * maintenance corpus on a three-crore flat is not a number anyone should read
   * as ours.
   *
   * A value under ₹1,000 cannot be a corpus and is a per-sqft rate — the
   * ₹50–75/sq.ft band this file already documents. Labelled as the rate it is,
   * rather than silently multiplied by an area we may not hold for the unit the
   * buyer is looking at.
   */
  if (typeof sheet?.ifms === 'number' && sheet.ifms > 0 && sheet.ifms < 1000) {
    lines.push(['IFMS (Maintenance Security)', `${rupees(sheet.ifms)}/sqft`, 'Interest-free refundable corpus, charged on area'])
    projectSpecificFigures += 1
  } else {
    charge('IFMS (Maintenance Security)', sheet?.ifms, 'Interest-free refundable corpus')
  }

  if (typeof sheet?.all_inclusive_price_cr === 'number') {
    projectSpecificFigures += 1
  }

  if (projectSpecificFigures < 2) return ''

  // 3. Statutory levies. Fixed by UP law and identical for every project, so a
  //    rate here is a lookup rather than a guess — the statutory tier.
  const gstRate = isRtm ? '0% (Exempt with OC)' : (typeof sheet?.gst_rate_pct === 'number' ? `${sheet.gst_rate_pct}%` : '5%')
  lines.push(['GST', gstRate, isRtm ? 'Ready to move with OC' : 'Under-construction residential'])
  lines.push(['UP Stamp Duty', typeof sheet?.stamp_duty_pct === 'number' ? `${sheet.stamp_duty_pct}%` : '7%', 'At registration (6% for women)'])
  lines.push(['Registration Fee', typeof sheet?.registration_pct === 'number' ? `${sheet.registration_pct}%` : '1%', 'State sub-registrar fee'])

  if (typeof sheet?.all_inclusive_price_cr === 'number') {
    lines.push(['**Estimated All-Inclusive Total**', `**₹${sheet.all_inclusive_price_cr} Cr**`, 'Including BSP, charges & taxes'])
  }

  const header = '| Cost Component | Rate / Amount | Details & Stage |\n| :--- | :--- | :--- |'
  return `${header}\n${lines.map(([k, v, n]) => `| **${cell(k)}** | ${cell(v)} | ${cell(n)} |`).join('\n')}`
}

// ── Sector versus sector ─────────────────────────────────────────────────────

export interface SectorStats {
  sector: string
  totalProjects: number
  priceRange: string
  readyCount: number
  topProjects: string
}

/** Two sectors side by side, from counts we computed rather than prose we asked for. */
export function renderSectorComparisonTable(a: SectorStats, b: SectorStats): string {
  if (!a?.sector || !b?.sector) return ''

  const rows: Array<[string, string, string]> = [
    // Not "Projects we hold". A buyer comparing two sectors is asking about
    // the market, and a row phrased as our inventory count answers a question
    // they did not ask — it reads as bookkeeping, and it invites the reading
    // that a sector with fewer rows in our database has fewer buildings in it.
    ['Projects listed', String(a.totalProjects), String(b.totalProjects)],
    ['Ready to move', String(a.readyCount), String(b.readyCount)],
    ['Price band', a.priceRange, b.priceRange],
    ['Landmark societies', a.topProjects, b.topProjects],
  ]

  const header = `| | ${cell(a.sector)} | ${cell(b.sector)} |\n| :--- | :--- | :--- |`
  const body = rows.map(([label, x, y]) => `| **${cell(label)}** | ${cell(x)} | ${cell(y)} |`)
  return `${header}\n${body.join('\n')}`
}

/** True when this turn should get a rendered market table. */
export function wantsMarketTable(message: string, hasProjectFocus: boolean): boolean {
  if (hasProjectFocus) return false
  const m = (message || '').toLowerCase()
  if (!m) return false

  // A market table compares PLACES or answers what things cost. It is not an
  // answer to "show me the shortlist".
  //
  // `shortlist|options` was an arm of this, and it inverted the funnel at the
  // exact rung that matters. Measured across three sessions: "yes show me the
  // shortlist" returned a micro-market price table — one cell of which listed
  // twenty sectors — instead of the projects. Three buyers asking for a
  // peaceful area, a happening area and a mall nearby all received the same
  // table, because the table is about micro-markets and knows nothing about
  // what they asked for.
  //
  // A buyer asking for a shortlist wants rows they can tap. The table is still
  // right for "what are rates in Sector 150" and "which sector is better".
  return (
    /\bvs\b|\bversus\b|\bcompare\b|\bbetter\b/.test(m) ||
    /\bwhich (sector|area|micro|part|region)/.test(m) ||
    /\bbest (sector|area|micro|place|locality)/.test(m) ||
    /\bwhere (should|can|do)\b/.test(m) ||
    /\b(rate|rates|price|prices|per sq|psf|cost)\b/.test(m)
  )
}

// ── Citywide band shelf ──────────────────────────────────────────────────────

/**
 * "Which is the best project in Noida?" — no sector, no budget, no buyer profile.
 *
 * There is no honest single answer, and the old behaviour did not give one: the
 * retrieval branch behind this question ordered by `created_at DESC`, so the
 * "best project in Noida" was whichever row was seeded most recently, scored
 * against an intent that is empty by definition. Seed order presented as a
 * ranking is the fake-confidence failure this codebase forbids elsewhere.
 *
 * The answer is a shelf, not a winner: the strongest project we hold in each of
 * three price bands, with the rule that chose them printed above it. Three
 * defensible picks, no crowned favourite for a buyer we know nothing about, and
 * the buyer sees our actual range rather than our newest imports.
 *
 * Rendered in code for the same reason the cost sheet and the affordability
 * table are: every column is one we hold, a gap prints "Not recorded", and the
 * model cannot invent a "5-Yr Upside" column it has no data for.
 */
export interface BandShelfRow extends ProjectRow {
  /** Lowest asking price we hold, in crore. Absent means unpriced. */
  entryPriceCr?: number | null
  rera_number?: string | null
  litigation_count?: number | null
}

/** The bands, in the order a buyer reads them. */
const SHELF_BANDS: Array<{ label: string; lo: number; hi: number }> = [
  { label: 'Under ₹1 Cr', lo: 0, hi: 1 },
  { label: '₹1–2 Cr', lo: 1, hi: 2 },
  { label: 'Above ₹2 Cr', lo: 2, hi: Number.POSITIVE_INFINITY },
]

/** Lowest real asking price for a row, in crore. */
function shelfEntryPrice(p: BandShelfRow): number | null {
  if (typeof p.entryPriceCr === 'number' && p.entryPriceCr > 0) return p.entryPriceCr
  const unit = (p.unit_types ?? [])
    .map((u) => u.price_min_cr ?? u.price_max_cr)
    .filter((n): n is number => typeof n === 'number' && n > 0)
  if (unit.length > 0) return Math.min(...unit)
  return typeof p.price_min_cr === 'number' && p.price_min_cr > 0 ? p.price_min_cr : null
}

/**
 * The shelf, or '' when fewer than two bands have anything in them.
 *
 * Two bands is the floor because one band is not a shelf — it is a shortlist
 * with extra framing, and `renderProjectTable` already does that better.
 */
export function renderCityBandShelf(projects: BandShelfRow[], city = 'Noida'): string {
  if (!projects || projects.length === 0) return ''

  const chosen: Array<{ band: string; row: BandShelfRow; price: number }> = []
  for (const band of SHELF_BANDS) {
    const inBand = projects
      .map((p) => ({ p, price: shelfEntryPrice(p) }))
      .filter((x) => x.price !== null && x.price >= band.lo && x.price < band.hi)
    if (inBand.length === 0) continue
    // Already ordered by the retrieval rule; the first in each band is its pick.
    chosen.push({ band: band.label, row: inBand[0].p, price: inBand[0].price as number })
  }

  if (chosen.length < 2) return ''

  const header =
    '| Budget | Project | Builder | Sector | Entry price | Possession |\n' +
    '| :--- | :--- | :--- | :--- | :--- | :--- |'

  const body = chosen.map(({ band, row, price }) => {
    // `humanPlanType` and not the raw column: measured live, one row printed
    // "ready_to_move" beside another that printed "Ready to Move", because
    // `possession_label` is populated on some projects and not others and the
    // fallback was the enum. Two spellings of the same state in one table reads
    // as two different states.
    const possession = row.possession_label ?? humanPlanType(row.status) ?? ABSENT
    return `| **${cell(band)}** | ${cell(row.name ?? '')} | ${cell(row.builder?.name ?? '')} | ${cell(sectorName(row.sector))} | ${cell(`from ₹${price} Cr`)} | ${cell(possession)} |`
  })

  // The rule is printed, not implied. A buyer who disagrees with the ranking can
  // see what it ranked on, which is the difference between a recommendation and
  // a leaderboard.
  const rule =
    `Strongest ${city} project we hold in each budget band, ranked on RERA registration, ` +
    `the builder's own delivery record, and recorded litigation — not on price alone.`

  return `${rule}\n\n${header}\n${body.join('\n')}`
}

/**
 * True when the question is citywide and superlative — no place, no budget.
 *
 * Narrow on purpose, and narrower than it looks: the shelf is only right when we
 * genuinely have nothing to narrow by. A buyer who has said "under 1.5 crore"
 * gets a ranked shortlist, because at that point one band IS the answer.
 */
export function wantsCityBandShelf(
  message: string,
  opts: { hasSector: boolean; hasBudget: boolean; hasProjectFocus: boolean },
): boolean {
  if (opts.hasSector || opts.hasBudget || opts.hasProjectFocus) return false
  const m = (message || '').toLowerCase()
  if (!m) return false
  const superlative = /\b(best|top|cheapest|costliest|most expensive|safest|nicest|good(?:est)?|recommend|suggest|which\s+(?:one|project|society|property))\b/.test(m)
  const inventory = /\b(project|projects|society|societies|propert(?:y|ies)|flat|flats|apartment|apartments|builder|builders|place|option|options)\b/.test(m)
  return superlative && inventory
}
