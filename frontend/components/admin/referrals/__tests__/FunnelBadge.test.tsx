import React from 'react'
import { render, screen } from '@testing-library/react'
import FunnelBadge from '../FunnelBadge'

describe('FunnelBadge', () => {
  it('renders the correct label for each of the four funnel stages', () => {
    const { rerender } = render(<FunnelBadge stage="arrived_no_chat" />)
    expect(screen.getByText('Arrived')).toBeDefined()

    rerender(<FunnelBadge stage="chatted_shallow" />)
    expect(screen.getByText('Chatted')).toBeDefined()

    rerender(<FunnelBadge stage="activated" />)
    expect(screen.getByText('Activated')).toBeDefined()

    rerender(<FunnelBadge stage="converted" />)
    expect(screen.getByText('Converted')).toBeDefined()
  })

  it('renders a distinct data-stage attribute per state (four visually distinct states)', () => {
    const stages = ['arrived_no_chat', 'chatted_shallow', 'activated', 'converted'] as const
    const seen = new Set<string>()
    for (const stage of stages) {
      const { container, unmount } = render(<FunnelBadge stage={stage} />)
      const badge = container.querySelector('[data-testid="funnel-badge"]')
      seen.add(badge?.getAttribute('data-stage') || '')
      unmount()
    }
    expect(seen.size).toBe(4)
  })
})
