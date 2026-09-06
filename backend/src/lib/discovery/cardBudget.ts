// backend/src/lib/discovery/cardBudget.ts
//
// How many project cards this turn has earned.
//
// Measured across four 15-turn production runs: 17 to 20 cards were emitted on
// nearly every discovery turn, regardless of whether the buyer had narrowed
// anything. "my budget would be 2cr max" — the second constraint they had given
// — produced nineteen. So did "how much would the EMI be" and "i want to visit
// this weekend", neither of which is a request for inventory at all.
//
// Nineteen cards is not a shortlist, it is a directory, and a directory is what
// this product exists not to be. The Gemini transcript the flow was compared
// against never shows more than four options at once, and groups them with a
// reason each.
//
// The cap is derived from how much the buyer has actually told us, because that
// is what makes a shortlist meaningful: three cards chosen from two constraints
// is a recommendation, and nineteen chosen from none is a filing cabinet.

import type { Intent } from './types'

/** The most cards any single turn may show. */
export const MAX_CARDS = 6

export interface CardBudget {
  limit: number
  reason: string
}

/**
 * Constraints the buyer has stated. Each one narrows the field enough that a
 * shortlist starts to mean something.
 *
 * `workplace` counts as a location: a stated office is a stronger locator than
 * a sector, because it also implies a ranking.
 */
function statedConstraints(intent: Intent): number {
  let n = 0
  if (intent.sector || intent.workplace) n += 1
  if (intent.bhk?.length) n += 1
  if (intent.budgetMax != null || intent.budgetMin != null) n += 1
  if (intent.possession) n += 1
  if (intent.lifestyleKeywords?.length) n += 1
  if (intent.purpose) n += 1
  return n
}

/**
 * A question about the conversation, not about property.
 *
 * "What did I ask you first?" was answered correctly — and with six project
 * cards under it, because by then two constraints were on the intent and the
 * budget only reads the intent. A question about what has been said is not a
 * request for inventory no matter how much the buyer has narrowed, and cards
 * beneath the answer make it look like a search result.
 */
const META_QUESTION =
  /\b(what (did|have) i (ask|say|tell|said|told)|what (do|did) you (know|remember|assume) about me|what have i told you|my (first|earlier|original|previous) (budget|question|sector|requirement)|summar(y|ise|ize)|recap|remind me what|so far)\b/i

/**
 * A question whose answer is a number, not a set of buildings.
 *
 * The card budget derived from stated constraints answers "how many", and it
 * fixed the nineteen-card directory dump. It does not answer "whether", and by
 * then two constraints are usually on the intent — so "how much would the EMI
 * be" went from nineteen cards to six, which is a smaller wrong answer.
 *
 * An EMI, a stamp duty figure or a GST rate is arithmetic. Cards under it are
 * not a shortlist; they are a search result stapled to a calculator, and the
 * buyer has to work out for themselves that the number does not describe them.
 *
 * Deliberately narrow: the words below cannot be an inventory ask. "What can I
 * afford" is not here, because that question genuinely ends in a shortlist.
 */
const CALCULATION =
  /\b(emi|instal?lments?|interest rate|down ?payment|stamp duty|registration (charge|fee|cost)|gst|loan (amount|tenure|eligibility)|monthly (payment|outgo))\b/i

/**
 * A question about what happens next, not about which building.
 *
 * "I want to visit this weekend" produced nineteen cards. The buyer had already
 * chosen; they were asking us to arrange something. Re-showing inventory at the
 * moment of commitment reads as a funnel, which is the thing the handoff is
 * explicitly not supposed to feel like.
 */
const LOGISTICS =
  /\b(site visit|visit (this|next|on|tomorrow|today)|book a? ?(visit|call)|call me|callback|contact (you|me|the builder)|whats ?app|paperwork|documents? (are |is )?(needed|required)|registry process)\b/i

export function cardBudgetFor(intent: Intent, message = ''): CardBudget {
  if (META_QUESTION.test(message)) {
    return { limit: 0, reason: 'a question about the conversation, not about inventory' }
  }
  if (CALCULATION.test(message)) {
    return { limit: 0, reason: 'the answer is a calculation, not a shortlist' }
  }
  if (LOGISTICS.test(message)) {
    return { limit: 0, reason: 'the buyer is arranging a next step, not browsing' }
  }

  // A project in focus: the cards are that project and at most a couple of
  // alternatives. A drilldown answered with six cards buries its own subject.
  if (intent.projectNames?.length) {
    return { limit: 3, reason: 'a project is in focus' }
  }

  const constraints = statedConstraints(intent)
  if (constraints >= 2) return { limit: MAX_CARDS, reason: `${constraints} constraints stated` }
  if (constraints === 1) return { limit: 4, reason: 'one constraint stated' }

  // Nothing stated. Cards here are a directory dump: the buyer cannot tell why
  // these and not others, which is the opposite of a recommendation. The
  // conversation should be asking for the first constraint instead.
  return { limit: 0, reason: 'nothing narrowed yet' }
}

/** Applies the budget to a payload, preserving order. */
export function capCards<T>(list: T[] | undefined, limit: number): T[] {
  if (!Array.isArray(list)) return []
  return limit <= 0 ? [] : list.slice(0, limit)
}
