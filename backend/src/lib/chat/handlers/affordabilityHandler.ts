import { MARKET_QUALIFIER, UP_STATUTORY } from '../../factPresentation'
import { FINANCIAL } from '../../config'
import type { ChatTopicHandler } from '../handlerContext'
import { prisma } from '../../db'
import { projectPriceNotes } from '../../projectPriceNote'
import { UNDATED_NOTE } from '../../priceVerification'
import { statedMonthlyIncome, computeAffordability, renderAffordabilityTable, asksBudgetPlan, extraDownPayment, parseFinancingStatement, loanForEmi, FOIR_CONSERVATIVE, type FinancingStatement } from '../../ai/affordability'

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
  // Banks lend up to 80% of the agreement value, never on stamp duty, GST or
  // club charges: those are paid in cash on top. The loan used to be 80% of the
  // landed cost, so a ₹1.20 Cr flat got a ₹1.25 Cr loan (live session, 17 Oct 2026).
  const downpaymentPct = opts.downpaymentPct ?? 0.20
  const downpaymentAmount = Math.round(basePrice * downpaymentPct)
  const loanPrincipal = basePrice - downpaymentAmount

  const tenureYears = opts.tenureYears ?? FINANCIAL.LOAN_TENURE_YEARS
  const baseInterestRatePct = opts.baseRatePct ?? FINANCIAL.EMI_RATE
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

/**
 * Monthly income in rupees from a buyer's message, or undefined.
 *
 * Accepts the number before or after the income word ("2.5L salary",
 * "salary of 2.5 lakh", "35 LPA", "earn 1.2 cr a year", "take home 180k").
 * The old matcher required the income word first, so the roadmap's own
 * example ("afford this on 2.5L salary") computed no FOIR at all, and it read
 * "salary 2.5 lakh" as 2.5 crore a year.
 *
 * With no period stated, a figure of ₹10 lakh or more is read as annual and
 * anything smaller as monthly — how Indian buyers quote the two.
 */
function matchIncome(message: string): RegExpExecArray | null {
  // "1,50,000" (Indian grouping) as well as "150000" and "1.5".
  const NUM = String.raw`(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(k|l|lakhs?|lacs?|lpa|cr|crores?)?`
  const PERIOD = String.raw`(pm|p\.m\.|per\s+month|a\s+month|monthly|\/\s*mo(?:nth)?|pa|p\.a\.|per\s+annum|a\s+year|per\s+year|annual(?:ly)?|yearly|\/\s*yr)?`
  const WORD = String.raw`(?:salary|income|make|earn(?:ing)?s?|take[-\s]?home|in[-\s]?hand|ctc|package)`
  const after = new RegExp(String.raw`\b${NUM}\s*${PERIOD}\s*(?:of\s+)?${WORD}`, 'i').exec(message)
  return after ?? new RegExp(String.raw`${WORD}(?:\s*(?:of|is|:))*\s*(?:rs\.?|inr|₹)?\s*${NUM}\s*${PERIOD}`, 'i').exec(message)
}

/**
 * Property price in rupees the buyer stated in the message, or undefined.
 * The income phrase is removed first, so "2.5L salary" or "35 LPA" is never
 * read as a price.
 */
export function parseStatedPrice(message: string): number | undefined {
  const income = matchIncome(message)
  const text = income ? message.replace(income[0], ' ') : message
  const cr = /(\d+(?:\.\d+)?)\s*(?:cr|crores?)\b/i.exec(text)
  if (cr) return parseFloat(cr[1]) * CRORE
  const l = /(\d+(?:\.\d+)?)\s*(?:l|lakhs?|lacs?)\b/i.exec(text)
  if (l && parseFloat(l[1]) > 30) return parseFloat(l[1]) * LAKH
  return undefined
}

export function parseMonthlyIncome(message: string): number | undefined {
  const m = matchIncome(message)
  if (!m) return undefined
  const value = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(value) || value <= 0) return undefined
  const unit = (m[2] || '').toLowerCase()
  const period = (m[3] || '').toLowerCase()
  const rupees =
    unit === 'k' ? value * 1000 :
    unit.startsWith('cr') ? value * CRORE :
    unit ? value * LAKH :
    value
  const annual = unit === 'lpa' || /pa|p\.a|annum|year|annual|yr/.test(period)
  const monthly = /pm|p\.m\.|month|mo/.test(period)
  if (annual) return Math.round(rupees / 12)
  if (monthly) return Math.round(rupees)
  return Math.round(rupees >= 10 * LAKH ? rupees / 12 : rupees)
}

export interface FinancingPlan {
  monthlyIncome: number
  downPayment: number
  /** True when the buyer gave the down payment; false when 20% of the price is assumed. */
  downPaymentStated: boolean
  loan: number
  /** 'stated' by the buyer, 'foir' from 40% of income, 'ltv' capped at 80% of the price. */
  loanBasis: 'stated' | 'foir' | 'ltv'
  price: number
  emi: number
  emiPctOfIncome: number
  rate: number
  tenureYears: number
  stampDuty: number
  registration: number
  gstIfUnderConstruction: number
}

/**
 * Income plus a down payment and/or a loan, worked into a price. With a loan
 * stated, price = down payment + loan; without one, the loan is what 40% of
 * income services at the assumed rate, capped at the 80% of the price banks
 * lend. Rate and, unless stated, tenure are assumptions and labelled so.
 */
export function computeFinancingPlan(f: FinancingStatement & { monthlyIncome: number }): FinancingPlan | null {
  if (f.downPayment == null && f.loanAmount == null) return null
  const rate = FINANCIAL.EMI_RATE
  const tenureYears = f.tenureYears ?? FINANCIAL.LOAN_TENURE_YEARS
  let loan: number
  let loanBasis: FinancingPlan['loanBasis'] = 'stated'
  if (f.loanAmount != null) loan = f.loanAmount
  else {
    loan = Math.round(loanForEmi(f.monthlyIncome * FOIR_CONSERVATIVE, rate, tenureYears))
    loanBasis = 'foir'
    if (loan > f.downPayment! * 4) { loan = f.downPayment! * 4; loanBasis = 'ltv' }
  }
  const downPayment = f.downPayment ?? Math.round(loan / 4)
  const price = downPayment + loan
  const emi = calculateEmi(loan, rate, tenureYears)
  return {
    monthlyIncome: f.monthlyIncome,
    downPayment,
    downPaymentStated: f.downPayment != null,
    loan,
    loanBasis,
    price,
    emi,
    emiPctOfIncome: Math.round((emi / f.monthlyIncome) * 100),
    rate,
    tenureYears,
    stampDuty: Math.round(price * UP_STATUTORY.stampDutyPct / 100),
    registration: Math.round(price * UP_STATUTORY.registrationPct / 100),
    gstIfUnderConstruction: Math.round(price * UP_STATUTORY.gstUnderConstructionPct / 100),
  }
}

/** Every figure in it comes from `computeFinancingPlan`; nothing for the model to redo. */
export function renderFinancingPlan(p: FinancingPlan, tenureStated: boolean): string {
  const amt = (n: number) => n >= CRORE ? inrCr(n) : `₹${(n / LAKH).toFixed(2)} L`
  const loanLabel = p.loanBasis === 'stated' ? 'Home loan (your figure)'
    : p.loanBasis === 'ltv' ? 'Home loan (capped at 80% of the price, the most banks lend)'
    : `Home loan (largest EMI within ${Math.round(FOIR_CONSERVATIVE * 100)}% of income)`
  const verdict = p.emiPctOfIncome <= 40
    ? `An EMI at ${p.emiPctOfIncome}% of income sits inside the 40% banks approve without argument.`
    : p.emiPctOfIncome <= 50
      ? `An EMI at ${p.emiPctOfIncome}% of income is stretched: banks go to about 50% only with no other EMI and a stable income.`
      : `An EMI at ${p.emiPctOfIncome}% of income is above the roughly 50% banks lend against, so expect a smaller sanction or a longer tenure.`
  const ltvNote = p.loanBasis === 'stated' && p.downPaymentStated && p.loan > p.downPayment * 4
    ? '\n\nThe loan is more than 80% of the price; banks usually fund up to 80%, so the down payment may need to rise.'
    : ''
  return `### Your financing plan, worked out

| | |
| :--- | ---: |
| **Monthly income** | ${inr(p.monthlyIncome)} |
| **Down payment${p.downPaymentStated ? ' (your figure)' : ' (assumed 20% of price)'}** | ${amt(p.downPayment)} |
| **${loanLabel}** | ${amt(p.loan)} |
| **Price this reaches (down payment + loan)** | **${amt(p.price)}** |
| **EMI at ${p.rate}% over ${p.tenureYears} years** | ${inr(p.emi)} / month |
| **EMI as share of income** | ${p.emiPctOfIncome}% |
| **Cash on top: stamp duty ${UP_STATUTORY.stampDutyPct}% + registration ${UP_STATUTORY.registrationPct}%** | ${amt(p.stampDuty + p.registration)} |
| **Plus GST ${UP_STATUTORY.gstUnderConstructionPct}% if under construction** | ${amt(p.gstIfUnderConstruction)} |

${verdict}${ltvNote}

The ${p.rate}% rate is an assumption; your bank's sanction letter decides the real EMI.${tenureStated ? '' : ` The ${p.tenureYears}-year tenure is assumed too.`} Stamp duty is ${UP_STATUTORY.stampDutyFemalePct}% with a woman as primary owner. Stamp duty, registration and GST are paid in cash, not from the loan, so keep them beside the down payment.`
}

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
    if (asksBudgetPlan(ctx.message)) return true
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

    // 2. Price: the project's own row, else a figure the buyer stated (this
    // message, then the budget remembered in intent). No invented benchmark.
    const isProjectSpecific = !!(project?.price_min_cr && project.price_min_cr > 0)
    // Under ₹10 L is a salary misread as a budget, not a flat price.
    const intentBudgetCr = typeof ctx.intent.budgetMax === 'number' && ctx.intent.budgetMax >= 0.1 ? ctx.intent.budgetMax : undefined
    const basePrice = isProjectSpecific
      ? project!.price_min_cr! * CRORE
      : parseStatedPrice(ctx.message) ?? (intentBudgetCr != null ? intentBudgetCr * CRORE : undefined)

    // 3. Income: this message, else the latest earlier turn that stated one.
    const earlier = [...(ctx.priorUserMessages ?? [])].reverse().map(m => statedMonthlyIncome(m)).find(Boolean)
    const userMonthlyIncome = parseMonthlyIncome(ctx.message) ?? earlier ?? undefined

    // Income with a down payment and/or a loan: the price follows from those,
    // computed here. The model did this sum itself and every attempt failed the
    // integrity check (live, 17 Oct 2026).
    const fin = parseFinancingStatement(ctx.message)
    const plan = userMonthlyIncome ? computeFinancingPlan({ ...fin, monthlyIncome: userMonthlyIncome }) : null
    if (plan) {
      ctx.send('token', { token: `${renderFinancingPlan(plan, fin.tenureYears != null)}\n\nWant me to show projects up to ${inrCr(plan.price)}?` })
      ctx.emitUiState({
        stage: 'FINANCE',
        thinking: 'Your financing plan:',
        chips: [
          { id: `chip_fin_show_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Projects up to ${inrCr(plan.price)}`, icon: 'search', analyticsId: 'chip_afford_reco', priority: 1, payload: { text: `Show me projects under ${(plan.price / CRORE).toFixed(2)} cr` } },
        ],
        missingFields: [],
        confidence: 'MEDIUM',
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'FINANCED', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    // No price, but an income: what that income supports, computed here. The
    // model wrote this as prose and gave a ₹75 L loan a "₹6.6 L" EMI, then
    // "around ₹6 crore" under a table saying ₹1.02 Cr (stress runs, 16 Oct 2026).
    if (basePrice == null && userMonthlyIncome) {
      const a = computeAffordability(userMonthlyIncome)
      const cr = (n: number) => `₹${n.toFixed(2)} Cr`
      ctx.send('token', {
        token: `### What ${inr(userMonthlyIncome)} a month supports

${renderAffordabilityTable(a)}

Banks keep the EMI within 40–50% of take-home pay and lend up to 80% of the price. Computed at ${a.rate}% over ${a.tenureYears} years — an assumed rate; your bank's sanction decides the real figure. Any car or personal loan EMI comes off the EMI line first.

On top of the price: stamp duty ${UP_STATUTORY.stampDutyPct}% (${UP_STATUTORY.stampDutyFemalePct}% with a woman as primary owner) and registration ${UP_STATUTORY.registrationPct}%, plus ${UP_STATUTORY.gstUnderConstructionPct}% GST if the flat is under construction. Keep those in cash beside the down payment.

Want me to show projects between ${cr(a.priceConservativeCr)} and ${cr(a.priceStretchedCr)}?`,
      })
      ctx.emitUiState({
        stage: 'FINANCE',
        thinking: 'What your income supports:',
        chips: [
          { id: `chip_afford_show_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Projects up to ${cr(a.priceConservativeCr)}`, icon: 'search', analyticsId: 'chip_afford_reco', priority: 1, payload: { text: `Show me projects under ${a.priceConservativeCr.toFixed(2)} cr` } },
        ],
        missingFields: [],
        confidence: 'MEDIUM',
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'FINANCED', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    if (basePrice == null) {
      const incomeLine = userMonthlyIncome
        ? ` I have your income as ${inr(userMonthlyIncome)} a month.`
        : ''
      ctx.send('token', {
        token: `To run the EMI and cash-flow check I need a price to work from — I don't have one for ${project ? project.name : 'this'} yet.${incomeLine}\n\nTell me the property price or your budget (e.g. "1.5 cr"), or name a project and I'll use its listed price.`,
      })
      ctx.emitUiState({
        stage: 'FINANCE',
        thinking: 'No price or budget on record:',
        chips: [
          { id: `chip_budget_1_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Budget ₹1 Cr', icon: 'calculator', analyticsId: 'chip_afford_budget', priority: 1, payload: { text: 'Can I afford a 1 cr flat?' } },
          { id: `chip_budget_2_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Budget ₹2 Cr', icon: 'calculator', analyticsId: 'chip_afford_budget', priority: 2, payload: { text: 'Can I afford a 2 cr flat?' } },
          { id: `chip_reco_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Show projects in my budget', icon: 'search', analyticsId: 'chip_afford_reco', priority: 3, payload: { text: 'Show me projects I can afford' } },
        ],
        missingFields: ['price'],
        confidence: 'LOW',
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'CLARIFYING', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    // The 1.30 fallback is a Noida-wide band, not this project's charges —
    // stated with the market qualifier whenever it is used.
    const multiplierOnRecord = project?.all_in_cost_multiplier != null
    const multiplier = project?.all_in_cost_multiplier ?? 1.30
    // "If I secure another 20 lakhs": the extra cash goes into the down payment,
    // on top of the assumed 20%, so the loan and EMI shrink by exactly that much.
    const extra = extraDownPayment(ctx.message)
    const calc = calculateAffordabilityBreakdown({
      basePrice,
      multiplier,
      userMonthlyIncome,
      ...(fin.tenureYears ? { tenureYears: fin.tenureYears } : {}),
      ...(extra ? { downpaymentPct: Math.min(0.9, 0.2 + extra / basePrice) } : {}),
    })

    // The base price is the project's own row only when isProjectSpecific; then
    // say who confirmed it and when. A buyer-stated figure has no such date.
    const basePriceBasis = isProjectSpecific
      ? `Developer quoted base — ${(await projectPriceNotes([project!.id])).get(project!.id) ?? UNDATED_NOTE}`
      : 'The price you gave'

    const title = project && isProjectSpecific
      ? `Financial Reality & Cash-Flow Stress Test — ${project.name}`
      : `Home Financing Cash-Flow & Rate Shock Analysis (${inrCr(basePrice)}, your figure)`

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
| **Headline Base Price** | ${inrCr(calc.basePrice)} | ${basePriceBasis} |
| **True Landed Cost** | **${inrCr(calc.totalLandedCost)}** (+${Math.round((calc.landedMultiplier - 1) * 100)}%${multiplierOnRecord ? '' : `, estimate — ${MARKET_QUALIFIER}`}) | Stamp duty, GST, IFMS & club charges: ${inrCr(calc.totalLandedCost - calc.basePrice)} paid in cash, not lent |
| **Downpayment (${extra ? `20% + your extra ${inrCr(extra)}` : 'assumed 20%'})** | ${inrCr(calc.downpaymentAmount)} | Upfront equity needed; your own figure will change the loan below |
| **Home Loan Principal${extra ? '' : ' (assumed 80% of price)'}** | ${inrCr(calc.loanPrincipal)} | ${calc.tenureYears}-year tenure at ${calc.baseInterestRatePct}% p.a. (assumed rate — your bank's offer will differ) |
| **Standard Bank EMI** | **${inr(calc.standardEmi)} / month** | Contractual bank debit |
| **Sec 24(b) Tax Shield** | **- ${inr(calc.monthlyTaxShieldSec24b)} / month** | ₹2L/yr interest deduction (assumes 30% slab + 4% cess) |
| **Net Out-of-Pocket Outflow** | **${inr(calc.netMonthlyOutflow)} / month** | Real cost to household budget |
| **+1.5% Rate Shock (${calc.shockInterestRatePct.toFixed(1)}%)** | **${inr(calc.shockEmi)} / month** | **+${inr(calc.rateShockBufferMonthly)} / month buffer needed** |
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
      confidence: isProjectSpecific && multiplierOnRecord ? 'HIGH' : 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'FINANCED', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
