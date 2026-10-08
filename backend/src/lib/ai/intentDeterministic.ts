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
  /**
   * Sectors the buyer ruled out ("not in Sector 150, avoid 137"). Never search
   * filters: they are stripped from `sector` and `sectorsMentioned`, including
   * any the model put there.
   */
  excludedSectors?: string[]
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
  end: number
}

const MONEY = /₹?\s*(\d+(?:\.\d+)?)\s*(crores?|cr\b|lakhs?|lacs?|l\b)/gi

/**
 * "around 1.5 maybe 1.6 max", "under 1.5 in sector 150": no unit written, but
 * a budget word sits right against the number. Only read when the message
 * states no unit anywhere, only for crore-scale values, and never for a number
 * that carries its own noun ("1.5 km", "2 bhk") or is a sector.
 */
const UNITLESS = /(?<![\d.])(\d{1,2}(?:\.\d{1,2})?)(?![\d.]|\s*(?:bhk|bed|bath|sq|km|kms|yrs?|years?|months?|mins?|minutes?|hours?|hrs?|floors?|th\b|st\b|nd\b|rd\b|acres?|k\b|%|lakh|lac|cr))/gi
const UNITLESS_CUE_BEFORE = /(?:\b(?:budget|under|below|upto|up\s*to|max(?:imum)?|around|about|within|afford|less\s+than)\s*(?:is|of|around|about)?\s*|₹\s*)$/i
const UNITLESS_CUE_AFTER = /^\s*(?:max|maximum|tops)\b/i

function unitlessCroreAmounts(text: string): Amount[] {
  const found: Amount[] = []
  for (const m of text.matchAll(UNITLESS)) {
    const index = m.index ?? 0
    const value = parseFloat(m[1])
    if (value < 0.3 || value > 10) continue
    const before = text.slice(Math.max(0, index - 20), index)
    if (/\b(?:sector|sec)\.?\s*-?\s*$/i.test(before)) continue
    const after = text.slice(index + m[0].length)
    // A whole number needs "budget" itself: "under 2" is too often not money.
    const cued = m[1].includes('.')
      ? UNITLESS_CUE_BEFORE.test(before) || UNITLESS_CUE_AFTER.test(after)
      : /\bbudget\s*(?:is|of)?\s*$/i.test(before)
    if (cued) found.push({ value, index, end: index + m[0].length })
  }
  return found
}

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
    found.push({ value: toCrore(parseFloat(m[1]), m[2]), index: m.index ?? 0, end: (m.index ?? 0) + m[0].length })
  }
  if (found.length === 0) return unitlessCroreAmounts(text)

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
      found.unshift({ value: lowUnitless, index: first.index - bare[0].length, end: first.index })
    }
  }
  return found
}

/** Words that make an amount a floor rather than a ceiling. */
const ABOVE = /\b(above|over|more\s+than|greater\s+than|starting\s+(?:at|from)|minimum|min|at\s+least|upwards\s+of|north\s+of)\b/i
const BELOW = /\b(under|below|within|upto|up\s*to|less\s+than|maximum|max|at\s+most|no\s+more\s+than|budget\s+(?:is|of)?|afford)\b/i
const RANGE = /\b(between|from|range)\b|[-–]/i

/**
 * Amounts that are not what the buyer will spend: cash in hand, a down
 * payment, a price someone else quoted. "40 lakh cash, finance the rest" set a
 * ₹40 L ceiling, and "sales guy quoted 1.9cr, fair?" searched under ₹1.9 Cr.
 */
const NOT_A_BUDGET = /\b(?:cash|saved|savings|down\s*-?\s*payments?|dp|quoted?|quoting|asking|bol\s+rah[ae]|eoi|token|booking\s+amount|loans?|emis?)\b/i
/** "another ₹7 lakh", "₹8 lakh more": a top-up on top of something, not the ceiling. */
const TOP_UP_BEFORE = /\b(?:another|additional|extra)\s*$/i
const TOP_UP_AFTER = /^\s*(?:more|extra|additional)\b/i
/** A comma or sentence stop ends the clause an amount's qualifier can belong to. */
const CLAUSE_BREAK = /[,;]|\.(?!\d)/

/** "Sorry, I meant 1.35": the later figure replaces the earlier one. */
const CORRECTION = /\b(?:meant|sorry|correction|i\s+mean|actually|make\s+(?:it|that)|change\s+(?:it|that)\s+to)\b/i

/** "Up to 1.5, rather closer to 1.3": a preference inside the ceiling, not a band. */
const PREFERENCE_TO = /\b(?:closer|close|nearer|near|ideally|preferably|rather)\s+to\b/i

/**
 * Read only the words around THIS amount: stop at the neighbouring amounts and
 * at a clause break, so "₹90 lakh loan, budget 1.2 cr" marks the 90 and not
 * the 1.2.
 */
function isNonBudgetAmount(text: string, amounts: Amount[], i: number): boolean {
  const a = amounts[i]
  const from = Math.max(0, a.index - 18, i > 0 ? amounts[i - 1].end : 0)
  const to = Math.min(a.end + 16, i + 1 < amounts.length ? amounts[i + 1].index : text.length)
  const before = text.slice(from, a.index).split(CLAUSE_BREAK).pop() ?? ''
  const after = text.slice(a.end, Math.max(a.end, to)).split(CLAUSE_BREAK)[0]
  return NOT_A_BUDGET.test(`${before} ${after}`) || TOP_UP_BEFORE.test(before) || TOP_UP_AFTER.test(after)
}

/**
 * Amounts in the message that are NOT the buyer's budget (cash, a quote, a
 * down payment). Exported so `applyLiterals` can strip them from whatever the
 * model or the heuristic reader proposed — leaving `budgetMax` unpinned is not
 * enough, because those readers take any amount as a ceiling.
 */
export function nonBudgetAmounts(text: string): number[] {
  return amountsIn(text).filter((_, i, all) => isNonBudgetAmount(text, all, i)).map(a => a.value)
}

function readBudget(text: string): { min?: number; max?: number } {
  const amounts = amountsIn(text).filter((_, i, all) => !isNonBudgetAmount(text, all, i))
  if (amounts.length === 0) return {}

  if (amounts.length >= 2) {
    const values = amounts.map(a => a.value).sort((x, y) => x - y)
    // Two amounts joined by range language is a band. What joins them is in the
    // span BETWEEN them — "1-2 cr" carries its hyphen there and nowhere else —
    // plus the run-up, which is where "between" and "from" sit.
    const span = text.slice(amounts[0].index, amounts[1].index + 1)
    const runUp = text.slice(Math.max(0, amounts[0].index - 20), amounts[0].index)
    if (CORRECTION.test(span)) return { max: amounts[amounts.length - 1].value }
    if (PREFERENCE_TO.test(span)) return { max: values[values.length - 1] }
    if (RANGE.test(span) || RANGE.test(runUp) || /\b(and|to|or)\b/i.test(span)) {
      return { min: values[0], max: values[values.length - 1] }
    }
    return { max: values[values.length - 1] }
  }

  const only = amounts[0]
  const before = text.slice(Math.max(0, only.index - 30), only.index)
  if (/\b(?:not|no)\s+(?:more|greater|over|above)\b/i.test(before)) return { max: only.value }
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
  // Studio / 1RK / Serviced Suite detection
  if (/\b(?:studio|studios|1rk|1\s*rk|serviced\s+suite|serviced\s+apartment|managed\s+suite)\b/i.test(text)) {
    found.add(1)
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
  // "within a year", "in one year", "12 months" are the ways people say it;
  // missing them silently dropped the constraint from a four-fact one-liner.
  if (/\b(?:within|in)\s*(?:1|a|one)\s*year\b|\b(?:1|one)\s*year\b|\b(?:6|12)\s*months?\b|next\s*year/i.test(text)) return '1year'
  if (/\b(?:within|in)\s*(?:2|two)\s*years?\b|\b(?:2|two)\s*years?\b|\b(?:18|24)\s*months?\b/i.test(text)) return '2year'
  if (/within\s*3\s*years?|\b3\s*years?\b|long\s*term/i.test(text)) return '3year+'
  return undefined
}

/** "1,500 sq ft", "1400+ sq.ft", "130 sqm". Group 3 is the unit; metres convert. */
const AREA = /(\d{1,2},\d{3}|\d{2,5})\s*(\+)?\s*(sq\.?\s*(?:feet|ft|meters?|metres?|mtrs?|mt|m)?\b|square\s*(?:feet|foot|ft|meters?|metres?|m)\b)/i

function readArea(text: string): { min?: number; max?: number } {
  const m = AREA.exec(text)
  if (!m) return {}
  const toSqft = (s: string) => Math.round(parseInt(s.replace(',', ''), 10) * (/^(?:sq\.?\s*|square\s*)m/i.test(m[3]) ? 10.7639 : 1))
  const n = toSqft(m[1])
  const before = text.slice(Math.max(0, m.index - 25), m.index)
  const low = /(\d{1,2},\d{3}|\d{2,5})\s*(?:to|–|-)\s*$/.exec(before)
  if (low) return { min: toSqft(low[1]), max: n }
  if (m[2] || /\b(?:minimum|min|at\s+least|above|over|more\s+than)\s*(?:of\s*)?$/i.test(before)) return { min: n }
  if (/\b(?:maximum|max|under|below|upto|up\s*to|less\s+than|within)\s*(?:of\s*)?$/i.test(before)) return { max: n }
  // "about 1500 sq ft", or a size stated plainly: a band around it.
  return { min: Math.round(n * 0.9), max: Math.round(n * 1.1) }
}

/**
 * Read a message for the constraints it states outright.
 *
 * `knownSectorNumbers` is passed through to `extractSectorMentions` for its
 * anchored bare-number rule; an empty list still resolves every explicit
 * "Sector N", which is the common case.
 */
/**
 * Sector numbers ruled out by a negation in front of them, or Hinglish "nahi"
 * after them. Only filler words ("in", "the", "sector") may sit between the
 * negation and the number, so "not more than 1.5 cr in sector 150" and "not
 * extension maybe 150" do not exclude 150. A list carries the negation:
 * "except 137, 143 and 150" rules out all three.
 */
export function readExcludedSectorNumbers(text: string): Set<string> {
  const out = new Set<string>()
  const num = String.raw`\d{1,3}\s*[a-d]?\b(?!\.\d|\d|\s*(?:cr|crore|l|lakh|lac|k|bhk|%|sq|years?|yrs?|minutes?|mins?|km|kms|floors?|th\s+floor)\b)`
  const before = new RegExp(
    String.raw`\b(?:not|avoid|avoiding|except|excluding|exclude|skip|skipping|forget|drop|remove|don'?t\s+want|no)\b` +
    String.raw`(?:\s+(?:in|at|near|around|the|any|anything|from|projects?|properties|flats?|sectors?|secs?)\b\.?)*\s*-?\s*` +
    `(${num}(?:\\s*(?:,|and|or|&)\\s*${num}|\\s*(?:and|or|&)\\s*(?:sector|sec)\\.?\\s*-?\\s*${num})*)`,
    'gi',
  )
  const after = /\b(?:sector|sec)\.?\s*-?\s*(\d{1,3}\s*[a-d]?)\s+(?:nahi|mat|not|avoid)\b/gi
  for (const m of text.matchAll(before)) {
    for (const n of m[1].matchAll(/\d{1,3}\s*[a-d]?\b/gi)) out.add(n[0].replace(/\s+/g, '').toUpperCase())
  }
  for (const m of text.matchAll(after)) out.add(m[1].replace(/\s+/g, '').toUpperCase())
  return out
}

/** "Sector 150" -> "150", for comparing against excluded numbers. */
export function sectorNumberOf(sector: string): string | null {
  const m = /(\d{1,3}\s*[a-d]?)\b/i.exec(sector)
  return m ? m[1].replace(/\s+/g, '').toUpperCase() : null
}

export function extractDeterministic(message: string, knownSectorNumbers: Iterable<string> = []): DeterministicIntent {
  const text = String(message ?? '')
  const literal = new Set<string>()

  // Canonicalised: the extractor lowercases while matching, so "Sector 16B"
  // came back "Sector 16b" and no longer equalled the column.
  const excluded = readExcludedSectorNumbers(text)
  const mentioned = extractSectorMentions(text, knownSectorNumbers)
    .map(s => canonicalSector(s) ?? s)
  const sectors = mentioned.filter(s => !excluded.has(sectorNumberOf(s) ?? ''))
  const excludedSectors = [...excluded].map(n => `Sector ${n}`)
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
    excludedSectors,
    bhk,
    budgetMin: budget.min,
    budgetMax: budget.max,
    possession,
    areaMin: area.min,
    areaMax: area.max,
    literal,
  }
}
