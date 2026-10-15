import type { ChatTopicHandler } from '../handlerContext'
import { UP_STATUTORY } from '../../factPresentation'
import { matchesLegalRiskQuestion } from './legalRisk'
import { femaleStampDutySaving } from './totalOutflow'

/**
 * A buyer who has already found a resale flat and asks what to check or what it
 * will cost: "documents and dues for a ₹1.65 Cr resale flat", "seller dropped to
 * 1.58 Cr but it needs renovation, recalculate".
 *
 * This is checking and arithmetic on the buyer's own numbers. It is not resale
 * inventory and not a price opinion: we hold no resale transaction prices, so
 * the answer never says whether the figure is fair. "Show me resale flats" does
 * not match and still gets the scope reply.
 */

const RESALE_CUE = /\b(resale|re-sale|second[- ]?hand|pre[- ]?owned|seller)\b/i
const ASKS_DOCS =
  /\b(documents?|papers?|checklist|verify|due\s+diligence|outstanding|dues|noc|check\s+before|before\s+(?:paying|booking|buying|signing))\b/i
const ASKS_COST =
  /\b(total\s+cost|all[- ]?in|recalculate|worth\s+(?:it|pursuing)|good\s+deal|renovat\w*|reduced|dropped|negotiat\w*)\b/i
// "Show me resale flats in sector 77" is a listings request, which we do not do.
const ASKS_LISTINGS = /\b(show|find|list|browse|suggest|recommend|search|available)\b[^.?!]*\b(resale|second[- ]?hand)\b/i

/**
 * The deal as the buyer has built it up over the conversation: the latest price they
 * gave for a resale flat and the latest renovation estimate. This turn's figures
 * win; earlier turns fill what this one leaves out. Held nowhere but the transcript.
 */
export function dealFromConversation(prior: ReadonlyArray<string>, message: string): { prices: number[]; renovation: number | null } {
  const cur = parseResaleAmounts(message)
  let { prices, renovation } = cur
  const recent = [...prior].reverse()
  if (prices.length === 0) {
    const m = recent.find(x => RESALE_CUE.test(x) && parseResaleAmounts(x).prices.length > 0)
    if (m) prices = parseResaleAmounts(m).prices
  }
  if (renovation === null) {
    const m = recent.find(x => parseResaleAmounts(x).renovation !== null)
    if (m) renovation = parseResaleAmounts(m).renovation
  }
  return { prices, renovation }
}

/** A revision with no resale word of its own, made while a resale deal is on the table. */
export function isDealFollowUp(prior: ReadonlyArray<string>, message: string): boolean {
  if (RESALE_CUE.test(message) || !REVISES_DEAL.test(message)) return false
  if (!/\d/.test(message)) return false
  return prior.some(x => RESALE_CUE.test(x) && parseResaleAmounts(x).prices.length > 0)
}

export function matchesResaleDealQuestion(message: string): boolean {
  if (!RESALE_CUE.test(message)) return false
  if (matchesLegalRiskQuestion(message)) return false
  if (ASKS_LISTINGS.test(message) && !ASKS_DOCS.test(message)) return false
  return ASKS_DOCS.test(message) || ASKS_COST.test(message)
}

// A follow-up that only revises the deal: "needs 8 lakh of renovation", "seller dropped it".
const REVISES_DEAL = /\b(?:renovat\w*|repairs?|interiors?|reduced|dropped|lowered|brought\s+down)\b/i

const CRORE = 10_000_000
const LAKH = 100_000
const AMOUNT = /(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\b/gi
const RENO_WORD = /(?:renovat\w*|repairs?|interiors?|reno)/i

const toInr = (n: string, unit: string) => Number(n) * (/^c/i.test(unit) ? CRORE : LAKH)

/** Prices the buyer stated, in the order stated, with any renovation estimate kept apart. */
export function parseResaleAmounts(message: string): { prices: number[]; renovation: number | null } {
  let renovation: number | null = null
  const amounts = [...message.matchAll(AMOUNT)].map(m => ({ inr: toInr(m[1], m[2]), at: m.index ?? 0, len: m[0].length }))
  const prices: number[] = []
  for (const a of amounts) {
    const near = message.slice(Math.max(0, a.at - 30), a.at + a.len + 30)
    // A renovation estimate is small next to the price. With no price given yet, anything
    // under ₹30 lakh is read as renovation, since no Noida flat sells for that little.
    const small = prices.length > 0 ? a.inr <= prices[0] * 0.3 : a.inr < 30 * LAKH
    if (RENO_WORD.test(near) && renovation === null && small) renovation = a.inr
    else if (a.inr > 0) prices.push(a.inr)
  }
  return { prices, renovation }
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const cr = (n: number) => `₹${(n / CRORE).toFixed(2)} Cr`

export function resaleCostAnswer(prices: number[], renovation: number | null): string {
  const s = UP_STATUTORY
  const rows = prices.map(p => {
    const stamp = Math.round(p * (s.stampDutyPct / 100))
    const reg = Math.round(p * (s.registrationPct / 100))
    const total = p + stamp + reg + (renovation ?? 0)
    return `| ${cr(p)} | ${inr(stamp)} | ${inr(reg)} | ${renovation === null ? 'not given' : inr(renovation)} | **${inr(total)}** |`
  })
  const saving = prices.map(femaleStampDutySaving)
  return `### What this costs you, on the numbers you gave

| Price | Stamp duty (${s.stampDutyPct}%) | Registration (${s.registrationPct}%) | Renovation | Total |
| :--- | :--- | :--- | :--- | :--- |
${rows.join('\n')}

- **GST:** ${s.gstReadyToMovePct}% on a completed flat bought from an individual. Confirm with your CA.
- **Stamp duty basis:** it is charged on the higher of the agreement value and the Authority circle rate, so if the circle rate is higher your duty is higher than shown.
${prices.length === 1 && saving[0] > 0 ? `- **If the primary owner is a woman,** stamp duty is ${s.stampDutyFemalePct}%, which saves about ${inr(saving[0])}.\n` : ''}- **Not in the total:** the Authority's transfer charges, any society transfer fee, brokerage and pending dues. Ask for each amount in writing. We don't hold them for this flat, so they are left out, not guessed.
${renovation === null ? '- **Renovation:** you did not give an estimate, so none is included. Send a contractor quote and I will add it.\n' : ''}
**Is it a fair price?** I can't say. We hold no resale transaction prices, only builder-side rows, and asking prices are not sale prices. Compare it with recent registered sales in the same society and tower from the seller's broker or the sub-registrar, and check the carpet area rather than the super area.`
}

const CHECKLIST = `### Resale flat: what to verify before you pay

Tick items off as you go; the ticks are kept on this device for this chat.

**Documents that prove you can legally buy it**
- [ ] **Ownership chain:** the registered sub-lease deed or conveyance deed in the seller's name, and every earlier transfer back to the builder's allotment.
- [ ] **Authority permission:** the Transfer Memorandum or NOC from the Noida / Greater Noida Authority, where the land is Authority leasehold. A seller who says "it's not needed" is a red flag.
- [ ] **Occupancy and completion certificates** that cover this tower, not just the project.
- [ ] **Sanctioned plan against the flat:** unit number, area, balcony and parking as built versus as approved.
- [ ] **Encumbrance and litigation search:** no mortgage, attachment or court dispute. If the seller has a home loan, the bank holds the original papers; get the loan closure letter and the release of originals before the final payment.
- [ ] **RERA record,** if the project is registered: validity, complaints and orders.

**Dues that become yours if you don't clear them first**
- [ ] Authority dues: lease rent, transfer charges, any pending notice.
- [ ] Society maintenance, sinking fund and club or parking charges, with a no-dues certificate from the RWA or maintenance company.
- [ ] Electricity, water and piped gas, as final bills or no-dues letters.
- [ ] Any stamp duty shortfall notice on an earlier registration.

**How to pay:** a small token first, then the balance against the executed registry, with dues deducted from the price or held back. Do not pay in cash and do not pay an individual other than the seller on title.

This is a checklist, not legal advice. Have a property lawyer read the documents before you sign.`

export const resaleDealHandler: ChatTopicHandler = {
  id: 'resale_deal',
  description: 'Documents, dues and total cost for a resale flat the buyer has already found',

  matches: ctx => matchesResaleDealQuestion(ctx.message) || (!ctx.activeProjectName && isDealFollowUp(ctx.priorUserMessages ?? [], ctx.message)),

  handle: async ctx => {
    const { prices, renovation } = dealFromConversation(ctx.priorUserMessages ?? [], ctx.message)
    const wantsCost = ASKS_COST.test(ctx.message) || REVISES_DEAL.test(ctx.message)
    const parts: string[] = []
    if (prices.length) parts.push(resaleCostAnswer(prices, renovation))
    else if (wantsCost) parts.push('Tell me the price the seller is asking, and any renovation estimate, and I will work out the stamp duty, registration and total. I will not assume a price.')
    if (ASKS_DOCS.test(ctx.message) || !prices.length) parts.push(CHECKLIST)

    ctx.send('token', { token: parts.join('\n\n---\n\n') })
    ctx.emitUiState({
      stage: 'FINANCE',
      thinking: 'Working from the numbers you gave and the standard resale checks:',
      chips: [
        { id: `chip_resale_advisor_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Have an advisor verify this', icon: 'shield-check', analyticsId: 'chip_resale_verify', priority: 1, payload: { text: 'I want an advisor to help verify a resale flat' } },
      ],
      missingFields: [],
      confidence: 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'FINANCE', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
