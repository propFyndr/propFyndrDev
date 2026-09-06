// backend/src/lib/discovery/sectorMentions.ts
//
// Which sectors did the buyer actually name?
//
// Lifted out of chat-router.ts so it can be tested. It decides whether a turn
// is a sector-versus-sector comparison, and it got that wrong in the most
// visible way possible: "Show me the best projects between 1 and 2 crore" was
// answered with a Sector 1 vs Sector 2 comparison table, because the bare
// number scan fired on "between" and both 1 and 2 are real sector numbers.

/**
 * A number carrying a unit is not a sector.
 *
 * "1 and 2 crore", "2 and 3 BHK", "1200 to 1400 sq ft" — the old scan promoted
 * every one of these to a sector pair. The unit is the disambiguator, and it
 * always sits immediately after the number.
 */
const UNIT_AFTER =
  /^\s*(?:(?:\+|-|–|to|and|or|&)\s*\d+(?:\.\d+)?\s*)?\s*(?:cr\b|crore|crores|lakh|lac|lakhs|l\b|bhk|bedroom|bed\b|bathroom|bath\b|sq\.?\s*(?:ft|m|yd)|sqft|sqm|yard|acre|km\b|kms\b|min(?:ute)?s?\b|year|yr|month|%|percent|rs\.?|₹|inr)/i

const COMPARISON_CONTEXT = /compare|vs|versus|better|difference|between|which\s+sector/i

/**
 * Sectors named in a message, as canonical "Sector N" strings.
 *
 * `knownSectorNumbers` is the bare number of every sector we hold ("150",
 * "10", "137"). It is only consulted for the anchored bare-number rule.
 */
export function extractSectorMentions(msg: string, knownSectorNumbers: Iterable<string>): string[] {
  const normalized = String(msg ?? '').toLowerCase()
  const found = new Set<string>()

  // 1. Explicit "sector N" — and "sectorS N", which matched nothing at all.
  //
  // `\bsector\s*` requires whitespace after "sector", so the plural form failed
  // outright: "sectors 1 and 2" and "compare sectors 75 and 78" both extracted
  // ZERO sectors, and the turn fell through to whatever sticky state it had.
  // Reported from live use, reproduced exactly.
  for (const m of normalized.matchAll(/\bsectors?\s*(\d+[a-z]?)\b/gi)) {
    found.add(`Sector ${m[1]}`)
  }

  /**
   * Every standalone occurrence of the token must carry a unit.
   *
   * A plain `indexOf` was not enough: looking for "1" in "sector 150 between 1
   * and 2 crore" lands inside "150", reads "50 between" after it, sees no unit
   * and promotes Sector 1. The token has to be matched on word boundaries, and
   * if it appears more than once, a single unit-free occurrence is a real
   * sector mention.
   */
  const carriesUnit = (num: string, from = 0): boolean => {
    const scan = new RegExp(`\\b${num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    scan.lastIndex = from
    let seen = false
    let m: RegExpExecArray | null
    while ((m = scan.exec(normalized)) !== null) {
      seen = true
      if (!UNIT_AFTER.test(normalized.slice(m.index + num.length, m.index + num.length + 24))) return false
    }
    return seen
  }

  /**
   * 2. The word "sector" carries across a whole list, not just one neighbour.
   *
   * "Sector 76 vs 75" was handled as a special case for exactly two numbers,
   * which left "sectors 150, 137 and 128" extracting only the first. The unit
   * a buyer states once governs every item in the run — the same convention
   * that makes "1 crore and 2 crores" a band and "2 and 3 BHK" two
   * configurations. Sectors were the one place it was not applied.
   *
   * Each continuation is still checked for a unit of its own, so "sector 150
   * and 2 crore" adds Sector 150 and stops.
   */
  const LIST_JOINER = String.raw`\s*(?:,|&|vs\.?|versus|with|and|or|to|compared\s+to)\s*`
  const listRun = new RegExp(
    String.raw`\bsectors?\s*(\d+[a-z]?)((?:${LIST_JOINER}(?:sectors?\s*)?\d+[a-z]?)+)`,
    'gi',
  )
  for (const m of normalized.matchAll(listRun)) {
    found.add(`Sector ${m[1]}`)
    const tail = m[2] ?? ''
    const from = (m.index ?? 0) + m[1].length
    for (const item of tail.matchAll(/(\d+[a-z]?)/gi)) {
      const num = item[1]
      if (!carriesUnit(num, from)) found.add(`Sector ${num}`)
    }
  }

  // 3. A bare number is a sector only alongside a sector we already named.
  //
  // Without that anchor this scanned every 1–3 digit token in any message
  // containing "compare", "between" or "vs", and promoted anything that
  // happened to be a sector number we hold. We hold Sectors 1 through 168, so
  // every budget, BHK count and carpet area matched.
  if (found.size === 1 && COMPARISON_CONTEXT.test(normalized)) {
    const known = new Set([...knownSectorNumbers].map(s => s.toLowerCase()))
    const withoutDecimals = normalized.replace(/\d+\.\d+/g, ' ')
    for (const m of withoutDecimals.matchAll(/\b(\d{1,3}[a-z]?)\b/gi)) {
      const tok = m[1]
      if (known.has(tok.toLowerCase()) && !carriesUnit(tok)) {
        found.add(`Sector ${tok}`)
      }
    }
  }

  return [...found]
}
