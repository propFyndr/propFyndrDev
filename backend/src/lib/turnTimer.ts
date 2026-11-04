// backend/src/lib/turnTimer.ts
//
// Where a turn's wall clock actually goes.
//
// Discovery turns measure 18-20s in production while the same retrieval runs in
// 79-228ms locally and the model leg measures 3.8s. That leaves ~14s
// unaccounted for, and every latency assumption made without measurement this
// week has been wrong — the prompt was blamed before it was profiled, and the
// answer turned out to be input size rather than generation.
//
// So: one timer, marks at the real boundaries, emitted on the `done` event and
// logged as a single line. Cheap enough to leave on permanently — a handful of
// Date.now() calls against a turn that costs seconds — and it means the next
// person to ask "why is this slow" reads an answer instead of forming a theory.

export interface TurnTimer {
  /** Record the end of a stage. Call it after the work, not before. */
  mark: (stage: string) => void
  /** Wrap an awaited call and mark it automatically. */
  time: <T>(stage: string, fn: () => Promise<T>) => Promise<T>
  /** Stage durations in call order, milliseconds. */
  readonly stages: Record<string, number>
  /**
   * Milliseconds from the request arriving to a moment (first token to the buyer,
   * first token from the model). Kept once: the first occurrence is the one the
   * buyer waits for. Cycle 2 Day 5.
   */
  point: (name: string) => void
  readonly points: Record<string, number>
  /** Total elapsed since the timer was created. */
  elapsed: () => number
  /** One log line, slowest stage first, then the moments. */
  summary: () => string
}

export function createTurnTimer(): TurnTimer {
  const t0 = Date.now()
  let last = t0
  const stages: Record<string, number> = {}
  const points: Record<string, number> = {}

  const mark = (stage: string): void => {
    const now = Date.now()
    // Same stage twice in a turn accumulates rather than overwriting — the
    // coverage lanes and the card loaders each run more than once.
    stages[stage] = (stages[stage] ?? 0) + (now - last)
    last = now
  }

  const time = async <T>(stage: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now()
    try {
      return await fn()
    } finally {
      stages[stage] = (stages[stage] ?? 0) + (Date.now() - start)
      last = Date.now()
    }
  }

  return {
    mark,
    time,
    stages,
    points,
    point: (name: string) => { if (!(name in points)) points[name] = Date.now() - t0 },
    elapsed: () => Date.now() - t0,
    summary: () => {
      const total = Date.now() - t0
      const ranked = Object.entries(stages)
        .filter(([, ms]) => ms >= 5)
        .sort((a, b) => b[1] - a[1])
        .map(([k, ms]) => `${k}=${ms}`)
        .join(' ')
      const at = Object.entries(points).map(([k, ms]) => `@${k}=${ms}`).join(' ')
      return `total=${total} ${ranked}${at ? ` ${at}` : ''}`
    },
  }
}
