// backend/src/lib/discovery/commuteAnchor.ts
//
// "My office is in Sector 63" is the most valuable sentence a buyer says, and
// it was the sentence that broke the funnel.
//
// Measured on a 15-turn production run: the buyer said "central noida, sector
// 63 noida in particular for office". Intent extraction put `sector: "Sector
// 63"` on the search, the sector lane found no residential inventory there —
// correctly, it is a commercial district — and answered "It is a business
// district, not a residential sector. I can't pull the cost sheet or
// availability right now — connect with our advisory team." Then Sector 63
// stayed sticky, so the next two turns were also about Sector 63 and the chips
// still read "Check other configurations in Sector 63" five turns later.
//
// A workplace is not a place to buy. It is the point you measure FROM.

import { SECTOR_ADJACENCY } from './constants'
import { normalizeSectorName } from '../ai/intent'

/**
 * Phrasings that mark a place as somewhere the buyer GOES, not somewhere they
 * want to live. Both orders occur: "office in Sector 63" and "Sector 63 for
 * office".
 */
/**
 * An anchor is anywhere the buyer travels to regularly — not only an office.
 *
 * The first version listed office words alone, and the school case failed in
 * exactly the way the office case had: "i need a 3bhk under 2cr, my kids school
 * is in sector 62" set `sector: "Sector 62, Noida"`, Sector 62 holds one
 * project, and the buyer got "One project is not enough for me to tell you what
 * the sector is like to live in... The sectors we cover in most depth are
 * Sector 75, Sector 150, Sector 79" — offered three sectors with no relation to
 * the school, verbatim again on the next turn.
 *
 * A school run is a commute. So is the trip to a parent's house or a hospital
 * you visit weekly. Every one of them is a place to measure FROM.
 */
// `work` last, so the longer alternatives win first ("workplace" must not be
// matched as "work" and leave "place" behind). It has to be here at all because
// "sector 125 for work" is the commonest way to say it.
const ANCHOR_NOUN =
  '(?:office|workplace|work\\s?place|company|firm|campus|job|schools?|college|university|kids?\\s+school|children\'?s?\\s+school|daughter\'?s?\\s+school|son\'?s?\\s+school|hospital|clinic|parents|in\\s?-?laws|gym|work)'

// "is" alone has to count as a connector: "my workplace is Sector 16A" carries
// no in/at/near, and it is a perfectly ordinary way to say it.
const WORKPLACE_BEFORE = new RegExp(
  `\\b(?:my\\s+)?${ANCHOR_NOUN}\\s+(?:(?:is\\s+)?(?:in|at|near|around|close to)|is)\\s+([^.,?!]{2,40})`,
  'i',
)
// No connector at all, when what follows is plainly a sector: "office sec 62",
// "wife ka office sec 125". Restricted to a sector token so "office space" or
// "office building" never reads as a place.
const WORKPLACE_BARE_SECTOR = new RegExp(
  `\\b${ANCHOR_NOUN}\\s+(?:(?:ka|ki|ke)\\s+)?(sec(?:tor)?\\.?\\s*-?\\s*\\d{1,3}\\s*[a-d]?)\\b`,
  'i',
)
// The adverb is optional but common: "i commute daily to the expressway" put
// "daily" between the verb and the preposition and matched nothing.
const WORKPLACE_VERB =
  /\b(?:i\s+)?(?:work|working|commute|commuting|travel|travelling|traveling|drive|driving)(?:\s+(?:daily|everyday|every\s+day|regularly|often|each\s+day))?(?:\s+somewhere)?\s+(?:in|at|to|from|towards?|around|near|close to)\s+([^.,?!]{2,40})/i

/**
 * People the buyer visits, rather than a place they go to work.
 *
 * "my parents live in sector 50" is an anchor for the same reason an office is:
 * it is a trip they make regularly and it decides where they want to be.
 */
const ANCHOR_RESIDENTS =
  /\b(?:my\s+)?(?:parents|in\s?-?laws|family|mother|father|mom|dad)\s+(?:live|lives|living|stay|stays|staying|are|is)\s+(?:in|at|near)\s+([^.,?!]{2,40})/i
const WORKPLACE_AFTER = new RegExp(
  `([^.,?!]{2,40}?)\\s+(?:in\\s+particular\\s+)?(?:for|is)\\s+(?:my\\s+)?${ANCHOR_NOUN}\\b`,
  'i',
)

/**
 * Noida's employment sectors and the residential belts people commute from.
 *
 * `SECTOR_ADJACENCY` covers residential neighbours, and Sector 63 appears in it
 * only as a VALUE — so `getNearbySectors('Sector 63')` fell through to a
 * numeric ±1/±2/±5 guess and offered Sectors 64, 65 and 68, which are
 * industrial. These lists are the belts a buyer working in each hub actually
 * looks at, ordered by commute convenience.
 *
 * Curated rather than computed, for the same reason `SECTOR_ADJACENCY` is: the
 * project coordinates we hold cover residential sectors, so there is nothing in
 * the database to measure a commercial sector's position from. Adding a
 * plausible lat/lng instead is what the deleted centroid cache did.
 */
export const EMPLOYMENT_HUB_BELTS: Record<string, string[]> = {
  // The Sector 62/63/64 IT and corporate belt, north-east Noida.
  'Sector 62': ['Sector 75', 'Sector 76', 'Sector 77', 'Sector 78', 'Sector 50', 'Sector 121', 'Sector 120'],
  'Sector 63': ['Sector 76', 'Sector 75', 'Sector 77', 'Sector 78', 'Sector 50', 'Sector 121', 'Sector 120'],
  'Sector 64': ['Sector 76', 'Sector 75', 'Sector 77', 'Sector 78', 'Sector 121'],
  'Sector 65': ['Sector 76', 'Sector 75', 'Sector 77', 'Sector 78', 'Sector 121'],
  'Sector 60': ['Sector 75', 'Sector 76', 'Sector 50', 'Sector 121', 'Sector 120'],
  'Sector 61': ['Sector 75', 'Sector 76', 'Sector 50', 'Sector 121'],
  // Film City / media belt.
  'Sector 16A': ['Sector 93', 'Sector 93A', 'Sector 94', 'Sector 100', 'Sector 128'],
  'Sector 16': ['Sector 93', 'Sector 93A', 'Sector 100', 'Sector 128'],
  // The Expressway IT corridor.
  'Sector 125': ['Sector 128', 'Sector 134', 'Sector 135', 'Sector 137', 'Sector 100'],
  'Sector 126': ['Sector 128', 'Sector 134', 'Sector 137', 'Sector 100'],
  'Sector 132': ['Sector 134', 'Sector 135', 'Sector 137', 'Sector 143', 'Sector 128'],
  'Sector 135': ['Sector 134', 'Sector 137', 'Sector 143', 'Sector 128'],
  'Sector 142': ['Sector 143', 'Sector 137', 'Sector 150', 'Sector 144'],
  'Sector 144': ['Sector 143', 'Sector 137', 'Sector 150'],
  // Knowledge Park / Greater Noida institutional belt.
  'Knowledge Park': ['Sector 1', 'Sector 2', 'Sector 4', 'Sector 16B', 'Sector 12'],
}

export interface CommuteAnchor {
  /** The workplace as the buyer named it, normalised when it is a sector. */
  place: string
  /** Residential sectors to look in, closest-commute first. Possibly empty. */
  belt: string[]
  /** How the phrase was recognised, for the log. */
  reason: string
}

/**
 * The workplace named in this message, if any.
 *
 * Returns null for the ordinary case — a buyer naming a sector they want to
 * live in — because a false positive here would drop a real search filter.
 */
export function detectCommuteAnchor(message: string): CommuteAnchor | null {
  const text = (message ?? '').trim()
  if (!text) return null

  for (const [re, reason] of [
    [WORKPLACE_BEFORE, 'anchor noun named before the place'],
    [WORKPLACE_BARE_SECTOR, 'anchor noun followed directly by a sector'],
    [ANCHOR_RESIDENTS, 'family named as living at the place'],
    [WORKPLACE_VERB, 'work/commute verb before the place'],
    [WORKPLACE_AFTER, 'place named before "for office"'],
  ] as Array<[RegExp, string]>) {
    const raw = re.exec(text)?.[1]?.trim()
    if (!raw) continue

    // Keep only the sector phrase when the capture dragged in surrounding words
    // ("central noida, sector 63 noida" -> "Sector 63").
    const sector = /\bsec(?:tor)?\.?\s*[-\s]?(\d{1,3}\s*[a-d]?)\b/i.exec(raw)
    const label = sector ? `Sector ${sector[1].replace(/\s+/g, '').toUpperCase()}` : raw
    const place = (sector ? normalizeSectorName(label) : raw) ?? label
    if (place.length < 2) continue

    return { place, belt: beltFor(place), reason }
  }
  return null
}

/** The residential belt for a workplace: curated hub list, else adjacency. */
export function beltFor(place: string): string[] {
  const hub = EMPLOYMENT_HUB_BELTS[place]
  if (hub) return hub
  const adjacent = SECTOR_ADJACENCY[place]
  if (adjacent) return adjacent
  return []
}

/**
 * Strip a workplace mention out of the search filters and record it instead.
 *
 * Runs AFTER extraction, because extraction is what puts the workplace sector
 * into `intent.sector` in the first place. Mutating a copy keeps the caller's
 * merge semantics intact.
 */
export function applyCommuteAnchor<T extends Record<string, unknown>>(
  message: string,
  intent: T,
): { intent: T; anchor: CommuteAnchor | null } {
  const anchor = detectCommuteAnchor(message)
  if (!anchor) return { intent, anchor: null }

  const next = { ...intent } as Record<string, unknown>
  next.workplace = anchor.place
  next.workplace_belt = anchor.belt

  // The workplace must not survive as a search filter. Only clear `sector` when
  // it IS the workplace — a buyer can legitimately say "flats in 78, I work in
  // 63", and Sector 78 is then a real filter that has to stay.
  if (typeof next.sector === 'string' && normalizeSectorName(next.sector) === anchor.place) {
    delete next.sector
    delete next.spatialScope
  }

  return { intent: next as T, anchor }
}
