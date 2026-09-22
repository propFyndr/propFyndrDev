// backend/src/lib/cache.ts
import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

/**
 * The shared Redis client, or null when Upstash is not configured.
 *
 * Exported so the answer cache uses this one lazily-constructed client rather
 * than opening a second connection for the same credentials.
 */
export function getRedis(): Redis | null {
  if (_redis) return _redis
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return _redis
}

// In-memory fallback limiter so we FAIL CLOSED when Redis is absent or erroring,
// instead of letting an attacker drain the AI budget unthrottled.
const memBuckets = new Map<string, { count: number; resetAt: number }>()

function memRateLimit(key: string, limit: number, windowSecs: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const b = memBuckets.get(key)
  if (!b || b.resetAt <= now) {
    memBuckets.set(key, { count: 1, resetAt: now + windowSecs * 1000 })
    return { allowed: true, remaining: limit - 1 }
  }
  b.count += 1
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count) }
}

export async function checkRateLimit(key: string, limit = 20, windowSecs = 60): Promise<{ allowed: boolean; remaining: number }> {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
    return { allowed: true, remaining: limit }
  }
  const redis = getRedis()
  // No Redis configured → enforce the in-memory limit (fail closed), don't wave everyone through.
  if (!redis) return memRateLimit(key, limit, windowSecs)

  const redisKey = `rl:${key}`
  try {
    const count = await redis.incr(redisKey)
    if (count === 1) await redis.expire(redisKey, windowSecs)
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
  } catch {
    // Redis errored → degrade to the in-memory limiter rather than failing open.
    return memRateLimit(key, limit, windowSecs)
  }
}

export async function invalidateSessionList(userId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(`sessions:list:${userId}`)
  } catch {
    // non-fatal
  }
}

const memTestCache = new Map<string, unknown>()

export async function getCached<T>(key: string): Promise<T | null> {
  // Tests must not read a shared, persistent cache. We use an isolated in-memory map
  // so external Upstash Redis is never polluted, while test assertions work deterministically.
  if (process.env.NODE_ENV === 'test') return (memTestCache.get(key) as T) ?? null
  const redis = getRedis()
  if (!redis) return null
  try {
    return await redis.get<T>(key)
  } catch {
    return null
  }
}

// Returns true if the value was written, false if Redis is absent or errored.
// Callers that require the write to succeed (e.g. admin session store) must check
// the return value and handle false as an infrastructure failure.
export async function setCached<T>(key: string, value: T, ttlSecs = 3600): Promise<boolean> {
  // Never let a test run pollute the shared cache for the next one (or for a dev
  // hitting the same Upstash instance). Isolated in memTestCache during test.
  if (process.env.NODE_ENV === 'test') {
    memTestCache.set(key, value)
    return true
  }
  const redis = getRedis()
  if (!redis) return false
  try {
    await redis.set(key, value, { ex: ttlSecs })
    return true
  } catch (e) {
    console.error('[cache] setCached failed:', e)
    return false
  }
}

export async function pingRedis(): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false
  try {
    await redis.ping()
    return true
  } catch {
    return false
  }
}

export async function deleteCached(key: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    memTestCache.delete(key)
    return
  }
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(key)
  } catch (e) {
    console.error('[cache] deleteCached failed:', e)
  }
}
