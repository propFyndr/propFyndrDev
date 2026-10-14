// Readers for ChatSession.last_projects.
//
// That column is `Json?` and is written with two incompatible shapes by
// different branches of the chat handler:
//
//   - an array of project id strings, when a project context is resolved
//   - an array of ScoredProject objects, when a search or the end-of-turn
//     persist writes the result set
//
// Both read sites used to be unchecked casts (`as string[]` and
// `as unknown as ScoredProject[]`), so each one was wrong on any turn where the
// other branch had written last. The id reader in particular fed
// postProcessIntent(), so a buyer saying "tell me more about it" could silently
// lose the focused project.
//
// Normalising on read fixes both directions without a migration and without
// having to make every writer agree.

import type { ScoredProject } from './types'

interface MaybeProject {
  id?: unknown
}

/** Project ids, accepting either persisted shape. Unknown entries are dropped. */
export function readLastProjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string') {
      ids.push(entry)
    } else if (entry && typeof entry === 'object') {
      const id = (entry as MaybeProject).id
      if (typeof id === 'string') ids.push(id)
    }
  }
  return ids
}

/**
 * The cached result set, or null when the column holds bare ids and therefore
 * carries no card data to reuse.
 */
export function readLastProjectCards(value: unknown): ScoredProject[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const objects = value.filter(
    (entry): entry is Record<string, unknown> =>
      !!entry && typeof entry === 'object' && typeof (entry as MaybeProject).id === 'string',
  )
  // A mixed array means a writer clobbered the shape mid-flight; treat the whole
  // value as untrustworthy rather than handing back a partial result set.
  if (objects.length !== value.length) return null
  // Compact cards (lib/chatStorage — an idle chat's trimmed copy) carry what the
  // buyer saw, not what an answer needs (decision_profile, competitors, units).
  // Reusing them would ground a follow-up on missing data; a fresh search won't.
  if (objects.some((o) => (o as { compact?: unknown }).compact === true)) return null
  return objects as unknown as ScoredProject[]
}
