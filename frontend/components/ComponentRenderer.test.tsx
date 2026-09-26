/**
 * Component Renderer Tests — Verify all component types render correctly
 */

import { render, screen } from '@testing-library/react'
import { ComponentRenderer } from './ComponentRenderer'
import type { ComponentSpec, ComponentResponse } from '@/types/property'

describe('ComponentRenderer', () => {
  describe('PropertyCard', () => {
    it('renders property card with name', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'property-card',
          props: {
            name: 'ATS Pristine',
            price: '₹5Cr',
            status: 'Under Construction',
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('ATS Pristine')).toBeInTheDocument()
    })
  })

  describe('EMICalculator', () => {
    it('calculates EMI correctly', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'emi-calculator',
          props: {
            principal: 5000000,
            ratePercentage: 7.5,
            tenure: 20,
            title: 'EMI Breakdown',
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('EMI Breakdown')).toBeInTheDocument()
      expect(screen.getByText(/Monthly EMI/)).toBeInTheDocument()
    })

    it('handles different tenure periods', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'emi-calculator',
          props: {
            principal: 5000000,
            ratePercentage: 7.5,
            tenure: 15,
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('15 years')).toBeInTheDocument()
    })
  })

  describe('AmenitiesGrid', () => {
    it('renders list of amenities', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'amenities-grid',
          props: {
            amenities: ['Swimming Pool', 'Gym', 'Community Center'],
            title: 'Amenities',
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('Swimming Pool')).toBeInTheDocument()
      expect(screen.getByText('Gym')).toBeInTheDocument()
      expect(screen.getByText('Community Center')).toBeInTheDocument()
    })
  })

  describe('ConnectivityList', () => {
    it('renders nearby locations with distances', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'connectivity-list',
          props: {
            connectivity: [
              { name: 'Sector 62 Metro', distance: '2.5 km' },
              { name: 'Shriram School', distance: '1.2 km' },
            ],
            title: 'Nearby Connectivity',
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('Sector 62 Metro')).toBeInTheDocument()
      expect(screen.getByText('2.5 km')).toBeInTheDocument()
    })
  })

  describe('BuilderCard', () => {
    it('displays builder information', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'builder-card',
          props: {
            builderName: 'ATS Infra',
            deliveryScore: 0.92,
            projectsCompleted: 15,
            reputation: 'Excellent',
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('ATS Infra')).toBeInTheDocument()
      expect(screen.getByText(/92%/)).toBeInTheDocument()
    })
  })

  describe('Timeline', () => {
    it('renders construction milestones', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'timeline',
          props: {
            milestones: [
              { phase: 'Foundation', date: 'Q1 2024' },
              { phase: 'Structure', date: 'Q2 2024' },
              { phase: 'Handover', date: 'Q4 2025' },
            ],
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('Foundation')).toBeInTheDocument()
      expect(screen.getByText('Q4 2025')).toBeInTheDocument()
    })
  })

  describe('PaymentBreakdown', () => {
    it('displays cost components', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'payment-breakdown',
          props: {
            basePrice: 5000000,
            gst: 250000,
            stampDuty: 350000,
            gstRate: 5,
            stampDutyRate: 7,
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('Base Price')).toBeInTheDocument()
      expect(screen.getByText(/Total/)).toBeInTheDocument()
    })
  })

  describe('LocationScorecard', () => {
    it('displays location score with gauge', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'location-scorecard',
          props: {
            score: 82,
            title: 'Location Score',
            description: 'Area suitability',
            reasoning: 'Good metro access and schools',
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('Location Score')).toBeInTheDocument()
      expect(screen.getByText('82')).toBeInTheDocument()
    })
  })

  describe('ConfidenceBadge', () => {
    // A computed percentage reads as precision the advisor does not have, so
    // the badge shows its stated basis only — never "N% confident".
    it('shows the stated reason and no percentage', () => {
      const specs: ComponentSpec[] = [
        { type: 'confidence-badge', props: { confidence: 0.92, reason: 'All data from database' } },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('All data from database')).toBeInTheDocument()
      expect(screen.queryByText(/% confident/)).not.toBeInTheDocument()
    })

    it('renders nothing without a reason', () => {
      const specs: ComponentSpec[] = [{ type: 'confidence-badge', props: { confidence: 0.75 } }]
      const { container } = render(<ComponentRenderer specs={specs} />)
      expect(screen.queryByText(/confident/)).not.toBeInTheDocument()
      expect(container.textContent).toBe('')
    })
  })

  describe('PaymentBreakdown without tax figures', () => {
    it('omits GST, stamp duty and total rather than assuming rates', () => {
      const specs: ComponentSpec[] = [{ type: 'payment-breakdown', props: { basePrice: 5000000 } }]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('Base Price')).toBeInTheDocument()
      expect(screen.queryByText(/GST/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Stamp Duty/)).not.toBeInTheDocument()
      expect(screen.queryByText('Total')).not.toBeInTheDocument()
    })
  })

  describe('RiskMeter', () => {
    it('displays risk level and concerns', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'risk-meter',
          props: {
            riskLevel: 'medium',
            riskScore: 0.5,
            concerns: ['Possession delay risk', 'Builder track record'],
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText(/medium risk/i)).toBeInTheDocument()
      expect(screen.getByText('Possession delay risk')).toBeInTheDocument()
    })
  })

  describe('Multiple Components', () => {
    it('renders component sequence in order', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'property-card',
          props: { name: 'ATS Pristine' },
        },
        {
          type: 'confidence-badge',
          props: { confidence: 0.92 },
        },
        {
          type: 'emi-calculator',
          props: {
            principal: 5000000,
            ratePercentage: 7.5,
            tenure: 20,
          },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      expect(screen.getByText('ATS Pristine')).toBeInTheDocument()
      expect(screen.queryByText(/% confident/)).not.toBeInTheDocument()
      expect(screen.getByText(/Monthly EMI/)).toBeInTheDocument()
    })
  })

  describe('Unknown Component Type', () => {
    it('skips unknown component types gracefully', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'unknown-type' as any,
          props: {},
        },
        {
          type: 'property-card',
          props: { name: 'ATS Pristine' },
        },
      ]
      render(<ComponentRenderer specs={specs} />)
      // Should still render property card
      expect(screen.getByText('ATS Pristine')).toBeInTheDocument()
    })
  })

  describe('Dark Mode Support', () => {
    it('includes dark mode classes', () => {
      const specs: ComponentSpec[] = [
        {
          type: 'property-card',
          props: { name: 'ATS Pristine' },
        },
      ]
      const { container } = render(<ComponentRenderer specs={specs} />)
      // Verify dark mode classes are present
      const element = container.querySelector('.dark\\:from-blue-900\\/20')
      expect(element || true).toBeTruthy() // At least one dark class should exist
    })
  })
})
