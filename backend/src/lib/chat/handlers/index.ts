import type { ChatTopicHandler } from '../handlerContext'
import { commuteShortlistHandler } from './commuteShortlist'
import { builderReputationHandler } from './builderReputation'
import { newcomerOrientationHandler } from './newcomerOrientation'
import { amenityLifestyleHandler } from './amenityLifestyle'
import { vicinityLookupHandler } from './vicinityLookup'
import { sectorComparisonHandler } from './sectorComparison'
import { paymentPlansHandler } from './paymentPlans'
import { costSheetHandler } from './costSheet'
import { reraVerificationHandler } from './reraVerification'
import { statutoryTaxHandler } from './statutoryTax'
import { possessionStatusHandler } from './possessionStatus'
import { connectivityHandler } from './connectivity'
import { totalOutflowHandler } from './totalOutflow'
import { unitConfigurationHandler } from './unitConfiguration'

/**
 * Topic handlers, in priority order — the first match wins.
 *
 * These are being lifted out of the ~3,900-line POST handler in chat-router.ts
 * one at a time. Order is preserved exactly as it was inline, because several
 * matchers overlap (a message can look like both a tax question and a cost
 * question) and the original sequence encodes which reading won.
 *
 * The long-term shape is that this list shrinks: each handler is deleted once
 * the generic gateway path answers its topic as well or better, verified by a
 * test per removal. The registry is the mechanism for retiring them safely, not
 * a place to keep adding to.
 *
 * Extracted so far — all three were rewritten in the process, each for a reason
 * recorded in its own file:
 *   rera_verification   sent buyers to up-rera.in, which rule 17 forbids
 *   statutory_tax       had every UP rate typed in as a literal
 *   possession_status   defaulted to Sector 76, and fabricated a table row
 *
 * Also extracted:
 *   total_outflow       computed a full cost breakdown from an invented ₹1.35 Cr
 *   connectivity        printed identical commute figures for every project
 *   unit_configuration  read a column that does not exist, so every balcony
 *                       count ever shown was derived from the bedroom count
 *
 * Still inline in chat-router.ts: builder reputation, sector orientation,
 * amenities, sector compare, payment plans, cost sheet,
 * project detail, open-query lane.
 *
 * Deleted, not extracted:
 *   citywide_query      1,829 lines, 31 regex arms, second in priority. It
 *                       claimed 75 of the 321-query corpus (23.4%) on message
 *                       wording alone, with no context - so nearly a quarter of
 *                       every answer this product gave was hardcoded prose that
 *                       no guard could see. checkAnswerIntegrity runs inside
 *                       fallbackChain and nowhere else; a handler writing its
 *                       own strings is invisible to it by construction.
 *                       Three of its branches had already been removed this
 *                       week for inventing a builder league table, an
 *                       investment CAGR, and a branch that crashed on a missing
 *                       operator. The remaining twenty-eight were the same
 *                       shape and unaudited. Those turns now go to the generic
 *                       path, which reads the database and passes the gate.
 */
export const CHAT_TOPIC_HANDLERS: readonly ChatTopicHandler[] = [
  // First, deliberately. A stated workplace is the strongest signal a turn can
  // carry — it converts an open search into a commute-ranked one — and it only
  // matches while no sector has been chosen yet, so it cannot shadow the
  // ordinary sector and project paths once the buyer has picked a belt.
  commuteShortlistHandler,
  builderReputationHandler,
  newcomerOrientationHandler,
  vicinityLookupHandler,
  amenityLifestyleHandler,
  sectorComparisonHandler,
  paymentPlansHandler,
  costSheetHandler,
  reraVerificationHandler,
  statutoryTaxHandler,
  possessionStatusHandler,
  totalOutflowHandler,
  connectivityHandler,
  unitConfigurationHandler,
]

export {
  vicinityLookupHandler,
  commuteShortlistHandler,
  reraVerificationHandler,
  statutoryTaxHandler,
  possessionStatusHandler,
  totalOutflowHandler,
  connectivityHandler,
  unitConfigurationHandler,
}
