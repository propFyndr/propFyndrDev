// backend/src/lib/ai/tools/financialCalculators.ts

export interface CircleRateDutyResult {
  propertyPriceCr: number
  agreementValueInr: number
  calculatedCircleValueInr: number
  taxableBaseInr: number
  baseCircleRateSqm: number
  amenitySurchargePct: number
  floorReliefDiscountPct: number
  effectiveCircleRateSqm: number
  stampDutyPct: number
  stampDutyAmountInr: number
  registrationFeeInr: number
  totalStatutoryTaxInr: number
  explanation: string
}

export function calculateCircleRateDuty(params: {
  propertyPriceCr: number
  carpetAreaSqft?: number
  sector?: string
  floorNumber?: number
  luxuryAmenitiesCount?: number
  isMale?: boolean
}): CircleRateDutyResult {
  const propertyPriceCr = params.propertyPriceCr
  const agreementValueInr = propertyPriceCr * 1_00_00_000
  const carpetAreaSqft = params.carpetAreaSqft || 1200
  const areaSqm = carpetAreaSqft * 0.092903

  // Base circle rate standard for prime Noida 7X/Expressway (~₹55,000/sqm)
  const baseCircleRateSqm = 55000

  // 3% surcharge per luxury amenity (pool, clubhouse, gym), capped at 15%
  const amenityCount = Math.min(params.luxuryAmenitiesCount ?? 3, 5)
  const amenitySurchargePct = Math.min(amenityCount * 3, 15)

  // 2% floor relief discount per floor above 4th, capped at 20%
  const floorNum = params.floorNumber ?? 5
  const floorReliefDiscountPct = floorNum > 4 ? Math.min((floorNum - 4) * 2, 20) : 0

  const netMultiplier = 1 + (amenitySurchargePct - floorReliefDiscountPct) / 100
  const effectiveCircleRateSqm = Math.round(baseCircleRateSqm * netMultiplier)
  const calculatedCircleValueInr = Math.round(effectiveCircleRateSqm * areaSqm)

  // Statutory tax is calculated on HIGHER of agreement value or circle value
  const taxableBaseInr = Math.max(agreementValueInr, calculatedCircleValueInr)

  // 7% male / 6% female in Uttar Pradesh
  const stampDutyPct = params.isMale !== false ? 7 : 6
  const stampDutyAmountInr = Math.round(taxableBaseInr * (stampDutyPct / 100))
  const registrationFeeInr = Math.round(taxableBaseInr * 0.01) // flat 1%, no cap (see UP_STATUTORY)
  const totalStatutoryTaxInr = stampDutyAmountInr + registrationFeeInr

  const explanation = `Stamp duty (${stampDutyPct}%) and registration fees (1%) are computed on the taxable base of ₹${(taxableBaseInr / 1_00_000).toFixed(2)} Lakhs (Circle Rate: ₹${effectiveCircleRateSqm.toLocaleString('en-IN')}/sqm with +${amenitySurchargePct}% amenity loading and -${floorReliefDiscountPct}% floor relief discount). Total statutory outgo: ₹${(totalStatutoryTaxInr / 1_00_000).toFixed(2)} Lakhs.`

  return {
    propertyPriceCr,
    agreementValueInr,
    calculatedCircleValueInr,
    taxableBaseInr,
    baseCircleRateSqm,
    amenitySurchargePct,
    floorReliefDiscountPct,
    effectiveCircleRateSqm,
    stampDutyPct,
    stampDutyAmountInr,
    registrationFeeInr,
    totalStatutoryTaxInr,
    explanation,
  }
}

export interface YieldRoiResult {
  capitalAmountCr: number
  horizonYears: number
  residential: {
    grossYieldPct: number
    annualRentInr: number
    totalRentalIncomeInr: number
    projectedAppreciationCr: number
    totalEstimatedWealthCr: number
  }
  commercial: {
    grossYieldPct: number
    annualRentInr: number
    totalRentalIncomeInr: number
    projectedAppreciationCr: number
    totalEstimatedWealthCr: number
  }
  netYieldDeltaInrMonthly: number
  recommendationThesis: string
}

export function compareYieldRoi(params: {
  capitalAmountCr: number
  horizonYears?: number
  residentialYieldPct?: number
  commercialYieldPct?: number
}): YieldRoiResult {
  const capitalAmountCr = params.capitalAmountCr
  const horizonYears = params.horizonYears || 5
  const capitalInr = capitalAmountCr * 1_00_00_000

  const resYield = params.residentialYieldPct || 3.0
  const commYield = params.commercialYieldPct || 7.0

  const resAnnualRent = Math.round(capitalInr * (resYield / 100))
  const commAnnualRent = Math.round(capitalInr * (commYield / 100))

  const resTotalRent = resAnnualRent * horizonYears
  const commTotalRent = commAnnualRent * horizonYears

  // Assume residential CAGR ~12% (established), commercial CAGR ~18% (due to Jewar Airport / corporate absorption)
  const resAppreciation = capitalAmountCr * Math.pow(1.12, horizonYears)
  const commAppreciation = capitalAmountCr * Math.pow(1.18, horizonYears)

  const resTotalWealth = resAppreciation + (resTotalRent / 1_00_00_000)
  const commTotalWealth = commAppreciation + (commTotalRent / 1_00_00_000)

  const monthlyDelta = Math.round((commAnnualRent - resAnnualRent) / 12)

  const recommendationThesis = `Over a ${horizonYears}-year horizon on ₹${capitalAmountCr} Cr: Commercial retail delivers ₹${(monthlyDelta / 1_000).toFixed(0)}k extra monthly cashflow (7.0% vs 3.0% yield) and projected total wealth of ₹${commTotalWealth.toFixed(2)} Cr vs ₹${resTotalWealth.toFixed(2)} Cr in residential.`

  return {
    capitalAmountCr,
    horizonYears,
    residential: {
      grossYieldPct: resYield,
      annualRentInr: resAnnualRent,
      totalRentalIncomeInr: resTotalRent,
      projectedAppreciationCr: Number(resAppreciation.toFixed(2)),
      totalEstimatedWealthCr: Number(resTotalWealth.toFixed(2)),
    },
    commercial: {
      grossYieldPct: commYield,
      annualRentInr: commAnnualRent,
      totalRentalIncomeInr: commTotalRent,
      projectedAppreciationCr: Number(commAppreciation.toFixed(2)),
      totalEstimatedWealthCr: Number(commTotalWealth.toFixed(2)),
    },
    netYieldDeltaInrMonthly: monthlyDelta,
    recommendationThesis,
  }
}
