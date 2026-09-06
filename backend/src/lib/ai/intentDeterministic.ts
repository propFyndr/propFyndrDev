// backend/src/lib/ai/intentDeterministic.ts
//
// What the message says, read from the message.
//
// The old heuristic held one sector, one BHK and one budget number, and it had
// no notion of a range at all — so "anything above 2 crore" came out as
// `budgetMax: 2`, the exact inverse of the filter the buyer asked for, and
// "2 BHK and 3 BHK" lost the 3. Measured over a 25-case corpus of messages this
// session actually saw: 15 clean.
//
// That mattered more than it looks, because of what sat downstream. The gate in
// `intent.ts` gave up on any message with a comma, a question mark, "and", "or"
// or "vs" in it, and gave up unconditionally once previous intent existed — so
// from turn two onward EVERY turn paid a model round-trip, and the model was
// free to return `{}` and silently drop a sector the buyer had typed in full.
// That is how "Compare Sector 150 and Sector 137" ended up answered with a
// four-turn-old Sector 2 coverage reply.
//
// The rule this module exists to support: **a fact stated literally in the
// message is not the model's to overrule.** Everything here is a fact of that
// kind. Inference — purpose from tone, a workplace from "I work near HCL",
// a correction like "make that 2 crore" — stays the model's job.

import { extractSectorMentions } from '../discovery/sectorMentions'
import { canonicalSector } from '../discovery/normalize'

export interface DeterministicIntent {
  sectors: string[]
  bhk: number[]
  budgetMin?: number
  budgetMax?: number
  possession?: string
  areaMin?: number
  areaMax?: number
  /** Field names read literally from the message. The model may not clear these. */
  literal: Set<string>
}

/** Crore is the unit everything is stored in. */
function toCrore(value: number, unit: string): number {
  const u = unit.toLowerCase()
  if (u.startsWith('l')) return value / 100
  return value
}

/** A money amount and where it sat, so the words before it can be read. */
interface Amount {
  value: number
  index: number
}

const MONEY = /₹?\s*(\d+(?:\.\d+)?)\s*(crores?|cr\b|lakhs?|lacs?|l\b)/gi

/**
 * Every money amount in the message, in crore.
 *
 * A bare number inherits the unit of the amount after it, which is how people
 * write ranges: "between 90 lakh and 1.2 crore" states both units, but
 * "1-2 cr" and "between 1 and 2 crore" state only the last one.
 */
function amountsIn(text: string): Amount[] {
  const found: Amount[] = []
  for (const m of text.matchAll(MONEY)) {
    found.push({ value: toCrore(parseFloat(m[1]), m[2]), index: m.index ?? 0 })
  }
  if (found.length === 0) return found

  // A number immediately before the first stated amount, joined by a range
  // word, is the low end and shares its unit: "between 1 and 2 crore".
  const first = found[0]
  const before = text.slice(Math.max(0, first.index - 28), first.index)
  const bare = /(?:between|from|range\s+of)?\s*₹?\s*(\d+(?:\.\d+)?)\s*(?:-|–|to|and|or)\s*$/i.exec(before)
  if (bare) {
    const lowUnitless = parseFloat(bare[1])
    // Only when it reads as the same scale: "between 1 and 2 crore" yes,
    // "3 BHK and 2 crore" no — the bare number must not carry its own noun.
    const trailing = text.slice(Math.max(0, first.index - 28), first.index)
    if (!/\b(bhk|bed|bath|sq|floor|tower|year|month)\w*\s*(?:-|–|to|and|or)\s*$/i.test(trailing)) {
      found.unshift({ value: lowUnitless, index: first.index - bare[0].length })
    }
  }
  return found
}

/** Words that make an amount a floor rather than a ceiling. */
const ABOVE = /\b(above|over|more\s+than|greater\s+than|starting\s+(?:at|from)|minimum|min|at\s+least|upwards\s+of|north\s+of)\b/i
const BELOW = /\b(under|below|within|upto|up\s*to|less\s+than|maximum|max|at\s+most|no\s+more\s+than|budget\s+(?:is|of)?|afford)\b/i
const RANGE = /\b(between|from|range)\b|[-–]/i

function readBudget(text: string): { min?: number; max?: number } {
  const amounts = amountsIn(text)
  if (amounts.length === 0) return {}

  if (amounts.length >= 2) {
    const values = amounts.map(a => a.value).sort((x, y) => x - y)
    // Two amounts joined by range language is a band. What joins them is in the
    // span BETWEEN them — "1-2 cr" carries its hyphen there and nowhere else —
    // plus the run-up, which is where "between" and "from" sit.
    const span = text.slice(amounts[0].index, amounts[1].index + 1)
    const runUp = text.slice(Math.max(0, amounts[0].index - 20), amounts[0].index)
    if (RANGE.test(span) || RANGE.test(runUp) || /\b(and|to|or)\b/i.test(span)) {
      return { min: values[0], max: values[values.length - 1] }
    }
    return { max: values[values.length - 1] }
  }

  const only = amounts[0]
  const before = text.slice(Math.max(0, only.index - 30), only.index)
  if (ABOVE.test(before)) return { min: only.value }
  if (BELOW.test(before)) return { max: only.value }
  // Unqualified — "80 lakh", "my budget 1.5cr". A stated figure is a ceiling.
  return { max: only.value }
}

/**
 * Every configuration named, not just the first.
 *
 * "2 BHK and 3 BHK" and "2 and 3 BHK" both mean two configurations. The second
 * shape is the one the old single-match regex lost, and it is the commoner way
 * to write it.
 */
function readBhk(text: string): number[] {
  const found = new Set<number>()
  for (const m of text.matchAll(/(\d)\s*(?:bhk|bed\s?rooms?|bedrooms?|bhks)\b/gi)) {
    found.add(parseInt(m[1], 10))
  }
  // Bare numbers sharing a later "BHK": "2 and 3 BHK", "2, 3 or 4 BHK".
  const shared = /((?:\d\s*(?:,|and|or|to|-|–)\s*)+\d)\s*(?:bhk|bed\s?rooms?|bedrooms?)\b/i.exec(text)
  if (shared) {
    for (const d of shared[1].matchAll(/\d/g)) found.add(parseInt(d[0], 10))
  }
  return [...found].filter(n => n >= 1 && n <= 6).sort((a, b) => a - b)
}

function readPossession(text: string): string | undefined {
  if (/\bready\s*to\s*move\b|\brtm\b|\bimmediate\b|\basap\b|\bmove[- ]in\s+ready\b/i.test(text)) return 'immediate'
  if (/within\s*1\s*year|\b1\s*year\b|next\s*year/i.test(text)) return '1year'
  if (/within\s*2\s*years?|\b2\s*years?\b/i.test(text)) return '2year'
  if (/within\s*3\s*years?|\b3\s*years?\b|long\s*term/i.test(text)) return '3year+'
  return undefined
}

function readArea(text: string): { min?: number; max?: number } {
  const range = /(\d{3,5})\s*(?:to|–|-)\s*(\d{3,5})\s*(?:sq|sqft|sq\.?\s*ft|square\s*feet)/i.exec(text)
  if (range) return { min: parseInt(range[1], 10), max: parseInt(range[2], 10) }
  const about = /(?:about|around|approximately|roughly)\s*(\d{3,5})\s*(?:sq|sqft|sq\.?\s*ft|square\s*feet)/i.exec(text)
  if (about) {
    const n = parseInt(about[1], 10)
    return { min: Math.round(n * 0.9), max: Math.round(n * 1.1) }
  }
  return {}
}

/**
 * Read a message for the constraints it states outright.
 *
 * `knownSectorNumbers` is passed through to `extractSectorMentions` for its
 * anchored bare-number rule; an empty list still resolves every explicit
 * "Sector N", which is the common case.
 */
export function extractDeterministic(message: string, knownSectorNumbers: Iterable<string> = []): DeterministicIntent {
  const text = String(message ?? '')
  const literal = new Set<string>()

  // Canonicalised: the extractor lowercases while matching, so "Sector 16B"
  // came back "Sector 16b" and no longer equalled the column.
  const sectors = extractSectorMentions(text, knownSectorNumbers)
    .map(s => canonicalSector(s) ?? s)
  if (sectors.length > 0) literal.add('sector')

  const bhk = readBhk(text)
  if (bhk.length > 0) literal.add('bhk')

  const budget = readBudget(text)
  if (budget.min !== undefined) literal.add('budgetMin')
  if (budget.max !== undefined) literal.add('budgetMax')

  const possession = readPossession(text)
  if (possession) literal.add('possession')

  const area = readArea(text)
  if (area.min !== undefined) literal.add('areaMin')
  if (area.max !== undefined) literal.add('areaMax')

  return {
    sectors,
    bhk,
    budgetMin: budget.min,
    budgetMax: budget.max,
    possession,
    areaMin: area.min,
    areaMax: area.max,
    literal,
  }
}
