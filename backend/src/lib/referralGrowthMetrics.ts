//
// Pure growth-analytics logic for the referral tree. No Prisma/Express
// dependency, mirroring referralAttribution.ts's shape so it's fully
// unit-testable without a database. See
// docs/superpowers/specs/2026-10-12-referral-growth-analytics-design.md.

export function computeKFactor(
  generations: { generation: number; activatedCount: number }[],
): {
  blended: number | null
  perGeneration: { generation: number; k: number | null }[]
} {
  const sorted = [...generations].sort((a, b) => a.generation - b.generation)
  const byGen = new Map(sorted.map((g) => [g.generation, g.activatedCount]))

  const perGeneration: { generation: number; k: number | null }[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]
    // Only a true boundary (consecutive generations) produces a ratio;
    // a gap (e.g. generation 0 then generation 2, nothing in between)
    // has no defined k for that pair.
    if (next.generation !== current.generation + 1) continue
    const denom = current.activatedCount
    perGeneration.push({ generation: current.generation, k: denom > 0 ? next.activatedCount / denom : null })
  }

  // Blended: all activated devices from generation 2 onward (people brought
  // in by someone who was themselves referred) over the combined
  // generation-0 + generation-1 activated base (the "seed" holders).
  const seedBase = (byGen.get(0) ?? 0) + (byGen.get(1) ?? 0)
  let spread = 0
  let hasSpreadGeneration = false
  for (const [gen, count] of byGen) {
    if (gen >= 2) {
      spread += count
      hasSpreadGeneration = true
    }
  }
  const blended = hasSpreadGeneration && seedBase > 0 ? spread / seedBase : null

  return { blended, perGeneration }
}

export function classifyFunnelStage(node: {
  messageCount: number
  activated: boolean
  hasCallback: boolean
  hasDossier: boolean
  hasSiteVisit: boolean
}): 'arrived_no_chat' | 'chatted_shallow' | 'activated' | 'converted' {
  if (node.hasCallback || node.hasDossier || node.hasSiteVisit) return 'converted'
  if (node.activated) return 'activated'
  if (node.messageCount > 0) return 'chatted_shallow'
  return 'arrived_no_chat'
}

export function detectBroadcastWindows(
  arrivals: { arrivedAt: Date }[],
  thresholdPerHour: number,
): { windowStart: Date; count: number }[] {
  const sorted = [...arrivals].sort((a, b) => a.arrivedAt.getTime() - b.arrivedAt.getTime())
  const ONE_HOUR_MS = 60 * 60 * 1000

  // For each index, the count of arrivals in the sliding 1-hour window
  // starting at that arrival (inclusive).
  const counts: number[] = new Array(sorted.length).fill(0)
  let j = 0
  for (let i = 0; i < sorted.length; i++) {
    if (j < i) j = i
    while (j < sorted.length && sorted[j].arrivedAt.getTime() - sorted[i].arrivedAt.getTime() < ONE_HOUR_MS) {
      j++
    }
    counts[i] = j - i
  }

  const windows: { windowStart: Date; count: number }[] = []
  let i = 0
  while (i < sorted.length) {
    if (counts[i] >= thresholdPerHour) {
      // Merge this contiguous run of flagged starting points into one
      // reported burst, taking the largest count seen in the run.
      let groupStart = i
      let maxCount = counts[i]
      let k = i + 1
      while (k < sorted.length && counts[k] >= thresholdPerHour) {
        maxCount = Math.max(maxCount, counts[k])
        k++
      }
      windows.push({ windowStart: sorted[groupStart].arrivedAt, count: maxCount })
      i = k
    } else {
      i++
    }
  }

  return windows
}

// ── Device engagement (activation inputs) ──────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000
/** Messages, summed across a device's human chats, that count as activation. */
export const ACTIVATION_MIN_MESSAGES = 3

export interface SessionSignal {
  guest_token: string | null
  message_count: number
  created_at: Date
  last_active: Date
  is_bot: boolean
}

/**
 * Per-device engagement from its chat sessions.
 *
 * - Messages are summed across the device's human chats, so 2 + 2 messages in
 *   two chats is 4, not "never more than 2 in one chat".
 * - A device is engaged when that total reaches ACTIVATION_MIN_MESSAGES, or
 *   when it came back: its human chats span 24h or more from the first
 *   chat's start to the last activity.
 * - Bot sessions add nothing. A device whose every session is a bot session
 *   is `botOnly`, and callers leave it out of the funnel altogether.
 */
export function summariseDeviceEngagement(sessions: SessionSignal[]): {
  messageCountByGuest: Map<string, number>
  engaged: Set<string>
  botOnly: Set<string>
} {
  const human = new Map<string, { messages: number; first: number; last: number }>()
  const sawBot = new Set<string>()
  for (const s of sessions) {
    if (!s.guest_token) continue
    if (s.is_bot) {
      sawBot.add(s.guest_token)
      continue
    }
    const first = s.created_at.getTime()
    const last = s.last_active.getTime()
    const cur = human.get(s.guest_token)
    if (!cur) {
      human.set(s.guest_token, { messages: s.message_count, first, last })
    } else {
      cur.messages += s.message_count
      cur.first = Math.min(cur.first, first)
      cur.last = Math.max(cur.last, last)
    }
  }

  const messageCountByGuest = new Map<string, number>()
  const engaged = new Set<string>()
  for (const [token, h] of human) {
    messageCountByGuest.set(token, h.messages)
    if (h.messages >= ACTIVATION_MIN_MESSAGES || h.last - h.first >= DAY_MS) engaged.add(token)
  }
  const botOnly = new Set([...sawBot].filter((t) => !human.has(t)))
  return { messageCountByGuest, engaged, botOnly }
}

// ── Arrival trend buckets (India time) ─────────────────────────────────────

export type TrendGranularity = 'daily' | 'weekly' | 'all'

// Admins read these in India; a UTC day would put 00:00–05:30 IST arrivals on
// the previous date. IST has no daylight saving, so a fixed offset is exact.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

/** IST calendar date, e.g. "2026-10-12". */
export function istDayKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** IST Monday-of-week for the week containing d. */
export function istWeekKey(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS)
  const monday = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

/** Buckets arrival dates by IST day or week; 'all' uses weekly buckets. */
export function bucketArrivals(dates: Date[], granularity: TrendGranularity): { date: string; newArrivals: number }[] {
  const keyFn = granularity === 'daily' ? istDayKey : istWeekKey
  const counts = new Map<string, number>()
  for (const d of dates) {
    const key = keyFn(d)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, newArrivals]) => ({ date, newArrivals }))
}
