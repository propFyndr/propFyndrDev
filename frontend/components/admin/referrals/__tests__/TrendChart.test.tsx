import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TrendChart from '../TrendChart'

describe('TrendChart', () => {
  it('toggles between daily/weekly/all-time without unmounting (calls onGranularityChange, no full reload)', () => {
    const onGranularityChange = jest.fn()
    const { rerender } = render(
      <TrendChart buckets={[{ date: '2026-01-01', newArrivals: 3 }]} granularity="daily" onGranularityChange={onGranularityChange} />,
    )

    fireEvent.click(screen.getByTestId('granularity-weekly'))
    expect(onGranularityChange).toHaveBeenCalledWith('weekly')

    // Parent re-renders with the new granularity — component instance persists.
    rerender(
      <TrendChart buckets={[{ date: '2026-W01', newArrivals: 10 }]} granularity="weekly" onGranularityChange={onGranularityChange} />,
    )
    expect(screen.getByTestId('granularity-weekly').className).toContain('bg-[#0066cc]')

    fireEvent.click(screen.getByTestId('granularity-all'))
    expect(onGranularityChange).toHaveBeenCalledWith('all')
  })

  it('renders an empty state with no buckets', () => {
    render(<TrendChart buckets={[]} granularity="daily" onGranularityChange={jest.fn()} />)
    expect(screen.getByText('No arrivals recorded yet.')).toBeDefined()
  })

  it('draws no bar for a bucket with zero arrivals', () => {
    render(
      <TrendChart
        buckets={[
          { date: '2026-01-01', newArrivals: 0 },
          { date: '2026-01-02', newArrivals: 4 },
        ]}
        granularity="daily"
        onGranularityChange={() => {}}
      />,
    )
    const bars = screen.getByTestId('trend-chart').querySelectorAll<HTMLElement>('[style*="height"]')
    expect(bars[0].style.height).toBe('0%')
    expect(bars[1].style.height).toBe('100%')
  })
})
