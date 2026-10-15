// backend/src/lib/ai/priceTrendAnswer.ts
//
// How a project's price moved, from the points we hold, said without overreach.
//
// Every point is labelled by where it came from. An observed price is one we saw
// being asked or paid; a benchmark is our own estimate of an earlier quarter. A
// rate of change is stated only between two OBSERVED points: a CAGR off modelled
// points restates whatever model produced them and reads as a market finding.
// With fewer than two observed points the answer shows the points, says which is
// which, states the one observed price if there is one, and says what would
// settle the question. It never says "not available" over rows that exist.

export interface TrendPoint {
  quarterLabel: string | null
  recordedAt: Date
  pricePerSqft: number
  source: string
}

/** Sources that are an actual observation of the market (same set as yieldTable). */
export const OBSERVED_PRICE_SOURCES: ReadonlySet<string> = new Set(['market_verified_2026', 'active_market_listing', 'admin_update'])

const BASIS: Record<string, string> = {
  market_verified_2026: 'Observed (market check)',
  active_market_listing: 'Observed (live listing)',
  admin_update: 'Observed (recorded by our team)',
  historical_benchmark: 'Internal benchmark estimate',
  monthly_auto_snapshot: 'Automatic snapshot',
}

export function basisLabel(source: string): string {
  return BASIS[source] ?? source.replace(/_/g, ' ')
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const period = (p: TrendPoint) =>
  p.quarterLabel ?? p.recordedAt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
const day = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

export interface TrendAnswer {
  text: string
  observedCount: number
  pointCount: number
}

/** The first calendar year the buyer named ("price in 2023"), or undefined. */
export function yearAsked(message: string): number | undefined {
  const m = /\b(20[12]\d)\b/.exec(message || '')
  return m ? Number(m[1]) : undefined
}

/** A direct answer for the year asked, ahead of the table. */
function yearLine(sorted: TrendPoint[], year: number): string {
  const inYear = sorted.filter((p) => p.recordedAt.getFullYear() === year || (p.quarterLabel ?? '').includes(String(year)))
  if (inYear.length > 0) {
    return `For ${year} we hold ${inYear.map((p) => `${period(p)}: ${inr(p.pricePerSqft)} per sq ft (${basisLabel(p.source).toLowerCase()})`).join('; ')}.\n\n`
  }
  const before = [...sorted].reverse().find((p) => p.recordedAt.getFullYear() < year)
  const after = sorted.find((p) => p.recordedAt.getFullYear() > year)
  const near = [before, after].filter((p): p is TrendPoint => Boolean(p)).map((p) => `${period(p)} (${inr(p.pricePerSqft)})`)
  return `We hold no price point for ${year}${near.length ? `; the closest are ${near.join(' and ')}` : ''}.\n\n`
}

export function renderPriceTrend(projectName: string, points: TrendPoint[], opts: { year?: number } = {}): TrendAnswer {
  const sorted = [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
  const observed = sorted.filter((p) => OBSERVED_PRICE_SOURCES.has(p.source))

  if (sorted.length === 0) {
    return {
      observedCount: 0,
      pointCount: 0,
      text:
        `### Price movement — ${projectName}\n\n` +
        `We hold no recorded price history for ${projectName}, so I can't say how its price has moved. ` +
        `The developer's price lists from earlier quarters would settle it, and our advisory team can request them.`,
    }
  }

  const table =
    '| Period | Price per sq ft | Basis |\n| :--- | ---: | :--- |\n' +
    sorted.map((p) => `| ${period(p)} | ${inr(p.pricePerSqft)} | ${basisLabel(p.source)} |`).join('\n')

  let verdict: string
  if (observed.length >= 2) {
    const first = observed[0]
    const last = observed[observed.length - 1]
    const pct = ((last.pricePerSqft - first.pricePerSqft) / first.pricePerSqft) * 100
    verdict =
      `Between ${period(first)} and ${period(last)} the observed price moved from ${inr(first.pricePerSqft)} to ` +
      `${inr(last.pricePerSqft)} per sq ft (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%). That is what the records show, not a forecast.`
  } else if (observed.length === 1) {
    const only = observed[0]
    verdict =
      `We hold one observed price: ${inr(only.pricePerSqft)} per sq ft (${period(only)}, recorded ${day(only.recordedAt)}). ` +
      `The other figures are internal benchmark estimates, not prices we saw being paid, so I won't state a rate of change from them ` +
      `or present them as what buyers paid. The developer's price lists for then and now would settle it; our advisory team can request them.`
  } else {
    verdict =
      `None of these figures is an observed price: they are internal benchmark estimates, so I won't state a rate of change from them. ` +
      `The developer's price lists for then and now would settle it; our advisory team can request them.`
  }

  return {
    observedCount: observed.length,
    pointCount: sorted.length,
    text: `### Price movement — ${projectName}\n\n${opts.year ? yearLine(sorted, opts.year) : ''}${table}\n\n${verdict}`,
  }
}
