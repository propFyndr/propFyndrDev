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

/** "1,50,000" -> "150000": Indian digit grouping broke every income pattern below. */
function ungroup(text: string): string {
  return text.replace(/(?<=\d),(?=\d{2,3}\b)/g, '')
}

/** A stated monthly income, in rupees, if the message contains one. */
export function statedMonthlyIncome(message: string): number | null {
  const m = ungroup((message ?? '').toLowerCase())

  // "15 LPA", "18 lakh per annum": annual, so a twelfth of it.
  const annual = /(\d+(?:\.\d+)?)\s*(?:lpa\b|(?:lakhs?|lacs?|l)\s*(?:per\s+annum|p\.?a\.?(?![a-z])|a\s+year|per\s+year|annual(?:ly)?|yearly))/i.exec(m)
  if (annual) return Math.round(Number(annual[1]) * 1_00_000 / 12)

  // "2 lakh a month", "₹1.5L per month", "earn 200000 monthly". "make a down
  // payment of 20 lakhs" is not an income.
  const lakh = /(?:earn|income|salary|make(?!\s+(?:a\s+|the\s+)?(?:down|dp|payment))|take home|in hand)[^.]{0,30}?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i.exec(m)
    ?? /(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|l)\s*(?:a|per|\/)\s*month/i.exec(m)
  if (lakh) return Math.round(Number(lakh[1]) * 1_00_000)

  const plain = /(?:earn|income|salary|make)[^.]{0,30}?(?:₹|rs\.?\s*)?(\d{5,8})\b/i.exec(m)
  if (plain) {
    const n = Number(plain[1])
    // Below 10k a month is not an income statement; above 50L is not monthly.
    if (n >= 10_000 && n <= 50_00_000) return n
  }
  return null
}

const AMOUNT = String.raw`(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|l|cr|crores?)\b`
const toRupees = (n: string, unit: string) => Math.round(Number(n) * (/^c/i.test(unit) ? 1_00_00_000 : 1_00_000))

export interface FinancingStatement {
  monthlyIncome?: number
  downPayment?: number
  loanAmount?: number
  tenureYears?: number
}

/**
 * Income, down payment, loan and tenure the buyer stated in this message.
 * Live 17 Oct 2026: "monthly income is : 1,50,000/month … my down payment
 * capacity is 20 lakhs" and "1.5L/MONTH … down payment of 20 lakhs and take an
 * 80 lakh loan" both reached the model, which did the arithmetic, failed the
 * integrity check, and ended on the outage notice.
 */
export function parseFinancingStatement(message: string): FinancingStatement {
  const m = ungroup(message ?? '')
  const out: FinancingStatement = {}
  const income = statedMonthlyIncome(m)
  if (income) out.monthlyIncome = income

  const down = new RegExp(String.raw`\b(?:down\s*-?\s*payment|dp)\b(?:\s+(?:capacity|budget|amount))?[^\d₹\n]{0,20}?` + AMOUNT, 'i').exec(m)
    ?? new RegExp(AMOUNT + String.raw`\s*(?:as|for|in|towards)?\s*(?:the\s+|a\s+)?(?:down\s*-?\s*payment|dp)\b`, 'i').exec(m)
  if (down) out.downPayment = toRupees(down[1], down[2])

  const loan = new RegExp(AMOUNT + String.raw`\s*(?:home\s+|bank\s+)?loan\b`, 'i').exec(m)
    ?? new RegExp(String.raw`\bloan\s*(?:amount)?\s*(?:of|is|:|=)\s*` + AMOUNT, 'i').exec(m)
  if (loan) out.loanAmount = toRupees(loan[1], loan[2])

  const tenure = /\btenure[^\d\n]{0,20}(\d{1,2})\s*(?:years?|yrs?)\b|\b(\d{1,2})\s*(?:-\s*)?(?:years?|yrs?)\s*(?:tenure|loan)\b/i.exec(m)
  const years = tenure ? Number(tenure[1] ?? tenure[2]) : NaN
  if (years >= 5 && years <= 30) out.tenureYears = years
  return out
}

/** An income plus a down payment or a loan: a financing plan for code to compute. */
export function statesFinancing(message: string): boolean {
  const f = parseFinancingStatement(message)
  return f.monthlyIncome != null && (f.downPayment != null || f.loanAmount != null)
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
 * Budget planning on a price the buyer already gave: "help me work out a
 * realistic budget and EMI" (our own chip), "how much should my monthly salary
 * be", "if I secure another 20 lakhs". Live session 17 Oct 2026: each of these
 * reached the model, which did the EMI arithmetic itself, quoted figures the
 * integrity check rightly rejected, and three turns ended on the outage notice.
 */
export function asksBudgetPlan(message: string): boolean {
  return statesFinancing(message) || /\b(realistic budget|budget\s*(?:and|&|\+)\s*emi|emi\s+(?:on|for)\s+(?:this|my|that|the)\s+budget|how much (?:should|must|would|do(?:es)?) (?:be |my |i |the )*(?:monthly |annual )?(?:salary|income|earn|take[- ]home)|(?:salary|income) (?:should|would|do i|must) (?:i |be |need)|(?:salary|income) (?:needed|required)|(?:secure|arrange|add|put in|have|get) (?:an?other|extra|additional|more) \d+(?:\.\d+)?\s*(?:l|lakhs?|lacs?|cr|crores?)\b)/i.test(message ?? '')
}

/** "another 20 lakhs" / "extra 0.5 cr" towards the purchase, in rupees, or null. */
export function extraDownPayment(message: string): number | null {
  const m = /(?:an?other|extra|additional|more)\s+(\d+(?:\.\d+)?)\s*(l|lakhs?|lacs?|cr|crores?)\b/i.exec(message ?? '')
  if (!m) return null
  return Math.round(Number(m[1]) * (/^c/i.test(m[2]) ? 1_00_00_000 : 1_00_000))
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
export const FOIR_CONSERVATIVE = 0.40
const FOIR_STRETCHED = 0.50

/** Standard down payment. Banks fund up to 80% of value on most home loans. */
const LTV = 0.80

/** Principal an EMI supports — the EMI formula solved for P. */
export function loanForEmi(emi: number, annualRatePct: number, tenureYears: number): number {
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
