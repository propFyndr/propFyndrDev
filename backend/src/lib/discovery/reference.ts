// backend/src/lib/discovery/reference.ts
//
// "Tell me about the first one" and "compare it with the second option".
//
// Measured on a 15-turn production run, both failed and both failed loudly:
//
//   T10  "tell me about the first one"        -> an essay about Jewar Airport
//   T14  "compare it with the second option"  -> "we currently only have ATS
//                                                Nobility in our verified
//                                                records"
//
// Two turns earlier the assistant had named five real projects in its own
// prose. Nothing resolved an ordinal against them, so "the first one" reached
// the entity lookup as the literal string "the first one", missed, and the
// general lane free-associated from an empty context.
//
// `ChatSession.last_projects` already holds the ordered set — it just had no
// reader for ordinal language.

/**
 * Ordinal words a buyer uses for a position in a list they were just shown.
 *
 * No bare numerals. "3" was in this alternation and "show me 3 options" only
 * escaped resolving to the third project because `option` is written plural
 * there and the word boundary failed — accidental, and "give me 2 project"
 * would have matched. An ordinal is written as an ordinal.
 */
const NOUN = '(?:one|option|project|society|choice|pick|listing|result)s?'
const ORDINALS: Array<[RegExp, number]> = [
  [new RegExp(`\\b(?:the\\s+)?(?:1st|first|topmost)\\s+${NOUN}\\b`, 'i'), 0],
  [new RegExp(`\\b(?:the\\s+)?(?:2nd|second)\\s+${NOUN}\\b`, 'i'), 1],
  [new RegExp(`\\b(?:the\\s+)?(?:3rd|third)\\s+${NOUN}\\b`, 'i'), 2],
  [new RegExp(`\\b(?:the\\s+)?(?:4th|fourth)\\s+${NOUN}\\b`, 'i'), 3],
  [new RegExp(`\\b(?:the\\s+)?(?:5th|fifth)\\s+${NOUN}\\b`, 'i'), 4],
  [new RegExp(`\\b(?:the\\s+)?last\\s+${NOUN}\\b`, 'i'), -1],
]

/**
 * A bare ordinal, with the noun left implicit.
 *
 * "tell me about the first", "what about the second" — common, and the noun
 * being absent is exactly why the entity extractor made a name out of it.
 */
const BARE_ORDINALS: Array<[RegExp, number]> = [
  [/\b(?:about|for|on)\s+(?:the\s+)?(?:1st|first)\b/i, 0],
  [/\b(?:about|for|on)\s+(?:the\s+)?(?:2nd|second)\b/i, 1],
  [/\b(?:about|for|on)\s+(?:the\s+)?(?:3rd|third)\b/i, 2],
]

export interface ShownProject {
  id: string
  name: string
  /** Entry price, when known — lets a superlative resolve. */
  priceMinCr?: number | null
}

/**
 * Superlatives point into the shown list too.
 *
 * Measured: "What is the per sqft rate on the cheapest one and what would the
 * total registry cost be?" — asked directly after six cards — answered neither
 * question. It returned a micro-market price table, because "the cheapest one"
 * resolved to nothing and the word "rate" then triggered the market table.
 *
 * Ordinals were handled and superlatives were not, which is an odd place to
 * draw the line: both are ways of pointing at a row the buyer can see.
 */
/**
 * The noun is mandatory, and "budget" and "premium" are not superlatives.
 *
 * The first version made the noun optional and included both words, so
 * "3bhk, my office is in sector 63, budget 2cr" matched — a buyer stating their
 * budget was read as pointing at the cheapest of a list that did not exist, and
 * the turn was answered with a request for clarification. It broke the demo
 * happy path on the first run after deploy.
 *
 * "budget" is how buyers state a constraint and "premium" describes a segment;
 * neither points at a row. A superlative needs its noun, or the explicit
 * "which is cheapest" form below.
 */
const SUPERLATIVE_NOUN = '(?:one|option|project|society|choice|pick|listing|flat|unit)s?'
const SUPERLATIVE_MIN = '(?:cheapest|lowest[- ]priced|least expensive|most affordable)'
const SUPERLATIVE_MAX = '(?:most expensive|costliest|priciest|dearest|highest[- ]priced)'
const SUPERLATIVES: Array<[RegExp, 'min' | 'max']> = [
  [new RegExp(`\\b(?:the\\s+)?${SUPERLATIVE_MIN}\\s+${SUPERLATIVE_NOUN}\\b`, 'i'), 'min'],
  [new RegExp(`\\b(?:the\\s+)?${SUPERLATIVE_MAX}\\s+${SUPERLATIVE_NOUN}\\b`, 'i'), 'max'],
  // "which is the cheapest?" — no noun, but unambiguous.
  [new RegExp(`\\bwhich\\s+(?:one\\s+)?is\\s+(?:the\\s+)?${SUPERLATIVE_MIN}\\b`, 'i'), 'min'],
  [new RegExp(`\\bwhich\\s+(?:one\\s+)?is\\s+(?:the\\s+)?${SUPERLATIVE_MAX}\\b`, 'i'), 'max'],
]

/** The cheapest or dearest of the shown set, when prices are known. */
export function resolveSuperlativeReference(
  message: string,
  shown: readonly ShownProject[],
): { project: ShownProject; kind: 'min' | 'max' } | null {
  if (!shown.length) return null
  for (const [re, kind] of SUPERLATIVES) {
    if (!re.test(message ?? '')) continue
    const priced = shown.filter(p => typeof p.priceMinCr === 'number')
    if (!priced.length) return null
    const sorted = [...priced].sort((a, b) => (a.priceMinCr as number) - (b.priceMinCr as number))
    const project = kind === 'min' ? sorted[0] : sorted[sorted.length - 1]
    return project ? { project, kind } : null
  }
  return null
}

/**
 * Which of the projects just shown does this message point at?
 *
 * Returns null when the message names no position, which is the common case —
 * a message naming a project outright is resolved by name elsewhere, and
 * guessing a position for it would answer about the wrong building.
 */
export function resolveOrdinalReference(
  message: string,
  shown: readonly ShownProject[],
): { project: ShownProject; index: number } | null {
  if (!shown.length) return null
  const text = (message ?? '').trim()
  if (!text) return null

  for (const [re, idx] of [...ORDINALS, ...BARE_ORDINALS]) {
    if (!re.test(text)) continue
    const index = idx === -1 ? shown.length - 1 : idx
    const project = shown[index]
    // An ordinal past the end of the list refers to nothing. Better to fall
    // through and let the turn ask than to answer about an arbitrary project.
    if (!project) return null
    return { project, index }
  }
  return null
}

/**
 * Every position the message points at — for "compare the first two", or
 * "compare it with the second option" where `it` is the project in focus.
 */
export function resolveOrdinalPair(
  message: string,
  shown: readonly ShownProject[],
  focusId?: string | null,
): ShownProject[] {
  const out: ShownProject[] = []
  const seen = new Set<string>()
  const push = (p?: ShownProject) => {
    if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p) }
  }

  // "compare it with the second" — `it` is whatever the session is focused on.
  if (/\b(?:it|this|that|the\s+(?:current|same)\s+(?:one|project))\b/i.test(message) && focusId) {
    push(shown.find((p) => p.id === focusId))
  }
  if (/\bfirst\s+two\b/i.test(message)) { push(shown[0]); push(shown[1]) }
  if (/\bfirst\s+three\b/i.test(message)) { push(shown[0]); push(shown[1]); push(shown[2]) }

  for (const [re, idx] of ORDINALS) {
    if (!re.test(message)) continue
    push(shown[idx === -1 ? shown.length - 1 : idx])
  }
  return out
}

/**
 * A message that answers its own pronoun.
 *
 * "What is EDC and IDC and do I have to pay them?" was read as pointing at a
 * shortlist, because `them` sits in the demonstrative arm below. Nothing had
 * been shown, so the buyer asking the single most common cost-sheet question
 * got "I've lost track of which options you mean" instead of an answer.
 *
 * `them` differs from `these` and `those`: it routinely refers backwards
 * inside the same sentence. A definition frame followed by enough words to
 * have named something is that case — the antecedent is in the message, so no
 * earlier list is needed. The length floor is what keeps a bare "what are
 * these?" out, which genuinely does need the list.
 */
const ANSWERS_ITS_OWN_PRONOUN = /(?:\bwhat\s+(?:is|are|does|do)\b.{12,}?\b(?:them|these|those)\b|\b(?:projects?|properties|flats?|apartments?|societies|options|builders?|developers?|sectors?)\b.{2,}?\b(?:them|these|those)\b|\b(?:show\s+me|find\s+me|list|recommend|suggest)\b.{2,}?\b(?:them|these|those)\b)/is

/**
 * Does this message rely on something shown earlier to mean anything at all?
 *
 * Used to decide that a turn must NOT be handed to the stateless general lane.
 * "the first one" carries no subject of its own; answering it without the list
 * is how a question about a shortlist became an essay about an airport.
 */
export function needsShownContext(message: string): boolean {
  const text = (message ?? '').trim()
  if (!text) return false
  return (
    ORDINALS.some(([re]) => re.test(text)) ||
    BARE_ORDINALS.some(([re]) => re.test(text)) ||
    (/\b(?:these|those|them|the\s+(?:above|ones?|shortlist|list|options))\b/i.test(text) &&
      !ANSWERS_ITS_OWN_PRONOUN.test(text)) ||
    /\bwhich\s+(?:of\s+)?(?:these|those|them)\b/i.test(text) ||
    /\bfirst\s+(?:two|three|four|couple)\b/i.test(text) ||
    SUPERLATIVES.some(([re]) => re.test(text))
  )
}

/**
 * The same pointer, aimed at a sector rather than a project.
 *
 * Measured: after "Sector 62 vs Sector 79", the follow-up "The second one."
 * resolved to nothing — `shown` holds projects, and two sectors had been
 * compared in prose without a card between them. The turn asked for
 * clarification, which is honest but is still a wasted turn on the single most
 * natural follow-up a comparison can have.
 *
 * A sector is not a row we can look up by id, so this returns the label and the
 * caller sets `intent.sector`. The ordered list comes from the last answer's own
 * text — the sectors it named, in the order it named them, which is exactly the
 * order the buyer is counting.
 */
const SECTOR_NOUN = '(?:one|option|sector|area|belt|location|choice|pick|micro[- ]?market)s?'
const SECTOR_ORDINALS: Array<[RegExp, number]> = [
  // String.raw, not a plain template: in a template literal `\b` is a backspace
  // character and `\s` is the letter s, so the pattern silently becomes
  // something that matches nothing. The alternations above predate this file's
  // move to interpolated nouns and escape by hand; raw is harder to get wrong.
  [new RegExp(String.raw`\b(?:the\s+)?(?:1st|first|former|topmost)\s+${SECTOR_NOUN}\b`, 'i'), 0],
  [new RegExp(String.raw`\b(?:the\s+)?(?:2nd|second|latter)\s+${SECTOR_NOUN}\b`, 'i'), 1],
  [new RegExp(String.raw`\b(?:the\s+)?(?:3rd|third)\s+${SECTOR_NOUN}\b`, 'i'), 2],
  [new RegExp(String.raw`\b(?:the\s+)?last\s+${SECTOR_NOUN}\b`, 'i'), -1],
  // Bare, noun implicit — "what about the second?", "the former".
  [/\b(?:about|for|on)\s+(?:the\s+)?(?:1st|first)\b/i, 0],
  [/\b(?:about|for|on)\s+(?:the\s+)?(?:2nd|second)\b/i, 1],
  // "former" and "latter" need no noun and no anchor — they are unambiguous
  // anaphors with no other meaning in a property conversation.
  [/\b(?:the\s+)?former\b/i, 0],
  [/\b(?:the\s+)?latter\b/i, 1],
]

/**
 * Sectors named in a block of text, in order, without repeats.
 *
 * Deliberately reads the ANSWER rather than a stored list: a sector comparison
 * is rendered as prose or a table, not as cards, so there is no `last_projects`
 * equivalent to read. The text the buyer just read is the list they are
 * pointing into.
 */
export function sectorsShownIn(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of (text ?? '').matchAll(/\bSector\s+(\d+[A-Za-z]?)\b/gi)) {
    const label = `Sector ${m[1].toUpperCase()}`
    if (seen.has(label)) continue
    seen.add(label)
    out.push(label)
  }
  return out
}

/**
 * Which of the sectors just named does this message point at?
 *
 * Requires at least two — a pointer into a list of one is not a pointer, and
 * resolving it would let "the second one" silently mean the only sector on
 * screen.
 */
export function resolveSectorReference(
  message: string,
  shown: readonly string[],
): { sector: string; index: number } | null {
  if (shown.length < 2) return null
  const text = (message ?? '').trim()
  if (!text) return null
  // A message that names a sector outright is not pointing at a position.
  if (/\bSector\s+\d/i.test(text)) return null

  for (const [re, idx] of SECTOR_ORDINALS) {
    if (!re.test(text)) continue
    const index = idx === -1 ? shown.length - 1 : idx
    const sector = shown[index]
    if (!sector) return null
    return { sector, index }
  }
  return null
}
