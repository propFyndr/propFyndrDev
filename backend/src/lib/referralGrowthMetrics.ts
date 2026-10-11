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
