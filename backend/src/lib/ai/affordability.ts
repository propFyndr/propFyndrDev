// backend/src/lib/ai/affordability.ts
//
// The affordability arithmetic, done in code.
//
// The 31 Aug audit rated "I earn 2 lakh a month, what can I afford in Noida?"
// one of the two weakest answers in the set, for two reasons that share a
// cause. It took 45.5 seconds, and it quoted a comfortable EMI range of
// "₹80,000 and ₹1,000,000 per month" — the second figure is ten lakh, on a two
// lakh income. The model meant ₹1,00,000 and slipped a digit crossing between
// Indian lakh notation and plain numerals.
//
// That is not a prompt problem. It is arithmetic, and this codebase already
// decided how to handle arithmetic the buyer will act on: `marketTable.ts`
// renders tables in code rather than asking the model to draw them, because a
// figure we computed cannot be off by a factor of ten. Same rule here.
//
// The latency has the same root: with no numbers in hand the turn classifies
// as `reasoning`, gets the big model and a 1,024-token thinking budget, and
// spends it deriving what two lines of code produce exactly.

import { FINANCIAL } from '../config'
import { calcEmi, formatInr } from '../calculators'

/** A stated monthly income, in rupees, if the message contains one. */
export function statedMonthlyIncome(message: string): number | null {
  const m = (message ?? '').toLowerCase()

  // "2 lakh a month", "₹1.5L per month", "earn 200000 monthly"
  const lakh = /(?:earn|income|salary|make|take home|in hand)[^.]{0,30}?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i.exec(m)
    ?? /(\d+(?:\.\d+)?)\s*(?:lakh|lac)\s*(?:a|per|\/)\s*month/i.exec(m)
  if (lakh) return Math.round(Number(lakh[1]) * 1_00_000)

  const plain = /(?:earn|income|salary|make)[^.]{0,30}?(?:₹|rs\.?\s*)?(\d{5,8})\b/i.exec(m)
  if (plain) {
    const n = Number(plain[1])
    // Below 10k a month is not an income statement; above 50L is not monthly.
    if (n >= 10_000 && n <= 50_00_000) return n
  }
  return null
}

/**
 * Is this turn asking what the buyer can afford?
 *
 * Requires BOTH an affordability question and a stated income. "What can I
 * afford" with no number is a conversation, not a calculation, and should keep
 * going through the ordinary path so it can ask.
 */
export function isAffordabilityQuestion(message: string): boolean {
  return /\b(afford|budget|how much (can|should) i|how much (home )?loan|borrow|what can i (buy|get)|eligib|loan amount|emi)\b/i.test(message ?? '')
}

/**
 * The income from this message, or from the latest earlier turn that stated one.
 * "Ok so what can I actually afford then?" one turn after "My salary is 1.8 lakh
 * a month" carried no number, so the model did the arithmetic and gave a ₹75 L
 * loan an EMI of "₹6.6 L" (stress run, 16 Oct 2026).
 */
export function incomeInConversation(message: string, history: ReadonlyArray<{ role: string; content: string }>): number | null {
  const own = statedMonthlyIncome(message)
  if (own || !isAffordabilityQuestion(message)) return own
  for (let i = history.length - 1; i >= 0; i--) {
    const n = history[i].role === 'user' ? statedMonthlyIncome(history[i].content) : null
    if (n) return n
  }
  return null
}

export interface Affordability {
  monthlyIncome: number
  /** Conservative and stretched EMI ceilings, from the FOIR band banks use. */
  emiConservative: number
  emiStretched: number
  /** Loan supported by each EMI at the configured rate and tenure. */
  loanConservativeCr: number
  loanStretchedCr: number
  /** Property price those loans reach at an 80% LTV. */
  priceConservativeCr: number
  priceStretchedCr: number
  downPaymentConservative: number
  downPaymentStretched: number
  rate: number
  tenureYears: number
}

/**
 * Banks size a home loan by FOIR — the share of income that may go to debt.
 * 40% is the conservative end and 50% the stretched one for a salaried buyer
 * with no other obligations; anything above that is not lent against.
 */
const FOIR_CONSERVATIVE = 0.40
const FOIR_STRETCHED = 0.50

/** Standard down payment. Banks fund up to 80% of value on most home loans. */
const LTV = 0.80

/** Principal an EMI supports — the EMI formula solved for P. */
function loanForEmi(emi: number, annualRatePct: number, tenureYears: number): number {
  const r = annualRatePct / 1200
  const n = tenureYears * 12
  if (r === 0) return emi * n
  return (emi * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n))
}

export function computeAffordability(monthlyIncome: number): Affordability {
  const rate = FINANCIAL.EMI_RATE
  const tenureYears = FINANCIAL.LOAN_TENURE_YEARS

  const emiConservative = Math.round(monthlyIncome * FOIR_CONSERVATIVE)
  const emiStretched = Math.round(monthlyIncome * FOIR_STRETCHED)

  const loanConservative = loanForEmi(emiConservative, rate, tenureYears)
  const loanStretched = loanForEmi(emiStretched, rate, tenureYears)

  const priceConservative = loanConservative / LTV
  const priceStretched = loanStretched / LTV

  return {
    monthlyIncome,
    emiConservative,
    emiStretched,
    loanConservativeCr: loanConservative / 1_00_00_000,
    loanStretchedCr: loanStretched / 1_00_00_000,
    priceConservativeCr: priceConservative / 1_00_00_000,
    priceStretchedCr: priceStretched / 1_00_00_000,
    downPaymentConservative: priceConservative - loanConservative,
    downPaymentStretched: priceStretched - loanStretched,
    rate,
    tenureYears,
  }
}

/** The table the buyer sees, built from the numbers above. */
export function renderAffordabilityTable(a: Affordability): string {
  const cr = (n: number) => `₹${n.toFixed(2)} Cr`
  return [
    `| | Comfortable (${Math.round(FOIR_CONSERVATIVE * 100)}% of income) | Stretched (${Math.round(FOIR_STRETCHED * 100)}%) |`,
    '| :--- | ---: | ---: |',
    `| **Monthly EMI** | ${formatInr(a.emiConservative)} | ${formatInr(a.emiStretched)} |`,
    `| **Loan supported** | ${cr(a.loanConservativeCr)} | ${cr(a.loanStretchedCr)} |`,
    `| **Property price** | ${cr(a.priceConservativeCr)} | ${cr(a.priceStretchedCr)} |`,
    `| **Down payment needed** | ${formatInr(Math.round(a.downPaymentConservative))} | ${formatInr(Math.round(a.downPaymentStretched))} |`,
  ].join('\n')
}

/**
 * The block handed to the model alongside the rendered table.
 *
 * It is told the table is already on screen for the same reason the market
 * tables are: left to redraw it, the model both spends output tokens on data
 * it was given and reintroduces the arithmetic error this module exists to
 * remove.
 */
export function affordabilityDirective(a: Affordability): string {
  return [
    '',
    '## AFFORDABILITY — ALREADY CALCULATED AND ON SCREEN',
    '',
    `Stated income: ${formatInr(a.monthlyIncome)} per month.`,
    `Computed at ${a.rate}% over ${a.tenureYears} years, ${Math.round(LTV * 100)}% loan-to-value.`,
    '',
    'A table with the EMI, loan, price and down payment is ALREADY rendered above',
    'your answer. Do NOT restate those figures in a table of your own, and do NOT',
    'recalculate them — every number the buyer needs is on screen and correct.',
    '',
    'Write the part the table cannot:',
    `- Which band you would actually stand behind, and why (the ${Math.round(FOIR_CONSERVATIVE * 100)}% column is the one`,
    '  banks approve without argument; the stretched column assumes no car loan,',
    '  no other EMI, and a stable income).',
    `- What ${a.priceConservativeCr.toFixed(2)}–${a.priceStretchedCr.toFixed(2)} Cr actually buys in Noida, using the projects you were`,
    '  given. Name them.',
    '- The costs on top of the sticker price: stamp duty, registration, GST where',
    '  it applies, and the fit-out nobody budgets for.',
    '- One honest caution about the stretched column.',
    '',
    'Do NOT mention rent or rental yield. This buyer is asking what to buy.',
    '',
  ].join('\n')
}
