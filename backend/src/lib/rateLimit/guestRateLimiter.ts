/**
 * Sliding-window rate limiter for guest sessions.
 * Enforces a maximum of 25 messages per 10-minute window per guest token.
 */

const GUEST_WINDOW_MS = 10 * 60 * 1000 // 10 minutes (600,000 ms)
const GUEST_LIMIT = 25 // 25 messages

// In-memory sliding window map: guestToken -> array of millisecond timestamps
const guestTimestamps = new Map<string, number[]>()

export interface GuestRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Check if the guest token has exceeded the sliding window limit.
 * Automatically prunes timestamps older than 10 minutes.
 */
export function checkGuestRateLimit(
  guestToken: string,
  limit = GUEST_LIMIT,
  windowMs = GUEST_WINDOW_MS
): GuestRateLimitResult {
  if (!guestToken || process.env.DISABLE_RATE_LIMIT === 'true') {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 }
  }

  const now = Date.now()
  const history = guestTimestamps.get(guestToken) ?? []

  // Prune timestamps outside the rolling window
  const activeTimestamps = history.filter((t) => now - t < windowMs)

  if (activeTimestamps.length >= limit) {
    guestTimestamps.set(guestToken, activeTimestamps)
    const oldest = activeTimestamps[0]
    const retryAfterMs = oldest + windowMs - now
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    }
  }

  // Record this hit
  activeTimestamps.push(now)
  guestTimestamps.set(guestToken, activeTimestamps)

  return {
    allowed: true,
    remaining: limit - activeTimestamps.length,
    retryAfterSeconds: 0,
  }
}

/**
 * Reset memory state (useful for tests).
 */
export function resetGuestRateLimit(): void {
  guestTimestamps.clear()
}
