import type { ChatTopicHandler } from '../handlerContext'
import { UP_STATUTORY, NOIDA_MARKET_RANGES, MARKET_QUALIFIER } from '../../factPresentation'
import { femaleStampDutySaving } from './totalOutflow'
import { quotedAmountCr } from './priceFairness'

/**
 * "How much stamp duty on a 1.5 cr flat for a woman buyer" got the rate table
 * and no number. When the buyer gives an amount, the arithmetic leads; these
 * are statutory rates, so computing on their figure is not a guess.
 */
export function computedOnAmount(message: string): string {
  const amountCr = quotedAmountCr(message)
  if (!amountCr) return ''
  const s = UP_STATUTORY
  const v = Math.round(amountCr * 1_00_00_000)
  const stamp = Math.round(v * s.stampDutyPct / 100)
  const stampFemale = stamp - femaleStampDutySaving(v)
  const reg = Math.round(v * s.registrationPct / 100)
  const gstUc = Math.round(v * s.gstUnderConstructionPct / 100)
  const asksWoman = /\b(?:woman|women|female|wife|mother|daughter|lady|mahila)\b/i.test(message)
  const rows = [
    asksWoman
      ? `| Stamp duty, female primary owner (${s.stampDutyFemalePct}%) | **${inr(stampFemale)}** |\n| Stamp duty, male owner (${s.stampDutyPct}%) for comparison | ${inr(stamp)} |`
      : `| Stamp duty (${s.stampDutyPct}%) | **${inr(stamp)}** |\n| Stamp duty if a woman is primary owner (${s.stampDutyFemalePct}%) | ${inr(stampFemale)} |`,
    `| Registration (${s.registrationPct}%) | ${inr(reg)} |`,
    `| GST if under construction (${s.gstUnderConstructionPct}%) | ${inr(gstUc)} |`,
    `| GST if ready to move with OC | ₹0 |`,
  ]
  return `### On ₹${amountCr.toFixed(2)} Cr

| Charge | Amount |
| :--- | ---: |
${rows.join('\n')}

Stamp duty is charged on the agreement value or the circle rate, whichever is higher, so the figure above is the floor.${v > s.tdsThresholdInr ? ` You also deduct ${s.tdsPct}% TDS (${inr(Math.round(v * s.tdsPct / 100))}) from the payment to the seller and deposit it with Form 26QB.` : ''}

`
}

/** ₹ with Indian digit grouping. */
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

/** ₹50,00,000 reads better as "₹50 Lakh" in a rate table. */
const lakh = (n: number) => `₹${(n / 100_000).toLocaleString('en-IN')} Lakh`

/**
 * "What stamp duty / registration / GST do I pay in UP?"
 *
 * Every rate here is fixed by law and identical for every project, so this is
 * the one branch that may state figures without a project lookup — the
 * `statutory` tier in lib/factPresentation.ts.
 *
 * The rates were previously typed into the response as literals. They now come
 * from UP_STATUTORY, which is the single documented place to update them when a
 * state budget changes; a table in a route handler is where a stale rate hides.
 * The budgeting percentages are market-typical rather than statutory, so they
 * carry the qualifier.
 */
export const statutoryTaxHandler: ChatTopicHandler = {
  id: 'statutory_tax',
  description: 'UP stamp duty, registration, GST and TDS rates',

  matches: ctx => ctx.flags.isStatutoryTaxQuery === true,

  handle: async ctx => {
    /**
     * Some buyers ask how to AVOID these, not what they are.
     *
     * Measured: "Can I buy a flat without paying stamp duty and registration if
     * the builder gives me a builder-buyer agreement on stamp paper?" got the
     * rate table below and nothing else. The table says "Mandatory" in a column,
     * which is not an answer — the buyer asked whether a specific arrangement
     * works, and silence on the premise reads as it working.
     *
     * This is the worst possible question to answer topically. An unregistered
     * agreement transfers no title, and a buyer who acts on that loses the flat
     * and the money. So the answer comes first, then the rates.
     */
    const asksHowToAvoid =
      /\b(without paying|avoid|avoiding|skip|skipping|escape|evade|not pay|don'?t pay|dodge|bypass|get around|save on)\b[^.?!]{0,40}\b(stamp|registration|registry|gst|tax)\b/i.test(ctx.message) ||
      /\b(stamp paper|notaris|notariz|unregistered|power of attorney|\bpoa\b|cash (?:deal|component|payment)|under[- ]?report|undervalu)\b/i.test(ctx.message)

    const avoidanceAnswer = asksHowToAvoid
      ? `**No — and the arrangement described does not transfer ownership.**

Stamp duty and registration are levies of the Uttar Pradesh government, not charges the builder can waive. A builder-buyer agreement on plain or notarised stamp paper is a contract to sell, not a title transfer: until the sale deed is registered and stamp duty paid, the flat is not legally yours. You would have no registered title to mortgage, sell or defend, and no protection if the same unit were sold to someone else.

What legitimately reduces the bill:
- Registering with a **female primary owner** — ${UP_STATUTORY.stampDutyFemalePct}% instead of ${UP_STATUTORY.stampDutyPct}%.
- Buying **ready-to-move with an Occupancy Certificate** — GST drops to ${UP_STATUTORY.gstReadyToMovePct}% from ${UP_STATUTORY.gstUnderConstructionPct}%, which on a ₹2 Cr flat is around ₹10 L.
- Valuing at the **circle rate** where it is genuinely lower than the agreement value; duty is charged on the higher of the two, so this only helps where the circle rate is above your price.

`
      : ''

    const text = `${avoidanceAnswer}${asksHowToAvoid ? '' : computedOnAmount(ctx.message)}### Statutory taxes & registration charges (Uttar Pradesh)

These are set by law and are the same for every project.

| Component | Rate | Nature | Paid when & to whom |
| :--- | :--- | :--- | :--- |
| **Stamp duty** | ${UP_STATUTORY.stampDutyPct}% of agreement or circle value, whichever is higher | Mandatory | At registry, to the UP Stamp & Registration Department |
| **Stamp duty — female primary owner** | ${UP_STATUTORY.stampDutyFemalePct}% | Concession | At registry |
| **Registration fee** | ${UP_STATUTORY.registrationPct}% of value | Mandatory | At deed execution, to the Sub-Registrar |
| **GST — under construction** | ${UP_STATUTORY.gstUnderConstructionPct}% (without input tax credit) | Statutory | Billed across construction milestones |
| **GST — ready to move with OC** | ${UP_STATUTORY.gstReadyToMovePct}% | Exempt | Not applicable once the Occupancy Certificate is granted |
| **TDS (Section 194-IA)** | ${UP_STATUTORY.tdsPct}% of sale consideration | Mandatory | Deducted by the buyer when value exceeds ${lakh(UP_STATUTORY.tdsThresholdInr)} (Form 26QB) |

### Budgeting
Allow ${NOIDA_MARKET_RANGES.allInclusiveLoadUnderConstructionPct} for an under-construction home, or ${NOIDA_MARKET_RANGES.allInclusiveLoadReadyToMovePct} for ready-to-move with OC, to cover statutory and possession charges — ${MARKET_QUALIFIER}.

Name a project and I'll use whichever of its own charges we hold verified.`

    const chips = [
      { id: `chip_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View cost sheet', icon: 'file-text', analyticsId: 'chip_cost', priority: 1, payload: { text: 'Show cost sheet and price breakdown' } },
      { id: `chip_emi_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Calculate monthly EMI', icon: 'calculator', analyticsId: 'chip_emi', priority: 2, payload: { text: 'Calculate EMI' } },
      { id: `chip_rtm_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Ready to move (${UP_STATUTORY.gstReadyToMovePct}% GST)`, icon: 'check-circle', analyticsId: 'chip_rtm_tax', priority: 3, payload: { text: 'Show ready to move flats in Noida' } },
    ]

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'Uttar Pradesh statutory rates:',
      chips,
      missingFields: [],
      // Statutory rates are verified; the budgeting band is market-typical and
      // is labelled as such in the body.
      confidence: 'MEDIUM',
    })
    ctx.send('done', {
      sessionId: ctx.sessionId,
      intentState: 'SHORTLISTED',
      intent: ctx.intent,
      responseMode: 'chat',
    })
    ctx.res.end()
  },
}
