import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StatCard } from '../ui'

/**
 * The stat tile that actually ships, on ten consoles.
 *
 * This replaces a test of `components/admin/StatCard.tsx`, which was the
 * pre-dedupe copy: it had no `loading` prop and no skeleton, it was imported by
 * nothing after the Day 4.1 migration, and it was deleted on 2026-09-24. The
 * duplicate carried the only StatCard test in the repo while the component on
 * every admin page had none — so the coverage was pointing at the copy nobody
 * renders.
 *
 * `loading` is the reason this file exists rather than just being deleted with
 * its subject: "stat cards render with working skeleton loaders" is a stated
 * Day 4.1 pass condition, and nothing else asserts it.
 */
describe('StatCard (portal/ui) — the one every console renders', () => {
  const icon = <svg data-testid="icon" />

  it('renders its label and value', () => {
    render(<StatCard label="Total leads" value="1,234" icon={icon} />)
    expect(screen.getByText('Total leads')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('shows a skeleton instead of the value while loading', () => {
    const { container } = render(<StatCard label="Total leads" value="1,234" icon={icon} loading />)
    expect(screen.queryByText('1,234')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('shows the value once loading is done', () => {
    const { container } = render(<StatCard label="Total leads" value="1,234" icon={icon} loading={false} />)
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).toBeNull()
  })

  it('renders the hint only when one is given', () => {
    const { rerender } = render(<StatCard label="Median reply" value="12m" icon={icon} />)
    expect(screen.queryByText('last 30 days')).not.toBeInTheDocument()
    rerender(<StatCard label="Median reply" value="12m" icon={icon} hint="last 30 days" />)
    expect(screen.getByText('last 30 days')).toBeInTheDocument()
  })

  it('tones the value without changing what it says', () => {
    // A tone is a colour, never a different number — the admin pages pick one
    // per metric and the value has to survive it.
    for (const tone of ['neutral', 'hot', 'good'] as const) {
      const { unmount } = render(<StatCard label="Open" value="7" icon={icon} tone={tone} />)
      expect(screen.getByText('7')).toBeInTheDocument()
      unmount()
    }
  })
})
