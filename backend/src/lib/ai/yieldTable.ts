// backend/src/lib/ai/yieldTable.ts
//
// Rental yield and price change, computed from our own rows and rendered in code.
//
// Three systems answered these questions and they contradicted each other, so
// the buyer got a refusal, a hedge or a constant depending on which one won:
//
//   * `guardrails.ts` blocks any "N% returns / CAGR / ROI" claim outright.
//   * HARD RULE 20 in `prompts/base.ts` forbids ROI projections.
//   * `tools/financialCalculators.ts` projects 12% residential and 18%
//     commercial CAGR from hardcoded constants, and `generateIntelligence.ts`
//     writes "Noida typically sees 5-8% annual appreciation" into stored
//     narrative.
//
// The first two are right and the third should never have existed. But "we don't
// answer that" is the wrong resolution, because **we hold the data for the honest
// half of the question**: every one of the 65 sector rows carries both
// `avg_rent_3bhk_monthly` and `avg_price_per_sqft`, and we hold 371 priced 3BHK
// unit types. Gross rental yield is division, on two numbers we already show the
// buyer elsewhere.
//
// The dividing line this file draws, and the reason it is drawn here rather than
// in a prompt:
//
//   YIELD IS MEASURED.       Recorded rent over a real asking price. Printable.
//   PAST CHANGE IS RECORDED. Two price points we actually stored, and the change
//                            between them — but only where the points came from
//                            somewhere. 1,400 of our 1,680 `price_history` rows
//                            carry `source: 'historical_benchmark'` and step by
//                            an identical amount each quarter (8990, 10540,
//                            12090 …). That is a generated arithmetic series,
//                            not a market observation, and quoting a CAGR off it
//                            would be the most convincing fabrication available:
//                            specific, plotted, and nobody can check it.
//   FUTURE RETURN IS NOT OURS TO STATE. No projection, no CAGR forward, at any
//                            confidence. The guardrail stays.

import { prisma } from '../db'

/** Sources that represent an actual observation of the market. */
const OBSERVED_SOURCES = new Set(['market_verified_2026', 'active_market_listing', 'admin_update'])

/** The sentinel for a cell we hold no value for. Same word as marketTable. */
const ABSENT = 'Not recorded'

const cell = (s: string) => s.replace(/\|/g, '\\|').trim() || ABSENT

const inr = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`

// ── Rental yield ─────────────────────────────────────────────────────────────

export interface SectorYield {
  sector: string
  city: string
  /** Recorded monthly rent for a 3BHK in this sector. */
  monthlyRent: number
  /** Median asking price for a 3BHK we hold here, in crore. */
  medianPriceCr: number
  /** How many priced 3BHK unit types that median is built from. */
  sampleSize: number
  /** Gross annual rent as a percentage of price. */
  grossYieldPct: number
}

const median = (ns: number[]): number => {
  const s = [...ns].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/**
 * Gross rental yield per sector, from recorded rent over our own 3BHK prices.
 *
 * Deliberately NOT `rent / (price_per_sqft × assumed area)`. That was the first
 * shape, and the assumed area is an invention sitting inside a number presented
 * as measured — a 3BHK is anywhere from 1,150 to 2,400 sqft here, so the
 * assumption moves the answer by more than the answer's own spread. Using our
 * real 3BHK asking prices removes the assumption entirely.
 *
 * Gross, and it says gross: maintenance, vacancy, property tax and brokerage all
 * come off this before a landlord sees it, and the difference is roughly a fifth.
 * `renderRentalYieldTable` prints that caveat rather than leaving the buyer to
 * assume the number is net.
 */
export async function computeSectorYields(
  cities: string[],
  opts: { minSample?: number; limit?: number } = {},
): Promise<SectorYield[]> {
  /**
   * Three, not two. A sector represented by two priced units heading a "best
   * yields" list is a sample, not a finding — the first run put Sector 25 top at
   * 4.53% off exactly two rows, half a point clear of a sector with nine.
   */
  const minSample = opts.minSample ?? 3
  const limit = opts.limit ?? 8

  const [sectors, units] = await Promise.all([
    prisma.sectorIntelligence.findMany({
      where: { city: { in: cities }, avg_rent_3bhk_monthly: { not: null } },
      select: { sector: true, city: true, avg_rent_3bhk_monthly: true },
    }),
    prisma.unitType.findMany({
      where: { bhk: 3, price_min_cr: { not: null }, project: { city: { in: cities } } },
      select: { price_min_cr: true, price_max_cr: true, project: { select: { sector: true, city: true } } },
    }),
  ])

  const key = (city: string, sector: string) => `${city.toLowerCase()}::${sector.toLowerCase()}`
  const pricesBySector = new Map<string, number[]>()
  for (const u of units) {
    if (typeof u.price_min_cr !== 'number' || u.price_min_cr <= 0) continue
    /**
     * The midpoint of the unit's range, not its floor.
     *
     * `price_min_cr` is the cheapest floor and orientation on offer, while the
     * rent figure is a sector AVERAGE. Dividing an average rent by a floor price
     * inflates every yield in the table, and it inflates them by a consistent
     * amount — which is worse than noise, because a uniformly wrong column looks
     * internally consistent. First run read 3.15%–4.53% against a market that
     * transacts nearer 2.5%–3.5%.
     */
    const price =
      typeof u.price_max_cr === 'number' && u.price_max_cr > u.price_min_cr
        ? (u.price_min_cr + u.price_max_cr) / 2
        : u.price_min_cr
    const k = key(u.project.city, u.project.sector)
    pricesBySector.set(k, [...(pricesBySector.get(k) ?? []), price])
  }

  const out: SectorYield[] = []
  // De-duplicated on the way out. `sectorIntelligence` carries the same place
  // twice under two cities — Sector 107 is filed as both Noida and Greater Noida
  // West with identical figures — and a "best yields" list showing one sector in
  // two rows reads as two different findings.
  const emitted = new Set<string>()
  for (const s of sectors) {
    const rent = s.avg_rent_3bhk_monthly
    if (typeof rent !== 'number' || rent <= 0) continue
    const prices = pricesBySector.get(key(s.city, s.sector)) ?? []
    if (prices.length < minSample) continue
    const dedupeKey = s.sector.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (emitted.has(dedupeKey)) continue
    emitted.add(dedupeKey)

    const medianPriceCr = median(prices)
    out.push({
      sector: s.sector,
      city: s.city,
      monthlyRent: rent,
      medianPriceCr,
      sampleSize: prices.length,
      grossYieldPct: Number((((rent * 12) / (medianPriceCr * 1_00_00_000)) * 100).toFixed(2)),
    })
  }

  return out.sort((a, b) => b.grossYieldPct - a.grossYieldPct).slice(0, limit)
}

/** The yield table, or '' when fewer than two sectors qualify. */
export function renderRentalYieldTable(rows: SectorYield[]): string {
  if (!rows || rows.length < 2) return ''

  const header =
    '| Sector | 3BHK rent/month | Median 3BHK price | Gross yield | Priced units |\n' +
    '| :--- | :--- | :--- | :--- | :--- |'

  const body = rows.map(
    (r) =>
      `| **${cell(r.sector)}** | ${cell(inr(r.monthlyRent))} | ${cell(`₹${r.medianPriceCr.toFixed(2)} Cr`)} | ${cell(`${r.grossYieldPct}%`)} | ${cell(String(r.sampleSize))} |`,
  )

  // Every part of the sum is named, including what is not in it. A yield figure
  // a buyer reads as net and acts on is off by about a fifth.
  const note =
    'Gross yield = recorded 3BHK rent × 12, over the median asking price of the 3BHK units we hold in that sector. ' +
    'Before maintenance, property tax, vacancy and brokerage — net is typically a fifth lower. ' +
    'Rent is a sector-level figure; price comes from our own unit rows. ' +
    'Where a sector shows few priced units, read the yield as indicative.'

  return `${header}\n${body.join('\n')}\n\n${note}`
}

// ── Recorded price change ────────────────────────────────────────────────────

export interface PricePoint {
  quarterLabel: string | null
  recordedAt: Date
  pricePerSqft: number
  source: string
}

export interface PriceChange {
  projectName: string
  points: PricePoint[]
  /** True when at least two points came from an observed source. */
  observed: boolean
  firstPsf: number
  lastPsf: number
  changePct: number
  years: number
}

/**
 * The recorded price series for one project, and what it changed by.
 *
 * Returns null when we hold fewer than two points, and marks `observed: false`
 * when every point is a `historical_benchmark` — the caller must not print a
 * change figure off an unobserved series. That is not caution for its own sake:
 * the benchmark rows step by an identical amount every quarter, so a CAGR
 * computed from them is a restatement of whatever constant generated them,
 * dressed as a market finding.
 */
export async function computePriceChange(projectId: string): Promise<PriceChange | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      price_history: {
        where: { price_per_sqft: { not: null } },
        orderBy: { recorded_at: 'asc' },
        select: { quarter_label: true, recorded_at: true, price_per_sqft: true, source: true },
      },
    },
  })
  if (!project || project.price_history.length < 2) return null

  const points: PricePoint[] = project.price_history.map((p) => ({
    quarterLabel: p.quarter_label,
    recordedAt: p.recorded_at,
    pricePerSqft: p.price_per_sqft as number,
    source: p.source,
  }))

  const first = points[0]
  const last = points[points.length - 1]
  const years = (last.recordedAt.getTime() - first.recordedAt.getTime()) / (365.25 * 24 * 3600 * 1000)

  return {
    projectName: project.name,
    points,
    observed: points.filter((p) => OBSERVED_SOURCES.has(p.source)).length >= 2,
    firstPsf: first.pricePerSqft,
    lastPsf: last.pricePerSqft,
    changePct: Number((((last.pricePerSqft - first.pricePerSqft) / first.pricePerSqft) * 100).toFixed(1)),
    years: Number(years.toFixed(1)),
  }
}

/**
 * The recorded series, with the change stated only when the series was observed.
 *
 * An unobserved series still renders — the buyer asked what we hold and we hold
 * these numbers — but it renders WITHOUT a change figure and says why. Showing
 * the points and withholding the conclusion is the honest shape: the points are
 * what we have, the conclusion is what they cannot support.
 */
export function renderPriceChangeTable(change: PriceChange): string {
  if (!change || change.points.length < 2) return ''

  const header = '| Quarter | Price/sqft |\n| :--- | :--- |'
  const body = change.points.map(
    (p) => `| ${cell(p.quarterLabel ?? p.recordedAt.toISOString().slice(0, 10))} | ${cell(inr(p.pricePerSqft))} |`,
  )

  const table = `${header}\n${body.join('\n')}`

  if (!change.observed) {
    return `${table}\n\nThese are benchmark figures carried in our records, not prices we observed being paid. We will not quote a rate of change off them — ask us for the current asking price instead, which we do hold.`
  }

  const direction = change.changePct >= 0 ? 'up' : 'down'
  return (
    `${table}\n\n${change.projectName} is ${direction} ${Math.abs(change.changePct)}% over the ` +
    `${change.years} years we have records for — ${inr(change.firstPsf)} to ${inr(change.lastPsf)} per sqft. ` +
    `That is what happened, not a forecast: we do not project future appreciation.`
  )
}

// ── Routing ──────────────────────────────────────────────────────────────────

/** The question is about rental yield or rental return, not about renting a home. */
export function asksRentalYield(message: string): boolean {
  const m = (message || '').toLowerCase()
  if (!m) return false
  return (
    /\b(rental\s+yield|gross\s+yield|net\s+yield|yield)\b/.test(m) ||
    /\brent(?:al)?\s+(?:return|income|yield)\b/.test(m) ||
    /\b(?:rent|rental)\b[^.?]{0,30}\b(?:vs|versus|against|compared\s+to)\b[^.?]{0,20}\b(?:emi|price|buy|purchase)\b/.test(m) ||
    /\b(?:most|best|highest)\s+returns?\b/.test(m) ||
    /\boffer(?:s)?\s+(?:the\s+)?(?:most|best)\s+returns?\b/.test(m)
  )
}

/** The question is about how prices have moved, or will. */
export function asksAppreciation(message: string): boolean {
  const m = (message || '').toLowerCase()
  if (!m) return false
  return (
    /\b(appreciat|capital\s+gain|price\s+(?:trend|growth|rise|movement|history|increase)|resale\s+value|how\s+much\s+(?:has|have|will)[^.?]{0,25}(?:grown|risen|gone\s+up|appreciate)|cagr)\b/.test(m) ||
    /\b(?:most|best|highest)\s+returns?\b/.test(m) ||
    /\bbest\s+area\s+to\s+put\s+money\b/.test(m)
  )
}

// ── Sector appreciation, from recorded figures ───────────────────────────────

/**
 * What a sector's prices have DONE, answered from the two columns that record it.
 *
 * `computePriceChange` above is per project, and it can never print a rate:
 * every one of our 280 projects carries exactly five `historical_benchmark`
 * points and exactly one observed point, so `observed` is false for all of them
 * by construction. That is the right refusal for a project — but it left the
 * SECTOR question, which is the one buyers actually ask, with no answer at all.
 * "Price appreciation in Sector 150" retrieved ten projects, fell past the
 * project branch, and was answered from the model's memory.
 *
 * `sector_intelligence` holds the figure honestly: all 65 rows carry
 * `price_5yr_cagr_pct` alongside `avg_price_per_sqft`, stamped
 * `verified_by: 'PropFyndr Research Desk'` with a `last_verified_at`. It is a
 * BACKWARD-LOOKING five-year figure on a row somebody signed for — a different
 * thing from the forward projection HARD RULE 20 forbids, and a different thing
 * again from a CAGR computed off the benchmark series, which would restate
 * whatever constant generated that series.
 *
 * So: print what happened, name who recorded it and when, attach the drivers we
 * hold, and refuse the forecast. The refusal is in the rendered text rather than
 * left to the prompt, because the prompt is the layer that has been ignoring it.
 */
export interface SectorAppreciation {
  sector: string
  city: string
  avgPsf: number | null
  /** Recorded five-year CAGR. Past, not projected. */
  cagr5yrPct: number
  /** Infrastructure on record for the sector, where we hold any. */
  drivers: string[]
  verifiedAt: Date | null
  verifiedBy: string | null
}

/** Reads `infrastructure_pipeline` defensively — it is a Json column. */
function pipelineProjects(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return []
  const list = (raw as { projects?: unknown }).projects
  if (!Array.isArray(list)) return []
  return list.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 3)
}

/**
 * Recorded appreciation for named sectors, or the strongest in the city.
 *
 * `sectors` empty means the citywide question — "which sector has appreciated
 * most" — and the answer is the top rows by recorded CAGR rather than a refusal.
 * That shape is deliberate: a superlative with no place named was the single
 * biggest source of low-scoring answers in the 31 Aug audit, because retrieval
 * needed a sector and the question is exactly the one that has none.
 */
export async function computeSectorAppreciation(
  cities: string[],
  sectors: string[] = [],
  limit = 6,
): Promise<SectorAppreciation[]> {
  const wanted = sectors
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((s) => s.length > 0)

  const rows = await prisma.sectorIntelligence.findMany({
    where: { city: { in: cities }, price_5yr_cagr_pct: { not: null } },
    select: {
      sector: true,
      city: true,
      avg_price_per_sqft: true,
      price_5yr_cagr_pct: true,
      infrastructure_pipeline: true,
      last_verified_at: true,
      verified_by: true,
    },
  })

  const mapped: SectorAppreciation[] = []
  // Same de-duplication as the yield table: `sector_intelligence` files Sector
  // 107 under both Noida and Greater Noida West with identical figures, and one
  // sector appearing twice reads as two findings.
  const emitted = new Set<string>()
  for (const r of rows) {
    const norm = r.sector.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (wanted.length > 0 && !wanted.some((w) => norm === w || norm.includes(w) || w.includes(norm))) continue
    if (emitted.has(norm)) continue
    emitted.add(norm)
    mapped.push({
      sector: r.sector,
      city: r.city,
      avgPsf: r.avg_price_per_sqft,
      cagr5yrPct: r.price_5yr_cagr_pct as number,
      drivers: pipelineProjects(r.infrastructure_pipeline),
      verifiedAt: r.last_verified_at,
      verifiedBy: r.verified_by,
    })
  }

  // A named-sector question keeps the buyer's order; a citywide one is a ranking.
  if (wanted.length === 0) mapped.sort((a, b) => b.cagr5yrPct - a.cagr5yrPct)
  return mapped.slice(0, limit)
}

/** The recorded-appreciation table, or '' when we hold nothing for the ask. */
export function renderAppreciationTable(rows: SectorAppreciation[]): string {
  if (!rows || rows.length === 0) return ''

  const anyDrivers = rows.some((r) => r.drivers.length > 0)
  const header = anyDrivers
    ? '| Sector | Current rate | 5-yr change (recorded) | On record nearby |\n| :--- | :--- | :--- | :--- |'
    : '| Sector | Current rate | 5-yr change (recorded) |\n| :--- | :--- | :--- |'

  const body = rows.map((r) => {
    const rate = typeof r.avgPsf === 'number' && r.avgPsf > 0 ? `${inr(r.avgPsf)}/sqft` : ABSENT
    const base = `| **${cell(r.sector)}** | ${cell(rate)} | ${cell(`${r.cagr5yrPct}% a year`)} |`
    return anyDrivers ? `${base} ${cell(r.drivers.join('; '))} |` : base
  })

  const stamped = rows.find((r) => r.verifiedAt)
  const when = stamped?.verifiedAt ? stamped.verifiedAt.toISOString().slice(0, 10) : null
  const who = stamped?.verifiedBy ?? 'our research desk'

  const note =
    `The five-year figure is compound annual growth already recorded — what these rates DID, ` +
    `logged by ${who}${when ? ` and last verified ${when}` : ''}. ` +
    `It is not a forecast, and we do not publish one: past rate movement in Noida has tracked ` +
    `infrastructure delivery dates more than anything else, and those slip. ` +
    `Ask us about a specific project and we will show the asking rate we hold for it today.`

  return `${header}\n${body.join('\n')}\n\n${note}`
}
