import { getSyncStampDutyRate, getSyncGstRate } from './tax/taxEngine'

/**
 * carpet ÷ super × 100, or null when either area is unrecorded or super is 0.
 *
 * For a write path storing UnitType.carpet_to_super_ratio_pct — tolerates
 * missing inputs (unlike calcLoadingRatio, built for a buyer-facing chat
 * answer where both areas are already known to be present).
 */
export function computeCarpetToSuperRatio(
  carpetAreaSqft: number | null | undefined,
  superAreaSqft: number | null | undefined,
): number | null {
  if (carpetAreaSqft == null || superAreaSqft == null || superAreaSqft === 0) return null
  return Math.round((carpetAreaSqft / superAreaSqft) * 10000) / 100
}

export function formatInr(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`
  return `₹${amount.toLocaleString('en-IN')}`
}

export function calcEmi(
  principalCr: number,
  annualRatePct: number,
  tenureYears: number
): { emi: number; totalPayment: number; totalInterest: number } {
  const P = principalCr * 1_00_00_000
  const r = annualRatePct / 1200
  const n = tenureYears * 12
  if (r === 0) return { emi: P / n, totalPayment: P, totalInterest: 0 }
  const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  const totalPayment = emi * n
  return { emi, totalPayment, totalInterest: totalPayment - P }
}

export function calcStampDuty(
  priceCr: number,
  gender: 'male' | 'female' | 'joint' = 'male',
  stateCode: string = 'UP'
): { stampDuty: number; registration: number; total: number; rate: number } {
  const price = priceCr * 1_00_00_000
  const rate = getSyncStampDutyRate(gender, stateCode)
  const stampDuty = (price * rate) / 100
  const registration = price * 0.01
  return { stampDuty, registration, total: stampDuty + registration, rate }
}

export function calcGst(
  priceCr: number,
  status: 'under_construction' | 'ready_to_move',
  carpetSqm = 0,
  stateCode: string = 'UP'
): { gst: number; rate: number; category: string } {
  if (status === 'ready_to_move') return { gst: 0, rate: 0, category: 'OC received — no GST' }
  const price = priceCr * 1_00_00_000
  const isAffordable = priceCr < 0.45 && carpetSqm > 0 && carpetSqm <= 60
  const rate = getSyncGstRate(status, isAffordable, stateCode)
  return { gst: (price * rate) / 100, rate, category: isAffordable ? 'affordable_housing' : 'standard' }
}

export function sqmToSqft(sqm: number): number {
  return Math.round(sqm * 10.7639)
}

export function calcRentalYield(
  monthlyRent: number,
  propertyCostCr: number,
  options?: { vacancyMonths?: number; monthlyMaintenance?: number }
): {
  grossYieldPct: number
  netYieldPct: number
  annualGrossRent: number
  annualNetRent: number
  effectiveOccupancyMonths: number
} {
  const propertyCost = propertyCostCr * 1_00_00_000
  const vacancyMonths = options?.vacancyMonths ?? 0
  const monthlyMaintenance = options?.monthlyMaintenance ?? 0
  const effectiveOccupancyMonths = Math.max(0, 12 - vacancyMonths)

  const annualGrossRent = monthlyRent * effectiveOccupancyMonths
  const grossYieldPct = propertyCost > 0 ? (annualGrossRent / propertyCost) * 100 : 0

  const netMonthly = Math.max(0, monthlyRent - monthlyMaintenance)
  const annualNetRent = netMonthly * effectiveOccupancyMonths
  const netYieldPct = propertyCost > 0 ? (annualNetRent / propertyCost) * 100 : 0

  return {
    grossYieldPct: parseFloat(grossYieldPct.toFixed(2)),
    netYieldPct: parseFloat(netYieldPct.toFixed(2)),
    annualGrossRent,
    annualNetRent,
    effectiveOccupancyMonths,
  }
}

// ─── ALL-IN TRUE LANDED COST ─────────────────────────────────────────────────

export interface AllInCostResult {
  basePriceCr: number
  gst: number
  stampDuty: number
  registration: number
  ifms: number
  plc: number
  carParking: number
  electricMeter: number
  totalCr: number
  overheadPct: number
}

export function calcAllInCost(
  basePriceCr: number,
  status: 'ready_to_move' | 'under_construction',
  gender: 'male' | 'female' | 'joint' = 'male',
  carpetSqft = 0,
  extras?: { plcPct?: number; carParkingLakhs?: number },
): AllInCostResult {
  const base = basePriceCr * 1_00_00_000
  const gstResult = calcGst(basePriceCr, status, carpetSqft / 10.7639)
  const stampResult = calcStampDuty(basePriceCr, gender)
  const ifms = carpetSqft > 0 ? carpetSqft * 50 : 0
  const plcPct = extras?.plcPct ?? 3
  const plc = (base * plcPct) / 100
  const carParking = (extras?.carParkingLakhs ?? 5) * 1_00_000
  const electricMeter = 50_000
  const totalRs =
    base +
    gstResult.gst +
    stampResult.stampDuty +
    stampResult.registration +
    ifms +
    plc +
    carParking +
    electricMeter
  const totalCr = totalRs / 1_00_00_000
  return {
    basePriceCr,
    gst: gstResult.gst,
    stampDuty: stampResult.stampDuty,
    registration: stampResult.registration,
    ifms,
    plc,
    carParking,
    electricMeter,
    totalCr: parseFloat(totalCr.toFixed(4)),
    overheadPct: parseFloat((((totalCr - basePriceCr) / basePriceCr) * 100).toFixed(2)),
  }
}

// ─── TRUE NET RENTAL YIELD (all-in cost basis) ───────────────────────────────

export function calcTrueNetRentalYield(
  monthlyRent: number,
  allInCostCr: number,
  vacancyMonths = 0,
  maintenanceMonthly = 0,
): {
  grossYieldPct: number
  netYieldPct: number
  annualGrossRent: number
  annualNetRent: number
  effectiveMonths: number
} {
  const allInCost = allInCostCr * 1_00_00_000
  const effectiveMonths = Math.max(0, 12 - vacancyMonths)
  const annualGrossRent = monthlyRent * 12
  const annualNetRent = Math.max(0, monthlyRent - maintenanceMonthly) * effectiveMonths
  return {
    grossYieldPct: allInCost > 0 ? parseFloat(((annualGrossRent / allInCost) * 100).toFixed(2)) : 0,
    netYieldPct: allInCost > 0 ? parseFloat(((annualNetRent / allInCost) * 100).toFixed(2)) : 0,
    annualGrossRent,
    annualNetRent,
    effectiveMonths,
  }
}

// ─── TWO-PROPERTY UPGRADE EQUITY ─────────────────────────────────────────────

export function calcUpgradeEquity(
  existingValueCr: number,
  remainingLoanCr: number,
  newPriceCr: number,
  downPaymentPct: number,
  interestRatePct: number,
  tenureYears: number,
): {
  netRealizedCashCr: number
  transactionCostsCr: number
  newLoanCr: number
  newMonthlyEmi: number
  cashFlowGapMonthly: number
  downPaymentCr: number
} {
  const transactionCosts = existingValueCr * 0.02
  const netRealizedCashCr = parseFloat((existingValueCr - remainingLoanCr - transactionCosts).toFixed(4))
  const downPaymentCr = parseFloat(((newPriceCr * downPaymentPct) / 100).toFixed(4))
  const newLoanCr = parseFloat((newPriceCr - downPaymentCr).toFixed(4))
  const emiResult = calcEmi(newLoanCr, interestRatePct, tenureYears)
  return {
    netRealizedCashCr,
    transactionCostsCr: parseFloat(transactionCosts.toFixed(4)),
    newLoanCr,
    newMonthlyEmi: Math.round(emiResult.emi),
    cashFlowGapMonthly: parseFloat((netRealizedCashCr - downPaymentCr).toFixed(4)),
    downPaymentCr,
  }
}

// ─── CARPET LOADING & USABLE AREA RATIO ──────────────────────────────────────

export function calcLoadingRatio(
  superBuiltUpSqft: number,
  carpetSqft: number,
): {
  loadingPct: number
  carpetEfficiencyPct: number
  superBuiltUpSqft: number
  carpetSqft: number
  verdict: 'efficient' | 'average' | 'high_loading'
} {
  if (superBuiltUpSqft <= 0 || carpetSqft <= 0 || carpetSqft > superBuiltUpSqft) {
    return { loadingPct: 0, carpetEfficiencyPct: 0, superBuiltUpSqft, carpetSqft, verdict: 'average' }
  }
  const loadingPct = parseFloat((((superBuiltUpSqft - carpetSqft) / superBuiltUpSqft) * 100).toFixed(2))
  const carpetEfficiencyPct = parseFloat((100 - loadingPct).toFixed(2))
  return {
    loadingPct,
    carpetEfficiencyPct,
    superBuiltUpSqft,
    carpetSqft,
    verdict: carpetEfficiencyPct >= 75 ? 'efficient' : carpetEfficiencyPct >= 65 ? 'average' : 'high_loading',
  }
}

