// backend/src/lib/jev/__tests__/execute.test.ts

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { executeJevDecision, type JevExecutionContext } from '../execute'
import type { JevDecision } from '../decision'
import type { Intent } from '../../discovery/types'

function createMockContext(message: string, intent: Partial<Intent> = {}): {
  ctx: JevExecutionContext
  events: Array<{ event: string; data: any }>
  state: { ended: boolean }
} {
  const events: Array<{ event: string; data: any }> = []
  const state = { ended: false }

  const res = {
    end: () => {
      state.ended = true
    },
    writableEnded: false,
  } as any

  const send = (event: string, data: any) => {
    events.push({ event, data })
  }

  const ctx: JevExecutionContext = {
    res,
    send,
    sessionId: 'test-session-123',
    message,
    intent: intent as Intent,
  }

  return { ctx, events, state }
}

describe('JEV Live Dispatcher (executeJevDecision)', () => {
  it('triggers Clarification Gate when clarify is present', async () => {
    const decision: JevDecision = {
      task: 'discover',
      sources: ['db'],
      shape: 'advisory',
      fields: [],
      clarify: 'Do you prefer Central Noida or Expressway?',
      via: 'llm',
    }

    const { ctx, events, state } = createMockContext('Looking for flats', { bhk: [3] })
    const handled = await executeJevDecision(decision, ctx)

    assert.equal(handled, true)
    assert.equal(state.ended, true)
    assert.ok(events.some((e) => e.event === 'token' && e.data.token.includes('Do you prefer Central Noida')))
  })

  it('handles smalltalk instantly without DB query', async () => {
    const decision: JevDecision = {
      task: 'smalltalk',
      sources: ['general'],
      shape: 'lookup',
      fields: [],
      clarify: null,
      via: 'llm',
    }

    const { ctx, events, state } = createMockContext('Hello!')
    const handled = await executeJevDecision(decision, ctx)

    assert.equal(handled, true)
    assert.equal(state.ended, true)
    assert.ok(events.some((e) => e.event === 'token' && /assist|help|hello/i.test(e.data.token)))
  })

  it('handles out of scope query cleanly', async () => {
    const decision: JevDecision = {
      task: 'out_of_scope',
      sources: ['general'],
      shape: 'lookup',
      fields: [],
      clarify: null,
      via: 'llm',
    }

    const { ctx, events, state } = createMockContext('What is the weather in Delhi?')
    const handled = await executeJevDecision(decision, ctx)

    assert.equal(handled, true)
    assert.equal(state.ended, true)
    assert.ok(events.some((e) => e.event === 'token' && e.data.token.includes('Noida and Greater Noida')))
  })

  it('handles statutory stamp duty calculation purely in code', async () => {
    const decision: JevDecision = {
      task: 'calculate',
      sources: ['statutory'],
      shape: 'lookup',
      fields: [],
      clarify: null,
      via: 'llm',
    }

    const { ctx, events, state } = createMockContext('What is the stamp duty on 1.5 cr flat in Noida?')
    const handled = await executeJevDecision(decision, ctx)

    assert.equal(handled, true)
    assert.equal(state.ended, true)
    assert.ok(events.some((e) => e.event === 'token' && e.data.token.includes('Statutory Stamp Duty')))
  })

  it('falls through to discovery pipeline when no fast-path applies', async () => {
    const decision: JevDecision = {
      task: 'discover',
      sources: ['db'],
      shape: 'advisory',
      fields: [],
      clarify: null,
      via: 'llm',
    }

    const { ctx, events, state } = createMockContext('3bhk in sector 150 under 2cr')
    const handled = await executeJevDecision(decision, ctx)

    assert.equal(handled, false)
    assert.equal(state.ended, false)
    assert.equal(events.length, 0)
  })
})
