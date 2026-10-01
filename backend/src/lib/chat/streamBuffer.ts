// backend/src/lib/chat/streamBuffer.ts
//
// Stream buffer for zero-loss mobile reconnects.
//
// Memory is the primary store: the turn that is still generating lives in this
// process, so a reconnect landing here can tail it live. Redis is a batched
// mirror (one RPUSH + EXPIRE per flush, not per token) so a reconnect landing on
// another instance, or after a restart, still gets what was produced. Writing
// every token to Upstash cost two commands per token — a 500-token answer was
// 1,000 commands, enough to exhaust the free tier (and the rate limiter that
// shares it) within a handful of turns.

import { getRedis } from '../cache'

export interface BufferedEvent {
  seq: number
  event: string
  data: Record<string, unknown>
  timestamp: number
}

const MAX_MEM_TURNS = 100
const MAX_MEM_EVENTS_PER_TURN = 2000
const REDIS_TTL_S = 120
const REDIS_FLUSH_MS = 1000
const TERMINAL_EVENTS = new Set(['done', 'error'])

const memoryStreamBuffer = new Map<string, BufferedEvent[]>()
const pendingRedis = new Map<string, BufferedEvent[]>()
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function getBufferKey(sessionId: string, turnId: string): string {
  return `stream:turn:${sessionId || 'anon'}:${turnId || 'default'}`
}

async function flushToRedis(key: string): Promise<void> {
  const timer = flushTimers.get(key)
  if (timer) clearTimeout(timer)
  flushTimers.delete(key)
  const batch = pendingRedis.get(key)
  pendingRedis.delete(key)
  if (!batch || batch.length === 0) return
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.rpush(key, ...batch.map((b) => JSON.stringify(b)))
    await redis.expire(key, REDIS_TTL_S)
  } catch (err) {
    console.warn('[STREAM_BUFFER:REDIS_ERROR] batch flush failed, memory buffer still serves this instance', (err as Error).message)
  }
}

export async function appendStreamEvent(
  sessionId: string,
  turnId: string,
  item: BufferedEvent,
  opts?: { forceMemory?: boolean },
): Promise<void> {
  const key = getBufferKey(sessionId, turnId)

  let list = memoryStreamBuffer.get(key)
  if (!list) {
    if (memoryStreamBuffer.size >= MAX_MEM_TURNS) {
      const oldestKey = memoryStreamBuffer.keys().next().value
      if (oldestKey) memoryStreamBuffer.delete(oldestKey)
    }
    list = []
    memoryStreamBuffer.set(key, list)
  }
  if (list.length < MAX_MEM_EVENTS_PER_TURN) list.push(item)

  if (opts?.forceMemory || !getRedis()) return

  const pending = pendingRedis.get(key) ?? []
  pending.push(item)
  pendingRedis.set(key, pending)
  if (TERMINAL_EVENTS.has(item.event)) {
    await flushToRedis(key)
  } else if (!flushTimers.has(key)) {
    const t = setTimeout(() => { void flushToRedis(key) }, REDIS_FLUSH_MS)
    t.unref?.()
    flushTimers.set(key, t)
  }
}

export async function getBufferedEvents(
  sessionId: string,
  turnId: string,
  afterSeq = 0,
  opts?: { forceMemory?: boolean },
): Promise<BufferedEvent[]> {
  const key = getBufferKey(sessionId, turnId)

  // Memory first: on the instance that produced the turn it is complete and current.
  const memList = memoryStreamBuffer.get(key)
  if (memList) return memList.filter((ev) => ev.seq > afterSeq)

  const redis = opts?.forceMemory ? null : getRedis()
  if (!redis) return []
  try {
    const rawItems = await redis.lrange<string[]>(key, 0, -1)
    return (rawItems ?? [])
      .map((str) => (typeof str === 'string' ? JSON.parse(str) : str))
      .filter((ev): ev is BufferedEvent => ev && typeof ev.seq === 'number' && ev.seq > afterSeq)
      .sort((a, b) => a.seq - b.seq)
  } catch (err) {
    console.warn('[STREAM_BUFFER:REDIS_READ_ERROR]', (err as Error).message)
    return []
  }
}

/**
 * Replays everything after `afterSeq`, then keeps following the turn while it
 * is still generating in this process, until a terminal event is delivered or
 * nothing new arrives for `idleMs`.
 *
 * Returns `'complete'` when a terminal event was delivered, `'partial'` when
 * events were delivered but the turn never finished, `'missing'` when the turn
 * is unknown here. The caller must never re-run the turn on `'missing'` — a
 * re-run re-bills the model and writes the buyer's message a second time.
 */
export async function tailBufferedEvents(
  sessionId: string,
  turnId: string,
  afterSeq: number,
  emit: (ev: BufferedEvent) => void,
  opts: { idleMs?: number; pollMs?: number; isClosed?: () => boolean } = {},
): Promise<'complete' | 'partial' | 'missing'> {
  const idleMs = opts.idleMs ?? 45_000
  const pollMs = opts.pollMs ?? 200
  let cursor = afterSeq
  let delivered = false
  let lastProgress = Date.now()

  for (;;) {
    if (opts.isClosed?.()) return delivered ? 'partial' : 'missing'
    const events = await getBufferedEvents(sessionId, turnId, cursor)
    for (const ev of events) {
      emit(ev)
      cursor = ev.seq
      delivered = true
      lastProgress = Date.now()
      if (TERMINAL_EVENTS.has(ev.event)) return 'complete'
    }
    const memList = memoryStreamBuffer.get(getBufferKey(sessionId, turnId))
    // The client already holds the terminal event: nothing left to send.
    if (memList?.some((ev) => ev.seq <= cursor && TERMINAL_EVENTS.has(ev.event))) return 'complete'
    // Not generating here (Redis copy only): one read is all there is.
    if (!memList) return delivered ? 'partial' : 'missing'
    if (Date.now() - lastProgress >= idleMs) return delivered ? 'partial' : 'missing'
    await new Promise((r) => setTimeout(r, pollMs))
  }
}

export function clearInMemoryBuffer(): void {
  memoryStreamBuffer.clear()
  pendingRedis.clear()
  for (const t of flushTimers.values()) clearTimeout(t)
  flushTimers.clear()
}
