import { render } from '@testing-library/react'
import ProjectPricingTab from '../property-detail/ProjectPricingTab'
import type { ProjectDetail, UnitTypeSummary } from '@/types/project'

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

const unitTypes = [
  { bhk: 3, price_min_cr: 1.4, price_max_cr: 1.6, super_area_sqft: 1650 },
] as unknown as UnitTypeSummary[]

describe('ProjectPricingTab', () => {
  it('survives the loading -> loaded transition (every hook runs on every render)', () => {
    // It used to return the skeleton before its last useEffect, so the loaded
    // render ran one more hook than the loading render and React threw
    // "Rendered more hooks than during the previous render".
    const { rerender, container } = render(
      <ProjectPricingTab unitTypes={unitTypes} detail={null} loading onGoToCosts={() => {}} />,
    )
    const detail = { name: 'Test Project', status: 'under_construction' } as unknown as ProjectDetail
    expect(() =>
      rerender(<ProjectPricingTab unitTypes={unitTypes} detail={detail} loading={false} onGoToCosts={() => {}} />),
    ).not.toThrow()
    expect(container).not.toBeEmptyDOMElement()
  })
})
