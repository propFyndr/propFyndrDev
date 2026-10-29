// backend/src/lib/chat/statusLine.ts
//
// The first thing the buyer sees from the server, sent as soon as the stream
// opens (Day 0: a sign of life within 1 second). Read off the message alone,
// before any lookup, so it names only what the buyer typed: a sector, an area,
// or nothing. Never a project name, which is not checked against our rows yet.

const AREAS: Array<[RegExp, string]> = [
  [/\b(?:greater\s*noida\s*west|noida\s*extension|gnw)\b/i, 'Greater Noida West'],
  [/\bgreater\s*noida\b/i, 'Greater Noida'],
  [/\b(?:noida\s*)?expressway\b/i, 'Noida Expressway'],
]

export function firstStatusLine(message: string): string {
  const text = message ?? ''
  const sectors = [...new Set([...text.matchAll(/\bsec(?:tor)?\.?\s*(\d{1,3}[a-z]?)\b/gi)].map((m) => m[1].toUpperCase()))]
  if (sectors.length === 1) return `Checking Sector ${sectors[0]} projects…`
  if (sectors.length > 1) return `Checking Sectors ${sectors.slice(0, -1).join(', ')} and ${sectors[sectors.length - 1]}…`
  const area = AREAS.find(([rx]) => rx.test(text))
  if (area) return `Checking ${area[1]} projects…`
  if (/\b\d\s*bhk\b|\d(?:\.\d+)?\s*(?:cr|crores?|lakhs?|l)\b/i.test(text)) return 'Looking through verified listings…'
  return 'Reading your question…'
}
