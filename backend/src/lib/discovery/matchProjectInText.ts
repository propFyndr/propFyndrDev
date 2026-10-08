// backend/src/lib/discovery/matchProjectInText.ts
//
// Which project does this message name?
//
// `claudeResponse.md` named this bug precisely and it was live in three places:
//
//     ctx.catalog.find(p => ctx.message.toLowerCase().includes(p.name.toLowerCase()))
//
// Two faults in one line. `.find()` returns the FIRST array element that
// matches, not the best one — and the array is `projectCatalog()`, a
// `findMany()` with no `orderBy`, so its order is Postgres heap order and
// changes with inserts and vacuum. And because the test is substring
// containment, a shorter name matches every message a longer name matches.
//
// Measured against the live database: **11 project names are a prefix of
// another project's name.**
//
//     ATS Pristine            / ATS Pristine & Golf Meadows
//     Maxblis White House     / Maxblis White House II
//     Lotus Greens Arena      / Lotus Greens Arena II
//     Lotus Boulevard         / Lotus Boulevard Espacia
//     Nirala Estate Phase 1   / Nirala Estate Phase 1 & 2
//     Antriksh Golf View      / Antriksh Golf View I / II
//     AIMS Golf Avenue I      / AIMS Golf Avenue I & II
//
// So "cost sheet for Maxblis White House II" could be answered with Maxblis
// White House — a different building, different RERA number, different
// possession date — and which one you got depended on heap order. These are
// phase-two towers of the same township: adjacent, differently priced, and
// years apart on handover.
//
// The rule is simply the longest match. A buyer who types more characters is
// being more specific, and the most specific name they matched is the one they
// meant.

export interface CatalogEntry {
  id: string
  name: string
}

/**
 * The most specific catalogue project named in this text, or null.
 *
 * `minLength` guards against a pathologically short project name matching
 * ordinary prose. Ties break on the id so the result is stable across
 * processes — never on array order, which is the fault being fixed.
 */
export function matchProjectInText<T extends CatalogEntry>(
  text: string,
  catalog: readonly T[],
  minLength = 4,
): T | null {
  const haystack = (text ?? '').toLowerCase()
  if (!haystack) return null

  let best: T | null = null
  for (const p of catalog) {
    const name = (p.name ?? '').toLowerCase()
    if (name.length < minLength || !haystack.includes(name)) continue
    if (
      best === null ||
      name.length > best.name.length ||
      (name.length === best.name.length && p.id < best.id)
    ) {
      best = p
    }
  }
  // No exact name in the text: fall back to the strict loose match below, so a
  // typo or a dropped word still reaches the row instead of "we don't hold it".
  return best ?? fuzzyMatchProject(haystack, catalog)
}

/**
 * Every catalogue project named in the text, most specific first, with names
 * that are merely a prefix of a longer match removed.
 *
 * For a comparison — "Maxblis White House II vs Lotus Boulevard Espacia" — the
 * caller wants both, and must not also receive "Maxblis White House" and
 * "Lotus Boulevard" as two extra projects that were never mentioned.
 */
export function matchProjectsInText<T extends CatalogEntry>(
  text: string,
  catalog: readonly T[],
  minLength = 4,
): T[] {
  const haystack = (text ?? '').toLowerCase()
  if (!haystack) return []

  const hits = catalog
    .filter(p => (p.name ?? '').length >= minLength && haystack.includes(p.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length || (a.id < b.id ? -1 : 1))

  // Drop a hit whose name sits inside a longer hit's name: it was matched by
  // the same characters, so it names no additional project.
  return hits.filter(
    (p, i) => !hits.slice(0, i).some(longer => longer.name.toLowerCase().includes(p.name.toLowerCase())),
  )
}

// ── Loose matches: typos, dropped words, partial names ──────────────────────
//
// The substring rule above is exact by design, so "Godrej Wods", "ATS Happy
// Trails" (DB: "ATS Homekraft Happy Trails") and "gaur city2" all missed, and
// the buyer was told we hold no such project while the row sat in the table.
// That is the worst failure a demo can show: a false "we don't have it".
//
// The loose rule works on words. A project's distinctive words are its name
// minus filler ("sector", "noida", "phase", "the"). A word in the message
// counts for a name word when it is equal, or within one edit (two for long
// words). A project is a match when at least two of its distinctive words are
// present, close together and in order, and they cover most of the name.
//
// Auto-resolution is deliberately strict — one clear winner, else nothing —
// because a confident wrong project is worse than a "did you mean".

const FILLER_WORDS = new Set([
  'the', 'and', 'of', 'at', 'by', 'in', 'a', 'an', 'sector', 'sec', 'noida', 'greater',
  'west', 'extension', 'ext', 'gnw', 'phase', 'tower', 'towers', 'project', 'projects',
])

function words(s: string): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(/&/g, ' ')
    // "city2" → "city 2", so a glued phase number still counts as a word.
    .replace(/([a-z])(\d)/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function nameWords(name: string): string[] {
  return [...new Set(words(name).filter(w => !FILLER_WORDS.has(w)))]
}

/** Levenshtein distance, bounded: returns max+1 as soon as it is exceeded. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

function wordMatches(nameWord: string, msgWord: string): boolean {
  if (nameWord === msgWord) return true
  // Numbers and short words must be exact: "150" is not "151", "ats" is not "ace".
  if (/\d/.test(nameWord) || nameWord.length < 5) return false
  return editDistance(nameWord, msgWord, nameWord.length >= 8 ? 2 : 1) <= (nameWord.length >= 8 ? 2 : 1)
}

export interface LooseHit<T> {
  project: T
  /** Share of the name's distinctive words found in the text, 0–1. */
  coverage: number
  matched: number
  /** Every name word was found, or at least one rare one was. */
  specific: boolean
}

// How many catalogue names carry each word. "golf", "view", "greens" sit in
// many names, so "a flat with a golf course view" must not resolve to
// "Antriksh Golf View" on those two words alone; "trails" sits in one.
const wordFrequencyCache = new WeakMap<readonly CatalogEntry[], Map<string, number>>()
function wordFrequency(catalog: readonly CatalogEntry[]): Map<string, number> {
  let df = wordFrequencyCache.get(catalog)
  if (!df) {
    df = new Map()
    for (const p of catalog) for (const w of nameWords(p.name)) df.set(w, (df.get(w) ?? 0) + 1)
    wordFrequencyCache.set(catalog, df)
  }
  return df
}

/** Every project the text loosely names, best first. */
export function looseProjectMatches<T extends CatalogEntry>(
  text: string,
  catalog: readonly T[],
): LooseHit<T>[] {
  const msg = words(text)
  if (msg.length === 0) return []
  const df = wordFrequency(catalog)
  const hits: LooseHit<T>[] = []
  for (const p of catalog) {
    const nw = nameWords(p.name)
    if (nw.length === 0) continue
    // Position of each name word in the message, in order.
    const positions: number[] = []
    let rare = false
    let from = 0
    for (const w of nw) {
      const at = msg.findIndex((m, i) => i >= from && wordMatches(w, m))
      if (at === -1) continue
      positions.push(at)
      if ((df.get(w) ?? 0) <= 2 && !/^\d+$/.test(w)) rare = true
      from = at + 1
    }
    const matched = positions.length
    // A one-word name ("Supertech Capetown" minus filler can be one word) needs
    // that word to be long enough to be a name, not prose.
    const enough = matched >= 2 || (nw.length === 1 && matched === 1 && nw[0].length >= 6)
    if (!enough) continue
    // Close together: "golf course with a park" does not name "Golf Park".
    const span = positions[positions.length - 1] - positions[0] + 1
    if (span > nw.length + 1) continue
    hits.push({ project: p, coverage: matched / nw.length, matched, specific: matched === nw.length || rare })
  }
  return hits.sort(
    (a, b) => b.coverage - a.coverage || b.matched - a.matched || a.project.name.length - b.project.name.length || (a.project.id < b.project.id ? -1 : 1),
  )
}

/**
 * The one project the text loosely names, or null when there is no clear
 * winner. Strict: most of the name present, and nothing else as good.
 */
export function fuzzyMatchProject<T extends CatalogEntry>(text: string, catalog: readonly T[]): T | null {
  const hits = looseProjectMatches(text, catalog).filter(h => h.coverage >= 0.6 && h.specific)
  if (hits.length === 0) return null
  const [best, next] = hits
  if (next && next.coverage === best.coverage && next.matched === best.matched) return null
  return best.project
}

/** Up to `limit` candidates for a "did you mean", looser than auto-resolution. */
export function suggestProjects<T extends CatalogEntry>(text: string, catalog: readonly T[], limit = 3): T[] {
  return looseProjectMatches(text, catalog)
    .filter(h => h.coverage >= 0.4 && h.specific)
    .slice(0, limit)
    .map(h => h.project)
}
