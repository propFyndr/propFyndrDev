// backend/src/lib/discovery/requirementChecklist.ts
//
// Per-criterion checklist for a recommended project: each criterion the buyer
// stated, compared directly against this project's own rows.
//
// Deliberately NOT derived from scoringEngine's dimensionExplanations: that
// engine scores missing data as a neutral 50, which renders ⚠️ — "we don't
// hold this" would read as "caution". Here an absent field is `unknown`,
// never a guess (CLAUDE.md § Fact Tiers).

import type { RequirementState } from './requirementState'
import { normalizeSectorName } from '../ai/intent'

export type ChecklistStatus = 'met' | 'caution' | 'unmet' | 'unknown'

export interface ChecklistRow {
  criterion: string
  status: ChecklistStatus
  note: string
}

/** The project fields this module reads. All optional: absent means unknown. */
export interface ChecklistProject {
  sector?: string | null
  city?: string | null
  price_min_cr?: number | null
  possession_date?: Date | string | null
  unit_types?: Array<{ bhk: number; price_min_cr?: number | null }> | null
  /** Card DTOs carry at most 10; `amenity_count` says whether that is all of them. */
  top_amenities?: Array<{ name: string }> | null
  amenity_count?: number | null
}

/** Card shows at this many stated criteria (Task 0.2, decided 2026-10-12). */
export const CHECKLIST_MIN_CRITERIA = 3

// Budget tolerance for a soft ceiling, matching the "Above the Stated Budget"
// block in the Recommendation Framework. A hard ceiling has zero tolerance.
const SOFT_BUDGET_TOLERANCE = 0.10

// On-site amenities we can check against the project's Amenity rows. Anything
// else the parser extracts (school, hospital, mall, market, metro_station,
// temple) is about proximity, which we don't hold per project — unknown.
const ONSITE_AMENITY: Record<string, RegExp> = {
  gym: /\bgym/i,
  clubhouse: /club\s*house/i,
  swimming_pool: /pool/i,
  park: /\bpark\b|garden/i,
  open_space: /open\s*space|green|landscap/i,
}

const AMENITY_LABEL: Record<string, string> = {
  metro_station: 'metro',
  swimming_pool: 'pool',
  open_space: 'open space',
}

const amenityLabel = (a: string) => AMENITY_LABEL[a] ?? a
const cr = (n: number) => `₹${Number(n.toFixed(2))} Cr`

function hasPossessionCriterion(s: RequirementState): boolean {
  return s.unit.status !== 'any' || s.unit.possessionDeadlineYears !== undefined
}

/** Stated criteria, one per category. */
export function countExplicitCriteria(s: RequirementState): number {
  return [
    s.budget.maxCr !== undefined,
    s.location.include.length > 0,
    s.unit.bhk.length > 0,
    hasPossessionCriterion(s),
    s.preferences.requiredAmenities.length > 0,
  ].filter(Boolean).length
}

function budgetRow(s: RequirementState, p: ChecklistProject): ChecklistRow {
  const max = s.budget.maxCr!
  // Cheapest unit in a BHK the buyer asked for, else the project's floor price.
  const wanted = (p.unit_types ?? []).filter(
    (u) => s.unit.bhk.includes(u.bhk) && typeof u.price_min_cr === 'number',
  )
  const price = wanted.length
    ? Math.min(...wanted.map((u) => u.price_min_cr as number))
    : p.price_min_cr ?? undefined
  const criterion = `Budget ≤ ${cr(max)}`
  if (price === undefined) return { criterion, status: 'unknown', note: 'Price not on record' }
  if (price <= max) return { criterion, status: 'met', note: `From ${cr(price)}` }
  const overPct = Math.round(((price - max) / max) * 100)
  const status = !s.budget.isHardCeiling && price <= max * (1 + SOFT_BUDGET_TOLERANCE) ? 'caution' : 'unmet'
  return { criterion, status, note: `From ${cr(price)}, ${overPct}% above` }
}

function locationRow(s: RequirementState, p: ChecklistProject): ChecklistRow {
  const wanted = s.location.include
  const criterion = wanted.join(' / ')
  if (!p.sector) return { criterion, status: 'unknown', note: 'Location not on record' }
  const sector = (normalizeSectorName(p.sector) ?? p.sector).toLowerCase()
  const city = (p.city ?? '').toLowerCase()
  const hit = wanted.some((w) => {
    const n = (normalizeSectorName(w) ?? w).toLowerCase()
    return n === sector || (city !== '' && n === city)
  })
  return hit
    ? { criterion, status: 'met', note: p.sector }
    : { criterion, status: 'unmet', note: `In ${p.sector}` }
}

function bhkRow(s: RequirementState, p: ChecklistProject): ChecklistRow {
  const criterion = `${s.unit.bhk.join(' or ')} BHK`
  const offered = [...new Set((p.unit_types ?? []).map((u) => u.bhk))].sort((a, b) => a - b)
  if (!offered.length) return { criterion, status: 'unknown', note: 'Configurations not on record' }
  return s.unit.bhk.some((b) => offered.includes(b))
    ? { criterion, status: 'met', note: 'Available' }
    : { criterion, status: 'unmet', note: `Offers ${offered.join(', ')} BHK` }
}

function possessionRow(s: RequirementState, p: ChecklistProject, now: Date): ChecklistRow {
  const { status, possessionDeadlineYears: years } = s.unit
  const criterion =
    status === 'ready_to_move' ? 'Ready to move'
    : years !== undefined ? `Possession within ${years} yr`
    : status === 'under_construction' ? 'Under construction'
    : 'Possession timeline'
  const date = p.possession_date ? new Date(p.possession_date) : undefined
  if (!date || isNaN(date.getTime())) return { criterion, status: 'unknown', note: 'Possession date not on record' }
  const when = date.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
  const ready = date <= now
  let ok: boolean
  if (status === 'ready_to_move') ok = ready
  else if (years !== undefined) {
    const deadline = new Date(now)
    deadline.setFullYear(deadline.getFullYear() + years)
    ok = date <= deadline
  } else if (status === 'under_construction') ok = !ready
  else ok = true
  return { criterion, status: ok ? 'met' : 'unmet', note: ready ? `Possession ${when}` : `Expected ${when}` }
}

function amenityRow(s: RequirementState, p: ChecklistProject): ChecklistRow {
  const asked = s.preferences.requiredAmenities
  const criterion = asked.map(amenityLabel).join(', ')
  const names = (p.top_amenities ?? []).map((a) => a.name)
  // A truncated list can't show an amenity is missing, only that it's present.
  const complete = names.length > 0 && (p.amenity_count ?? names.length) <= names.length
  const onsite = asked.filter((a) => ONSITE_AMENITY[a])
  const nearby = asked.filter((a) => !ONSITE_AMENITY[a])
  const missing = onsite.filter((a) => !names.some((n) => ONSITE_AMENITY[a].test(n)))
  const parts: string[] = []
  if (missing.length) parts.push(`${complete ? 'Not listed' : 'Not confirmed'}: ${missing.map(amenityLabel).join(', ')}`)
  if (nearby.length) parts.push(`Nearby ${nearby.map(amenityLabel).join(', ')} not verified`)
  if (!parts.length) return { criterion, status: 'met', note: 'All listed' }
  // Not being listed is not proof of absence, so a gap is caution, never unmet.
  const status: ChecklistStatus = complete && missing.length ? 'caution' : 'unknown'
  return { criterion, status, note: parts.join('; ') }
}

/**
 * Rows for each stated criterion, or null when fewer than
 * CHECKLIST_MIN_CRITERIA are stated (card not shown).
 */
export function buildRequirementChecklist(
  s: RequirementState,
  p: ChecklistProject,
  now: Date = new Date(),
): ChecklistRow[] | null {
  if (countExplicitCriteria(s) < CHECKLIST_MIN_CRITERIA) return null
  const rows: ChecklistRow[] = []
  if (s.budget.maxCr !== undefined) rows.push(budgetRow(s, p))
  if (s.location.include.length) rows.push(locationRow(s, p))
  if (s.unit.bhk.length) rows.push(bhkRow(s, p))
  if (hasPossessionCriterion(s)) rows.push(possessionRow(s, p, now))
  if (s.preferences.requiredAmenities.length) rows.push(amenityRow(s, p))
  return rows
}
