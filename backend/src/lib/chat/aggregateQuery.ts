// backend/src/lib/chat/aggregateQuery.ts
//
// Questions about the catalogue as a whole, answered from our rows.
//
// "Average price per sq ft in Sector 150", "average maintenance in Noida",
// "how many projects does Godrej have", "which projects have a clubhouse and
// possession before 2027" had no answer path: the open lane wrote prose over a
// handful of prompt rows, and the model could say "6" for a builder that has
// eleven projects because the context held six. The numbers are in the table,
// so this computes them — no model call, no rounding by a language model, and
// every figure carries the count it was computed over.
//
// Two consumers share `queryProjects`: the deterministic gate in chat-router
// (parseAggregateQuestion → queryProjects → renderAggregateAnswer) and the
// `query_projects` tool the main lane's model can call with structured args.

import { prisma } from '../db'
import { sectorWhereClause } from '../discovery/normalize'
import { builderNames } from '../builderNames'
import { computedQualifier } from '../factPresentation'
import { outOfScopeCity } from '../config/cities'

export type AggregateMetric = 'avg' | 'median' | 'min' | 'max' | 'count' | 'list'
export type AggregateField = 'price' | 'price_per_sqft' | 'maintenance' | 'projects'
type Status = 'under_construction' | 'ready_to_move' | 'new_launch'

export interface ProjectQuery {
  metric: AggregateMetric
  field: AggregateField
  sector?: string
  city?: string
  builder?: string
  bhk?: number
  maxBudgetCr?: number
  status?: Status
  /** Exclusive upper bound on possession_date. */
  possessionBefore?: Date
  amenity?: string
  limit?: number
}

interface Row {
  name: string
  sector: string
  value: number | null
  possession: string | null
}

export interface ProjectQueryResult {
  found: boolean
  query: ProjectQuery
  /** Projects matching the filters. */
  matched: number
  /** Projects that had a usable value for the field. */
  used: number
  /** Projects left out because their only figure is marked estimated. */
  excludedEstimated: number
  stats?: {
    avg: number
    median: number
    min: { value: number; name: string; sector: string }
    max: { value: number; name: string; sector: string }
    /** Share of values that are the single most common value — a template tell. */
    modeShare: number
  }
  rows: Row[]
}

const STATUSES: readonly Status[] = ['under_construction', 'ready_to_move', 'new_launch']

export async function queryProjects(q: ProjectQuery): Promise<ProjectQueryResult> {
  const and: Array<Record<string, unknown>> = []
  if (q.sector) {
    const clause = sectorWhereClause(q.sector)
    if (clause.length) and.push({ OR: clause })
  }
  if (q.city) and.push({ city: { equals: q.city.trim(), mode: 'insensitive' } })
  if (q.builder) and.push({ builder: { name: { contains: q.builder.trim(), mode: 'insensitive' } } })
  if (q.status && STATUSES.includes(q.status)) and.push({ status: q.status })
  if (q.possessionBefore) and.push({ possession_date: { lt: q.possessionBefore } })
  if (q.amenity) and.push({ amenities: { some: { name: { contains: q.amenity.trim(), mode: 'insensitive' } } } })
  if (q.bhk || q.maxBudgetCr) {
    // Both constraints on the SAME unit type, or a cheap 1BHK satisfies a
    // "3BHK under 2 Cr" filter.
    const unit: Record<string, unknown> = {}
    if (q.bhk) unit.bhk = q.bhk
    if (q.maxBudgetCr) unit.price_min_cr = { lte: q.maxBudgetCr }
    and.push({ unit_types: { some: unit } })
  }

  const projects = await prisma.project.findMany({
    where: and.length ? { AND: and } : {},
    select: {
      name: true,
      sector: true,
      price_min_cr: true,
      possession_label: true,
      maintenance_per_sqft_monthly: true,
      unit_types: { select: { bhk: true, price_min_cr: true, price_per_sqft: true, price_is_estimated: true } },
    },
    orderBy: { name: 'asc' },
  })

  let excludedEstimated = 0
  const rows: Row[] = projects.map((p) => {
    const units = p.unit_types.filter((u) => !q.bhk || u.bhk === q.bhk)
    let value: number | null = null
    if (q.field === 'price') {
      const unitPrices = units.map((u) => u.price_min_cr).filter((v): v is number => typeof v === 'number' && v > 0)
      value = unitPrices.length ? Math.min(...unitPrices) : (!q.bhk && typeof p.price_min_cr === 'number' && p.price_min_cr > 0 ? p.price_min_cr : null)
    } else if (q.field === 'price_per_sqft') {
      const measured = units.filter((u) => typeof u.price_per_sqft === 'number' && u.price_per_sqft > 0 && u.price_is_estimated === false)
      if (measured.length) value = Math.min(...measured.map((u) => u.price_per_sqft as number))
      else if (units.some((u) => typeof u.price_per_sqft === 'number' && u.price_per_sqft > 0)) excludedEstimated += 1
    } else if (q.field === 'maintenance') {
      const m = p.maintenance_per_sqft_monthly
      value = typeof m === 'number' && m > 0 ? m : null
    }
    return { name: p.name, sector: p.sector, value, possession: p.possession_label }
  })

  const withValue = rows.filter((r) => r.value !== null) as Array<Row & { value: number }>
  const result: ProjectQueryResult = {
    found: projects.length > 0,
    query: q,
    matched: projects.length,
    used: q.field === 'projects' ? projects.length : withValue.length,
    excludedEstimated,
    rows,
  }

  if (q.field !== 'projects' && withValue.length > 0) {
    const sorted = [...withValue].sort((a, b) => a.value - b.value)
    const values = sorted.map((r) => r.value)
    const mid = Math.floor(values.length / 2)
    const counts = new Map<number, number>()
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
    result.stats = {
      avg: values.reduce((s, v) => s + v, 0) / values.length,
      median: values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2,
      min: { value: sorted[0].value, name: sorted[0].name, sector: sorted[0].sector },
      max: { value: sorted[sorted.length - 1].value, name: sorted[sorted.length - 1].name, sector: sorted[sorted.length - 1].sector },
      modeShare: Math.max(...counts.values()) / values.length,
    }
  }
  return result
}

// ── Parsing a buyer's question ───────────────────────────────────────────────

const AMENITIES: Array<[RegExp, string]> = [
  [/\bclub\s*house\b|\bclubhouse\b/i, 'club'],
  [/\bswimming\s+pool\b|\bpool\b/i, 'pool'],
  [/\bgym(?:nasium)?\b/i, 'gym'],
  [/\bjogging\s+track\b/i, 'jogging'],
  [/\btennis\b/i, 'tennis'],
  [/\bbadminton\b/i, 'badminton'],
  [/\bsquash\b/i, 'squash'],
  [/\bcricket\b/i, 'cricket'],
  [/\byoga\b/i, 'yoga'],
  [/\bspa\b/i, 'spa'],
  [/\bev\s+charging\b/i, 'ev'],
  [/\b(?:kids?|children'?s?)\s+play/i, 'play'],
  [/\blibrary\b/i, 'library'],
  [/\bamphi\s*theat(?:re|er)\b/i, 'amphitheat'],
]

/** Builder named in the message: full name, or a first word only one builder has ("Godrej"). */
async function builderIn(message: string): Promise<string | undefined> {
  const text = message.toLowerCase()
  const names = await builderNames()
  const full = names.filter((n) => n.length >= 4 && text.includes(n.toLowerCase())).sort((a, b) => b.length - a.length)[0]
  if (full) return full
  const byFirst = new Map<string, string[]>()
  for (const n of names) {
    const first = n.toLowerCase().split(/\s+/)[0]
    if (first.length >= 4) byFirst.set(first, [...(byFirst.get(first) ?? []), n])
  }
  for (const [first, owners] of byFirst) {
    if (owners.length === 1 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) return owners[0]
  }
  return undefined
}

/**
 * The aggregate question this message asks, or null when it is not one.
 *
 * Narrow on purpose: it must not take "cheapest 3BHK in GNW" (a shortlist,
 * which discovery answers with cards) or "is the average buyer…" (prose).
 * It needs an aggregate word AND a thing to aggregate.
 */
export async function parseAggregateQuestion(message: string): Promise<ProjectQuery | null> {
  const m = (message ?? '').toLowerCase()
  if (m.length > 300) return null
  // "Average price in Gurgaon" is a coverage question; computing it over our
  // Noida rows would answer a different city's question with our stock.
  if (outOfScopeCity(message)) return null
  // Advice, not arithmetic.
  if (/\b(should\s+i|recommend|suggest|worth\s+it|good\s+(?:for|investment)|better)\b/.test(m)) return null

  const field: AggregateField | null =
    /\bmaintenance\b/.test(m) ? 'maintenance'
      : /\bper\s*sq|\bpsf\b|\bsq\.?\s*ft\b|\bsqft\b|\brate\b/.test(m) ? 'price_per_sqft'
      : /\b(price|cost|prices|ticket\s+size)\b/.test(m) ? 'price'
      : /\b(projects?|societies|society|developments?|properties)\b/.test(m) ? 'projects'
      : null
  if (!field) return null

  let metric: AggregateMetric | null = null
  if (/\b(average|avg|mean)\b/.test(m)) metric = 'avg'
  else if (/\bmedian\b/.test(m)) metric = 'median'
  else if (/\b(lowest|minimum)\b/.test(m) && field !== 'projects') metric = 'min'
  else if (/\b(highest|maximum)\b/.test(m) && field !== 'projects') metric = 'max'
  else if (/\b(how\s+many|number\s+of|count\s+of)\b/.test(m) && field === 'projects') metric = 'count'

  const sectors = [...m.matchAll(/\bsec(?:tor)?\s*-?\s*(\d{1,3}[a-z]?)\b/g)].map((x) => x[1])
  // Two sectors is a comparison; the sector-comparison path answers it.
  if (sectors.length > 1) return null

  const possession = m.match(/\b(?:possession|handover|delivery|ready)\s+(before|by|in)\s+(?:the\s+end\s+of\s+)?(20\d{2})\b/)
  const possessionBefore = possession
    ? new Date(Date.UTC(Number(possession[2]) + (possession[1] === 'before' ? 0 : 1), 0, 1))
    : undefined
  const amenity = AMENITIES.find(([re]) => re.test(m))?.[1]

  // "Which projects have a clubhouse and possession before 2027": a filter
  // discovery cannot apply, so it is answered as a list here.
  if (!metric && field === 'projects' && (amenity || possessionBefore) && /\b(which|list|show|all)\b/.test(m)) metric = 'list'
  if (!metric) return null

  const bhk = m.match(/\b(\d)\s*-?\s*bhk\b/)
  const budget = m.match(/\b(?:under|below|within|up\s*to|less\s+than)\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(cr|crores?|l|lakhs?|lacs?)\b/)
  const city = /\b(greater\s+noida\s+west|gnw|noida\s+extension)\b/.test(m) ? 'Greater Noida West'
    : /\bgreater\s+noida\b/.test(m) ? 'Greater Noida'
    : /\bnoida\b/.test(m) && !sectors.length ? 'Noida'
    : undefined
  const status: Status | undefined = /\bready[\s-]*to[\s-]*move\b|\brtm\b/.test(m) ? 'ready_to_move'
    : /\bunder[\s-]*construction\b/.test(m) ? 'under_construction'
    : /\bnew\s+launch/.test(m) ? 'new_launch'
    : undefined

  const builder = await builderIn(message)
  // An average needs a place or a builder. "Average price in Delhi" names
  // neither (Delhi is not a city we tag), and must not quietly become the
  // average of our whole catalogue.
  if (['avg', 'median', 'min', 'max'].includes(metric) && !sectors.length && !city && !builder) return null

  return {
    metric,
    field,
    sector: sectors[0] ? `Sector ${sectors[0].toUpperCase()}` : undefined,
    city,
    builder,
    bhk: bhk ? Number(bhk[1]) : undefined,
    maxBudgetCr: budget ? Number(budget[1]) / (budget[2].startsWith('c') ? 1 : 100) : undefined,
    status,
    possessionBefore,
    amenity,
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────

function fmt(field: AggregateField, v: number): string {
  if (field === 'price') return v >= 1 ? `₹${v.toFixed(2)} Cr` : `₹${Math.round(v * 100)} lakh`
  if (field === 'maintenance') return `₹${v.toFixed(2)}/sq.ft per month`
  return `₹${Math.round(v).toLocaleString('en-IN')}/sq.ft`
}

function scopeLabel(q: ProjectQuery): string {
  const parts: string[] = []
  if (q.bhk) parts.push(`${q.bhk}BHK`)
  if (q.status) parts.push(q.status.replace(/_/g, ' '))
  parts.push('projects')
  if (q.builder) parts.push(`by ${q.builder}`)
  if (q.amenity) parts.push(`with a ${q.amenity === 'club' ? 'clubhouse' : q.amenity}`)
  if (q.sector) parts.push(`in ${q.sector}`)
  if (q.city) parts.push(`${q.sector ? ',' : 'in'} ${q.city}`.replace(' ,', ','))
  if (q.maxBudgetCr) parts.push(`under ₹${q.maxBudgetCr} Cr`)
  if (q.possessionBefore) parts.push(`${q.amenity ? 'and' : 'with'} possession before ${q.possessionBefore.getUTCFullYear()}`)
  return parts.join(' ').replace(/ ,/g, ',')
}

const FIELD_LABEL: Record<AggregateField, string> = {
  price: 'entry price',
  price_per_sqft: 'price per sq.ft',
  maintenance: 'maintenance',
  projects: 'projects',
}

export function renderAggregateAnswer(r: ProjectQueryResult): string {
  const q = r.query
  const scope = scopeLabel(q)

  if (!r.found) {
    return `None of the projects we hold match: ${scope}. Tell me which filter to relax — sector, budget or configuration — and I'll rerun it.`
  }

  if (q.metric === 'count' || q.metric === 'list') {
    const limit = Math.min(q.limit ?? 15, 25)
    const shown = r.rows.slice(0, limit)
    const table = ['| Project | Sector | Possession |', '| :--- | :--- | :--- |',
      ...shown.map((p) => `| ${p.name.replace(/\|/g, '/')} | ${p.sector} | ${p.possession ?? 'Not recorded'} |`)].join('\n')
    const more = r.matched > shown.length ? `\n\n${r.matched - shown.length} more match. Narrow it by sector or budget to see them.` : ''
    return `We hold **${r.matched}** ${scope}.\n\n${table}${more}`
  }

  if (!r.stats) {
    const why = r.excludedEstimated > 0
      ? ` ${r.excludedEstimated} of them carry only an estimated figure, which I won't average into a number you might act on.`
      : ''
    return `We hold ${r.matched} ${scope}, but none has a recorded ${FIELD_LABEL[q.field]} I can compute from.${why} The advisory team can get current figures from the builders.`
  }

  const s = r.stats
  const headline = q.metric === 'min' ? `Lowest ${FIELD_LABEL[q.field]}: **${fmt(q.field, s.min.value)}** at ${s.min.name} (${s.min.sector})`
    : q.metric === 'max' ? `Highest ${FIELD_LABEL[q.field]}: **${fmt(q.field, s.max.value)}** at ${s.max.name} (${s.max.sector})`
    : q.metric === 'median' ? `Median ${FIELD_LABEL[q.field]}: **${fmt(q.field, s.median)}**`
    : `Average ${FIELD_LABEL[q.field]}: **${fmt(q.field, s.avg)}**`

  const table = [
    '| | Value | Project |',
    '| :--- | :--- | :--- |',
    `| Average | ${fmt(q.field, s.avg)} | |`,
    `| Median | ${fmt(q.field, s.median)} | |`,
    `| Lowest | ${fmt(q.field, s.min.value)} | ${s.min.name} (${s.min.sector}) |`,
    `| Highest | ${fmt(q.field, s.max.value)} | ${s.max.name} (${s.max.sector}) |`,
  ].join('\n')

  const notes: string[] = [`${scope.charAt(0).toUpperCase()}${scope.slice(1)} — ${computedQualifier(r.used)}.`]
  if (r.used < r.matched) notes.push(`${r.matched - r.used} of the ${r.matched} matching projects have no recorded ${FIELD_LABEL[q.field]}${r.excludedEstimated ? ` (${r.excludedEstimated} only an estimate)` : ''} and are left out.`)
  if (r.used < 3) notes.push('That is too few projects to read as a trend.')
  if (r.used >= 5 && s.modeShare > 0.5) notes.push(`More than half of these projects carry the identical figure, which looks like a default rather than a measurement — treat the average with caution.`)
  if (q.field === 'price' && !q.bhk) notes.push('Entry price is the lowest configuration in each project.')

  return `${headline}\n\n${table}\n\n${notes.join(' ')}`
}
