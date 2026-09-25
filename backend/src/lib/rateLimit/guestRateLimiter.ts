/**
 * Sliding-window rate limiter for guest sessions.
 * Enforces a maximum of 25 messages per 10-minute window per guest token.
 *
 * Backed by the Redis that `lib/cache.ts` already connects to. It used to keep
 * the windows in a process-local `Map`, which made the cap a suggestion: every
 * deploy handed everyone a fresh quota, and a second instance doubled it. The
 * thing this protects is the AI spend, which is exactly what a bot drains
 * across a restart.
 *
 * The `Map` survives as the fallback for when Redis is absent or erroring —
 * the same fail-closed posture `checkRateLimit` takes, and for the same reason:
 * an unreachable cache must not become an unthrottled chat endpoint.
 */

import { getRedis } from '../cache'

const GUEST_WINDOW_MS = 10 * 60 * 1000 // 10 minutes (600,000 ms)
const GUEST_LIMIT = 25 // 25 messages

// In-memory sliding window map: guestToken -> array of millisecond timestamps
const guestTimestamps = new Map<string, number[]>()

export interface GuestRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

function windowResult(active: number[], limit: number, windowMs: number, now: number): GuestRateLimitResult {
  if (active.length >= limit) {
    const oldest = active[0]
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }
  return { allowed: true, remaining: limit - active.length - 1, retryAfterSeconds: 0 }
}

/** The process-local window, used when Redis cannot answer. */
function memoryWindow(guestToken: string, limit: number, windowMs: number, now: number): GuestRateLimitResult {
  const history = guestTimestamps.get(guestToken) ?? []
  const active = history.filter((t) => now - t < windowMs)
  const result = windowResult(active, limit, windowMs, now)
  if (result.allowed) active.push(now)
  guestTimestamps.set(guestToken, active)
  return result
}

/**
 * Check if the guest token has exceeded the sliding window limit.
 *
 * A sorted set keyed on the token, scored by timestamp: drop what fell out of
 * the window, count what is left, add this hit. A fixed-window counter would
 * have been fewer lines, but it lets a burst of 2x the limit through either
 * side of a boundary — which is the one traffic shape this exists to stop.
 */
export async function checkGuestRateLimit(
  guestToken: string,
  limit = GUEST_LIMIT,
  windowMs = GUEST_WINDOW_MS
): Promise<GuestRateLimitResult> {
  if (!guestToken || process.env.DISABLE_RATE_LIMIT === 'true') {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 }
  }

  const now = Date.now()

  // Tests must not reach a shared Upstash instance — same rule as `getCached`.
  const redis = process.env.NODE_ENV === 'test' ? null : getRedis()
  if (!redis) return memoryWindow(guestToken, limit, windowMs, now)

  const key = `rl:guest:${guestToken}`
  try {
    await redis.zremrangebyscore(key, 0, now - windowMs)
    const count = await redis.zcard(key)

    if (count >= limit) {
      // The oldest surviving hit is when the window next frees a slot.
      const oldest = await redis.zrange<Array<string | number>>(key, 0, 0, { withScores: true })
      const oldestScore = Number(oldest?.[1] ?? now)
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldestScore + windowMs - now) / 1000)),
      }
    }

    // The member has to be unique or two hits in the same millisecond collapse
    // into one and the buyer gets a free message.
    await redis.zadd(key, { score: now, member: `${now}-${Math.random().toString(36).slice(2, 8)}` })
    // Let the key expire on its own once the whole window has passed, so an
    // abandoned guest token does not sit in Redis forever.
    await redis.expire(key, Math.ceil(windowMs / 1000))

    return { allowed: true, remaining: limit - count - 1, retryAfterSeconds: 0 }
  } catch {
    // Redis errored → enforce the local window rather than waving everyone through.
    return memoryWindow(guestToken, limit, windowMs, now)
  }
}

/**
 * Reset memory state (useful for tests).
 */
export function resetGuestRateLimit(): void {
  guestTimestamps.clear()
}
