import {
  applyStreamEvent,
  emptyStreamFallback,
  buildSmartTitle,
  isSearchState,
  pickShortlist,
  shortlistKey,
} from '@/lib/chat/streamReducer'
import type { SSEEvent } from '@/lib/backend-api'
import type { ChatMessage } from '@/types/property'

/**
 * The message shaping that used to be unreachable.
 *
 * Two hundred lines of it lived inside a useCallback inside a 2,089-line
 * component — seven separate setChatHistory calls reshaping the same message,
 * none of them testable. These are the rules a buyer notices when they break.
 */

const base = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'stream-1',
  type: 'ai',
  content: '',
  timestamp: '2026-08-28T00:00:00.000Z',
  ...over,
} as ChatMessage)

const project = (id: string) => ({ id, slug: id, name: `Project ${id}` }) as never

describe('search state', () => {
  it('only shows the property spinner when a search will actually happen', () => {
    expect(isSearchState('READY_TO_SEARCH')).toBe(true)
    expect(isSearchState('SHORTLISTED')).toBe(true)
  })

  it('keeps gathering turns out of the searching state', () => {
    // A property spinner on a turn that will never return a property reads as
    // a hang, and the buyer stops waiting.
    for (const s of ['COLD', 'GATHERING', 'ADVISORY', 'anything else']) {
      expect(isSearchState(s)).toBe(false)
    }
  })
})

describe('shortlist selection', () => {
  it('prefers exact matches', () => {
    const exact = [project('a')]
    const nearby = [project('b')]
    expect(pickShortlist(exact, nearby)).toBe(exact)
  })

  it('falls back to nearby only when there are no exact matches', () => {
    const nearby = [project('b')]
    expect(pickShortlist([], nearby)).toBe(nearby)
  })

  it('identifies a shortlist by its members, not their order', () => {
    expect(shortlistKey([project('a'), project('b')]))
      .toBe(shortlistKey([project('b'), project('a')]))
  })

  it('treats a different shortlist as different', () => {
    expect(shortlistKey([project('a')])).not.toBe(shortlistKey([project('c')]))
  })

  it('survives a null shortlist', () => {
    expect(shortlistKey(null)).toBe('')
    expect(shortlistKey(undefined)).toBe('')
  })
})

describe('applyStreamEvent', () => {
  it('appends tokens rather than replacing them', () => {
    let m = base({ content: 'Sector ' })
    m = applyStreamEvent(m, { type: 'token', token: '150' } as SSEEvent)
    expect(m.content).toBe('Sector 150')
    expect(m.isSearching).toBe(false)
  })

  it('shows the shortlist and stops searching when properties land', () => {
    const event = {
      type: 'properties',
      exactResults: [project('a'), project('b')],
      nearbyResults: [project('c')],
      expansion: null,
    } as unknown as SSEEvent
    const m = applyStreamEvent(base({ isSearching: true }), event)
    expect(m.isSearching).toBe(false)
    expect(m.properties).toHaveLength(2)
    expect(m.streamingResultCount).toBe(2)
    expect(m.streamingPhase).toBe('generating')
  })

  it('keeps nearby results available alongside the exact ones', () => {
    // Both are carried on the message; only one is shown as the shortlist.
    const event = {
      type: 'properties',
      exactResults: [project('a')],
      nearbyResults: [project('c')],
      expansion: null,
    } as unknown as SSEEvent
    const m = applyStreamEvent(base(), event)
    expect(m.nearbyResults).toHaveLength(1)
  })

  it('does not wipe chips when ui_state arrives without any', () => {
    const m = base({ chips: [{ id: 'x' }] as never })
    const after = applyStreamEvent(m, { type: 'ui_state', chips: [] } as unknown as SSEEvent)
    expect(after.chips).toHaveLength(1)
  })

  it('clears the streaming phase on done so the spinner cannot stick', () => {
    const m = applyStreamEvent(
      base({ streamingPhase: 'generating', streamingResultCount: 3 } as Partial<ChatMessage>),
      { type: 'done', sessionId: 's1', responseMode: 'search' } as unknown as SSEEvent,
    )
    expect(m.streamingPhase).toBeNull()
    expect(m.streamingResultCount).toBeNull()
    expect(m.isSearching).toBe(false)
  })

  it('takes the response mode from the backend, not from what it can see', () => {
    const m = applyStreamEvent(
      base(),
      { type: 'done', sessionId: 's1', responseMode: 'chat' } as unknown as SSEEvent,
      { projects: [project('a')] },
    )
    // Projects are present, but the backend said chat. The backend owns this.
    expect(m.responseMode).toBe('chat')
  })

  it('infers a mode only for old sessions that carry none', () => {
    const withProjects = applyStreamEvent(
      base(), { type: 'done', sessionId: 's1' } as unknown as SSEEvent, { projects: [project('a')] })
    expect(withProjects.responseMode).toBe('search')

    const without = applyStreamEvent(
      base(), { type: 'done', sessionId: 's1' } as unknown as SSEEvent, { projects: [] })
    expect(without.responseMode).toBe('chat')
  })

  it('only renders a comparison table when there is something to compare', () => {
    const one = applyStreamEvent(base(), {
      type: 'done', sessionId: 's1', responseMode: 'comparison', comparisonProjects: [project('a')],
    } as unknown as SSEEvent)
    expect(one.showComparisonTable).toBe(false)

    const two = applyStreamEvent(base(), {
      type: 'done', sessionId: 's1', responseMode: 'comparison',
      comparisonProjects: [project('a'), project('b')],
    } as unknown as SSEEvent)
    expect(two.showComparisonTable).toBe(true)
  })

  it('gives an error a message the buyer can read', () => {
    const m = applyStreamEvent(base({ isSearching: true }), { type: 'error', message: '' } as SSEEvent)
    expect(m.content).toBe('Something went wrong. Please try again.')
    expect(m.isSearching).toBe(false)
  })

  it('leaves the message alone for a focus event', () => {
    const m = base({ content: 'kept' })
    expect(applyStreamEvent(m, { type: 'focus', projectId: 'p1' } as unknown as SSEEvent)).toBe(m)
  })
})

describe('empty stream fallback', () => {
  it('speaks when the stream closed with nothing at all', () => {
    expect(emptyStreamFallback(base()).content).toContain('overview panel')
  })

  it('stays quiet when there was text', () => {
    const m = base({ content: 'Here are three options.' })
    expect(emptyStreamFallback(m)).toBe(m)
  })

  it('stays quiet when cards carried the answer', () => {
    const m = base({ properties: [project('a')] as never })
    expect(emptyStreamFallback(m)).toBe(m)
  })

  it('stays quiet when a component payload carried the answer', () => {
    const m = base({ componentResponse: { blocks: [] } as never })
    expect(emptyStreamFallback(m)).toBe(m)
  })
})

describe('session titles', () => {
  it('names the search by its facts once two are known', () => {
    expect(buildSmartTitle('find me something', { bhk: [3], sector: 'Sector 150' }))
      .toBe('3 BHK · Sector 150')
  })

  it('writes lakhs below a crore and crores above it', () => {
    expect(buildSmartTitle('x', { bhk: [2], budgetMax: 0.8 })).toBe('2 BHK · ₹80L')
    expect(buildSmartTitle('x', { bhk: [2], budgetMax: 1.8 })).toBe('2 BHK · ₹1.8Cr')
  })

  it('falls back to the buyer’s own words when one fact names nothing', () => {
    expect(buildSmartTitle('show me flats', { sector: 'Noida' })).toBe('show me flats')
  })

  it('truncates a long message rather than running off the sidebar', () => {
    const long = 'a'.repeat(60)
    const title = buildSmartTitle(long, null)
    expect(title).toHaveLength(38)
    expect(title.endsWith('...')).toBe(true)
  })
})

describe('server status line', () => {
  it('shows the status only until the answer starts', () => {
    const waiting = applyStreamEvent(base(), { type: 'status', status: 'reading', message: 'Checking Sector 150 projects…' } as SSEEvent)
    expect(waiting.streamingStatus).toBe('Checking Sector 150 projects…')
    const answering = applyStreamEvent(base({ content: 'Three projects match.' }), { type: 'status', status: 'thinking', message: 'Searching…' } as SSEEvent)
    expect(answering.streamingStatus).toBeUndefined()
  })
})
