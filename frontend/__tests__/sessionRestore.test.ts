import {
  sortRestoredMessages,
  lastMessageWithResults,
  restoreMessage,
  attachTrailingChips,
  type StoredMessage,
} from '@/lib/chat/sessionRestore'
import type { ChatMessage } from '@/types/property'

/**
 * What a returning buyer sees when their conversation is rebuilt.
 *
 * All three decisions here used to live inside a 190-line effect, where the
 * only way to find out they were wrong was to open a stored session and read
 * it.
 */

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 'm', type: 'ai', content: '', timestamp: '2026-08-28T00:00:00.000Z', ...over,
} as ChatMessage)

const project = (id: string) => ({ id, slug: id, name: id }) as never

describe('ordering a restored conversation', () => {
  it('puts the question above its answer when both share a timestamp', () => {
    // Written in the same millisecond constantly. Left to sort stability, the
    // answer appeared above the question and the chat talked to itself.
    const ordered = sortRestoredMessages([
      msg({ id: 'answer', type: 'ai', timestamp: '2026-08-28T10:00:00.000Z' }),
      msg({ id: 'question', type: 'user', timestamp: '2026-08-28T10:00:00.000Z' }),
    ])
    expect(ordered.map(m => m.id)).toEqual(['question', 'answer'])
  })

  it('orders by time when the times differ', () => {
    const ordered = sortRestoredMessages([
      msg({ id: 'later', timestamp: '2026-08-28T10:05:00.000Z' }),
      msg({ id: 'earlier', timestamp: '2026-08-28T10:00:00.000Z' }),
    ])
    expect(ordered.map(m => m.id)).toEqual(['earlier', 'later'])
  })

  it('does not mutate what it was given', () => {
    const input = [msg({ id: 'b', timestamp: '2026-08-28T10:05:00.000Z' }), msg({ id: 'a', timestamp: '2026-08-28T10:00:00.000Z' })]
    sortRestoredMessages(input)
    expect(input.map(m => m.id)).toEqual(['b', 'a'])
  })

  it('survives a missing timestamp', () => {
    expect(() => sortRestoredMessages([msg({ timestamp: undefined as never }), msg({})])).not.toThrow()
  })
})

describe('which shelf reopens', () => {
  it('reopens the most recent shortlist, not the first', () => {
    const found = lastMessageWithResults([
      msg({ id: 'old', exactResults: [project('a')] as never }),
      msg({ id: 'chat' }),
      msg({ id: 'new', exactResults: [project('b')] as never }),
    ])
    expect(found?.id).toBe('new')
  })

  it('counts nearby-only results as results', () => {
    const found = lastMessageWithResults([msg({ id: 'n', nearbyResults: [project('a')] as never })])
    expect(found?.id).toBe('n')
  })

  it('finds nothing in a conversation that produced no cards', () => {
    expect(lastMessageWithResults([msg({ id: 'a' }), msg({ id: 'b' })])).toBeUndefined()
  })
})

describe('rebuilding a message from its artifacts', () => {
  const stored = (artifacts: StoredMessage['artifacts']): StoredMessage => ({
    id: 'm1', role: 'assistant', content: 'text', created_at: '2026-08-28T10:00:00.000Z', artifacts,
  })

  it('marks a message that carried cards as a search', () => {
    const m = restoreMessage(stored([
      { type: 'property_results', exactResults: [project('a')], nearbyResults: [], expansion: null },
    ]))
    expect(m.responseMode).toBe('search')
    expect(m.exactResults).toHaveLength(1)
  })

  it('caps a restored comparison at the four columns the table can lay out', () => {
    const m = restoreMessage(stored([
      { type: 'comparison', projects: [project('a'), project('b'), project('c'), project('d'), project('e')] },
    ]))
    expect(m.comparisonProjects).toHaveLength(4)
    expect(m.showComparisonTable).toBe(true)
  })

  it('rebuilds an older two-sided comparison', () => {
    const m = restoreMessage(stored([{ type: 'comparison', left: project('a'), right: project('b') }]))
    expect(m.comparisonProjects).toHaveLength(2)
  })

  it('does not claim a comparison it cannot render', () => {
    const m = restoreMessage(stored([{ type: 'comparison', projects: [project('a')] }]))
    expect(m.comparisonProjects).toBeUndefined()
  })

  it('reads the buyer role back as a user message', () => {
    expect(restoreMessage({ id: 'x', role: 'user', content: 'hi', created_at: '' }).type).toBe('user')
  })

  it('brings back the "What I checked" line stored with the answer', () => {
    const m = restoreMessage(stored([{ type: 'checked', labels: ['RealtyAsk records: A', 7, 'UP law: GST'] }]))
    expect(m.checked).toEqual(['RealtyAsk records: A', 'UP law: GST'])
    expect(restoreMessage(stored([{ type: 'checked', labels: 'nope' }])).checked).toBeUndefined()
  })

  it('handles a message with no artifacts at all', () => {
    const m = restoreMessage({ id: 'x', role: 'assistant', content: 'plain', created_at: '' })
    expect(m.content).toBe('plain')
    expect(m.responseMode).toBeUndefined()
  })
})

describe('trailing chips', () => {
  it('puts session chips back on the last answer when it has none', () => {
    // Sessions predating per-message chips restored with none at all, so a
    // conversation mid-flow read as finished.
    const out = attachTrailingChips([msg({ id: 'u', type: 'user' }), msg({ id: 'a', type: 'ai' })], [{ id: 'c1' }])
    expect(out[1].chips).toHaveLength(1)
  })

  it('never overwrites chips the message already carries', () => {
    const out = attachTrailingChips([msg({ id: 'a', type: 'ai', chips: [{ id: 'own' }] as never })], [{ id: 'session' }])
    expect((out[0].chips as Array<{ id: string }>)[0].id).toBe('own')
  })

  it('targets the last answer, not the last message', () => {
    const out = attachTrailingChips(
      [msg({ id: 'a', type: 'ai' }), msg({ id: 'u', type: 'user' })], [{ id: 'c1' }])
    expect(out[0].chips).toHaveLength(1)
    expect(out[1].chips).toBeUndefined()
  })

  it('does nothing when the session carried no chips', () => {
    const input = [msg({ id: 'a', type: 'ai' })]
    expect(attachTrailingChips(input, undefined)).toBe(input)
    expect(attachTrailingChips(input, [])).toBe(input)
  })

  it('does nothing in a conversation with no answer yet', () => {
    const input = [msg({ id: 'u', type: 'user' })]
    expect(attachTrailingChips(input, [{ id: 'c1' }])).toBe(input)
  })
})
