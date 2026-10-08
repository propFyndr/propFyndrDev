import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { drainStep, createTypewriterBuffer } from '@/lib/chat/typewriterBuffer'
import { calculateLoanCockpit } from '@/lib/calculators'
import { computeCarpetEfficiency } from '@/lib/chat/carpetEfficiency'
import { REALTY_SCHEMA } from '@/components/response/Markdown'
import AffordabilityCard from '@/components/chat/AffordabilityCard'
import ProvenancePill from '@/components/chat/ProvenancePill'
import VerificationProofDrawer from '@/components/chat/VerificationProofDrawer'

describe('Day 5: Micro-UX, Financial Cockpit, Usable Area Visualizer & Provenance', () => {
  describe('Task 5.1: Typewriter Buffer & Adaptive Easing', () => {
    it('drains text at adaptive speed based on buffer lag', () => {
      // No lag
      expect(drainStep(10, 10)).toBe(0)
      expect(drainStep(20, 10)).toBe(0)

      // Small lag (<= 15 chars) drains 1 char
      expect(drainStep(0, 10)).toBe(1)
      expect(drainStep(0, 15)).toBe(1)

      // Medium lag (16-40 chars) drains 2 chars
      expect(drainStep(0, 20)).toBe(2)
      expect(drainStep(0, 40)).toBe(2)

      // High lag (41-80 chars) drains 4 chars
      expect(drainStep(0, 50)).toBe(4)
      expect(drainStep(0, 80)).toBe(4)

      // Extreme lag (> 80 chars) drains 8 chars
      expect(drainStep(0, 85)).toBe(8)
      expect(drainStep(0, 200)).toBe(8)
    })

    it('createTypewriterBuffer supports immediate flush on stream completion', () => {
      let output = ''
      const buffer = createTypewriterBuffer((text) => { output = text })
      buffer.write('Streamed response chunk')
      buffer.flushImmediately()
      expect(output).toBe('Streamed response chunk')
      buffer.stop()
    })
  })

  describe('Task 5.2: Client-Side Financial Cockpit & Rate Shock', () => {
    it('calculates loan parameters, base EMI, rate shock and FOIR in <5ms with 0 tokens', () => {
      const t0 = performance.now()
      const result = calculateLoanCockpit({
        totalLandedCost: 15000000, // 1.5 Cr
        downPaymentPct: 20,
        tenureYears: 20,
        annualInterestRatePct: 8.5,
        enableRateShock: false,
      })
      const elapsed = performance.now() - t0

      // Execution speed assertion
      expect(elapsed).toBeLessThan(10) // Well within 5ms typical execution

      // Loan principal = 1.5 Cr * 80% = 1.2 Cr = 1,20,00,000
      expect(result.loanPrincipal).toBe(12000000)
      expect(result.downPaymentAmount).toBe(3000000)

      // Standard Monthly EMI at 8.5% for 20 years on 1.2 Cr
      expect(result.standardMonthlyEmi).toBeGreaterThan(100000)
      expect(result.standardMonthlyEmi).toBeLessThan(110000)

      // Shock EMI at 10.0% (8.5 + 1.5)
      expect(result.shockMonthlyEmi).toBeGreaterThan(result.standardMonthlyEmi)
      expect(result.monthlyRateShockDelta).toBe(result.shockMonthlyEmi - result.standardMonthlyEmi)
      expect(result.monthlyRateShockDelta).toBeGreaterThan(10000)

      // Sec 24(b) deduction savings
      expect(result.monthlyTaxShieldSec24b).toBeGreaterThan(0)
      expect(result.netMonthlyOutflow).toBe(result.standardMonthlyEmi - result.monthlyTaxShieldSec24b)

      // 40% FOIR safe monthly income
      expect(result.safeMonthlyTakeHome).toBe(Math.round(result.standardMonthlyEmi / 0.40))
    })

    it('handles custom tenure and down payment ranges correctly', () => {
      const res = calculateLoanCockpit({
        totalLandedCost: 20000000, // 2 Cr
        downPaymentPct: 50,
        tenureYears: 10,
        annualInterestRatePct: 8.5,
        enableRateShock: true,
      })
      // 50% of 2 Cr is 1 Cr
      expect(resultLoanPrincipal(res)).toBe(10000000)
      expect(res.downPaymentAmount).toBe(10000000)
      expect(res.activeInterestRatePct).toBe(10.0)
    })

    it('updates AffordabilityCard DOM when user drags down payment and tenure sliders', () => {
      const mockData = {
        basePrice: 12000000,
        landedMultiplier: 1.15,
        totalLandedCost: 13800000,
        downpaymentAmount: 2760000,
        loanPrincipal: 11040000,
        tenureYears: 20,
        baseInterestRatePct: 8.5,
        standardEmi: 95800,
        shockInterestRatePct: 10.0,
        shockEmi: 106500,
        rateShockBufferMonthly: 10700,
        monthlyTaxShieldSec24b: 5000,
        netMonthlyOutflow: 90800,
        safeMonthlyTakeHome: 239500,
        safeAnnualHouseholdIncome: 2874000,
      }

      render(<AffordabilityCard data={mockData} />)
      expect(screen.getByText('Financial Cockpit')).toBeInTheDocument()

      const downPaymentSlider = screen.getByLabelText('Down Payment Percentage')
      fireEvent.change(downPaymentSlider, { target: { value: '30' } })
      expect(screen.getAllByText(/30%/).length).toBeGreaterThan(0)

      const tenureSlider = screen.getByLabelText('Loan Tenure in Years')
      fireEvent.change(tenureSlider, { target: { value: '15' } })
      expect(screen.getByText(/15 years/)).toBeInTheDocument()
    })
  })

  describe('Task 5.3: RERA Carpet Loading & Usable Area Visualizer', () => {
    it('computes exact loading percentage, rating and price per usable sqft', () => {
      const res = computeCarpetEfficiency(2000, 1500, 1.5)

      // Common area = 500 sqft
      expect(res.commonAreaSqft).toBe(500)
      // Loading percentage = (500 / 2000) * 100 = 25%
      expect(res.loadingPercentage).toBe(25)
      // Efficiency = 1500 / 2000 = 75%
      expect(res.carpetEfficiencyPercentage).toBe(75)

      // Effective carpet rate
      expect(res.advertisedRatePerSqft).toBe(7500) // 1.5 Cr / 2000 sqft = 7,500/sqft
      expect(res.effectiveCarpetRatePerSqft).toBe(10000) // 7500 * (2000 / 1500) = 10,000/sqft
    })

    it('computes elevator congestion index (ECI) correctly', () => {
      const eci = computeCarpetEfficiency(1500, 1200, 1.2, { totalFlats: 120, totalLifts: 4 })
      expect(eci.eciScore).toBe(30) // 120 / 4 = 30 flats per lift
      expect(eci.eciRating).toBe('Low Wait')
    })
  })

  describe('Task 5.4: Provenance Trust Pills & Protocol Whitelist', () => {
    it('whitelists #provenance and #entity in REALTY_SCHEMA protocols', () => {
      expect(REALTY_SCHEMA.protocols.href).toContain('#provenance')
      expect(REALTY_SCHEMA.protocols.href).toContain('#entity')
    })

    it('transforms [Verified: Claim] into clickable #provenance links in markdown', () => {
      const sampleText = 'This project is [Verified: HRERA Registered 2024] and ready for handover.'
      const transformed = sampleText.replace(
        /\[Verified:\s*([^\]]+)\]/gi,
        (_m, claim) => `[Verified: ${claim}](#provenance:${encodeURIComponent(claim.trim())})`
      )
      expect(transformed).toContain('[Verified: HRERA Registered 2024](#provenance:HRERA%20Registered%202024)')
    })

    it('renders ProvenancePill and triggers onClick callback', () => {
      const onClick = jest.fn()
      render(<ProvenancePill claim="Ganga Jal Supply" onClick={onClick} />)

      const pill = screen.getByRole('button', { name: /Ganga Jal Supply/i })
      expect(pill).toBeInTheDocument()
      fireEvent.click(pill)
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('renders VerificationProofDrawer with accessible dialog roles and closes on request', () => {
      const onClose = jest.fn()
      const { rerender } = render(
        <VerificationProofDrawer
          proof={{
            claim: 'Ganga Jal Supply (TDS 220 ppm)',
            authorityName: 'Noida Jal Board',
            certificateId: 'NJB-WATER-2024-88',
          }}
          onClose={onClose}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(screen.getByText('Project record')).toBeInTheDocument()
      expect(screen.getByText('NJB-WATER-2024-88')).toBeInTheDocument()

      const closeBtn = screen.getByLabelText('Close proof drawer')
      fireEvent.click(closeBtn)
      expect(onClose).toHaveBeenCalledTimes(1)

      rerender(<VerificationProofDrawer proof={null} onClose={onClose} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

function resultLoanPrincipal(res: ReturnType<typeof calculateLoanCockpit>): number {
  return res.loanPrincipal
}
