// What a project card says about possession and flags, kept out of the
// component so it can be tested without rendering.
//
// The backend makes the same calls when it builds a card's reasons and
// concerns (backend/src/lib/discovery/scoring.ts). This copy exists for cards
// that were stored before those fixes: a reopened chat shows the concerns it
// saved, raw tokens included.

const UNFINISHED = new Set(['under_construction', 'new_launch'])

/**
 * The note the backend appends to a card's possession label once its date has
 * passed on a project still being built (backend/src/lib/possession.ts).
 */
const PASSED_NOTE = /\s*\(possession date passed[^)]*\)/i

/** The label without that note, for text that says the date itself. */
export function withoutPassedNote(label: string | null | undefined): string {
  return (label ?? '').replace(PASSED_NOTE, '').trim()
}

/**
 * A stated possession date that has already passed on a project still being
 * built: a missed date, not a handover. Never "Ready to Move".
 *
 * Same rule as the backend (backend/src/lib/possession.ts): a date at or before
 * now on an under-construction or new-launch project. The backend's label note
 * also counts, for cards whose date was not sent.
 */
export function isPossessionDatePassed(
  p: { status?: string | null; possession_date?: string | Date | null; possession_label?: string | null },
  now: Date = new Date(),
): boolean {
  if (!p.status || !UNFINISHED.has(p.status)) return false
  if (p.possession_label && PASSED_NOTE.test(p.possession_label)) return true
  if (!p.possession_date) return false
  const t = new Date(p.possession_date).getTime()
  return !Number.isNaN(t) && t <= now.getTime()
}

const NOT_A_CONCERN = /^(?:none|low[_\s-]?risk)$/i
const ACRONYMS = new Set(['NCLT', 'SPV', 'RERA'])
const PROPER_NOUNS = new Set(['SUPREME', 'COURT', 'SURAKSHA'])

function humanToken(token: string): string {
  return token
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase()
      if (ACRONYMS.has(upper)) return upper
      const word = part.toLowerCase()
      return PROPER_NOUNS.has(upper) ? word[0].toUpperCase() + word.slice(1) : word
    })
    .join(' ')
}

/**
 * A concern as a line a buyer can read, or null when it is not a concern.
 * Stored enum tokens ("moderate_risk", "NCLT_INSOLVENCY") are said in words;
 * "low_risk" and "none" are dropped; a sentence passes through unchanged.
 */
export function cleanConcern(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value || NOT_A_CONCERN.test(value)) return null
  if (/\s/.test(value) || !value.includes('_')) return value
  return /risk$/i.test(value) ? `Risk flag on record: ${humanToken(value)}` : `Flag on record: ${humanToken(value)}`
}
