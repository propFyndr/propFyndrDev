import { applyStreamEvent } from '../streamReducer'
import type { SSEEvent } from '@/lib/backend-api'
import type { ChatMessage } from '@/types/property'

// A provider died mid-reply and the backend sends the outage notice with
// `replace`: the half-written sentence must not stay above it.
describe('token replace', () => {
  const half = { id: 'm', role: 'assistant', content: 'The EMI would be ₹1,02,108 per month.' } as unknown as ChatMessage

  it('replaces the partial answer', () => {
    const out = applyStreamEvent(half, { type: 'token', token: 'Outage notice', replace: true } as unknown as SSEEvent)
    expect(out.content).toBe('Outage notice')
  })

  it('appends an ordinary token', () => {
    const out = applyStreamEvent(half, { type: 'token', token: ' More.' } as unknown as SSEEvent)
    expect(out.content).toBe('The EMI would be ₹1,02,108 per month. More.')
  })
})
