import type { ChatTopicHandler } from '../handlerContext'
import { calculateEmi } from './affordabilityHandler'

/**
 * "I can get a 90 lakh loan, what EMI at 8.5% for 20 years?"
 *
 * The buyer gave the loan itself, so this is arithmetic, not advice: it was
 * reaching the general model lane, which does EMI maths in prose (red-team
 * spec 2026-10-05). Rate and tenure the buyer did not give are stated as
 * assumptions, never folded in silently.
 */
const LOAN_AMOUNT = /(?:loan\s+(?:of|amount(?:\s+of)?)\s*(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\b)|(?:(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\s+(?:home\s+)?loan\b)/i
const RATE = /(\d{1,2}(?:\.\d{1,2})?)\s*%/
const TENURE = /(\d{1,2})\s*(?:years?|yrs?|saal)\b/i

const DEFAULT_RATE = 8.5
const DEFAULT_TENURE = 20

export function parseLoanEmiQuestion(message: string): { principal: number; rate: number | null; tenure: number | null } | null {
  if (!/\bemi\b|\binstal+ment\b|\bkisht\b/i.test(message)) return null
  const m = message.match(LOAN_AMOUNT)
  if (!m) return null
  const value = Number(m[1] ?? m[3])
  const unit = m[2] ?? m[4]
  if (!Number.isFinite(value) || value <= 0) return null
  const principal = /^c/i.test(unit) ? value * 10_000_000 : value * 100_000
  const rate = message.match(RATE) ? Number(message.match(RATE)![1]) : null
  const tenure = message.match(TENURE) ? Number(message.match(TENURE)![1]) : null
  return { principal, rate: rate && rate > 0 && rate < 30 ? rate : null, tenure: tenure && tenure > 0 && tenure <= 35 ? tenure : null }
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const amount = (n: number) => (n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(2)} Cr` : `₹${(n / 100_000).toFixed(2)} L`)

export function loanEmiAnswer(q: { principal: number; rate: number | null; tenure: number | null }): string {
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

This is a reducing-balance EMI on the loan alone. A floating rate moves with the repo rate, so the EMI or the tenure changes over the loan's life.`
}

export const loanEmiHandler: ChatTopicHandler = {
  id: 'loan_emi',
  description: 'EMI on a loan amount the buyer stated',

  matches: ctx => parseLoanEmiQuestion(ctx.message) !== null,

  handle: async ctx => {
    const q = parseLoanEmiQuestion(ctx.message)
    if (!q) return false
    ctx.send('token', { token: loanEmiAnswer(q) })
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
