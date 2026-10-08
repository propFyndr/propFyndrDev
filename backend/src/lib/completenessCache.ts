// backend/src/lib/completenessCache.ts
//
// Completeness scores, computed once and reused.
//
// The projects list spends nearly all its time reading relations it does not
// render. Unit types, four profile tables, payment plans and a documents lookup
// are loaded for 393 projects so that `computeCompleteness` can turn them into
// two numbers per project. The numbers are cheap; getting the inputs is not.
//
// ── Why a cache and not a column ──────────────────────────────────────────
//
// The obvious fix is to materialise the score onto `Project` and recompute on
// write. That is probably the right long-term answer and it is the wrong first
// move: roughly twenty write paths touch a project or one of its relations, and
// a materialised score is only as correct as the least-remembered of them. The
// failure mode is silent, and it is wrong numbers on the screen built to find
// wrong numbers — the same class of bug Phase 10.2 existed to fix.
//
// A cache is reversible, has no migration, and cannot go wrong in a way that
// outlives its TTL. It also proves the score is derivable cheaply before
// anything commits to storing it.
//
// ── The staleness ceiling, stated plainly ─────────────────────────────────
//
// `Project.updated_at` does NOT change when a relation changes — adding an
// image or a payment plan leaves it untouched — so it cannot be the
// invalidation signal. Time is. A score can therefore be up to TTL_SECS stale
// after someone edits a relation.
//
// That is acceptable here and would not be everywhere: this feeds a worklist an
// analyst uses to decide what to fix next, not a number anyone bills against.
// Written down next to the number because a cache whose staleness window is
// undocumented is one somebody is eventually surprised by.
//
// One key for the whole map rather than one per project: the cache is Upstash
// over REST, so 393 lookups would be 393 HTTP round trips and cost more than
// the query it replaces.
import { getCached, setCached } from './cache'

/**
 * Ten minutes. See the staleness note above — this number IS the guarantee.
 *
 * It is now a FRESHNESS window, not an expiry. The map is kept for KEEP_SECS and
 * marked stale after TTL_SECS; a stale map is still served, and the projects list
 * re-scores in the background (stale-while-revalidate). So a score can be stale
 * for TTL_SECS plus one background refresh, and no request pays the cold cost
 * except the very first after KEEP_SECS of disuse.
 */
export const TTL_SECS = 600

/** How long the map survives at all. A day of admin inactivity = one cold load. */
export const KEEP_SECS = 24 * 60 * 60

const KEY = 'admin:project-completeness:v2'

export interface CachedScore {
  score: number
  /**
   * `TabScores` from completeness.ts, widened. It is a fixed-key interface
   * there, but this map round-trips through JSON, so it arrives back as a plain
   * object and typing it as one is the honest shape.
   */
  tabScores: Record<string, number>
}

export type ScoreMap = Record<string, CachedScore>

interface Stored { at: number; scores: ScoreMap }

/**
 * The cached map (empty if absent) and whether it is past TTL_SECS.
 *
 * Never throws and never distinguishes "cache is down" from "cache is empty" —
 * both mean the same thing to the caller: compute it. `getCached` already
 * returns null in tests and without Redis, so the uncached path is the one that
 * runs in CI and stays exercised.
 */
export async function loadScoreState(): Promise<{ scores: ScoreMap; stale: boolean; at: number }> {
  const hit = await getCached<Stored>(KEY)
  if (!hit || typeof hit !== 'object' || !hit.scores) return { scores: {}, stale: true, at: 0 }
  return { scores: hit.scores, stale: Date.now() - hit.at > TTL_SECS * 1000, at: hit.at }
}

/** The cached map, or an empty one. For readers that do not refresh it. */
export async function loadScoreMap(): Promise<ScoreMap> {
  return (await loadScoreState()).scores
}

/** Which of these projects still need computing. */
export function missingFrom(map: ScoreMap, projectIds: readonly string[]): string[] {
  return projectIds.filter((id) => !map[id])
}

/**
 * Writes the merged map back.
 *
 * Merged rather than replaced, so a request that computed three new projects
 * does not discard the other 390 and make the next request pay for them again.
 * `at` stamps when the scores were computed; a merge of a few new projects into
 * a stale map passes the old `at` through so it stays stale and still refreshes.
 *
 * Best-effort: a failed write costs the next request its speed, never its
 * correctness, so it is not worth failing a response over.
 */
export async function saveScoreMap(map: ScoreMap, at: number = Date.now()): Promise<void> {
  await setCached<Stored>(KEY, { at, scores: map }, KEEP_SECS).catch(() => false)
}
