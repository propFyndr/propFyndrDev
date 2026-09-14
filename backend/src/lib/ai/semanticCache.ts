// backend/src/lib/ai/semanticCache.ts

import { createHash } from 'node:crypto'
import { getRedis } from '../cache'

export interface CachedEntry {
  token: string
  chips?: Array<{
    id: string
    actionType: string
    label: string
    icon?: string
    analyticsId?: string
    priority?: number
    payload?: Record<string, unknown>
  }>
  intentState?: string
  responseMode?: string
  expiresAt: number
  hitCount: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
  hitRate: string
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_CACHE_ENTRIES = 5000

const cache = new Map<string, CachedEntry>()
const accessOrder = new Map<string, number>() // Track access time for LRU
let cacheHits = 0
let cacheMisses = 0
let accessCounter = 0 // Monotonic counter for access ordering

/** Normalizes query string for semantic matching: */
export function normalizeQueryKey(query: string): string {
  if (!query) return ''
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(please|can you|could you|tell me|explain to me|i want to know|what is|what are|how to|how do i)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Scope for a cache entry. */
export const GLOBAL_SCOPE = 'global'

/** Intent fields that change what a correct answer says. */
const ANSWER_SHAPING_FIELDS = [
  'sector',
  'bhk',
  'budgetMin',
  'budgetMax',
  'possession',
  'purpose',
  'builderName',
  'projectNames',
  'lifestyleKeywords',
] as const

/** Short, stable digest of the intent an answer was written under. */
export function intentFingerprint(intent?: Record<string, unknown> | null): string {
  if (!intent) return 'anon'
  const shaping: Record<string, unknown> = {}
  for (const f of ANSWER_SHAPING_FIELDS) {
    const v = intent[f]
    if (v === undefined || v === null) continue
    if (Array.isArray(v) && v.length === 0) continue
    // Sort arrays so ["2","3"] and ["3","2"] are one bucket, not two.
    shaping[f] = Array.isArray(v) ? [...v].map(String).sort() : v
  }
  const keys = Object.keys(shaping)
  if (keys.length === 0) return 'anon'
  const canonical = JSON.stringify(shaping, keys.sort())
  return createHash('sha256').update(canonical).digest('hex').slice(0, 12)
}

function buildCacheKey(query: string, scope: string, fingerprint = 'anon'): string {
  const normalized = normalizeQueryKey(query)
  if (!normalized || normalized.length < 3) return ''
  return `${scope}::${fingerprint}::${normalized}`
}

/** L1 only. */
export function getCachedResponseLocal(
  query: string,
  scope: string = GLOBAL_SCOPE,
  fingerprint = 'anon',
): CachedEntry | null {
  const key = buildCacheKey(query, scope, fingerprint)
  if (!key) return null
  return readLocal(key)
}

/** L1, then Redis. */
export async function getCachedResponse(
  query: string,
  scope: string = GLOBAL_SCOPE,
  fingerprint = 'anon',
): Promise<CachedEntry | null> {
  const key = buildCacheKey(query, scope, fingerprint)
  if (!key) return null

  const local = readLocal(key, false)
  if (local) return local

  const remote = await readRemote(key)
  if (!remote) {
    cacheMisses++
    return null
  }

  // Promote. The remote copy already carries its own absolute expiry, so this
  // does not extend the entry's life, it just stops paying for it again.
  cache.set(key, remote)
  accessOrder.set(key, ++accessCounter)
  cacheHits++
  return remote
}

/** `countMiss` is false when the caller is about to consult Redis: an L1 miss */
function readLocal(key: string, countMiss = true): CachedEntry | null {
  const entry = cache.get(key)
  if (!entry) {
    if (countMiss) cacheMisses++
    return null
  }

  // Check TTL expiration
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    accessOrder.delete(key)
    if (countMiss) cacheMisses++
    return null
  }

  entry.hitCount++
  cacheHits++
  accessOrder.set(key, ++accessCounter) // Update LRU timestamp
  return entry
}

// ── L2: Upstash ──────────────────────────────────────────────────────────────

/** Namespace, so a key change is a cache flush rather than a wrong answer. */
// v3 (30 Aug 2026): v2 was written while the chain could fall onto tool-blind
// legs unchecked, so it holds answers naming projects that do not exist —
// "Shriram Suites, Sector 137, OC issued" among them. Those entries outlive the
// fix that stops them being produced, so the namespace is retired with it.
//
// v4, same day: two topic flags were misrouting, so v3 holds answers to the
// wrong question — "how do I verify a project is RERA compliant" answered with
// the builder delivery scorecard. The key encodes the query, not which handler
// answered it, so a routing fix cannot invalidate its own stale entries and the
// reported query kept returning the reported bug. Any future routing change
// needs this bumped too; the alternative is a routing version inside the key,
// which is not worth building for a flush that costs a cold cache.
// v5: four routing changes in one session, and the first smoke run proved the
// point this comment already made. "Which is the best project in Noida" came
// back in 1.6 seconds with the pre-change answer — micro-market prose naming no
// project, and zero chips, because the cached path does not rebuild them — so the
// citywide band shelf could not be observed at all. The changes: the discovery
// gate now opens for a citywide superlative, the open lane no longer takes
// rental-yield or appreciation questions, a category-of-party question routes to
// the open path, and `appreciation_potential_5yr` no longer reaches a prompt.
// Every one of those changes what an answer to the same words means.
// Bumped to v6 on 3 Sep 2026, and the reason is the same shape as the note
// above: what an answer to the same words means has changed, so the old ones
// must not be served under the new interpretation.
//
// Observed on the verification run: "What is the resale value of my 20 year old
// house in Delhi?" came back in 1.5 seconds with the 890-character pre-fix
// answer — a fluent valuation for a city and a service we do not cover — while
// the deployed build declines it in one sentence. The cache read happens before
// every gate in the router, and the scope is global, so a bad answer cached
// before a fix stays reachable by any user for the whole 12-hour TTL.
//
// Changes since v5: off-topic subjects (eating out, live traffic, school
// admissions, valuing a property you own) now decline instead of answering;
// identity documents are refused rather than acknowledged; out-of-scope cities
// no longer resolve to a Noida sector; the general lane carries buyer state, so
// an answer written for one buyer's budget and focus is no longer shareable at
// all; and chips are suppressed on grievance and refusal turns.
// v9: v8 cached the text of turns that had also rendered cards, so the replay
// was that answer with its inventory removed — and it replayed for every buyer
// who typed the same query. The write now refuses any turn that showed cards;
// this bump drops the entries written before it.
const REDIS_PREFIX = 'ac:v9:' // v8: v7 cached project-focused handler answers under project-free keys

/** A read that takes longer than this is not worth waiting for — the LLM call it */
const REDIS_READ_TIMEOUT_MS = Number(process.env.ANSWER_CACHE_READ_TIMEOUT_MS ?? 250)

/** Resolves to null rather than rejecting, and never waits past the deadline. */
async function readRemote(key: string): Promise<CachedEntry | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raced = await Promise.race([
      redis.get<CachedEntry>(REDIS_PREFIX + key),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), REDIS_READ_TIMEOUT_MS)),
    ])
    if (!raced || typeof raced !== 'object') return null
    const entry = raced as CachedEntry
    // Redis TTL and our own expiry can disagree after a clock skew or a manual
    // key edit. The stored expiry wins: it is what the answer was written under.
    if (!entry.token || typeof entry.expiresAt !== 'number' || Date.now() > entry.expiresAt) {
      return null
    }
    return entry
  } catch (err) {
    console.warn('[answerCache] redis read failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Fire-and-forget. A write that fails costs one future cache miss, nothing more. */
function writeRemote(key: string, entry: CachedEntry, ttlMs: number): void {
  const redis = getRedis()
  if (!redis) return
  void redis
    .set(REDIS_PREFIX + key, entry, { ex: Math.max(1, Math.floor(ttlMs / 1000)) })
    .catch((err: unknown) => {
      console.warn('[answerCache] redis write failed:', err instanceof Error ? err.message : err)
    })
}

/**
 * Stores a verified advisory response in L1, and in Redis when configured.
 */
export function setCachedResponse(
  query: string,
  data: {
    token: string
    chips?: CachedEntry['chips']
    intentState?: string
    responseMode?: string
  },
  ttlMs = CACHE_TTL_MS,
  scope: string = GLOBAL_SCOPE,
  fingerprint = 'anon',
): void {
  const key = buildCacheKey(query, scope, fingerprint)
  if (!key || !data.token) return

  // Evict least-recently-used entry if capacity reached
  if (cache.size >= MAX_CACHE_ENTRIES) {
    let lruKey: string | undefined
    let minAccessTime = Infinity
    for (const [k, accessTime] of accessOrder.entries()) {
      if (accessTime < minAccessTime) {
        minAccessTime = accessTime
        lruKey = k
      }
    }
    if (lruKey) {
      cache.delete(lruKey)
      accessOrder.delete(lruKey)
    }
  }

  const entry: CachedEntry = {
    token: data.token,
    chips: data.chips,
    intentState: data.intentState ?? 'SHORTLISTED',
    responseMode: data.responseMode ?? 'chat',
    expiresAt: Date.now() + ttlMs,
    hitCount: 0,
  }
  cache.set(key, entry)
  accessOrder.set(key, ++accessCounter) // Mark as recently accessed
  // Shared copy, so the next instance and the next deploy do not pay for this
  // answer again. Never awaited — see writeRemote.
  writeRemote(key, entry, ttlMs)
}

/**
 * Returns cache telemetry for Admin Analytics
 */
export function getCacheStats(): CacheStats {
  const total = cacheHits + cacheMisses
  const hitRate = total > 0 ? `${((cacheHits / total) * 100).toFixed(1)}%` : '0.0%'
  return {
    hits: cacheHits,
    misses: cacheMisses,
    size: cache.size,
    maxSize: MAX_CACHE_ENTRIES,
    hitRate,
  }
}
