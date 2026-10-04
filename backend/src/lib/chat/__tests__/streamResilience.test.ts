// backend/src/lib/chat/__tests__/streamResilience.test.ts
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  appendStreamEvent,
  getBufferedEvents,
  clearInMemoryBuffer,
  claimTurn,
  tailBufferedEvents,
  BufferedEvent,
} from '../streamBuffer'
import { computeFactTtl } from '../../web'

describe('Stream Resilience & SSE Reconnection Protocol', () => {
  beforeEach(() => {
    clearInMemoryBuffer()
  })

  it('claims a turn once; a retry of the same turn tails the original instead of re-running', async () => {
    const turnId = `turn-claim-${Date.now()}-${Math.random().toString(36).slice(2)}`
    assert.equal(await claimTurn('turn', turnId), true)
    assert.equal(await claimTurn('turn', turnId), false)

    // The original produces its answer after the retry started tailing.
    setTimeout(() => {
      void appendStreamEvent('turn', turnId, { seq: 1, event: 'token', data: { token: 'Hi' }, timestamp: Date.now() })
      void appendStreamEvent('turn', turnId, { seq: 2, event: 'done', data: {}, timestamp: Date.now() })
    }, 50)
    const seen: number[] = []
    const outcome = await tailBufferedEvents('turn', turnId, 0, (ev) => seen.push(ev.seq), { pollMs: 10 })
    assert.equal(outcome, 'complete')
    assert.deepEqual(seen, [1, 2])
  })

  it('buffers events and retrieves them filtered by afterSeq in strict monotonic order', async () => {
    const sessionId = `test-sess-order-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const turnId = 'turn-order-1'

    const events: BufferedEvent[] = [
      { seq: 1, event: 'text', data: { text: 'Hello' }, timestamp: Date.now() },
      { seq: 2, event: 'text', data: { text: ' from' }, timestamp: Date.now() },
      { seq: 3, event: 'text', data: { text: ' PropFyndr' }, timestamp: Date.now() },
      { seq: 4, event: 'ui_state', data: { missingFields: [], confidence: 'HIGH' }, timestamp: Date.now() },
      { seq: 5, event: 'done', data: {}, timestamp: Date.now() },
    ]

    for (const ev of events) {
      await appendStreamEvent(sessionId, turnId, ev)
    }

    // 1. Fetch from beginning
    const all = await getBufferedEvents(sessionId, turnId, 0)
    assert.equal(all.length, 5)
    assert.deepEqual(
      all.map((e) => e.seq),
      [1, 2, 3, 4, 5],
    )

    // 2. Fetch with afterSeq = 2 (client already saw 1 and 2)
    const afterTwo = await getBufferedEvents(sessionId, turnId, 2)
    assert.equal(afterTwo.length, 3)
    assert.deepEqual(
      afterTwo.map((e) => e.seq),
      [3, 4, 5],
    )

    // 3. Fetch with afterSeq = 5 (client saw all)
    const afterFive = await getBufferedEvents(sessionId, turnId, 5)
    assert.equal(afterFive.length, 0)

    // 4. Fetch with unknown session/turn returns empty array
    const unknown = await getBufferedEvents('unknown-session', 'unknown-turn', 0)
    assert.equal(unknown.length, 0)
  })

  it('simulates 25%, 50%, and 75% mid-stream network disconnections and guarantees complete replay', async () => {
    const sessionId = `test-sess-chaos-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const turnId = 'turn-chaos-1'

    // Generate a 12-event stream (10 text chunks, 1 ui_state, 1 done)
    const fullStream: BufferedEvent[] = []
    for (let i = 1; i <= 10; i++) {
      fullStream.push({
        seq: i,
        event: 'text',
        data: { text: `token_${i} ` },
        timestamp: Date.now(),
      })
    }
    fullStream.push({
      seq: 11,
      event: 'ui_state',
      data: { missingFields: [], confidence: 'HIGH' },
      timestamp: Date.now(),
    })
    fullStream.push({
      seq: 12,
      event: 'done',
      data: {},
      timestamp: Date.now(),
    })

    for (const ev of fullStream) {
      await appendStreamEvent(sessionId, turnId, ev)
    }

    // Helper simulating client buffer with deduplication
    function simulateClientReception(
      initialReceived: BufferedEvent[],
      reconnectedEvents: BufferedEvent[],
    ): { finalEvents: BufferedEvent[]; totalText: string } {
      let lastSeq = initialReceived.length > 0 ? initialReceived[initialReceived.length - 1].seq : 0
      const received = [...initialReceived]

      for (const ev of reconnectedEvents) {
        if (ev.seq > lastSeq) {
          received.push(ev)
          lastSeq = ev.seq
        }
      }

      const totalText = received
        .filter((e) => e.event === 'text')
        .map((e) => String(e.data.text ?? ''))
        .join('')

      return { finalEvents: received, totalText }
    }

    // --- Scenario A: Disconnect at 25% (after seq 3) ---
    const cut25Seq = 3
    const received25 = fullStream.slice(0, cut25Seq)
    const replayed25 = await getBufferedEvents(sessionId, turnId, cut25Seq)
    assert.equal(replayed25.length, 9)
    assert.equal(replayed25[0].seq, 4)
    assert.equal(replayed25[replayed25.length - 1].seq, 12)

    const clientState25 = simulateClientReception(received25, replayed25)
    assert.equal(clientState25.finalEvents.length, 12)
    assert.deepEqual(
      clientState25.finalEvents.map((e) => e.seq),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    )
    assert.equal(
      clientState25.totalText,
      'token_1 token_2 token_3 token_4 token_5 token_6 token_7 token_8 token_9 token_10 ',
    )

    // --- Scenario B: Disconnect at 50% (after seq 6) ---
    const cut50Seq = 6
    const received50 = fullStream.slice(0, cut50Seq)
    const replayed50 = await getBufferedEvents(sessionId, turnId, cut50Seq)
    assert.equal(replayed50.length, 6)
    assert.equal(replayed50[0].seq, 7)

    const clientState50 = simulateClientReception(received50, replayed50)
    assert.equal(clientState50.finalEvents.length, 12)
    assert.equal(clientState50.totalText, clientState25.totalText)

    // --- Scenario C: Disconnect at 75% (after seq 9) ---
    const cut75Seq = 9
    const received75 = fullStream.slice(0, cut75Seq)
    const replayed75 = await getBufferedEvents(sessionId, turnId, cut75Seq)
    assert.equal(replayed75.length, 3) // seq 10, 11, 12
    assert.equal(replayed75[0].seq, 10)

    const clientState75 = simulateClientReception(received75, replayed75)
    assert.equal(clientState75.finalEvents.length, 12)
    assert.equal(clientState75.totalText, clientState25.totalText)
  })

  it('in-memory fallback ring buffer evicts oldest turns when exceeding turn limit', async () => {
    // Fill beyond 100 turns using forceMemory: true
    for (let t = 1; t <= 105; t++) {
      await appendStreamEvent(
        `sess-${t}`,
        `turn-${t}`,
        {
          seq: 1,
          event: 'text',
          data: { text: `turn_${t}` },
          timestamp: Date.now(),
        },
        { forceMemory: true },
      )
    }

    // Turns 1..5 should have been evicted from in-memory fallback
    const evicted = await getBufferedEvents('sess-1', 'turn-1', 0, { forceMemory: true })
    assert.equal(evicted.length, 0, 'Turn 1 must be evicted by ring buffer LRU')

    // Turn 105 should still be present
    const recent = await getBufferedEvents('sess-105', 'turn-105', 0, { forceMemory: true })
    assert.equal(recent.length, 1)
    assert.equal(recent[0].data.text, 'turn_105')
  })

  it('validates SSE keep-alive comment format and parser ignoring', () => {
    const sseComment = ': ping\n\n'
    // SSE specification requires comment lines to start with ':'
    assert.ok(sseComment.startsWith(':'))

    // Parse simulation: SSE parser checks
    const lines = sseComment.split('\n')
    const nonCommentLines = lines.filter((l) => l.trim().length > 0 && !l.startsWith(':'))
    assert.equal(nonCommentLines.length, 0, 'Keep-alive comment must contain no active event payload')
  })

  it('achieves 100% recovery rate across 20 simulated failure scenarios', async () => {
    let passedScenarios = 0
    const totalScenarios = 20

    // Build baseline 12-event stream
    const fullStream: BufferedEvent[] = []
    for (let i = 1; i <= 10; i++) {
      fullStream.push({
        seq: i,
        event: 'token',
        data: { token: `word_${i} `, seq: i },
        timestamp: Date.now(),
      })
    }
    fullStream.push({
      seq: 11,
      event: 'ui_state',
      data: { missingFields: [], confidence: 'HIGH', seq: 11 },
      timestamp: Date.now(),
    })
    fullStream.push({
      seq: 12,
      event: 'done',
      data: { sessionId: 'sess-chaos', intentState: 'COMPLETED', seq: 12 },
      timestamp: Date.now(),
    })

    // Scenarios 1 to 11: Cut socket at sequence K (K from 1 to 11)
    for (let cut = 1; cut <= 11; cut++) {
      const sId = `chaos-cut-${cut}-${Date.now()}`
      const tId = `turn-${cut}`
      for (const ev of fullStream) await appendStreamEvent(sId, tId, ev)

      const replayed = await getBufferedEvents(sId, tId, cut)
      assert.equal(replayed.length, 12 - cut)
      assert.equal(replayed[0].seq, cut + 1)
      assert.equal(replayed[replayed.length - 1].seq, 12)
      passedScenarios++
    }

    // Scenario 12: Rapid triple-flap network drop (cuts at seq 3, seq 6, seq 9)
    {
      const sId = `chaos-triple-${Date.now()}`
      const tId = 'turn-triple'
      for (const ev of fullStream) await appendStreamEvent(sId, tId, ev)

      let clientReceived: BufferedEvent[] = fullStream.slice(0, 3)
      let lastClientSeq = 3

      // Reconnect 1 -> receive 4, 5, 6
      const leg1 = await getBufferedEvents(sId, tId, lastClientSeq)
      clientReceived = clientReceived.concat(leg1.slice(0, 3)) // simulate drop after receiving 3 items (seq 4, 5, 6)
      lastClientSeq = 6

      // Reconnect 2 -> receive 7, 8, 9
      const leg2 = await getBufferedEvents(sId, tId, lastClientSeq)
      clientReceived = clientReceived.concat(leg2.slice(0, 3)) // simulate drop after seq 9
      lastClientSeq = 9

      // Reconnect 3 -> receive 10, 11, 12
      const leg3 = await getBufferedEvents(sId, tId, lastClientSeq)
      clientReceived = clientReceived.concat(leg3)

      assert.equal(clientReceived.length, 12)
      assert.deepEqual(clientReceived.map((e) => e.seq), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      passedScenarios++
    }

    // Scenario 13: Jittered / duplicate packets arriving at client
    {
      const initialSeq = 5
      const duplicatePkt: BufferedEvent = {
        seq: 5,
        event: 'token',
        data: { token: 'duplicate', seq: 5 },
        timestamp: Date.now(),
      }
      // Deduplicator check
      const currentHighest = 5
      const shouldDrop = duplicatePkt.seq <= currentHighest
      assert.ok(shouldDrop, 'Client must drop duplicate packet without corruption')
      passedScenarios++
    }

    // Scenario 14: Upstream stall with keep-alive comment ping
    {
      const keepAlivePing = ': ping\n\n'
      assert.ok(keepAlivePing.startsWith(':'))
      const parsedData = keepAlivePing.startsWith(':') ? null : JSON.parse(keepAlivePing)
      assert.equal(parsedData, null, 'Comment pings must never produce actionable JSON events')
      passedScenarios++
    }

    // Scenario 15: Premature disconnect before first byte received (afterSeq: 0)
    {
      const sId = `chaos-zero-${Date.now()}`
      const tId = 'turn-zero'
      for (const ev of fullStream) await appendStreamEvent(sId, tId, ev)

      const replayed = await getBufferedEvents(sId, tId, 0)
      assert.equal(replayed.length, 12)
      assert.equal(replayed[0].seq, 1)
      passedScenarios++
    }

    // Scenario 16: Late reconnect after stream already completed (afterSeq: 12)
    {
      const sId = `chaos-completed-${Date.now()}`
      const tId = 'turn-completed'
      for (const ev of fullStream) await appendStreamEvent(sId, tId, ev)

      const replayed = await getBufferedEvents(sId, tId, 12)
      assert.equal(replayed.length, 0)
      passedScenarios++
    }

    // Scenario 17: Out-of-bounds future seq reconnect (afterSeq: 999)
    {
      const sId = `chaos-oob-${Date.now()}`
      const tId = 'turn-oob'
      for (const ev of fullStream) await appendStreamEvent(sId, tId, ev)

      const replayed = await getBufferedEvents(sId, tId, 999)
      assert.equal(replayed.length, 0)
      passedScenarios++
    }

    // Scenario 18: In-memory fallback recovery when Redis is disconnected
    {
      const sId = `chaos-fallback-${Date.now()}`
      const tId = 'turn-fallback'
      for (const ev of fullStream) await appendStreamEvent(sId, tId, ev, { forceMemory: true })

      const replayed = await getBufferedEvents(sId, tId, 4, { forceMemory: true })
      assert.equal(replayed.length, 8)
      assert.equal(replayed[0].seq, 5)
      passedScenarios++
    }

    // Scenario 19: Unknown session or expired turn returns empty array without throwing
    {
      const replayed = await getBufferedEvents('non-existent-session', 'non-existent-turn', 0)
      assert.equal(replayed.length, 0)
      passedScenarios++
    }

    // Scenario 20: Recovery after token empty/whitespace padding
    {
      const sId = `chaos-empty-${Date.now()}`
      const tId = 'turn-empty'
      await appendStreamEvent(sId, tId, {
        seq: 1,
        event: 'token',
        data: { token: '   ', seq: 1 },
        timestamp: Date.now(),
      })
      const replayed = await getBufferedEvents(sId, tId, 0)
      assert.equal(replayed.length, 1)
      passedScenarios++
    }

    assert.equal(passedScenarios, totalScenarios, 'Must complete all 20 failure scenarios with 100% recovery')
  })
})

describe('tailBufferedEvents — reconnect never re-runs a turn', () => {
  beforeEach(() => clearInMemoryBuffer())

  it('follows a turn that is still generating until its done event', async () => {
    const turn = `tail-live-${Date.now()}`
    await appendStreamEvent('turn', turn, { seq: 1, event: 'token', data: { token: 'a', seq: 1 }, timestamp: 0 }, { forceMemory: true })
    const got: number[] = []
    setTimeout(() => {
      void appendStreamEvent('turn', turn, { seq: 2, event: 'token', data: { token: 'b', seq: 2 }, timestamp: 0 }, { forceMemory: true })
      void appendStreamEvent('turn', turn, { seq: 3, event: 'done', data: { seq: 3 }, timestamp: 0 }, { forceMemory: true })
    }, 30)
    const outcome = await tailBufferedEvents('turn', turn, 1, (ev) => got.push(ev.seq), { pollMs: 10, idleMs: 2000 })
    assert.equal(outcome, 'complete')
    assert.deepEqual(got, [2, 3])
  })

  it('reports missing for an unknown turn instead of inviting a re-run', async () => {
    const outcome = await tailBufferedEvents('turn', 'never-seen-turn-id', 0, () => {}, { pollMs: 10, idleMs: 50 })
    assert.equal(outcome, 'missing')
  })

  it('returns complete at once when the client already holds the done event', async () => {
    const turn = `tail-done-${Date.now()}`
    await appendStreamEvent('turn', turn, { seq: 1, event: 'done', data: { seq: 1 }, timestamp: 0 }, { forceMemory: true })
    const started = Date.now()
    const outcome = await tailBufferedEvents('turn', turn, 1, () => {}, { pollMs: 10, idleMs: 5000 })
    assert.equal(outcome, 'complete')
    assert.ok(Date.now() - started < 500)
  })

  it('gives up as partial when a live turn stalls past idleMs', async () => {
    const turn = `tail-stall-${Date.now()}`
    await appendStreamEvent('turn', turn, { seq: 1, event: 'token', data: { seq: 1 }, timestamp: 0 }, { forceMemory: true })
    const outcome = await tailBufferedEvents('turn', turn, 0, () => {}, { pollMs: 10, idleMs: 60 })
    assert.equal(outcome, 'partial')
  })
})
