// backend/src/lib/jev/execute.ts
//
// Live JEV Execution Dispatcher (Phase 1 & Phase 2).
// Routes decisions to deterministic handlers, pure calculators, or discovery.

import type { Response } from 'express'
import type { JevDecision } from './decision'
import type { Intent } from '../discovery/types'
import {
  calcEmi,
  calcStampDuty,
  calcGst,
  calcAllInCost,
  calcTrueNetRentalYield,
  calcUpgradeEquity,
  calcLoadingRatio,
  formatInr,
} from '../calculators'
import {
  isRentalInquiry,
  isResaleInquiry,
  isCommercialInquiry,
  isChainOfTitleQuery,
  isSocietyFinancialQuery,
  isOwnerNicheQuery,
  formatRentalAdvisory,
  formatResaleAdvisory,
  formatCommercialAdvisory,
  getChainOfTitleChecklist,
  getSocietyFinancialHealthChecklist,
  getNonObviousOwnerFactorsGuide,
} from '../advisory/marketAdvisory'
import { matchesLegalRiskQuestion } from '../chat/handlers/legalRisk'
import { statedBasePriceInr } from '../chat/handlers/totalOutflow'
import { ASKS_FOR_THE_CATCH } from '../chat/handlers/projectCatch'
import { ASKS_FAIRNESS } from '../chat/handlers/priceFairness'
import { MARKET_QUALIFIER } from '../factPresentation'

/**
 * A question a dedicated handler further down the router answers from law and
 * our own rows. JEV runs first, so without this its canned replies (the
 * clarify gate, the generic registration guide) pre-empted them: "is sector
 * 150 sports city registry solved", "10 lakh EOI refundable hai" and
 * "bsp 1.2 cr total kitna padega" all lost their specific answers.
 */
function ownedByDedicatedHandler(message: string): boolean {
  return matchesLegalRiskQuestion(message) || statedBasePriceInr(message) !== null ||
    ASKS_FOR_THE_CATCH.test(message) || ASKS_FAIRNESS.test(message)
}

/** "How does registry work", not "is registry safe in X". */
const ASKS_REGISTRATION_PROCESS =
  /\b(?:process|procedure|steps?|how\s+(?:do|does|to|is)|kaise|kya\s+karna)\b[^?]*\b(?:regist(?:ry|ration|er)|sub[- ]?lease|e[- ]?stamp)/i

export interface JevExecutionContext {
  res: Response
  send: (event: string, data: any) => void
  sessionId?: string
  userId?: string
  message: string
  intent: Intent
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  turnTrace?: any
  timer?: any
}

/**
 * Executes a JEV decision.
 * Returns true if the turn was completely handled and responded to.
 * Returns false if execution should fall through to the primary pipeline.
 */
export async function executeJevDecision(
  decision: JevDecision,
  ctx: JevExecutionContext,
): Promise<boolean> {
  const { res, send, sessionId, message } = ctx

  if (ownedByDedicatedHandler(message)) return false

  // 1. Clarification Gate Trigger
  if (decision.clarify && decision.clarify.trim().length > 0) {
    console.log('[JEV:CLARIFY_GATE]', decision.clarify)
    send('token', { token: `${decision.clarify}\n\n` })
    send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
    res.end()
    return true
  }

  // 2. Smalltalk / Greeting Fast-Path
  if (decision.task === 'smalltalk') {
    const greeting = getSmalltalkResponse(message)
    send('token', { token: greeting })
    send('done', { sessionId: sessionId ?? null, intentState: 'COLD', intent: ctx.intent })
    res.end()
    return true
  }

  // 3. Out of Scope Handler (Sales-OS Advisory Bridges)
  if (decision.task === 'out_of_scope') {
    if (isRentalInquiry(message)) {
      send('token', { token: formatRentalAdvisory(message) })
      send('done', { sessionId: sessionId ?? null, intentState: 'COLD', intent: ctx.intent })
      res.end()
      return true
    }
    if (isResaleInquiry(message)) {
      send('token', { token: formatResaleAdvisory(message) })
      send('done', { sessionId: sessionId ?? null, intentState: 'COLD', intent: ctx.intent })
      res.end()
      return true
    }
    if (isCommercialInquiry(message)) {
      send('token', { token: formatCommercialAdvisory(message) })
      send('done', { sessionId: sessionId ?? null, intentState: 'COLD', intent: ctx.intent })
      res.end()
      return true
    }
    send('token', {
      token:
        "I'm specifically focused on residential property search, builder verification, and legal/financial advisory in Noida and Greater Noida. How can I help you with your home search?",
    })
    send('done', { sessionId: sessionId ?? null, intentState: 'COLD', intent: ctx.intent })
    res.end()
    return true
  }

  // 4. Pure Calculator Handler (Stamp Duty, All-In Cost, Yield, Upgrade Equity, Loading)
  if (decision.task === 'calculate') {
    const handled = handleDeterministicCalculations(message, ctx)
    if (handled) return true
  }

  // 5. Legal & Due Diligence Advisory / Market Explanations
  if (decision.task === 'legal_process' || decision.task === 'market_explain') {
    if (isChainOfTitleQuery(message)) {
      send('token', { token: getChainOfTitleChecklist(message) })
      send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
      res.end()
      return true
    }
    if (isSocietyFinancialQuery(message)) {
      send('token', { token: getSocietyFinancialHealthChecklist(message) })
      send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
      res.end()
      return true
    }
    if (isOwnerNicheQuery(message)) {
      send('token', { token: getNonObviousOwnerFactorsGuide(message) })
      send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
      res.end()
      return true
    }
    if (/\b(?:due\s+diligence|checklist|checks|verify|rera\s+check)\b/i.test(message)) {
      const checklist = getDueDiligenceChecklist(message)
      send('token', { token: checklist })
      send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
      res.end()
      return true
    }
    if (decision.task === 'legal_process' && ASKS_REGISTRATION_PROCESS.test(message)) {
      const legalGuide = getLegalProcessGuide(message)
      send('token', { token: legalGuide })
      send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
      res.end()
      return true
    }
  }

  // Otherwise, fall through to main pipeline with JEV context attached
  return false
}

function getSmalltalkResponse(message: string): string {
  const lower = (message || '').toLowerCase().trim()
  if (/\b(?:thank|thanks|dhanyawad|shukriya)\b/.test(lower)) {
    return "You're very welcome! Let me know whenever you'd like to check specific sectors, compare projects, or calculate all-in acquisition costs."
  }
  if (/\b(?:who\s+are\s+you|what\s+can\s+you\s+do|help)\b/.test(lower)) {
    return "I'm your PropFyndr real estate advisor for Noida and Greater Noida. I can help you find verified properties, check builder track records and RERA filings, calculate stamp duty and EMIs, and compare residential sectors."
  }
  return 'Hello! How can I assist with your home search or property evaluation in Noida and Greater Noida today?'
}

export function handleDeterministicCalculations(message: string, ctx: JevExecutionContext): boolean {
  const { res, send, sessionId } = ctx
  const lower = (message || '').toLowerCase()

  // Branch A: UP Statutory Stamp Duty & Registration
  const stampDutyMatch = /\bstamp\s+duty\b.*?(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?|lakh?s?)/i.exec(message)
  if (stampDutyMatch && !/\ball[- ]?in|total\s+cost/i.test(lower)) {
    const isCr = /cr(?:ore)?/i.test(stampDutyMatch[0])
    const amountCr = parseFloat(stampDutyMatch[1]) * (isCr ? 1 : 0.01)
    const isWoman = /\b(?:woman|female|mother|wife|daughter|lady)\b/i.test(message)
    const calculation = calcStampDuty(amountCr, isWoman ? 'female' : 'male')

    const text =
      `**UP Statutory Stamp Duty & Registration Breakdown**\n\n` +
      `- **Agreement Value:** ₹${amountCr.toFixed(2)} Cr\n` +
      `- **Stamp Duty Rate:** ${calculation.rate}%\n` +
      `- **Estimated Stamp Duty:** ${formatInr(calculation.stampDuty)}\n` +
      `- **Registration Fee (1%):** ${formatInr(calculation.registration)}\n` +
      `- **Total Statutory Outflow:** ${formatInr(calculation.total)}\n\n` +
      `*Note: Exact stamp duty is calculated on the higher of the circle rate or agreement value.*`

    send('token', { token: text })
    send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
    res.end()
    return true
  }

  // Branch B (all-in cost) is deliberately absent. It invented a 1.5 Cr base,
  // 1,200 sqft, PLC and parking whenever "all-in" appeared, so "1.5 cr all
  // inclusive, what can I get" — a budget — got a cost sheet for a flat nobody
  // named. totalOutflowHandler computes on a price the buyer actually stated.

  // Branch C: True Net Rental Yield
  if (/\b(?:rental\s+yield|net\s+yield|true\s+yield|yield\s+calc|passive\s+income)\b/i.test(lower)) {
    const monthlyRent = parseMonthlyRent(message)
    const costMatch = /(?:cost|price|property|value|worth|for)\s*(?:of|is|at)?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?)/i.exec(message)
    const propertyCostCr = costMatch ? parseFloat(costMatch[1]) : null
    // Both inputs are the buyer's or there is no calculation: a "typical" rent
    // or price is a guess dressed as arithmetic.
    if (!monthlyRent || !propertyCostCr) return false

    const r = calcTrueNetRentalYield(monthlyRent, propertyCostCr, 1, 3500)

    const text =
      `**True Net Rental Yield Analysis**\n\n` +
      `| Metric | Value | Commentary |\n` +
      `|---|---|---|\n` +
      `| Monthly Expected Rent | ${formatInr(monthlyRent)} | Your figure |\n` +
      `| Annual Gross Rent | ${formatInr(r.annualGrossRent)} | 12 months full tenancy |\n` +
      `| Acquisition Basis | ₹${propertyCostCr.toFixed(2)} Cr | Your figure — use the all-in cost for a true yield |\n` +
      `| **Gross Rental Yield** | **${r.grossYieldPct}%** | Pre-expense cash-on-cost |\n` +
      `| **True Net Rental Yield** | **${r.netYieldPct}%** | Assumes 1 month vacancy a year and ₹3,500/month maintenance |\n\n` +
      `*Residential gross yields in Noida usually sit around 2–3.5% (${MARKET_QUALIFIER}).*`

    send('token', { token: text })
    send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
    res.end()
    return true
  }

  // Branch D: Two-Property Upgrade Equity
  if (/\b(?:upgrade|selling\s+.*buying|already\s+own|sell\s+.*buy)\b/i.test(lower)) {
    const values = Array.from(message.matchAll(/(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?)/gi)).map(m => parseFloat(m[1]))
    // Needs the buyer's own sale value and target price; never a default pair.
    if (values.length < 2) return false
    const existingVal = values[0]
    const newVal = values[1]
    const loanMatch = /(?:loan|debt|outstanding)\s*(?:of|is)?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:cr|lakh?s?)/i.exec(message)
    const remainingLoanCr = loanMatch
      ? /cr/i.test(loanMatch[0])
        ? parseFloat(loanMatch[1])
        : parseFloat(loanMatch[1]) * 0.01
      : 0

    const r = calcUpgradeEquity(existingVal, remainingLoanCr, newVal, 20, 8.6, 20)

    const text =
      `**Two-Property Upgrade Equity & Cashflow Analysis**\n\n` +
      `| Step | Amount | Details |\n` +
      `|---|---|---|\n` +
      `| Current Home Sale Value | ₹${existingVal.toFixed(2)} Cr | Expected gross realization |\n` +
      `| Outstanding Loan Repayment | (₹${remainingLoanCr.toFixed(2)} Cr) | ${loanMatch ? 'Cleared at sale closure' : 'No loan mentioned, so none assumed'} |\n` +
      `| Brokerage & Legal Friction (2%) | (₹${r.transactionCostsCr.toFixed(2)} Cr) | Transaction overhead |\n` +
      `| **Net Unlocked Cash Equity** | **₹${r.netRealizedCashCr.toFixed(2)} Cr** | Cash in hand for redeployment |\n` +
      `| Down Payment Needed (20%) | ₹${r.downPaymentCr.toFixed(2)} Cr | 20% on new ₹${newVal.toFixed(2)} Cr home |\n` +
      `| **Surplus Liquid Capital** | **₹${r.cashFlowGapMonthly.toFixed(2)} Cr** | Buffer for registry & interiors |\n` +
      `| New Home Loan (80%) | ₹${r.newLoanCr.toFixed(2)} Cr | Funded via home loan |\n` +
      `| **New Monthly EMI** | **${formatInr(r.newMonthlyEmi)}/mo** | 20 years @ 8.6% p.a. |\n`

    send('token', { token: text })
    send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
    res.end()
    return true
  }

  // Branch E: Carpet Loading & Usable Area Ratio
  if (/\b(?:loading|carpet\s+efficiency|usable\s+area|super\s+built.?up\s+vs\s+carpet)\b/i.test(lower)) {
    const nums = Array.from(message.matchAll(/(\d{1,2},?\d{3}|\d{3,4})\s*(?:sqft|sq\.?\s*ft|sft)?/gi)).map(m => parseInt(m[1].replace(',', ''), 10))
    const supers = nums.filter(n => n >= 400)
    // Two areas from the buyer or no ratio. Math.max() of nothing is -Infinity,
    // which is truthy, so the old `|| 1400` default never applied and the
    // answer came out as NaN.
    if (supers.length < 2) return false
    const superArea = Math.max(...supers)
    const carpetArea = Math.min(...supers)
    if (carpetArea >= superArea) return false

    const r = calcLoadingRatio(superArea, carpetArea)
    const verdictLabel =
      r.verdict === 'efficient'
        ? 'High efficiency (excellent usable space)'
        : r.verdict === 'average'
          ? 'Standard high-rise efficiency'
          : 'High loading (substantial common/circulation space)'

    const text =
      `**Carpet Area Efficiency & Loading Analysis**\n\n` +
      `- **Super Built-Up Area:** ${r.superBuiltUpSqft.toLocaleString('en-IN')} sqft\n` +
      `- **Usable Carpet Area:** ${r.carpetSqft.toLocaleString('en-IN')} sqft\n` +
      `- **Loading Ratio:** **${r.loadingPct}%**\n` +
      `- **Carpet Efficiency:** **${r.carpetEfficiencyPct}%**\n` +
      `- **Evaluation:** ${verdictLabel}\n\n` +
      `*Carpet efficiency of about 68–74% is common in Noida high-rises (${MARKET_QUALIFIER}); above 75% means little space lost to common areas.*`

    send('token', { token: text })
    send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
    res.end()
    return true
  }

  return false
}

/**
 * Monthly rent as the buyer wrote it: "rent is 25000", "25k rent",
 * "₹25,000 per month", "rent 25 thousand". The old pattern captured "250" out of
 * "25000" and multiplied by 1,000 — a ₹2.5 lakh rent.
 */
export function parseMonthlyRent(message: string): number | null {
  const m =
    /\brent(?:al)?\s*(?:of|is|at|=|:|hai|around|about)?\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)?\b/i.exec(message) ??
    /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)?\s*(?:per\s*month|\/\s*month|\/mo|a\s*month|monthly|rent)\b/i.exec(message)
  if (!m) return null
  const n = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  const unit = (m[2] ?? '').toLowerCase()
  const rent = unit === 'k' || unit === 'thousand' ? n * 1000 : unit === 'lakh' || unit === 'l' ? n * 100_000 : n
  return rent >= 1000 ? Math.round(rent) : null
}

function getDueDiligenceChecklist(_message: string): string {
  return (
    `**UP RERA Due Diligence Checklist for Noida & Greater Noida**\n\n` +
    `Before signing any agreement or paying an advance booking amount, verify these 5 critical checks:\n\n` +
    `1. **UP RERA Registration & Phase Validity:** Search on \`up-rera.in\` using the project's RERA ID. Verify that the promoter's declared completion deadline matches what the sales representative quoted.\n` +
    `2. **Authority Land Dues Status:** Verify whether the developer has cleared installment dues with the Noida or Greater Noida Authority. Pending authority dues are the #1 cause of registry delays.\n` +
    `3. **Sanctioned Tower & Floor Plans:** Request the sanctioned building layout approved by the Authority. Confirm that your specific tower, floor, and unit configuration exist on the approved map.\n` +
    `4. **RERA Designated 70% Escrow Account:** All payments must be deposited strictly into the RERA-designated escrow bank account, not a general corporate account.\n` +
    `5. **Occupancy Certificate (for Ready Homes):** Never accept "fit-out possession" without an official Occupancy Certificate (OC) or Completion Certificate (CC) issued by the Authority.\n`
  )
}

function getLegalProcessGuide(_message: string): string {
  return (
    `**Step-by-Step Property Registration & Legal Process in UP**\n\n` +
    `1. **Builder-Buyer Agreement (BBA):** Upon paying 10% of the property value, the builder executes a formal BBA. In UP, BBAs must be registered under RERA guidelines.\n` +
    `2. **Authority NOC & Completion:** Upon completion, the developer obtains Authority CC/OC and receives permission to execute tripartite sub-lease deeds.\n` +
    `3. **E-Stamping & Challan Generation:** Book an appointment on \`igrsup.gov.in\`. Generate an e-challan for 7% stamp duty (6% for women) and 1% registration fee.\n` +
    `4. **Sub-Registrar Office Execution:** The buyer, developer representative, and two witnesses present original IDs, allotment letters, and biometric verification.\n` +
    `5. **Tripartite Sub-Lease Deed Issuance:** The deed is stamped and registered, transferring leasehold rights from the Authority and Builder to the Buyer.\n` +
    `6. **Authority Mutation:** Submit the registered deed copy to the Authority to update municipal records and utility connections in your name.\n`
  )
}
