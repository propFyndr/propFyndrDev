import type { ChatTopicHandler } from '../handlerContext'
import { MARKET_QUALIFIER } from '../../factPresentation'

export interface InvestmentMetrics {
  purchasePrice: number // in crores
  landedCost: number // price + all statutory
  annualRentalYield: number // %
  monthlyRentEstimate: number // ₹
  capitalAppreciationYearlyPct: number // %
  projectedValueIn5Years: number // crores
  projectedValueIn10Years: number // crores
  taxShieldAnnual: number // ₹ from Section 24
  netROI5Years: number // % after tax
  buyVsRentBreakeven: number // months
  builderTrackRecordRiskFlag: boolean
}

/**
 * Phase 6: Investment Advisory
 * Noida market baseline (market tier, shown with MARKET_QUALIFIER)
 */
const MARKET_BASELINES = {
  annualRentalYield: 2.8, // 2.8% annual rent
  capitalAppreciation: 7.5, // 7.5% yearly
  taxShieldRate: 0.312, // 31.2% (30% slab + 4% cess)
}

export function calculateInvestmentMetrics(opts: {
  purchasePriceCr: number
  landedCostCr: number
  expectedRentalYield?: number // % override
  expectedAppreciation?: number // % override
  builderHasDelays?: boolean
}): InvestmentMetrics {
  const purchase = opts.purchasePriceCr * 10_000_000
  const landed = opts.landedCostCr * 10_000_000

  const rentalYield = opts.expectedRentalYield ?? MARKET_BASELINES.annualRentalYield
  const appreciation = opts.expectedAppreciation ?? MARKET_BASELINES.capitalAppreciation

  const monthlyRent = Math.round((purchase * rentalYield) / 100 / 12)
  const annualRent = monthlyRent * 12

  // Section 24 Interest Deduction: up to ₹2,00,000/yr
  const taxShield = Math.min(Math.round(200_000 * MARKET_BASELINES.taxShieldRate), Math.round(annualRent * 0.5))

  // 5-year projection
  const futureValue5y = landed * Math.pow(1 + appreciation / 100, 5)
  const futureValue10y = landed * Math.pow(1 + appreciation / 100, 10)
  const totalRent5y = annualRent * 5
  const netGain5y = futureValue5y - landed + totalRent5y - (taxShield * 5)
  const roi5y = ((netGain5y / landed) / 5) * 100

  // Breakeven: when cumulative rent > down payment
  const downPayment = landed * 0.20
  const breakeven = downPayment > 0 ? Math.ceil((downPayment * 12) / monthlyRent) : 0

  return {
    purchasePrice: opts.purchasePriceCr,
    landedCost: opts.landedCostCr,
    annualRentalYield: rentalYield,
    monthlyRentEstimate: monthlyRent,
    capitalAppreciationYearlyPct: appreciation,
    projectedValueIn5Years: futureValue5y / 10_000_000,
    projectedValueIn10Years: futureValue10y / 10_000_000,
    taxShieldAnnual: taxShield,
    netROI5Years: roi5y,
    buyVsRentBreakeven: breakeven,
    builderTrackRecordRiskFlag: opts.builderHasDelays ?? false,
  }
}

export const investmentAdvisoryHandler: ChatTopicHandler = {
  name: 'investmentAdvisory',
  when: (ctx) => {
    const q = ctx.message.toLowerCase()
    return (
      (q.includes('invest') || q.includes('roi') || q.includes('return')) &&
      (q.includes('rental') || q.includes('yield') || q.includes('appreciation') || q.includes('tax'))
    )
  },
  async handle(ctx) {
    const { intent, message } = ctx
    const focus = intent.focus_project_id ? await ctx.prisma.project.findUnique({
      where: { id: intent.focus_project_id },
      select: {
        name: true,
        price_min_cr: true,
        builder_id: true,
        builder: { select: { name: true, lift_act_compliant: true } },
      },
    }) : null

    if (!focus || !focus.price_min_cr) {
      ctx.send('answer', {
        token: `To run investment analysis I need a property price. Tell me a project name or price range (e.g. "1.5 cr 2 bhk").`,
      })
      ctx.res.end()
      return
    }

    const metrics = calculateInvestmentMetrics({
      purchasePriceCr: focus.price_min_cr,
      landedCostCr: focus.price_min_cr * 1.3, // market default landed cost
      builderHasDelays: !(focus.builder?.lift_act_compliant ?? true),
    })

    const answerText = `
**Investment Case: ${focus.name}**

| Metric | Value | Assumption |
|--------|-------|-----------|
| **Purchase Price** | ₹${metrics.purchasePrice.toFixed(2)} Cr | Base price |
| **Landed Cost** (all-in) | ₹${metrics.landedCost.toFixed(2)} Cr | +30% statutory |
| **Monthly Rent (Est.)** | ₹${metrics.monthlyRentEstimate.toLocaleString('en-IN')} | ${metrics.annualRentalYield}% yield ${MARKET_QUALIFIER} |
| **Annual Tax Shield** | ₹${metrics.taxShieldAnnual.toLocaleString('en-IN')} | Section 24(b) deduction |
| **5-Year Projection** | ₹${metrics.projectedValueIn5Years.toFixed(2)} Cr | +${metrics.capitalAppreciationYearlyPct}% yearly ${MARKET_QUALIFIER} |
| **Net ROI (5 years)** | ${metrics.netROI5Years.toFixed(1)}% | After rent, tax, appreciation |
| **Buy vs Rent Breakeven** | ${metrics.buyVsRentBreakeven} months | Cumulative rent = down payment |
${
  metrics.builderTrackRecordRiskFlag
    ? '\n⚠️ **Risk Flag**: Builder has history of delays — possession may impact returns.'
    : ''
}

**Disclaimer**: Projections use Noida market benchmarks (not verified for this project). Actual yield depends on tenant quality, maintenance, regulations. Consult a CA for tax planning.
`

    ctx.send('answer', { token: answerText })
    ctx.res.end()
  },
}
