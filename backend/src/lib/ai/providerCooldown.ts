/** Short-lived cooldown for provider legs that just failed for a durable reason. */

/** How long a leg stays skipped. Long enough to matter, short enough to recover. */
const COOLDOWN_MS = 5 * 60 * 1000

/** Cooldown for a per-minute rate limit. */
const RATE_LIMIT_COOLDOWN_MS = 65 * 1000

/**
 * Cooldown for a leg whose balance is gone.
 *
 * A depleted prepay balance does not refill on a timer — it refills when a
 * human tops it up. Retrying it on the ordinary five-minute durable window
 * cost two dead legs and ~1.2s at the head of nearly every turn across a
 * 67-query run, and every one of those probes returned the same 429. An hour
 * is long enough to stop paying that tax and short enough that a top-up is
 * picked up without a restart; a leg that answers is trusted again at once
 * via recordSuccess, so a manual top-up recovers on the first probe after it.
 */
const BALANCE_EXHAUSTED_COOLDOWN_MS = 60 * 60 * 1000

/**
 * A balance that a retry cannot restore, as opposed to a quota window.
 *
 * `402 status code (no body)` is here because that is literally all the OpenAI
 * SDK throws for a Cerebras payment failure — no message, no type. Matching
 * only the words meant both Cerebras legs took the ordinary five-minute
 * cooldown and were re-probed all run: two dead round-trips at the head of
 * nearly every turn, which is most of what the answer chain was waiting on.
 */
const BALANCE_EXHAUSTED = [
  'credits are depleted',
  'prepayment',
  'payment required',
  'payment_required',
  '402',
  // GitHub Models answers 410 during its retirement brownout. Retrying that on
  // the five-minute window costs four dead probes an hour per key for a
  // service that comes back on someone else's schedule, not ours.
  '410',
  'brownout',
  'retirement',
  'insufficient_quota',
  'exceeded your current quota',
  'billing',
  'trial key',
  'calls / month',
  'monthly limit',
]

/** Quota windows are usually per-minute or per-day; five minutes splits it sensibly. */
const cooldowns = new Map<string, { until: number; reason: string }>()

export type FailureKind = 'durable' | 'transient' | 'rate_limited'

/** A per-minute rate limit, as opposed to an exhausted balance or day quota. */
const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'rate_limit',
  'requests per minute',
  'too many requests',
  'resource_exhausted: quota exceeded for quota metric',
  'per minute',
  'retry after',
  'retry_after',
]

/** Signals a limit that will not clear on its own within the turn. */
const NOT_MERELY_RATE_LIMITED = [
  'credits are depleted',
  'prepayment',
  'billing',
  'per day',
  'daily limit',
  'requests per day',
  'insufficient_quota',
  'trial key',
  'calls / month',
  'monthly limit',
]

/** Classifies a provider failure. */
export function classifyFailure(error: unknown): FailureKind {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()

  const durable = [
    'exceeded your current quota',
    'quota',
    'insufficient_quota',
    'billing',
    'payment required',
    'payment_required',
    '402',
    'invalid api key',
    'incorrect api key',
    'invalid_api_key',
    'unauthorized',
    'authentication',
    '401',
    'permission',
    '403',
    'model does not exist',
    'model_not_found',
    'does not exist or you do not have access',
    'has been retired',
    'retirement',
    'deprecated',
    '410',
  ]

  // Checked before `durable`, because a per-minute limit also says "quota".
  if (
    RATE_LIMIT_PATTERNS.some(needle => message.includes(needle)) &&
    !NOT_MERELY_RATE_LIMITED.some(needle => message.includes(needle))
  ) {
    return 'rate_limited'
  }

  return durable.some(needle => message.includes(needle)) ? 'durable' : 'transient'
}

/** True when this leg should be skipped right now. */
export function isCoolingDown(key: string): boolean {
  const entry = cooldowns.get(key)
  if (!entry) return false
  if (entry.until <= Date.now()) {
    cooldowns.delete(key)
    return false
  }
  return true
}

/** Why a leg is cooling down, for the log line. */
export function cooldownReason(key: string): string | null {
  const entry = cooldowns.get(key)
  return entry && entry.until > Date.now() ? entry.reason : null
}

/** Records a failure. */
export function recordFailure(key: string, error: unknown): FailureKind {
  const kind = classifyFailure(error)
  if (kind === 'durable' || kind === 'rate_limited') {
    const full = error instanceof Error ? error.message : String(error ?? '')
    const reason = full.slice(0, 120)
    // A per-minute limit clears on its own; a depleted balance does not. Cooling
    // a rate-limited free key for the full durable window would remove the only
    // fallback capacity available precisely when the paid key is also struggling.
    // Classified off the whole message, not the 120-char log slice: the
    // depletion sentence sits behind a JSON envelope and can fall outside it.
    const lower = full.toLowerCase()
    const ms =
      kind === 'rate_limited'
        ? RATE_LIMIT_COOLDOWN_MS
        : BALANCE_EXHAUSTED.some(needle => lower.includes(needle))
          ? BALANCE_EXHAUSTED_COOLDOWN_MS
          : COOLDOWN_MS
    cooldowns.set(key, { until: Date.now() + ms, reason })
  }
  return kind
}

/** A leg that answers is trusted again immediately. */
export function recordSuccess(key: string): void {
  cooldowns.delete(key)
}

/** Test seam. */
export function resetCooldowns(): void {
  cooldowns.clear()
}

/** Current state, for the health endpoint. */
export function activeCooldowns(): Array<{ key: string; secondsLeft: number; reason: string }> {
  const now = Date.now()
  const out: Array<{ key: string; secondsLeft: number; reason: string }> = []
  for (const [key, entry] of cooldowns) {
    if (entry.until > now) out.push({ key, secondsLeft: Math.round((entry.until - now) / 1000), reason: entry.reason })
  }
  return out
}
