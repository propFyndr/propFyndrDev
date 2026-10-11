import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeKFactor, classifyFunnelStage, detectBroadcastWindows } from '../referralGrowthMetrics'

test('computeKFactor: zero denominator returns null, not NaN or 0', () => {
  const result = computeKFactor([
    { generation: 0, activatedCount: 0 },
    { generation: 1, activatedCount: 5 },
  ])
  assert.equal(result.perGeneration[0].k, null)
})

test('computeKFactor: per-generation math is activatedCount[N+1] / activatedCount[N]', () => {
  const result = computeKFactor([
    { generation: 0, activatedCount: 2 },
    { generation: 1, activatedCount: 4 },
    { generation: 2, activatedCount: 8 },
  ])
  assert.equal(result.perGeneration.length, 2)
  assert.equal(result.perGeneration[0].generation, 0)
  assert.equal(result.perGeneration[0].k, 2)
  assert.equal(result.perGeneration[1].generation, 1)
  assert.equal(result.perGeneration[1].k, 2)
})

test('computeKFactor: blended is total non-root arrivals over gen 0+1 combined', () => {
  const result = computeKFactor([
    { generation: 0, activatedCount: 2 },
    { generation: 1, activatedCount: 4 },
    { generation: 2, activatedCount: 6 },
  ])
  // non-root (gen >= 2) activated = 6; gen 0+1 combined = 6 => blended = 1
  assert.equal(result.blended, 1)
})

test('computeKFactor: blended is null when gen 0+1 combined is zero', () => {
  const result = computeKFactor([
    { generation: 0, activatedCount: 0 },
    { generation: 1, activatedCount: 0 },
  ])
  assert.equal(result.blended, null)
})

test('computeKFactor: single generation array has no boundaries and null blended', () => {
  const result = computeKFactor([{ generation: 0, activatedCount: 5 }])
  assert.deepEqual(result.perGeneration, [])
  assert.equal(result.blended, null)
})

test('classifyFunnelStage: converted takes priority over activated/chatted/arrived', () => {
  const stage = classifyFunnelStage({
    messageCount: 0,
    activated: true,
    hasCallback: true,
    hasDossier: false,
    hasSiteVisit: false,
  })
  assert.equal(stage, 'converted')
})

test('classifyFunnelStage: converted wins even with low message count and not "activated"', () => {
  const stage = classifyFunnelStage({
    messageCount: 0,
    activated: false,
    hasCallback: false,
    hasDossier: true,
    hasSiteVisit: false,
  })
  assert.equal(stage, 'converted')
})

test('classifyFunnelStage: activated beats chatted_shallow', () => {
  const stage = classifyFunnelStage({
    messageCount: 1,
    activated: true,
    hasCallback: false,
    hasDossier: false,
    hasSiteVisit: false,
  })
  assert.equal(stage, 'activated')
})

test('classifyFunnelStage: chatted_shallow when messages but not activated', () => {
  const stage = classifyFunnelStage({
    messageCount: 1,
    activated: false,
    hasCallback: false,
    hasDossier: false,
    hasSiteVisit: false,
  })
  assert.equal(stage, 'chatted_shallow')
})

test('classifyFunnelStage: arrived_no_chat when nothing happened', () => {
  const stage = classifyFunnelStage({
    messageCount: 0,
    activated: false,
    hasCallback: false,
    hasDossier: false,
    hasSiteVisit: false,
  })
  assert.equal(stage, 'arrived_no_chat')
})

test('detectBroadcastWindows: exactly at threshold counts as flagged', () => {
  const base = new Date('2026-01-01T00:00:00Z').getTime()
  const arrivals = Array.from({ length: 10 }, (_, i) => ({ arrivedAt: new Date(base + i * 60_000) }))
  const windows = detectBroadcastWindows(arrivals, 10)
  assert.equal(windows.length, 1)
  assert.equal(windows[0].count, 10)
})

test('detectBroadcastWindows: below threshold is not flagged', () => {
  const base = new Date('2026-01-01T00:00:00Z').getTime()
  const arrivals = Array.from({ length: 9 }, (_, i) => ({ arrivedAt: new Date(base + i * 60_000) }))
  const windows = detectBroadcastWindows(arrivals, 10)
  assert.equal(windows.length, 0)
})

test('detectBroadcastWindows: a burst spanning two calendar hours but within one sliding 60-minute window is still caught', () => {
  // 10 arrivals between 00:40 and 01:20 — spans two calendar hours but fits a 60-min sliding window
  const start = new Date('2026-01-01T00:40:00Z').getTime()
  const arrivals = Array.from({ length: 10 }, (_, i) => ({ arrivedAt: new Date(start + i * 4 * 60_000) }))
  const windows = detectBroadcastWindows(arrivals, 10)
  assert.equal(windows.length, 1)
})

test('detectBroadcastWindows: multiple separate bursts are both reported', () => {
  const base = new Date('2026-01-01T00:00:00Z').getTime()
  const burst1 = Array.from({ length: 10 }, (_, i) => ({ arrivedAt: new Date(base + i * 60_000) }))
  const burst2Start = base + 5 * 60 * 60_000 // 5 hours later, clear of burst1's window
  const burst2 = Array.from({ length: 10 }, (_, i) => ({ arrivedAt: new Date(burst2Start + i * 60_000) }))
  const windows = detectBroadcastWindows([...burst1, ...burst2], 10)
  assert.equal(windows.length, 2)
})

test('detectBroadcastWindows: empty arrivals returns no windows', () => {
  assert.deepEqual(detectBroadcastWindows([], 10), [])
})
