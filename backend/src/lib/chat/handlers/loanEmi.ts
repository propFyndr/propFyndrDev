import type { ChatTopicHandler } from '../handlerContext'
import { calculateEmi } from './affordabilityHandler'
import { UP_STATUTORY } from '../../factPresentation'
import { focusProjectPrice } from './statutoryTax'

/**
 * "I can get a 90 lakh loan, what EMI at 8.5% for 20 years?"
 *
 * The buyer gave the loan itself, so this is arithmetic, not advice: it was
 * reaching the general model lane, which does EMI maths in prose (red-team
 * spec 2026-10-05). Rate and tenure the buyer did not give are stated as
 * assumptions, never folded in silently.
 */
const LOAN_AMOUNT = /(?:loan\s+(?:of|amount(?:\s+of)?)\s*(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\b)|(?:(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\s+(?:home\s+)?loan\b)/i
// "80% loan on a 1.5 crore flat": the loan is a share of a stated price.
const LOAN_SHARE = /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:home\s+)?loan\s+on\s+(?:a\s+|the\s+)?(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\b/i
// Hinglish order, price first: "1.5 crore ke flat pe 80% loan".
const LOAN_SHARE_HI = /(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\s+(?:ke|ka|ki)\s+(?:flat|ghar|property)\s+(?:pe|par|pr)\s+(\d{1,3}(?:\.\d+)?)\s*%\s*(?:home\s+)?loan\b/i
// "an 80% loan" with no price: the price comes from the project in focus.
const LOAN_SHARE_ONLY = /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:home\s+)?loan\b/i
const DOWN_SHARE_ONLY = /(\d{1,2}(?:\.\d+)?)\s*%\s*(?:down(?:\s*payment)?|downpayment|upfront|margin)\b/i
const RATE = /(\d{1,2}(?:\.\d{1,2})?)\s*%/

/** The loan share of an EMI question that names no amount, or null. */
export function loanShareOfFocus(message: string): number | null {
  if (!/\bemi\b|\binstal+ment\b|\bkisht\b/i.test(message) || parseLoanEmiQuestion(message)) return null
  const m = message.match(LOAN_SHARE_ONLY)
  // "20% down" is the same question as "80% loan": the rest is the loan.
  const down = m ? null : message.match(DOWN_SHARE_ONLY)
  const pct = m ? Number(m[1]) : down ? 100 - Number(down[1]) : NaN
  return pct > 0 && pct <= 100 ? pct : null
}
const TENURE = /(\d{1,2})\s*(?:years?|yrs?|saal)\b/i

const DEFAULT_RATE = 8.5
const DEFAULT_TENURE = 20

type LoanQuestion = { principal: number; rate: number | null; tenure: number | null; price?: number }

const rupees = (value: number, unit: string) => (/^c/i.test(unit) ? value * 10_000_000 : value * 100_000)

export function parseLoanEmiQuestion(message: string): LoanQuestion | null {
  if (!/\bemi\b|\binstal+ment\b|\bkisht\b/i.test(message)) return null
  let principal: number
  let price: number | undefined
  let rest = message
  const en = message.match(LOAN_SHARE)
  const hi = en ? null : message.match(LOAN_SHARE_HI)
  // Normalised to [match, pct, value, unit] whichever order the buyer used.
  const share = en ?? (hi ? [hi[0], hi[3], hi[1], hi[2]] : null)
  if (share) {
    const pct = Number(share[1])
    price = rupees(Number(share[2]), share[3])
    if (!(pct > 0 && pct <= 100) || !(price > 0)) return null
    principal = Math.round((price * pct) / 100)
    rest = message.replace(share[0], ' ') // the loan share is not the interest rate
  } else {
    const m = message.match(LOAN_AMOUNT)
    if (!m) return null
    const value = Number(m[1] ?? m[3])
    if (!Number.isFinite(value) || value <= 0) return null
    principal = rupees(value, m[2] ?? m[4])
  }
  const rate = rest.match(RATE) ? Number(rest.match(RATE)![1]) : null
  const tenure = rest.match(TENURE) ? Number(rest.match(TENURE)![1]) : null
  return {
    principal,
    rate: rate && rate > 0 && rate < 30 ? rate : null,
    tenure: tenure && tenure > 0 && tenure <= 35 ? tenure : null,
    ...(price ? { price } : {}),
  }
}

/** Cash the buyer pays themselves: down payment plus the fixed UP charges on the price. */
function upFrontCash(price: number, principal: number): string {
  const down = price - principal
  const stamp = (price * UP_STATUTORY.stampDutyPct) / 100
  const reg = (price * UP_STATUTORY.registrationPct) / 100
  const gst = (price * UP_STATUTORY.gstUnderConstructionPct) / 100
  const pct = Math.round((down / price) * 100)
  return `

### Cash up front on a ${amount(price)} flat

| | Amount |
| :--- | ---: |
| Down payment (${pct}%) | ${inr(down)} |
| Stamp duty (${UP_STATUTORY.stampDutyPct}%) | ${inr(stamp)} |
| Registration (${UP_STATUTORY.registrationPct}%) | ${inr(reg)} |
| **Cash up front, ready to move** | **${inr(down + stamp + reg)}** |

If the flat is under construction, add ${UP_STATUTORY.gstUnderConstructionPct}% GST, ${inr(gst)}, paid across construction milestones: ${inr(down + stamp + reg + gst)} in all. Stamp duty is ${UP_STATUTORY.stampDutyFemalePct}% if a woman is the primary owner, and it is charged on the circle rate if that is higher than the price. Banks also charge a processing fee; ask yours for the figure.`
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const amount = (n: number) => (n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(2)} Cr` : `₹${(n / 100_000).toFixed(2)} L`)

export function loanEmiAnswer(q: LoanQuestion): string {
  const rate = q.rate ?? DEFAULT_RATE
  const tenure = q.tenure ?? DEFAULT_TENURE
  const emi = calculateEmi(q.principal, rate, tenure)
  const total = emi * tenure * 12
  const assumed = [
    q.rate == null ? `${rate}% interest (your bank's sanctioned rate decides the real figure)` : null,
    q.tenure == null ? `a ${tenure}-year tenure` : null,
  ].filter(Boolean)
  const alt = q.rate == null ? `\n\nAt ${rate + 0.5}%, the same loan is ${inr(calculateEmi(q.principal, rate + 0.5, tenure))} a month.` : ''

  return `### EMI on a ${amount(q.principal)} loan

**${inr(emi)} a month** at ${rate}% over ${tenure} years.

| | Amount |
| :--- | ---: |
| Loan | ${amount(q.principal)} |
| Total repaid | ${amount(total)} |
| Total interest | ${amount(total - q.principal)} |
${assumed.length ? `\nI assumed ${assumed.join(' and ')}.` : ''}${alt}

This is a reducing-balance EMI on the loan alone. A floating rate moves with the repo rate, so the EMI or the tenure changes over the loan's life.${q.price ? upFrontCash(q.price, q.principal) : ''}`
}

export const loanEmiHandler: ChatTopicHandler = {
  id: 'loan_emi',
  description: 'EMI on a loan amount the buyer stated',

  matches: ctx => parseLoanEmiQuestion(ctx.message) !== null || (Boolean(ctx.activeProjectName) && loanShareOfFocus(ctx.message) !== null),

  handle: async ctx => {
    let q = parseLoanEmiQuestion(ctx.message)
    let basis = ''
    // "EMI on that with an 80% loan" after a project answer: the price is the
    // project's lowest listed one, stated with its confirmation date.
    const pct = q ? null : loanShareOfFocus(ctx.message)
    if (!q && pct !== null) {
      const focus = await focusProjectPrice(ctx.activeProjectName)
      if (!focus) return false
      const price = Math.round(focus.amountCr * 10_000_000)
      const rest = ctx.message.replace(LOAN_SHARE_ONLY, ' ')
      const rate = rest.match(RATE) ? Number(rest.match(RATE)![1]) : null
      const tenure = rest.match(TENURE) ? Number(rest.match(TENURE)![1]) : null
      q = { principal: Math.round((price * pct) / 100), price, rate: rate && rate > 0 && rate < 30 ? rate : null, tenure: tenure && tenure > 0 && tenure <= 35 ? tenure : null }
      basis = `${focus.heading}.\n\n`
    }
    if (!q) return false
    ctx.send('token', { token: basis + loanEmiAnswer(q) })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'EMI on your loan:',
      chips: [],
      missingFields: [],
      confidence: q.rate == null ? 'MEDIUM' : 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
