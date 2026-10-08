// Property calculators — pure math, no external deps.

export interface EmiResult {
  emi_monthly: number
  total_payment: number
  total_interest: number
  principal: number
  annual_rate: number
  tenure_months: number
}

/**
 * Standard EMI formula: P × r × (1+r)^n / ((1+r)^n - 1)
 * @param principal_cr  Loan amount in crores
 * @param annual_rate   Annual interest rate percent (e.g. 8.5)
 * @param tenure_years  Loan tenure in years
 */
export function calculateEmi(
  principal_cr: number,
  annual_rate: number,
  tenure_years: number,
): EmiResult {
  const principal = principal_cr * 1e7
  const r = annual_rate / 12 / 100
  const n = tenure_years * 12
  const emi = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  const total_payment = emi * n
  return {
    emi_monthly: Math.round(emi),
    total_payment: Math.round(total_payment),
    total_interest: Math.round(total_payment - principal),
    principal,
    annual_rate,
    tenure_months: n,
  }
}

export interface StampDutyResult {
  property_value: number
  stamp_duty: number
  registration: number
  total_charges: number
  stamp_duty_rate: number
  buyer_gender: 'male' | 'female' | 'joint'
  note: string
}

/**
 * UP stamp duty (2024).
 * Men: 7%, Women: 6% (1% concession), Joint: 6.5%.
 * Registration: 1%.
 */
export function calculateStampDuty(
  price_cr: number,
  buyer_gender: 'male' | 'female' | 'joint' = 'male',
): StampDutyResult {
  const value = price_cr * 1e7
  const rate = buyer_gender === 'female' ? 6 : buyer_gender === 'joint' ? 6.5 : 7
  const stamp_duty = Math.round(value * rate / 100)
  const registration = Math.round(value * 1 / 100)
  return {
    property_value: value,
    stamp_duty,
    registration,
    total_charges: stamp_duty + registration,
    stamp_duty_rate: rate,
    buyer_gender,
    note: 'Indicative. Rates based on UP 2024 rules. Verify with registered valuer before purchase.',
  }
}

export interface GstResult {
  property_value: number
  gst_amount: number
  gst_rate: number
  category: 'affordable' | 'standard' | 'ready_to_move'
  note: string
}

/**
 * GST on residential property (post-2019 revised rates).
 * RTM (OC received): 0%. Affordable UC (≤₹45L + carpet ≤90sqm, non-metro): 1%. Standard UC: 5%.
 * Noida = non-metro.
 */
export function calculateGst(
  price_cr: number,
  status: 'under_construction' | 'ready_to_move',
  carpet_sqm = 0,
): GstResult {
  const value = price_cr * 1e7
  if (status === 'ready_to_move') {
    return { property_value: value, gst_amount: 0, gst_rate: 0, category: 'ready_to_move',
      note: 'No GST on ready-to-move properties with Occupancy Certificate.' }
  }
  const isAffordable = price_cr <= 4.5 && carpet_sqm > 0 && carpet_sqm <= 90

  const rate = isAffordable ? 1 : 5
  return {
    property_value: value,
    gst_amount: Math.round(value * rate / 100),
    gst_rate: rate,
    category: isAffordable ? 'affordable' : 'standard',
    note: isAffordable
      ? 'Affordable housing rate (≤₹45L + carpet ≤90sqm in non-metro). Verify carpet area with builder.'
      : 'Standard under-construction rate after composition scheme.',
  }
}

export interface LoanCockpitParams {
  totalLandedCost: number
  downPaymentPct: number // 10 to 50
  tenureYears: number // 10 to 30
  annualInterestRatePct: number // e.g. 8.5
  enableRateShock?: boolean // +1.5%
}

export interface LoanCockpitResult {
  downPaymentAmount: number
  loanPrincipal: number
  activeInterestRatePct: number
  standardMonthlyEmi: number
  shockMonthlyEmi: number
  monthlyRateShockDelta: number
  monthlyTaxShieldSec24b: number
  netMonthlyOutflow: number
  safeMonthlyTakeHome: number
}

/**
 * Real-time client-side loan calculations with Sec 24(b) tax relief and RBI rate shock.
 */
export function calculateLoanCockpit(params: LoanCockpitParams): LoanCockpitResult {
  const downPaymentAmount = Math.round(params.totalLandedCost * (params.downPaymentPct / 100))
  const loanPrincipal = Math.max(0, params.totalLandedCost - downPaymentAmount)
  const baseRate = params.annualInterestRatePct || 8.5
  const shockRate = baseRate + 1.5

  const calcEmiRupees = (principal: number, ratePct: number, years: number) => {
    if (principal <= 0) return 0
    const r = ratePct / 12 / 100
    const n = years * 12
    if (r === 0) return Math.round(principal / n)
    return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
  }

  const standardMonthlyEmi = calcEmiRupees(loanPrincipal, baseRate, params.tenureYears)
  const shockMonthlyEmi = calcEmiRupees(loanPrincipal, shockRate, params.tenureYears)
  const monthlyRateShockDelta = Math.max(0, shockMonthlyEmi - standardMonthlyEmi)

  // Sec 24(b) deduction on interest: max ₹2,00,000/yr. Tax savings at 30% slab: max ₹5,000/mo.
  const approxFirstYearInterest = loanPrincipal * (baseRate / 100)
  const annualSec24bDeduction = Math.min(approxFirstYearInterest, 200000)
  const monthlyTaxShieldSec24b = Math.round((annualSec24bDeduction * 0.30) / 12)

  const activeInterestRatePct = params.enableRateShock ? shockRate : baseRate
  const effectiveEmi = params.enableRateShock ? shockMonthlyEmi : standardMonthlyEmi
  const netMonthlyOutflow = Math.max(0, effectiveEmi - monthlyTaxShieldSec24b)
  const safeMonthlyTakeHome = Math.round(effectiveEmi / 0.40)

  return {
    downPaymentAmount,
    loanPrincipal,
    activeInterestRatePct,
    standardMonthlyEmi,
    shockMonthlyEmi,
    monthlyRateShockDelta,
    monthlyTaxShieldSec24b,
    netMonthlyOutflow,
    safeMonthlyTakeHome,
  }
}


