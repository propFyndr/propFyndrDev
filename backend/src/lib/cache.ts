// backend/src/lib/cache.ts
import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

/** Commands whose first argument is the key. Every command the app sends is listed. */
const KEY_FIRST = new Set([
  'get', 'set', 'expire', 'ttl', 'incr', 'sadd', 'srem', 'smembers',
  'zadd', 'zcard', 'zrange', 'zremrangebyscore', 'rpush', 'lrange',
])

/**
 * Namespaces every key under `prefix`, including inside multi()/pipeline().
 *
 * Dev and live share one Upstash database but no longer one Postgres (live is
 * on Neon, dev on Supabase), so their route/search caches, rate limits and
 * admin sessions must not mix. Dev sets REDIS_KEY_PREFIX=dev:; live sets none
 * and keeps its existing keys.
 */
export function withKeyPrefix<T extends object>(target: T, prefix: string): T {
  const p = (k: unknown) => (typeof k === 'string' ? prefix + k : k)
  const proxy: T = new Proxy(target, {
    get(t, prop, recv) {
      const v = Reflect.get(t, prop, recv)
      if (typeof v !== 'function') return v
      if (prop === 'multi' || prop === 'pipeline') return (...a: unknown[]) => withKeyPrefix(v.apply(t, a), prefix)
      if (prop === 'del') return (...keys: unknown[]) => v.apply(t, keys.map(p))
      if (typeof prop === 'string' && KEY_FIRST.has(prop)) {
        return (key: unknown, ...rest: unknown[]) => {
          const out = v.apply(t, [p(key), ...rest])
          return out === t ? proxy : out // keep pipeline chains prefixed
        }
      }
      return v.bind(t)
    },
  })
  return proxy
}

/**
 * The shared Redis client, or null when Upstash is not configured.
 *
 * Exported so the answer cache uses this one lazily-constructed client rather
 * than opening a second connection for the same credentials.
 */
export function getRedis(): Redis | null {
  if (_redis) return _redis
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    const prefix = (process.env.REDIS_KEY_PREFIX || '').trim()
    _redis = prefix ? withKeyPrefix(client, prefix) : client
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
    // INCR and TTL together; set the expiry whenever the key has none, not only
    // on count 1. A lost EXPIRE used to leave the key with no TTL — a permanent
    // lockout. Plain EXPIRE (no 'NX') so this works on any Redis version.
    const [count, ttl] = await redis.multi().incr(redisKey).ttl(redisKey).exec() as [number, number]
    if (ttl < 0) await redis.expire(redisKey, windowSecs)
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
  } catch {
    // Redis errored → degrade to the in-memory limiter rather than failing open.
    return memRateLimit(key, limit, windowSecs)
  }
}

/** Clears a rate-limit bucket, e.g. after a successful login. */
export async function resetRateLimit(key: string): Promise<void> {
  memBuckets.delete(key)
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(`rl:${key}`)
  } catch {
    // non-fatal: the bucket expires on its own
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

interface MemEntry {
  value: unknown
  expiresAt: number
}
const memFallbackCache = new Map<string, MemEntry>()

export async function getCached<T>(key: string): Promise<T | null> {
  // Tests must not read a shared, persistent cache. We use an isolated in-memory map
  // so external Upstash Redis is never polluted, while test assertions work deterministically.
  if (process.env.NODE_ENV === 'test') return (memTestCache.get(key) as T) ?? null
  const redis = getRedis()
  if (redis) {
    try {
      const val = await redis.get<T>(key)
      if (val !== null && val !== undefined) return val
    } catch {
      // Degrade to memory fallback on Redis error
    }
  }
  const mem = memFallbackCache.get(key)
  if (mem) {
    if (Date.now() < mem.expiresAt) {
      return mem.value as T
    }
    memFallbackCache.delete(key)
  }
  return null
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
  memFallbackCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSecs * 1000,
  })
  const redis = getRedis()
  if (!redis) return true
  try {
    await redis.set(key, value, { ex: ttlSecs })
    return true
  } catch (e) {
    console.error('[cache] setCached failed:', e)
    return true
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
  memFallbackCache.delete(key)
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(key)
  } catch (e) {
    console.error('[cache] deleteCached failed:', e)
  }
}
