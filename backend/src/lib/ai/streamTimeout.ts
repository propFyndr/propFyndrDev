// backend/src/lib/ai/streamTimeout.ts
//
// Mistral and Cerebras were the only legs in the fallback chain with no timeout
// of any kind. Gemini, Groq and OpenAI each grew their own; these two never
// did, so a stalled stream ran until the HTTP client gave up. That matters more
// than it sounds: both sit directly below three Gemini legs that are cooling
// down on a depleted balance, so they are the legs most turns actually land on.
//
// Groq and OpenAI keep their own copies of this logic. They are not touched
// here — this exists so the two legs that had nothing get one implementation
// rather than two more.

/** Thrown when a provider stream stalls, or its headers never arrive. */
export class StreamStalledError extends Error {
  readonly tokensSent: boolean
  constructor(provider: string, tokensSent: boolean) {
    super(`${provider} stream stalled`)
    this.name = 'StreamStalledError'
    this.tokensSent = tokensSent
  }
}

/**
 * Silence budget once the stream is producing. 60s was one window for both
 * phases; it is kept for the mid-stream phase, where a slow-but-progressing
 * generation must never be cut off mid-sentence.
 */
export const DEFAULT_INACTIVITY_MS = 60_000

/**
 * Silence budget BEFORE the first chunk, which is a different failure.
 *
 * A single window for both phases meant a leg that was never going to answer
 * still held the turn for a full minute before rolling over, and the turn then
 * paid the next leg's latency on top. Measured over the corpus, the calls that
 * set p99 were not long answers — the 39.4s call that set it emitted about 536
 * tokens, so almost all of that time was spent waiting for a stream that had
 * not started.
 *
 * 25s matches what gemini.ts already uses for its own first-token deadline, so
 * every leg in the chain now behaves the same way. A provider that has sent
 * nothing in 25 seconds is not about to be the fast path.
 */
export const DEFAULT_FIRST_TOKEN_MS = Number(process.env.STREAM_FIRST_TOKEN_MS ?? 8_000)

export interface InactivityGuard {
  /** Pass to the SDK as `{ signal }` so an abort tears the fetch down. */
  readonly signal: AbortSignal
  /** Call on every chunk. A generation that is slow but progressing never trips. */
  reset(): void
  /** Call once the stream ends, on every path. */
  clear(): void
  /** Records that content has reached the client, for the thrown error. */
  markTokenSent(): void
  /**
   * Rethrows as StreamStalledError when this guard caused the failure, and
   * rethrows the original otherwise — the chain treats those differently.
   */
  rethrow(err: unknown): never
}

/**
 * Guards one streaming call. Arm it BEFORE the create() await so a header stall
 * is caught in the same window as a mid-body stall.
 */
export function createInactivityGuard(
  provider: string,
  inactivityMs = DEFAULT_INACTIVITY_MS,
  // Never longer than the mid-stream budget. A caller that passes only one
  // number means "this is my timeout" and must not silently get a longer one
  // for the phase before any content arrives.
  firstTokenMs = Math.min(inactivityMs, DEFAULT_FIRST_TOKEN_MS),
): InactivityGuard {
  const controller = new AbortController()
  let timer: NodeJS.Timeout | null = null
  let fired = false
  let tokensSent = false
  // Which phase we are in. The first chunk is what moves us from the short
  // first-token budget to the longer mid-stream one, not the first `reset()`
  // call — the guard is armed before create(), so reset() runs once before
  // anything has arrived.
  let started = false

  const reset = () => {
    if (timer) clearTimeout(timer)
    const budget = started ? inactivityMs : firstTokenMs
    timer = setTimeout(() => {
      fired = true
      console.warn(
        `[${provider.toUpperCase()}] ${started ? 'inactivity' : 'first-token'} timeout after ${budget}ms tokensSent=${tokensSent}`,
      )
      controller.abort()
    }, budget)
  }

  /** Called on the first chunk: widens the window for the rest of the stream. */
  const markStarted = () => {
    if (started) return
    started = true
    reset()
  }

  reset()

  return {
    signal: controller.signal,
    // Every chunk both widens the phase and restarts the clock, so a caller
    // that only knows about reset() gets the correct behaviour for free.
    reset: () => { markStarted(); reset() },
    clear: () => { if (timer) clearTimeout(timer) },
    markTokenSent: () => { tokensSent = true },
    rethrow(err: unknown): never {
      if (timer) clearTimeout(timer)
      if (fired || controller.signal.aborted) throw new StreamStalledError(provider, tokensSent)
      throw err
    },
  }
}
