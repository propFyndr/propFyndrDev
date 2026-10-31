// backend/src/lib/discovery/projectRowRank.ts
//
// Which ROW does a project name point at, when several rows contain it?
//
// "Great Value Sharanam" is a substring of "Great Value Sharanam Greno", and
// "Jaypee Klassic" names the Sector 128 row while "Jaypee Klassic Block 6-10"
// is the Sector 134 one. Handlers asked Postgres for the first row whose name
// CONTAINS the text, with no orderBy, so the answer depended on heap order:
// the 31 Oct 2026 benchmark answered about Sector 1 when the buyer meant
// Sector 107 (F10, F16), and about a ready Sector 128 flat when the buyer said
// Sector 134 (F19).
//
// Rule: a sector the buyer typed beats an exact name, an exact name beats a
// longer one, and the shorter name wins what is left. Ties break on id so the
// pick never depends on array order.

export interface RankableRow {
  id: string
  name: string
  sector?: string | null
}

/** Sector tokens the text states outright: "Sector 134", "sec 143b" -> "134", "143b". */
export function statedSectors(text: string): Set<string> {
  const out = new Set<string>()
  for (const m of (text ?? '').matchAll(/\bsec(?:tor)?\.?\s*-?\s*(\d{1,3}[a-z]?)\b/gi)) out.add(m[1].toLowerCase())
  return out
}

/** "Sector 134" -> "134". Non-numbered localities ("Techzone 4") never match. */
export function sectorKey(sector: string): string {
  return (sector ?? '').toLowerCase().replace(/^sector\s*/, '').trim()
}

export function pickRow<T extends RankableRow>(rows: readonly T[], named: string, message = ''): T | null {
  if (rows.length === 0) return null
  const want = (named ?? '').trim().toLowerCase()
  const stated = statedSectors(message)
  const score = (r: T) =>
    (stated.size > 0 && r.sector && stated.has(sectorKey(r.sector)) ? 2 : 0) + (r.name.toLowerCase() === want ? 1 : 0)
  return [...rows].sort(
    (a, b) => score(b) - score(a) || a.name.length - b.name.length || (a.id < b.id ? -1 : 1),
  )[0]
}
