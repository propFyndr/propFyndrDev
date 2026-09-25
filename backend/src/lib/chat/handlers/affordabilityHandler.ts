import type { ChatTopicHandler } from '../handlerContext'
import { prisma } from '../../db'

const CRORE = 10_000_000
const LAKH = 100_000

export interface AffordabilityCalculation {
  basePrice: number
  landedMultiplier: number
  totalLandedCost: number
  downpaymentAmount: number
  loanPrincipal: number
  tenureYears: number
  baseInterestRatePct: number
  standardEmi: number
  shockInterestRatePct: number
  shockEmi: number
  rateShockBufferMonthly: number
  monthlyTaxShieldSec24b: number
  netMonthlyOutflow: number
  safeMonthlyTakeHome: number
  safeAnnualHouseholdIncome: number
  userMonthlyIncome?: number
  userFoirPct?: number
  foirStatus?: 'comfortable' | 'manageable' | 'stressed'
}

/**
 * Calculates standard reducing-balance EMI.
 */
export function calculateEmi(principal: number, annualRatePct: number, tenureYears: number = 20): number {
  if (principal <= 0 || annualRatePct <= 0 || tenureYears <= 0) return 0
  const monthlyRate = annualRatePct / (12 * 100)
  const totalMonths = tenureYears * 12
  const factor = Math.pow(1 + monthlyRate, totalMonths)
  return Math.round((principal * monthlyRate * factor) / (factor - 1))
}

/**
 * Computes complete institutional cash-flow advisory breakdown with Indian tax shields and rate shock test.
 */
export function calculateAffordabilityBreakdown(opts: {
  basePrice: number
  multiplier?: number
  downpaymentPct?: number
  baseRatePct?: number
  shockHikeBps?: number
  tenureYears?: number
  userMonthlyIncome?: number
}): AffordabilityCalculation {
  const basePrice = opts.basePrice
  const landedMultiplier = opts.multiplier ?? 1.30
  const totalLandedCost = Math.round(basePrice * landedMultiplier)
  const downpaymentPct = opts.downpaymentPct ?? 0.20
  const downpaymentAmount = Math.round(totalLandedCost * downpaymentPct)
  const loanPrincipal = totalLandedCost - downpaymentAmount

  const tenureYears = opts.tenureYears ?? 20
  const baseInterestRatePct = opts.baseRatePct ?? 8.5
  const shockInterestRatePct = baseInterestRatePct + ((opts.shockHikeBps ?? 150) / 100)

  const standardEmi = calculateEmi(loanPrincipal, baseInterestRatePct, tenureYears)
  const shockEmi = calculateEmi(loanPrincipal, shockInterestRatePct, tenureYears)
  const rateShockBufferMonthly = shockEmi - standardEmi

  // Section 24(b) Indian Tax Shield: Up to ₹2,00,000/yr interest deduction.
  // Standard 30% tax slab (+4% cess) yields ~₹62,400/yr = ₹5,200/month net cash savings.
  const monthlyTaxShieldSec24b = Math.min(Math.round((200_000 * 0.312) / 12), Math.round(standardEmi * 0.5))
  const netMonthlyOutflow = Math.max(0, standardEmi - monthlyTaxShieldSec24b)

  // Safe FOIR: 40% standard
  const safeMonthlyTakeHome = Math.round(standardEmi / 0.40)
  const safeAnnualHouseholdIncome = safeMonthlyTakeHome * 12

  let userMonthlyIncome = opts.userMonthlyIncome
  let userFoirPct: number | undefined
  let foirStatus: 'comfortable' | 'manageable' | 'stressed' | undefined

  if (userMonthlyIncome && userMonthlyIncome > 0) {
    userFoirPct = Math.round((standardEmi / userMonthlyIncome) * 100)
    if (userFoirPct <= 35) {
      foirStatus = 'comfortable'
    } else if (userFoirPct <= 45) {
      foirStatus = 'manageable'
    } else {
      foirStatus = 'stressed'
    }
  }

  return {
    basePrice,
    landedMultiplier,
    totalLandedCost,
    downpaymentAmount,
    loanPrincipal,
    tenureYears,
    baseInterestRatePct,
    standardEmi,
    shockInterestRatePct,
    shockEmi,
    rateShockBufferMonthly,
    monthlyTaxShieldSec24b,
    netMonthlyOutflow,
    safeMonthlyTakeHome,
    safeAnnualHouseholdIncome,
    userMonthlyIncome,
    userFoirPct,
    foirStatus,
  }
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const inrCr = (n: number) => `₹${(n / CRORE).toFixed(2)} Cr`
const inrLakh = (n: number) => `₹${(n / LAKH).toFixed(2)} Lakhs`

export const affordabilityHandler: ChatTopicHandler = {
  id: 'affordability_advisor',
  description: 'Forensic cash flow, rate-shock stress test, and income tax shield advisory',

  matches: ctx => {
    const q = ctx.message.toLowerCase()
    const triggers = [
      'afford', 'affordability', 'monthly payment', 'emi for', 'salary needed',
      'salary required', 'cash flow', 'down payment', 'downpayment', 'tax benefit',
      'tax saving', 'rate shock', 'stress test', 'can i buy'
    ]
    if (triggers.some(t => q.includes(t))) return true
    if (/\b(?:earn|income|salary)\s*(?:of|is)?\s*(?:rs\.?|inr|₹)?\s*\d+/i.test(q)) return true
    return ctx.flags.isAffordabilityQuery === true
  },

  handle: async ctx => {
    // 1. Identify target project if any
    const named = (Array.isArray(ctx.intent.projectNames) && ctx.intent.projectNames[0])
      || ctx.activeProjectName
      || (ctx.cachedProjects && ctx.cachedProjects.length > 0 ? ctx.catalog.find(p => p.id === ctx.cachedProjects[0].id)?.name : null)
      || null

    const project = named
      ? await prisma.project.findFirst({
          where: {
            OR: [
              { name: { contains: String(named), mode: 'insensitive' } },
              { slug: { contains: String(named), mode: 'insensitive' } },
            ],
          },
          include: { unit_types: { orderBy: { price_min_cr: 'asc' } } },
        })
      : null

    // 2. Parse price or use project min price
    let basePrice = 1.5 * CRORE // 1.5 Cr default benchmark
    let isProjectSpecific = false

    if (project?.price_min_cr && project.price_min_cr > 0) {
      basePrice = project.price_min_cr * CRORE
      isProjectSpecific = true
    } else {
      // Check if message states a price (e.g., "for 2 cr", "budget 2.5 crore")
      const crMatch = ctx.message.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore)/i)
      if (crMatch) {
        basePrice = parseFloat(crMatch[1]) * CRORE
      } else {
        const lMatch = ctx.message.match(/(\d+(?:\.\d+)?)\s*(?:l|lakh)/i)
        if (lMatch && parseFloat(lMatch[1]) > 30) {
          basePrice = parseFloat(lMatch[1]) * LAKH
        }
      }
    }

    // 3. Parse user income if stated
    let userMonthlyIncome: number | undefined
    const incomeMonthMatch = ctx.message.match(/(?:earn|income|salary)\s*(?:of|is)?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:l|lakh)?\s*(?:pm|per month|\/mo)/i)
    if (incomeMonthMatch) {
      const val = parseFloat(incomeMonthMatch[1])
      userMonthlyIncome = val < 50 ? val * LAKH : val
    } else {
      const incomeYearMatch = ctx.message.match(/(?:earn|income|salary)\s*(?:of|is)?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:l|lakh|cr)?\s*(?:pa|lpa|per annum|\/yr)?/i)
      if (incomeYearMatch) {
        const raw = parseFloat(incomeYearMatch[1])
        if (raw < 10) {
          // e.g. 1.2 Cr pa
          userMonthlyIncome = Math.round((raw * CRORE) / 12)
        } else if (raw <= 150) {
          // e.g. 35 LPA
          userMonthlyIncome = Math.round((raw * LAKH) / 12)
        }
      }
    }

    const multiplier = project?.all_in_cost_multiplier ?? 1.30
    const calc = calculateAffordabilityBreakdown({
      basePrice,
      multiplier,
      userMonthlyIncome,
    })

    const title = project
      ? `Financial Reality & Cash-Flow Stress Test — ${project.name}`
      : `Home Financing Cash-Flow & Rate Shock Analysis (${inrCr(basePrice)} Benchmark)`

    const foirComment = calc.userFoirPct !== undefined
      ? `\n### Household Affordability Verdict
- **Your Monthly Income:** ${inr(calc.userMonthlyIncome!)}
- **Debt-to-Income (FOIR):** **${calc.userFoirPct}%** of your monthly income goes toward this loan.
${calc.foirStatus === 'comfortable'
  ? '✅ **Healthy Ratio:** Within safe retail banking limits (≤35%). Strong mortgage approval odds.'
  : calc.foirStatus === 'manageable'
    ? '⚠️ **Moderate Stress:** Between 36%–45% FOIR. Manageable if you have minimal existing personal or car loan EMIs.'
    : '🛑 **Over-Leveraged Alert:** Exceeds the recommended 40% FOIR ceiling. Consider increasing down payment or targeting a lower ticket size.'}\n`
      : ''

    const responseText = `### ${title}

| Financial Dimension | Benchmark / Breakdown | Impact on Monthly Outflow |
| :--- | :--- | :--- |
| **Headline Base Price** | ${inrCr(calc.basePrice)} | Developer quoted base |
| **True Landed Cost** | **${inrCr(calc.totalLandedCost)}** (+${Math.round((calc.landedMultiplier - 1) * 100)}%) | Stamp duty, GST, IFMS & club charges |
| **Recommended Downpayment (20%)** | ${inrCr(calc.downpaymentAmount)} | Upfront equity needed |
| **Home Loan Principal (80%)** | ${inrCr(calc.loanPrincipal)} | 20-year tenure at ${calc.baseInterestRatePct}% p.a. |
| **Standard Bank EMI** | **${inr(calc.standardEmi)} / month** | Contractual bank debit |
| **Sec 24(b) Tax Shield** | **- ${inr(calc.monthlyTaxShieldSec24b)} / month** | ₹2L/yr interest deduction (30% bracket) |
| **Net Out-of-Pocket Outflow** | **${inr(calc.netMonthlyOutflow)} / month** | Real cost to household budget |
| **+1.5% RBI Rate Shock (10.0%)** | **${inr(calc.shockEmi)} / month** | **+${inr(calc.rateShockBufferMonthly)} / month buffer needed** |
| **Min. Safe Monthly Income (40% FOIR)** | **${inr(calc.safeMonthlyTakeHome)} / month** | Recommended take-home (~${inrLakh(calc.safeAnnualHouseholdIncome)} gross/yr) |
${foirComment}
> **Advisor Strategy Note:** Banks typically calculate eligibility purely on standard EMI (${inr(calc.standardEmi)}/mo), but smart buyers budget for the **Rate Shock EMI (${inr(calc.shockEmi)}/mo)** to survive RBI repo rate hiking cycles without liquidity distress.`

    ctx.send('token', { token: responseText })
    ctx.emitUiState({
      stage: 'FINANCE',
      thinking: `Affordability analysis for ${project ? project.name : inrCr(basePrice)}:`,
      chips: [
        {
          id: `chip_dossier_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Generate Family Deal Dossier',
          icon: 'share-2',
          analyticsId: 'chip_gen_dossier',
          priority: 1,
          payload: { text: project ? `Generate family deal dossier for ${project.name}` : 'Generate family deal dossier' },
        },
        {
          id: `chip_tax_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Section 24(b) & 80C Limits',
          icon: 'shield',
          analyticsId: 'chip_tax_limits',
          priority: 2,
          payload: { text: 'How do Section 24b and 80C tax deductions work on home loans?' },
        },
        {
          id: `chip_down_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: '30% Downpayment Impact',
          icon: 'calculator',
          analyticsId: 'chip_dp_impact',
          priority: 3,
          payload: { text: `What is the EMI if I pay 30% downpayment on ${project ? project.name : 'this project'}?` },
        },
      ],
      affordabilityData: calc,
      confidence: isProjectSpecific ? 'HIGH' : 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'FINANCED', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
