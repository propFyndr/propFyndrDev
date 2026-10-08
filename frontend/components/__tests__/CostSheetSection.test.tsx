import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import CostSheetSection, { NOT_ON_RECORD } from '../property-detail/CostSheetSection'
import type { ProjectDetail, UnitTypeSummary } from '@/types/project'

/**
 * The cost sheet shows this project's own cost_sheet charges, and a charge we
 * don't hold says so — it is never filled with a typical Noida figure.
 */
const unit = { id: 'u1', name: '3 BHK', bhk: 3, bathrooms: 3, super_area_sqft: 1000, price_min_cr: 1 } as UnitTypeSummary

const detail = (cost_sheet: Record<string, unknown> | null) =>
  ({ status: 'under_construction', oc_status: null, cost_sheet } as unknown as ProjectDetail)

describe('CostSheetSection', () => {
  it('uses the project cost_sheet values', () => {
    render(
      <CostSheetSection
        detail={detail({ parking_cost: 400000, club_membership: 150000, ifms: 60000, plc_charges: [], other_charges: [] })}
        unitTypes={[unit]}
      />,
    )
    expect(screen.getByText('₹4,00,000')).toBeInTheDocument()
    expect(screen.getByText('₹1,50,000')).toBeInTheDocument()
    // IFMS row and the handover subtotal (IFMS is the only handover charge on record)
    expect(screen.getAllByText('₹60,000')).toHaveLength(2)
    expect(screen.queryByText('₹3,50,000')).not.toBeInTheDocument() // old hardcoded parking
  })

  it('shows "not on record" instead of typical figures when there is no cost sheet', () => {
    render(<CostSheetSection detail={detail(null)} unitTypes={[unit]} />)
    expect(screen.getAllByText(NOT_ON_RECORD).length).toBeGreaterThanOrEqual(5)
    for (const typical of ['₹3,50,000', '₹3,00,000', '₹75,000', '₹50,000', '₹25,000']) {
      expect(screen.queryByText(typical)).not.toBeInTheDocument()
    }
  })

  it('invents no area or price when the unit has neither', () => {
    render(<CostSheetSection detail={detail(null)} unitTypes={[{ id: 'u2', name: '2 BHK', bhk: 2, bathrooms: 2 } as UnitTypeSummary]} />)
    expect(screen.getByText('Price not on record')).toBeInTheDocument()
    expect(screen.queryByText(/1,200|1,650|7,500/)).not.toBeInTheDocument()
  })
})
