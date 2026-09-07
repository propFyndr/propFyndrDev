/**
 * Computed deltas between two or more projects, for the comparison lane.
 *
 * Today the comparison prompt hands the model a bracketed table template
 * (`[Price per sqft range]`, `[1-line top strength]`, ...) plus the raw facts
 * JSON for each project, and asks the model to compute the differences itself
 * — which project is cheaper, by how much, which has the faster possession,
 * whose builder delivers on time more often. That is exactly the shape of
 * arithmetic this codebase has been burned by before: a model deriving a rate
 * or a ranking from raw numbers, live in the response, with nothing to check
 * it against. `answerIntegrity.ts` and `toolBlindGuard.ts` exist to catch a
 * fabricated project or registration number; neither catches "Project A is
 * ₹8/sqft cheaper" when the true figure is ₹80/sqft cheaper, because both
 * numbers are equally well-formed.
 *
 * This module computes the actual deltas once, in code, from the same rows
 * already fetched for the comparison turn — no new query, no schema change —
 * and the prompt is handed the answer rather than the homework. The model's
 * job becomes quoting a number and explaining what it means for the buyer,
 * which is the same shift `marketTable.ts` already made for tables: render
 * what we can compute deterministically, and let the model write only the
 * prose around it.
 */

interface ComparisonUnitType {
  bhk?: number | null
  price_min_cr?: number | null
  price_max_cr?: number | null
  super_area_sqft?: number | null
}

interface ComparisonProject {
  id: string
  name: string
  possession_date?: Date | string | null
  possession_label?: string | null
  total_towers?: number | null
  open_space_pct?: number | null
  unit_types?: ComparisonUnitType[] | null
  amenities?: Array<{ name?: string | null }> | null
  connectivity?: Array<{ type?: string | null; name?: string | null; distance_km?: number | null }> | null
  builder?: {
    name?: string | null
    average_delay_months?: number | null
    delivered_units?: number | null
    projects_delivered_count?: number | null
    founded_year?: number | null
  } | null
}

/** Lowest price-per-sqft across a project's configurations, or null if unpriced. */
function minPricePerSqft(p: ComparisonProject): number | null {
  const rates = (p.unit_types ?? [])
    .filter(u => u.price_min_cr && u.super_area_sqft)
    .map(u => (u.price_min_cr! * 1e7) / u.super_area_sqft!)
  return rates.length ? Math.min(...rates) : null
}

/** Lowest entry price across a project's configurations, in crore. */
function minEntryPriceCr(p: ComparisonProject): number | null {
  const prices = (p.unit_types ?? []).map(u => u.price_min_cr).filter((v): v is number => v != null)
  return prices.length ? Math.min(...prices) : null
}

/** Nearest metro distance in km, or null if no metro connectivity is recorded. */
function nearestMetroKm(p: ComparisonProject): number | null {
  const metros = (p.connectivity ?? [])
    .filter(c => c.type === 'metro' && c.distance_km != null)
    .map(c => c.distance_km!)
  return metros.length ? Math.min(...metros) : null
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * The projects sharing a named amenity, and each project's amenities no
 * other project in the set carries. Buyers ask "which one has X" and "what
 * does A have that B doesn't" — both are a set operation, not a judgement
 * call, so there is nothing here for a model to get wrong if it is handed
 * the sets directly.
 */
function amenityComparison(projects: ComparisonProject[]): {
  shared: string[]
  unique: Record<string, string[]>
} {
  const sets = projects.map(p => new Set((p.amenities ?? []).map(a => a.name).filter((n): n is string => !!n)))
  const shared = sets.length
    ? [...sets[0]].filter(name => sets.every(s => s.has(name))).sort()
    : []
  const unique: Record<string, string[]> = {}
  projects.forEach((p, i) => {
    const others = sets.filter((_, j) => j !== i)
    const onlyHere = [...sets[i]].filter(name => !others.some(s => s.has(name))).sort()
    if (onlyHere.length) unique[p.name] = onlyHere
  })
  return { shared, unique }
}

/**
 * One line per metric, naming which project leads and by how much — never
 * asserting which project is "better", which is a buyer's judgement call
 * that depends on what they are optimising for. `leader` is the project name
 * only when the delta is large enough to be a real distinction, not noise.
 */
function metricLine(
  label: string,
  values: Array<{ name: string; value: number | null; unit: string; lowerIsBetter: boolean; minDelta?: number }>,
): { label: string; values: Record<string, string>; leader: string | null; deltaNote: string | null } {
  const out: Record<string, string> = {}
  for (const v of values) out[v.name] = v.value == null ? 'not recorded' : `${v.value}${v.unit}`

  const known = values.filter(v => v.value != null) as Array<{ name: string; value: number; unit: string; lowerIsBetter: boolean }>
  if (known.length < 2) return { label, values: out, leader: null, deltaNote: null }

  const sorted = [...known].sort((a, b) => (values[0].lowerIsBetter ? a.value - b.value : b.value - a.value))
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const delta = Math.abs(best.value - worst.value)
  const minDelta = values[0].minDelta ?? 0
  if (delta < minDelta) return { label, values: out, leader: null, deltaNote: 'difference is not material' }

  return {
    label,
    values: out,
    leader: best.name,
    deltaNote: `${best.name} leads by ${Math.round(delta * 100) / 100}${best.unit}`,
  }
}

/**
 * Computes every deltа a comparison prompt currently asks the model to work
 * out for itself. Returns null fields rather than omitting a metric entirely
 * when a project lacks the underlying data — an absent value is the honest
 * "we do not hold this for one of these projects", the same rule the rest of
 * the facts block already follows.
 */
export function buildComparisonDiff(projects: ComparisonProject[]): Record<string, unknown> | null {
  if (projects.length < 2) return null

  const entryPrice = metricLine(
    'entry_price_cr',
    projects.map(p => ({ name: p.name, value: minEntryPriceCr(p), unit: ' Cr', lowerIsBetter: true, minDelta: 0.1 })),
  )
  const pricePerSqft = metricLine(
    'price_per_sqft',
    projects.map(p => ({ name: p.name, value: minPricePerSqft(p), unit: '/sq.ft', lowerIsBetter: true, minDelta: 100 })),
  )
  const openSpace = metricLine(
    'open_space_pct',
    projects.map(p => ({ name: p.name, value: p.open_space_pct ?? null, unit: '%', lowerIsBetter: false, minDelta: 5 })),
  )
  const metroDistance = metricLine(
    'nearest_metro_km',
    projects.map(p => ({ name: p.name, value: nearestMetroKm(p), unit: ' km', lowerIsBetter: true, minDelta: 0.5 })),
  )
  const builderDelay = metricLine(
    'builder_avg_delay_months',
    projects.map(p => ({
      name: p.name,
      value: p.builder?.average_delay_months ?? null,
      unit: ' months',
      lowerIsBetter: true,
      minDelta: 1,
    })),
  )
  const builderDelivered = metricLine(
    'builder_projects_delivered',
    projects.map(p => ({
      name: p.name,
      value: p.builder?.projects_delivered_count ?? null,
      unit: '',
      lowerIsBetter: false,
      minDelta: 2,
    })),
  )

  // Possession: how many months apart, and who is sooner. Computed from the
  // real date so "sooner" tracks the calendar, not the label text.
  const possessionDates = projects.map(p => ({ name: p.name, date: toDate(p.possession_date) }))
  const knownDates = possessionDates.filter((d): d is { name: string; date: Date } => d.date !== null)
  let possession: { leader: string | null; monthsApart: number | null } = { leader: null, monthsApart: null }
  if (knownDates.length >= 2) {
    const sorted = [...knownDates].sort((a, b) => a.date.getTime() - b.date.getTime())
    const months = Math.round(
      (sorted[sorted.length - 1].date.getTime() - sorted[0].date.getTime()) / (1000 * 60 * 60 * 24 * 30),
    )
    possession = { leader: months > 0 ? sorted[0].name : null, monthsApart: months }
  }

  return {
    entry_price: entryPrice,
    price_per_sqft: pricePerSqft,
    open_space: openSpace,
    nearest_metro: metroDistance,
    builder_track_record: { average_delay: builderDelay, projects_delivered: builderDelivered },
    possession,
    amenities: amenityComparison(projects),
    note:
      'These figures are computed directly from the verified facts above, not derived by you. ' +
      'Quote them as given; do not recompute a percentage, ratio or ranking from the raw numbers elsewhere in this prompt.',
  }
}
