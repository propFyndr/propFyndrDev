// backend/src/lib/discovery/facing.ts
//
// Which way a flat faces, as a buyer says it, mapped to the tokens we store.
//
// A buyer who "wants a property facing sunrise" wants an east-facing flat. Nothing
// connected the two: the search had no facing field, so the criterion was dropped
// and the answer was a generic list with a note to "verify tower orientation".
// The data is there (`UnitType.unit_orientations`: east_facing on 200 projects),
// it just was never asked for.
//
// This reads only what the message says. It does not guess from tone, and it does
// not read a direction that is part of a place or project name ("East Delhi",
// "Sunrise Heights"): a bare "east" is not a facing; "east facing", "facing east",
// "east side", "sunrise" and the Hindi forms are.
//
// Orientation is recorded per configuration, never per tower or floor, and only
// eight values exist in the data: east_facing, north_facing, park_facing,
// road_facing, pool_view, garden_view, golf_view, corner_unit. West and south are
// recognised so that asking for them gets an honest "we hold none", not silence.

export type FacingToken =
  | 'east_facing' | 'west_facing' | 'north_facing' | 'south_facing'
  | 'park_facing' | 'road_facing' | 'pool_view' | 'garden_view' | 'golf_view' | 'corner_unit'

const LABEL: Record<FacingToken, string> = {
  east_facing: 'east-facing',
  west_facing: 'west-facing',
  north_facing: 'north-facing',
  south_facing: 'south-facing',
  park_facing: 'park-facing',
  road_facing: 'road-facing',
  pool_view: 'pool view',
  garden_view: 'garden view',
  golf_view: 'golf view',
  corner_unit: 'corner unit',
}

/** How a stored token reads to a buyer. Unknown tokens read as plain words. */
export function facingLabel(token: string): string {
  return LABEL[token as FacingToken] ?? token.replace(/_/g, ' ')
}

/** "east-facing or north-facing". */
export function facingList(tokens: readonly string[], joiner = 'or'): string {
  const labels = tokens.map(facingLabel)
  return labels.length <= 1 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} ${joiner} ${labels[labels.length - 1]}`
}

const DIRECTION_WORDS: Record<'east' | 'west' | 'north' | 'south', string> = {
  east: '(?:east|eastern|purab|poorab|purvi|purv)',
  west: '(?:west|western|paschim|pashchim)',
  north: '(?:north|northern|uttar)',
  south: '(?:south|southern|dakshin)',
}
const TOKEN_OF: Record<keyof typeof DIRECTION_WORDS, FacingToken> = {
  east: 'east_facing', west: 'west_facing', north: 'north_facing', south: 'south_facing',
}

// Words that mark a direction as a FACING rather than a place.
const ANCHOR = '(?:facing|faces?|faced|side|direction|orientation|aspect|view|ward|wala|wali|wale|mukhi|disha|taraf)'

const COMPOUND: Array<[RegExp, FacingToken[]]> = [
  [/\bnorth[\s-]?east\b|\bne\b|\bishan\b/i, ['east_facing', 'north_facing']],
  [/\bnorth[\s-]?west\b|\bnw\b/i, ['north_facing', 'west_facing']],
  [/\bsouth[\s-]?east\b|\bse\b/i, ['south_facing', 'east_facing']],
  [/\bsouth[\s-]?west\b|\bsw\b/i, ['south_facing', 'west_facing']],
]

// Said without a direction word at all. Order matters: sunrise before sun.
const SUN: Array<[RegExp, FacingToken]> = [
  [/\b(?:sun\s?rise|sunrise|rising\s+sun|morning\s+(?:sun|sunlight|light)|early\s+(?:morning\s+)?sun|subah\s+ki\s+(?:dhoop|roshni)|suraj\s+(?:nikalta|ki\s+pehli))\b/i, 'east_facing'],
  [/\b(?:sun\s?set|sunset|setting\s+sun|evening\s+(?:sun|sunlight)|shaam\s+ki\s+dhoop)\b/i, 'west_facing'],
]

// A view or a position, which the data stores beside the compass directions.
const VIEWS: Array<[RegExp, FacingToken]> = [
  [new RegExp(`\\b(?:park|green)[\\s-]*(?:facing|view)\\b|\\bfacing\\s+(?:the\\s+)?park\\b|\\boverlooking\\s+(?:the\\s+)?park\\b`, 'i'), 'park_facing'],
  [new RegExp(`\\b(?:garden)[\\s-]*(?:facing|view)\\b|\\bfacing\\s+(?:the\\s+)?garden\\b|\\boverlooking\\s+(?:the\\s+)?garden\\b`, 'i'), 'garden_view'],
  [new RegExp(`\\b(?:pool|swimming\\s+pool)[\\s-]*(?:facing|view)\\b|\\bfacing\\s+(?:the\\s+)?(?:swimming\\s+)?pool\\b|\\boverlooking\\s+(?:the\\s+)?(?:swimming\\s+)?pool\\b`, 'i'), 'pool_view'],
  [new RegExp(`\\bgolf(?:\\s+course)?[\\s-]*(?:facing|view)\\b|\\bfacing\\s+(?:the\\s+)?golf\\b|\\boverlooking\\s+(?:the\\s+)?golf\\b`, 'i'), 'golf_view'],
  [new RegExp(`\\b(?:main\\s+)?road[\\s-]*(?:facing|view)\\b|\\bfacing\\s+(?:the\\s+)?(?:main\\s+)?road\\b`, 'i'), 'road_facing'],
  [/\bcorner\s+(?:unit|flat|apartment|property|house|side)s?\b/i, 'corner_unit'],
]

// "Sunrise Heights" is a place, not a direction.
const NAME_SUFFIX = /^\s*(?:heights?|apartments?|residen\w*|towers?|greens?|city|homes?|enclave|park|gardens?|court|plaza|villas?|estate|avenue|county|nest|valley|meadows?|society|builders?|developers?|infra\w*)\b/i

const NEGATION = /\b(?:not|no|avoid|except|without|never|nahi|nahin|nhi|mat|na)\b/i

// Hindi puts the negative after the phrase: "east facing flat nahi chahiye".
const NEGATION_AFTER = /^\s*(?:flats?\s+|wala\s+|wali\s+|wale\s+|mukhi\s+|disha\s+|facing\s+|side\s+|property\s+|apartments?\s+)*(?:nahi|nahin|nhi|mat)\b/i

function negatedBefore(text: string, index: number, length = 0): boolean {
  // Only the words just before, so "east facing, not west" negates west and not east.
  const before = text.slice(Math.max(0, index - 22), index)
  if (NEGATION.test(before) && !/[.?!;]\s*$/.test(before)) return true
  return length > 0 && NEGATION_AFTER.test(text.slice(index + length, index + length + 30))
}

/**
 * The facing tokens a message asks for, in the order stated. Empty when none.
 * A mention that is negated ("not east facing") asks for nothing.
 */
export function readFacing(message: string): FacingToken[] {
  const text = (message || '').toLowerCase()
  if (!text.trim()) return []
  // Remember where each was said, so the result is in the order the buyer said them.
  const at = new Map<FacingToken, number>()
  const add = (t: FacingToken, index = 0) => { if (!at.has(t) || index < (at.get(t) as number)) at.set(t, index) }

  // Compass compounds first, and consumed so "north east" is not also read as "north" + "east".
  let rest = text
  for (const [re, tokens] of COMPOUND) {
    const m = re.exec(rest)
    if (!m || negatedBefore(rest, m.index, m[0].length)) continue
    // A bare "ne"/"se" is too short to trust: it must sit next to an anchor word.
    const bare = m[0].length <= 2
    const near = rest.slice(Math.max(0, m.index - 12), m.index + m[0].length + 14)
    if (bare && !new RegExp(ANCHOR, 'i').test(near)) continue
    tokens.forEach((tok) => add(tok, m.index))
    rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length)
  }

  // A direction word counts only beside an anchor word: "east facing", "facing east", "east side".
  for (const dir of Object.keys(DIRECTION_WORDS) as Array<keyof typeof DIRECTION_WORDS>) {
    const word = DIRECTION_WORDS[dir]
    const patterns = [
      new RegExp(`\\b${word}[\\s-]*${ANCHOR}\\b`, 'g'),
      new RegExp(`\\b${ANCHOR}\\s+(?:the\\s+|towards?\\s+|to\\s+)?${word}\\b`, 'g'),
      // "east or north facing": the direction before the last one leads up to the anchor.
      new RegExp(`\\b${word}\\b(?=(?:\\s*(?:,|/|or|and|ya|aur)\\s*(?:east|west|north|south|purab|paschim|uttar|dakshin)\\w*)+[\\s-]*${ANCHOR}\\b)`, 'g'),
    ]
    for (const re of patterns) {
      for (const m of rest.matchAll(re)) {
        if (negatedBefore(rest, m.index ?? 0, m[0].length)) continue
        add(TOKEN_OF[dir], m.index ?? 0)
      }
    }
  }
  // Hindi direction words are not place names the way "east" is: bare is enough.
  for (const m of rest.matchAll(/\b(?:purab|poorab|purvi)\b/g)) if (!negatedBefore(rest, m.index ?? 0, m[0].length)) add('east_facing', m.index ?? 0)

  for (const [re, token] of SUN) {
    const m = re.exec(rest)
    if (!m || negatedBefore(rest, m.index, m[0].length)) continue
    if (NAME_SUFFIX.test(rest.slice(m.index + m[0].length))) continue
    add(token, m.index)
  }
  for (const [re, token] of VIEWS) {
    const m = re.exec(rest)
    if (m && !negatedBefore(rest, m.index, m[0].length)) add(token, m.index)
  }
  return [...at.entries()].sort((a, b) => a[1] - b[1]).map(([token]) => token)
}

/** "any facing", "direction doesn't matter": the buyer is lifting an earlier facing preference. */
export function clearsFacing(message: string): boolean {
  return /\b(?:any|no)\s+(?:particular\s+|specific\s+)?(?:facing|direction|orientation)\b|\b(?:facing|direction|orientation)\s+(?:doesn'?t|does\s+not|dont|don'?t)\s+matter\b|\bdirection\s+koi\s+bhi\b/i.test(message || '')
}

/** Does a unit's stored orientation list satisfy any wanted token? */
export function satisfiesFacing(orientations: readonly string[] | null | undefined, wanted: readonly string[]): boolean {
  return Boolean(orientations?.some((o) => wanted.includes(o)))
}
