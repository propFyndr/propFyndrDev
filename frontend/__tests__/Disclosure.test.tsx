import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import VerificationPanel from '@/components/property-detail/VerificationPanel'
import PriceInclusions, { summarisePriceInclusions } from '@/components/property-detail/PriceInclusions'
import type { ProjectDetail } from '@/types/project'

// Nineteen disclosure fields were returned by the API and read by nothing, so
// the page showed the amenities and the price and dropped the risk record.
// These assert that the unflattering half now renders, and that we never assert
// something we do not hold.

const base = { id: 'p1', slug: 's', name: 'Ace Arte' } as unknown as ProjectDetail
const project = (over: Partial<ProjectDetail>): ProjectDetail => ({ ...base, ...over } as ProjectDetail)

describe('PriceInclusions', () => {
  it('says nothing when we hold none of the three flags', () => {
    expect(summarisePriceInclusions({})).toBeNull()
    const { container } = render(<PriceInclusions project={project({})} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('states what the price excludes — the case that used to read "ALL INCLUSIVE"', () => {
    const summary = summarisePriceInclusions({
      price_includes_plc: false,
      price_includes_club: false,
      price_includes_taxes: false,
    })
    expect(summary).toBe('Excludes PLC, club membership and taxes')
  })

  it('separates what is included from what is not', () => {
    expect(
      summarisePriceInclusions({
        price_includes_plc: true,
        price_includes_club: false,
        price_includes_taxes: null,
      }),
    ).toBe('Includes PLC; excludes club membership')
  })

  it('reports only the flags we actually hold', () => {
    const summary = summarisePriceInclusions({ price_includes_taxes: true })
    expect(summary).toBe('Includes taxes')
    expect(summary).not.toMatch(/club|PLC/)
  })
})

describe('VerificationPanel', () => {
  it('renders nothing when we hold no compliance record', () => {
    const { container } = render(<VerificationPanel project={project({})} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a missing Occupancy Certificate and why it matters', () => {
    render(<VerificationPanel project={project({ oc_obtained: false })} />)
    expect(screen.getByText('Not yet obtained')).toBeInTheDocument()
    expect(screen.getByText(/GST applies at 5%/)).toBeInTheDocument()
  })

  it('surfaces a raised legal flag rather than hiding it', () => {
    render(<VerificationPanel project={project({
      project_risk_flag: 'nclt_moratorium',
      legal_flag_detail: 'Insolvency proceedings admitted.',
    })} />)
    expect(screen.getByText('Nclt Moratorium')).toBeInTheDocument()
    expect(screen.getByText('Insolvency proceedings admitted.')).toBeInTheDocument()
  })

  it('does not show a legal row when the flag is explicitly "none"', () => {
    const { container } = render(<VerificationPanel project={project({ project_risk_flag: 'none' })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a registry embargo with its reasons', () => {
    render(<VerificationPanel project={project({
      registry_status: 'embargo',
      registry_embargo_reasons: ['Authority dues outstanding'],
    })} />)
    expect(screen.getByText('Embargo')).toBeInTheDocument()
    expect(screen.getByText(/Authority dues outstanding/)).toBeInTheDocument()
  })

  it('shows ongoing litigation with its types', () => {
    render(<VerificationPanel project={project({
      ongoing_litigation_count: 2,
      litigation_types: ['Land title', 'Consumer forum'],
    })} />)
    expect(screen.getByText('2 cases')).toBeInTheDocument()
    expect(screen.getByText(/Land title; Consumer forum/)).toBeInTheDocument()
  })

  it('singularises a single case', () => {
    render(<VerificationPanel project={project({ ongoing_litigation_count: 1 })} />)
    expect(screen.getByText('1 case')).toBeInTheDocument()
  })

  it('shows possession confidence together with its note', () => {
    render(<VerificationPanel project={project({
      possession_confidence: 'at_risk',
      possession_confidence_note: 'Structure work paused since March.',
    })} />)
    expect(screen.getByText('At Risk')).toBeInTheDocument()
    expect(screen.getByText('Structure work paused since March.')).toBeInTheDocument()
  })

  it('flags an expired RERA registration', () => {
    render(<VerificationPanel project={project({ rera_valid_until: '2020-01-01' })} />)
    expect(screen.getByText(/Expired/)).toBeInTheDocument()
  })

  it('renders location concerns beside nothing else if that is all we hold', () => {
    render(<VerificationPanel project={project({ location_concerns: ['Adjacent to an industrial belt'] })} />)
    expect(screen.getByText('Adjacent to an industrial belt')).toBeInTheDocument()
  })

  it('shows environmental risk', () => {
    render(<VerificationPanel project={project({ flood_waterlogging_risk: 'high', aqi_annual_avg: 245 })} />)
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('AQI 245')).toBeInTheDocument()
  })
})
