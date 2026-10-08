import { calculateEmi, calculateStampDuty, calculateGst, calculateLoanCockpit } from '../lib/calculators'
import { formatInr } from '../lib/format'


describe('calculateEmi', () => {
  it('computes correct EMI for 1Cr at 8.5% for 20 years', () => {
    const r = calculateEmi(1, 8.5, 20)
    expect(r.emi_monthly).toBeGreaterThan(85000)
    expect(r.emi_monthly).toBeLessThan(88000)
    expect(r.tenure_months).toBe(240)
    expect(r.principal).toBe(10000000)
  })

  it('total_payment = principal + interest', () => {
    const r = calculateEmi(2, 9, 25)
    expect(r.total_interest).toBeGreaterThan(0)
    expect(r.total_payment).toBe(r.principal + r.total_interest)
  })

  it('handles 0% rate — no interest charged', () => {
    const r = calculateEmi(1, 0, 10)
    expect(r.emi_monthly).toBe(Math.round(1e7 / 120))
    expect(r.total_interest).toBe(0)
  })
})

describe('calculateStampDuty', () => {
  it('applies 7% stamp duty for male buyer', () => {
    const r = calculateStampDuty(2, 'male')
    expect(r.stamp_duty).toBe(1400000)
    expect(r.registration).toBe(200000)
    expect(r.total_charges).toBe(1600000)
  })

  it('applies 6% stamp duty for female buyer', () => {
    const r = calculateStampDuty(2, 'female')
    expect(r.stamp_duty).toBe(1200000)
  })

  it('applies 6.5% for joint buyer', () => {
    const r = calculateStampDuty(2, 'joint')
    expect(r.stamp_duty).toBe(1300000)
  })

  it('defaults to male if gender omitted', () => {
    const r = calculateStampDuty(1)
    expect(r.stamp_duty_rate).toBe(7)
  })
})

describe('calculateGst', () => {
  it('returns 0% GST for ready_to_move', () => {
    const r = calculateGst(3, 'ready_to_move')
    expect(r.gst_rate).toBe(0)
    expect(r.gst_amount).toBe(0)
    expect(r.category).toBe('ready_to_move')
  })

  it('returns 1% for affordable under-construction (≤45L + ≤90sqm)', () => {
    const r = calculateGst(0.4, 'under_construction', 85)
    expect(r.gst_rate).toBe(1)
    expect(r.category).toBe('affordable')
  })

  it('returns 5% for standard under-construction (>45L)', () => {
    const r = calculateGst(2, 'under_construction', 120)
    expect(r.gst_rate).toBe(5)
    expect(r.category).toBe('standard')
  })

  it('returns 5% when carpet area missing (>0 check)', () => {
    const r = calculateGst(0.4, 'under_construction', 0)
    expect(r.gst_rate).toBe(5)
  })
})

describe('calculateLoanCockpit', () => {
  it('computes correct loan principal and down payment', () => {
    const res = calculateLoanCockpit({
      totalLandedCost: 10000000, // 1 Cr
      downPaymentPct: 20,
      tenureYears: 20,
      annualInterestRatePct: 8.5,
    })
    expect(res.downPaymentAmount).toBe(2000000)
    expect(res.loanPrincipal).toBe(8000000)
    expect(res.standardMonthlyEmi).toBeGreaterThan(69000)
    expect(res.standardMonthlyEmi).toBeLessThan(70000)
  })

  it('computes Sec 24b tax shield capped at 5000/mo', () => {
    const res = calculateLoanCockpit({
      totalLandedCost: 20000000, // 2 Cr, 80% loan = 1.6 Cr
      downPaymentPct: 20,
      tenureYears: 20,
      annualInterestRatePct: 8.5,
    })
    // 1.6 Cr * 8.5% = 13.6 Lakh interest >> 2 Lakh ceiling. (200000 * 0.30) / 12 = 5000
    expect(res.monthlyTaxShieldSec24b).toBe(5000)
    expect(res.netMonthlyOutflow).toBe(res.standardMonthlyEmi - 5000)
  })

  it('computes rate shock buffer when enabled', () => {
    const withoutShock = calculateLoanCockpit({
      totalLandedCost: 10000000,
      downPaymentPct: 20,
      tenureYears: 20,
      annualInterestRatePct: 8.5,
      enableRateShock: false,
    })
    const withShock = calculateLoanCockpit({
      totalLandedCost: 10000000,
      downPaymentPct: 20,
      tenureYears: 20,
      annualInterestRatePct: 8.5,
      enableRateShock: true,
    })
    expect(withShock.shockMonthlyEmi).toBeGreaterThan(withoutShock.standardMonthlyEmi)
    expect(withShock.activeInterestRatePct).toBe(10) // 8.5 + 1.5
    expect(withShock.monthlyRateShockDelta).toBe(withShock.shockMonthlyEmi - withoutShock.standardMonthlyEmi)
  })
})

