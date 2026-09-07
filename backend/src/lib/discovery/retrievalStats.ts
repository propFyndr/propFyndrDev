/**
 * How often discovery is actually asked to find inventory, and how often it
 * comes back with nothing.
 *
 * Before this, empty-retrieval rate had no counter, no analytics event, and no
 * trace — and it is the leading indicator for fabrication. Every documented
 * fabrication incident in this codebase traces to a turn that retrieved
 * nothing and had no tool to fix it: the model faces a prompt with no project
 * rows in it and a buyer expecting buildings, and has exactly two options —
 * refuse, or invent. Retrieval returning zero rows is not itself a bug (a
 * genuinely under-served sector should return zero), but not knowing how
 * often it happens, or for which sector/BHK/budget combinations, means the
 * team cannot tell "the buyer asked for something we do not have" apart from
 * "our matching missed something we do have."
 *
 * Deliberately the cheapest possible version, matching the tool-call counter
 * in lib/ai/tools/handlers.ts: in-memory, per-process, reset on deploy. A
 * durable version — one that can answer "which sector/BHK/budget combinations
 * come back empty most often", which is what actually turns into a
 * data-acquisition queue — needs a persisted table and is a schema decision,
 * held for the identity/schema work rather than guessed at here.
 */

interface RetrievalStats {
  /** Every call where discovery actually ran (not skipped by intent state). */
  calls: number
  /** Calls that returned zero rows in both exactResults and nearbyResults. */
  empty: number
}

const stats: RetrievalStats = { calls: 0, empty: 0 }

/** Call once per discoverProjects() invocation that actually runs. */
export function recordRetrieval(exactCount: number, nearbyCount: number): void {
  stats.calls++
  const isEmpty = exactCount === 0 && nearbyCount === 0
  if (isEmpty) stats.empty++
  console.log(`[RETRIEVAL:RATE] empty=${isEmpty} — ${stats.empty}/${stats.calls} calls this process have returned nothing`)
}

/** Read-only snapshot for a future admin panel or health-check endpoint. */
export function getRetrievalStats(): RetrievalStats & { emptyRate: number } {
  return { ...stats, emptyRate: stats.calls === 0 ? 0 : stats.empty / stats.calls }
}

/** Test seam. */
export function resetRetrievalStats(): void {
  stats.calls = 0
  stats.empty = 0
}
