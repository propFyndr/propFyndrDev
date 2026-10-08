// backend/src/lib/discovery/sectorMentions.ts
//
// Which sectors did the buyer actually name?
//
// Lifted out of chat-router.ts so it can be tested. It decides whether a turn
// is a sector-versus-sector comparison, and it got that wrong in the most
// visible way possible: "Show me the best projects between 1 and 2 crore" was
// answered with a Sector 1 vs Sector 2 comparison table, because the bare
// number scan fired on "between" and both 1 and 2 are real sector numbers.
//
// Rules 4b/4c/5 below fixed a second live failure: "15A93" (meant as Sector
// 15A and Sector 93) extracted nothing at all, because neither half is a
// sector we hold inventory in (we hold 93A/93B, not bare 93; nothing in 15A).
// `isPlausibleSectorToken` widens "known" to anything `getSectorLocation`
// resolves — Noida's whole 1-168 numeric range plus the named Greater Noida
// groups — so a real sector the buyer names is recognised even when our
// catalogue holds no project there. Recognising it is what lets the turn
// answer honestly ("we don't list Sector 15A") instead of silently searching
// citywide or falling to a web-grounded guess.

import { getSectorLocation } from './sectorToCity'

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
 * A number is only "sector 93" shorthand once in a while; most of the time
 * it's a BHK count, a budget, an area or a year. Real-estate words that
 * reliably accompany a sector reference when the word "sector" itself is
 * missing — deliberately narrow, and deliberately excludes bare comparison
 * words ("better", "vs"): `extractSectorMentions('is 76 better than 75?', …)`
 * must stay `[]` (no anchor), and widening this to comparison words alone
 * would resolve that exact sentence as a sector pair.
 */
const BARE_NUMBER_SIGNAL = /\b\d\s*bhk\b|\bcrore?\b|\blakh\b|\blac\b|\bbudget\b|\bmein\b|\bme\b|\bwala\b|\bside\b|\bnear\b|\bliye\b|\bjagah\b/i

/**
 * Is `tok` ("150", "15a", "93") a sector that could exist, whether or not we
 * hold a project there? `known` is the DB-held set (lowercased, no "Sector "
 * prefix); the fallback is Noida's documented 1-168 numeric range via
 * `getSectorLocation`, which already encodes GNW/YEIDA's own numbering
 * separately from Noida's. A held sector is always plausible; the reverse
 * isn't true, and that gap is exactly what this function closes.
 */
function isPlausibleSectorToken(tok: string, known: Set<string>): boolean {
  const lower = tok.toLowerCase()
  if (known.has(lower)) return true
  const m = /^(\d{1,3})([a-d]?)$/i.exec(tok)
  if (!m) return false
  const num = parseInt(m[1], 10)
  if (num < 1 || num > 168) return false
  return getSectorLocation(`Sector ${tok}`) !== null
}

/**
 * Sectors named in a message, as canonical "Sector N" strings.
 *
 * `knownSectorNumbers` is the bare number of every sector we hold ("150",
 * "10", "137"). It anchors the bare-number rules, and is widened to any
 * plausible Noida/GNW sector by `isPlausibleSectorToken` — see that
 * function's comment for why holding inventory isn't the bar for
 * "recognised".
 */
export function extractSectorMentions(msg: string, knownSectorNumbers: Iterable<string>): string[] {
  const normalized = String(msg ?? '').toLowerCase()
  const found = new Set<string>()
  const known = new Set([...knownSectorNumbers].map(s => s.toLowerCase()))

  // 1. Explicit "sector N" — and "sectorS N", which matched nothing at all.
  //
  // `\bsector\s*` requires whitespace after "sector", so the plural form failed
  // outright: "sectors 1 and 2" and "compare sectors 75 and 78" both extracted
  // ZERO sectors, and the turn fell through to whatever sticky state it had.
  // Reported from live use, reproduced exactly. "sec"/"secs" is the same word,
  // abbreviated — "sec 62 near metro" matched nothing for the same reason.
  for (const m of normalized.matchAll(/\b(?:sectors?|secs?)\.?\s*(\d+[a-z]?)\b/gi)) {
    found.add(`Sector ${m[1].toUpperCase()}`)
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
    String.raw`\b(?:sectors?|secs?)\.?\s*(\d+[a-z]?)((?:${LIST_JOINER}(?:(?:sectors?|secs?)\.?\s*)?\d+[a-z]?)+)`,
    'gi',
  )
  for (const m of normalized.matchAll(listRun)) {
    found.add(`Sector ${m[1].toUpperCase()}`)
    const tail = m[2] ?? ''
    const from = (m.index ?? 0) + m[1].length
    for (const item of tail.matchAll(/(\d+[a-z]?)/gi)) {
      const num = item[1]
      if (!carriesUnit(num, from)) found.add(`Sector ${num.toUpperCase()}`)
    }
  }

  // 3. A bare number is a sector only alongside a sector we already named.
  //
  // Without that anchor this scanned every 1–3 digit token in any message
  // containing "compare", "between" or "vs", and promoted anything that
  // happened to be a sector number we hold. We hold Sectors 1 through 168, so
  // every budget, BHK count and carpet area matched.
  if (found.size === 1 && COMPARISON_CONTEXT.test(normalized)) {
    const withoutDecimals = normalized.replace(/\d+\.\d+/g, ' ')
    for (const m of withoutDecimals.matchAll(/\b(\d{1,3}[a-z]?)\b/gi)) {
      const tok = m[1]
      if (isPlausibleSectorToken(tok, known) && !carriesUnit(tok)) {
        found.add(`Sector ${tok}`)
      }
    }
  }

  // 4. Shorthand single token query (e.g. "15A", "150", "sec 15a", "15-a")
  if (found.size === 0) {
    const cleaned = normalized.trim().replace(/^(?:sec|sector)\.?\s*/i, '').replace(/-/g, '')
    if (isPlausibleSectorToken(cleaned, known)) {
      found.add(`Sector ${cleaned.toUpperCase()}`)
    }
  }

  /**
   * 4b. A short fragment of separated bare tokens and nothing else: "15a 93",
   * "15A, 93", "15a/93", "15a & 93", "15a and 93", "150 ya 137". No "sector"
   * word anywhere — reported live as "15A93" (one run-together token; see 4c)
   * and its spaced and punctuated variants, all of which lost both halves.
   *
   * Guarded against reading two ordinary numbers as sectors: at least one
   * part must carry a letter suffix ("15a 93"), or the message must use an
   * explicit connector word or punctuation ("150 and 137", "150, 137") —
   * bare whitespace between two plain numbers alone ("137 150") stays
   * unresolved, same caution as rule 3's anchor requirement.
   */
  if (found.size === 0) {
    const stripped = normalized.trim().replace(/^(?:sec|sector)\.?\s*/i, '').replace(/[?!.,;:]+$/, '')
    const CONNECTOR_WORDS = new Set(['and', 'or', 'ya', 'vs', 'vs.', 'versus'])
    const parts = stripped
      .split(/[\s,&/-]+/)
      .map(p => p.trim().replace(/[?!.,;:]+$/, ''))
      .filter(p => p && !CONNECTOR_WORDS.has(p))
    const hasLetter = parts.some(p => /[a-d]$/i.test(p))
    const hadExplicitConnector = /[,&/]|\b(?:and|or|ya|vs\.?|versus)\b/i.test(stripped)
    if (
      parts.length >= 2 && parts.length <= 4 &&
      parts.every(p => /^\d{1,3}[a-d]?$/i.test(p)) &&
      (hasLetter || hadExplicitConnector) &&
      parts.every(p => isPlausibleSectorToken(p, known))
    ) {
      for (const p of parts) found.add(`Sector ${p.toUpperCase()}`)
    }
  }

  /**
   * 4c. One glued token, no separator at all: "15A93". The letter suffix is
   * the only safe place to cut — it is where the first sector ends in every
   * real example ("15A" + "93", "93A" + "15") — so a glued run with no
   * letter at all ("1593") is left alone rather than guessed at: "15|93",
   * "159|3" and "1|593" are equally plausible splits with nothing to choose
   * between them, and guessing wrong is worse than asking.
   */
  if (found.size === 0) {
    const stripped = normalized.trim().replace(/^(?:sec|sector)\.?\s*/i, '').replace(/[?!.,;:]+$/, '')
    const glued = /^(\d{1,3}[a-d])(\d{1,3}[a-d]?)$/i.exec(stripped)
    if (glued && isPlausibleSectorToken(glued[1], known) && isPlausibleSectorToken(glued[2], known)) {
      found.add(`Sector ${glued[1].toUpperCase()}`)
      found.add(`Sector ${glued[2].toUpperCase()}`)
    }
  }

  /**
   * 5. A bare number with no unit, in a message that carries its own
   * real-estate signal (a BHK count, a money word, a Hinglish locative), is a
   * sector named without the word "sector". "noida 150 3bhk 1.5" and "kya
   * 150 mein 2bhk mil jayega 1 cr mein" both dropped 150 silently — the fast
   * path then read the BHK and budget alone and searched citywide.
   *
   * Deliberately NOT triggered by comparison words alone ("better", "vs") —
   * see `BARE_NUMBER_SIGNAL`'s comment — and deliberately stops at the first
   * qualifying token: a message with a real signal and ONE bare number names
   * one sector, and finding a second bare "sector" in the same sentence is
   * ambiguous enough to leave to the model.
   */
  if (found.size === 0 && BARE_NUMBER_SIGNAL.test(normalized)) {
    const withoutDecimals = normalized.replace(/\d+\.\d+/g, ' ')
    const bhkDigits = new Set([...withoutDecimals.matchAll(/\b(\d)\s*bhk\b/gi)].map(m => m[1]))
    for (const m of withoutDecimals.matchAll(/\b(\d{1,3}[a-z]?)\b/gi)) {
      const tok = m[1]
      if (bhkDigits.has(tok)) continue
      // A bare single digit ("1", "2") stays ambiguous in this unanchored
      // case — too easily a stray count rather than a sector — even though
      // Sector 1 and Sector 2 both exist. Two digits or a letter suffix only.
      if (tok.replace(/[a-z]$/i, '').length < 2) continue
      if (isPlausibleSectorToken(tok, known) && !carriesUnit(tok)) {
        found.add(`Sector ${tok}`)
        break
      }
    }
  }

  return [...found]
}
