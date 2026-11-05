import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import CallbackModal from '@/components/CallbackModal'
import LeadSuccessModal from '@/components/LeadSuccessModal'
import ProjectPricingTab from '@/components/property-detail/ProjectPricingTab'
import OverviewTab from '@/components/property-detail/OverviewTab'
import ConstructionTimeline from '@/components/property-detail/ConstructionTimeline'
import ComparisonTable, { columnName } from '@/components/ComparisonTable'
import NotFound from '@/app/not-found'

jest.mock('@/lib/analytics', () => ({ track: jest.fn(), trackSiteVisitBooked: jest.fn() }))
jest.mock('@/lib/whatsapp', () => ({ buildWhatsAppUrl: () => null, trackWhatsAppHandoff: jest.fn() }))
jest.mock('@/lib/authedFetch', () => ({ authHeaders: jest.fn().mockResolvedValue({}) }))
jest.mock('@/lib/guestToken', () => ({ getGuestToken: () => 'guest-test' }))
jest.mock('@/lib/backend-api', () => ({
  getProjectOverview: jest.fn().mockResolvedValue({ construction_milestones: null }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))

const src = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

describe('modals sit above the cookie banner and declare themselves', () => {
  const project = { id: 'p1', slug: 'p1', name: 'Test Towers', sector: 'Sector 1' } as any

  it('callback modal is a labelled modal dialog with focus inside it', () => {
    render(<CallbackModal project={project} isDone={false} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const labelId = dialog.getAttribute('aria-labelledby')!
    expect(document.getElementById(labelId)).toBeInTheDocument()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('callback modal overlay is above the cookie banner (z-50)', () => {
    const { container } = render(<CallbackModal project={project} isDone={false} onClose={() => {}} />)
    expect(container.querySelector('.fixed.inset-0')!.className).toContain('z-[120]')
    expect(src('components', 'CookiesBanner.tsx')).toContain('z-50')
  })

  it('callback modal makes no spam or response-time promise', () => {
    const { container } = render(<CallbackModal project={project} isDone={false} onClose={() => {}} />)
    expect(container.textContent).not.toMatch(/Guaranteed 0 Spam|Official Developer Desk|Within 30 Minutes/i)
  })

  it('site visit success says request received, not booked or confirmed', () => {
    const { container } = render(
      <LeadSuccessModal type="site_visit" projectName="Test Towers" name="A" visitDate="Mon, 1 Jan" timeSlot="10:00 AM" onClose={() => {}} />,
    )
    expect(container.textContent).not.toMatch(/Visit Booked|is confirmed|confirmation shortly|within 2/i)
    expect(container.textContent).toMatch(/Request received/)
    expect(container.textContent).toMatch(/call to confirm a slot/)
  })

  it('site visit scheduler traps focus and is labelled', () => {
    const f = src('components', 'SiteVisitScheduler.tsx')
    expect(f).toMatch(/role="dialog"/)
    expect(f).toMatch(/aria-modal="true"/)
    expect(f).toMatch(/aria-labelledby=/)
    expect(f).toMatch(/useDialogA11y/)
  })
})

describe('pricing tab does not invent bank or title claims', () => {
  it('lists banks as on record only', () => {
    const detail = {
      name: 'P', status: 'under_construction', cost_sheet: null, payment_plan: null, payment_plans: [],
      builder_detail: { funding_banks: ['HDFC Bank'] },
    } as any
    const unit = { id: 'u', name: '3 BHK', bhk: 3, super_area_sqft: 1500, price_min_cr: 1.5 } as any
    const { container } = render(<ProjectPricingTab unitTypes={[unit]} detail={detail} onGoToCosts={() => {}} />)
    const t = container.textContent ?? ''
    expect(t).toContain('HDFC Bank')
    expect(t).toContain('Banks on record')
    expect(t).not.toMatch(/APF Sanctioned|Fast Track|Clear Title Verified|Pre-approved/)
  })
})

describe('overview tab', () => {
  const props = (unit: Record<string, unknown>, conn: unknown[] = []) => ({
    project: { id: 'x', slug: 'x', name: 'X', status: 'under_construction', builder: { name: 'B' } },
    detail: { all_connectivity: conn, all_amenities: [], marketing_claims: [] },
    d: { id: 'x', slug: 'x', name: 'X', status: 'under_construction', unit_types: [{ bhk: 3, ...unit }] },
    loading: false, documents: [], aqi: null, floorPlanImages: [], decisionThesis: null, whyBuy: [], whyAvoid: [],
    onViewFloorPlans: jest.fn(), onGoToLocation: jest.fn(), onGoToDocuments: jest.fn(), onGoToPricing: jest.fn(),
  }) as any

  it('prints only the minimum price when the maximum is absent', () => {
    const { container } = render(<OverviewTab {...props({ price_min_cr: 1.2, price_max_cr: null })} />)
    const t = container.textContent ?? ''
    expect(t).not.toContain('undefined')
    expect(t).toContain('₹1.20 Cr')
  })

  it('has no cab pickup promise, no rank badges, and no derived metro minutes', () => {
    const { container } = render(
      <OverviewTab {...props({ price_min_cr: 1.2, price_max_cr: 1.5 }, [{ type: 'metro', name: 'Sector 62', distance_km: 0.8 }])} />,
    )
    const t = container.textContent ?? ''
    expect(t).not.toMatch(/cab pickup|sample flat walkthrough/i)
    expect(t).not.toMatch(/BEST VALUE|MOST POPULAR/)
    expect(t).not.toMatch(/\b2 mins\b/)
    expect(t).toContain('0.8 km')
  })
})

describe('construction timeline', () => {
  const done = Array.from({ length: 6 }, (_, i) => ({ name: `M${i}`, status: 'completed', date_label: null }))

  it('does not claim 100% or handover when status is under construction', () => {
    const { container } = render(<ConstructionTimeline milestones={done as any} projectStatus="under_construction" />)
    const t = container.textContent ?? ''
    expect(t).not.toMatch(/100%|Key Handover|Real-time/)
    expect(t).toMatch(/not marked ready to move/)
  })
})

describe('compare table names no winner', () => {
  const cards = [
    { id: 'a', slug: 'a', name: 'ATS Pristine Tower 1', sector: 'Sector 150', price_range_label: '₹1 Cr', price_min_cr: 1, status: 'under_construction', builder: { name: 'B' } },
    { id: 'b', slug: 'b', name: 'ATS Pristine Tower 2', sector: 'Sector 150', price_range_label: '₹2 Cr', price_min_cr: 2, status: 'ready_to_move', builder: { name: 'B' } },
    { id: 'c', slug: 'c', name: 'ATS Pristine', sector: 'Sector 99', price_range_label: '₹3 Cr', price_min_cr: 3, status: 'under_construction', builder: { name: 'B' } },
  ] as any

  it('has no Winner column, Best Value badge, and distinct full headers', async () => {
    ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: false })
    const { container } = render(<ComparisonTable projects={cards} />)
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull())
    const t = container.textContent ?? ''
    expect(t).not.toMatch(/Winner|Best Value|Lowest Entry/i)
    const heads = Array.from(container.querySelectorAll('thead th')).map(h => h.textContent)
    expect(new Set(heads).size).toBe(heads.length)
    expect(heads).toContain('ATS Pristine Tower 1 · Sector 150')
  })

  it('columnName adds the sector only when the name lacks it', () => {
    expect(columnName({ name: 'ATS Pristine', sector: 'Sector 150' })).toBe('ATS Pristine · Sector 150')
    expect(columnName({ name: 'X Sector 150', sector: 'Sector 150' })).toBe('X Sector 150')
  })
})

describe('generic 404', () => {
  it('says Page not found, not Listing Not Found', () => {
    render(<NotFound />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found')
    expect(document.body.textContent).not.toMatch(/Listing Not Found/)
  })
})

describe('stamp duty has no non-statutory joint rate', () => {
  it.each([
    ['components/CalculatorPanel.tsx'],
    ['components/property-detail/CostSheetSection.tsx'],
    ['lib/calculators.ts'],
  ])('%s', (file) => {
    const f = src(...file.split('/'))
    expect(f).not.toMatch(/Joint \(6\.5%\)|'joint'/)
  })
})

describe('chat header fits a 360 px phone', () => {
  const f = src('components', 'DiscoveryContent.tsx')
  it('keeps the right-hand actions un-shrinkable and drops the referral button on narrow screens', () => {
    expect(f).toMatch(/justify-end gap-1\.5 sm:gap-2 pointer-events-auto shrink-0/)
    expect(f).toMatch(/hidden min-\[420px\]:block"><ReferralShareButton/)
    expect(f).toMatch(/max-w-\[96px\] min-\[400px\]:max-w-\[155px\]/)
  })
})
