// backend/src/lib/discovery/chipPolicy.ts
//
// When chips are welcome, and when silence is the better answer.
//
// Chips scored 4.4/10 across a 29-turn adversarial run — the weakest surface in
// the product. On eleven of those turns they related to neither the question nor
// the answer. Two examples set the rules below:
//
//   * A buyer alleging their booking token had been taken and their calls
//     ignored was offered "Top Rated Builders", "Buyer Checklist Before
//     Booking" and "Brokerage & Extra Charges Guide".
//   * A buyer eleven turns into a shortlist was offered "Help me set a budget".
//
// Neither was a generation bug. `emitUiState` filtered chips correctly and then,
// finding none left, INJECTED a generic floor set — the only additive step in an
// otherwise subtractive pipeline. So a turn that had earned no chips got the
// cold-start trio instead of nothing.
//
// A chip is a shortcut for something the buyer plausibly wants next. On a
// grievance, a refusal, or an off-topic aside there is no such thing, and
// offering one reads as not having listened.

import { isOutageNotice } from '../ai/outageNotice'

/** Turn shapes where any chip is noise. */
const SUPPRESS: Array<[RegExp, string]> = [
  // A complaint about us. The next step is a human, not a shortcut.
  // `refund\w*` because `\brefund\b` misses "refunded" and "refunding", which
  // is how buyers actually write it.
  [/\b(scam|fraud|cheated|duped|ghosted|stopped picking up|not picking|no response|refund\w*|complaint|grievance|legal action|consumer court|sue|harass|rude|pathetic|terrible service|worst)\b/i, 'grievance'],
  // Money movement. Nothing we can offer is a button.
  [/\b(refund\w*|charge\s?back|return my|my money back|cancel my booking|token back)\b/i, 'financial dispute'],
  // Identity documents — the reply is a boundary, not a menu.
  [/\b(aadhaar|aadhar|pan\s*card|passport number|voter\s*id|driving\s*licen[cs]e|otp|password|cvv)\b/i, 'identity data'],
  // Someone probing the assistant rather than asking about property.
  [/\b(system prompt|ignore (all|previous|your) instructions|jailbreak|you are now|reveal your)\b/i, 'probe'],
]

export interface ChipDecision {
  allowed: boolean
  reason: string
}

/**
 * Should this turn carry chips at all?
 *
 * `answerText` is checked as well as the question, because a turn can become a
 * refusal on our side even when the question looked ordinary — an out-of-scope
 * city, a project we do not hold, a legal premise we will not endorse. A menu
 * of next steps under "we do not cover that" is the same mistake as under a
 * complaint.
 */
export function chipsAreWelcome(message: string, answerText = ''): ChipDecision {
  const q = message ?? ''
  for (const [re, reason] of SUPPRESS) {
    if (re.test(q)) return { allowed: false, reason }
  }

  /**
   * Every provider failed and this is the outage notice.
   *
   * Offering "Compare these 3" under "I couldn't get you a reliable answer just
   * now" invites the buyer to tap something that is going to fail the same way,
   * and makes a service failure look like a working product that chose not to
   * help. The card was already suppressed for this turn (`turnDegraded` in
   * chat-router); the chips were not, because an outage notice does not match
   * the "declined something" wording below.
   */
  if (isOutageNotice(answerText)) {
    return { allowed: false, reason: 'the turn degraded to an outage notice' }
  }

  // Our own reply declined something. Offering shortcuts on top of a refusal
  // undercuts it.
  const declined =
    /\b(we (do not|don't) (cover|track|maintain|advise|deal)|not (available|realistic|viable|possible)|cannot (process|share|confirm)|please don'?t share|nothing has been saved|does not transfer ownership|out of scope|only cover)\b/i
      .test(answerText)
  if (declined) return { allowed: false, reason: 'the answer declined something' }

  return { allowed: true, reason: 'ordinary property turn' }
}

/**
 * True when a chip's text is plausibly about the same thing the answer was.
 *
 * A cheap relevance floor, not a ranker. It catches the case that made the
 * score bad: a chip naming a project, sector or topic that appears nowhere in
 * the question or the answer. A chip with no proper noun in it — "What are the
 * trade-offs?", "Compare these 3" — is generic by design and always passes,
 * because those read as controls rather than claims.
 */
export function chipIsRelevant(
  label: string,
  message: string,
  answerText: string,
  entities: readonly string[] = [],
): boolean {
  const text = label ?? ''
  const haystack = `${message} ${answerText}`.toLowerCase()

  // A sector is a hard reference: if the chip names one, the turn has to have
  // named it too.
  const sectors = text.match(/Sector\s+\d+[A-Za-z]?/gi) ?? []
  if (sectors.length) {
    return sectors.some(s => haystack.includes(s.toLowerCase().replace(/\s+/g, ' ')))
  }

  /**
   * Otherwise: does the chip name a PROJECT the turn never mentioned?
   *
   * The previous version tested every word of four letters or more against a
   * stop-word list, and the stop-word list could not be finished. Measured on a
   * project drilldown: "View Floor Plans" and "View Cost Sheet & Taxes" were
   * both discarded because "View" is not in the answer text — a chip taking the
   * buyer to a table we had already built, hidden for containing an ordinary
   * verb. Only "Schedule Site Visit" survived, and only because all three of
   * its words happened to be listed.
   *
   * This is the same shape as the fabrication guard's own history: a blocklist
   * of words that must not appear is unfinishable, and every gap in it discards
   * something honest. Ask what a name IS instead. `entities` is the project
   * vocabulary we actually hold, so a token is only treated as a claim when it
   * is genuinely part of a project name. Everything else — verbs, UI nouns,
   * whatever a future chip says — passes untouched.
   *
   * With no vocabulary loaded the chip passes. Showing a chip is recoverable;
   * hiding a good one is invisible.
   */
  const entityWords = new Set<string>()
  for (const name of entities) {
    for (const w of name.match(/[A-Za-z][A-Za-z']{3,}/g) ?? []) {
      // "Heights", "Greens" and "Estate" belong to a dozen project names each,
      // so they identify no particular one and must not gate a chip.
      if (!GENERIC_PROJECT_WORD.test(w)) entityWords.add(w.toLowerCase())
    }
  }
  if (entityWords.size === 0) return true

  const claimed = (text.match(/[A-Za-z][A-Za-z']{3,}/g) ?? [])
    .map(w => w.toLowerCase())
    .filter(w => entityWords.has(w))
  if (!claimed.length) return true // no entity claim to check

  // One word in common is enough: "Mahagun Meadows" against "Mahagun" is the
  // same subject, and chip labels are too short to demand more.
  return claimed.some(w => haystack.includes(w))
}

/** Words shared across many project names, so they identify none of them. */
const GENERIC_PROJECT_WORD =
  /^(heights?|greens?|estate|vista|park|parkway|city|towers?|residency|residences?|homes?|garden|gardens|county|enclave|apartments?|society|villas?|court|grand|royal|palm|palms|the|and|group|projects?|infra|buildwell|builders?|developers?|limited|private|corp|corporation)$/i

/**
 * Can this chip actually do anything right now?
 *
 * `chipIsRelevant` asks whether a chip is about the right SUBJECT. That misses
 * the other half: a chip can be perfectly on-topic and still lead nowhere.
 * "Compare these 3" with two cards on screen, "Calculate monthly EMI" before
 * any price is known, "Payment plan for…" with no project in scope — each is
 * about property, each passes a topic check, and each takes the buyer to a dead
 * end or to a question they have to answer first.
 *
 * A chip is a shortcut. A shortcut to a prompt for more input is not one.
 */
export interface ChipContext {
  /** Cards rendered on this turn. */
  cardCount: number
  /** True when a single project is in scope. */
  hasProject: boolean
  /** True when a budget or a price band is known. */
  hasBudget: boolean
  /** True when a sector or workplace has been established. */
  hasLocation: boolean
}

export function chipIsActionable(label: string, ctx: ChipContext): boolean {
  const l = (label ?? '').toLowerCase()

  // "Compare these N" needs at least N things to compare.
  if (/\bcompare\b/.test(l)) {
    const named = /\bcompare\s+(?:these\s+)?(\d+)/.exec(l)
    const needed = named ? Number(named[1]) : 2
    if (ctx.cardCount < Math.max(2, needed)) return false
  }

  // A money calculation needs a number to calculate from.
  if (/\b(emi|loan|affordab|monthly outgo|instal)/.test(l) && !ctx.hasBudget && !ctx.hasProject) return false

  // Project-scoped actions need a project, or at least cards to pick from.
  if (/\b(payment plan|cost sheet|floor plan|site visit|brochure|full cost|rera status)\b/.test(l)
    && !ctx.hasProject && ctx.cardCount === 0) return false

  // "Explore NEARBY sectors" means nothing before anywhere has been named —
  // nearby to what? But "Explore top Noida sectors" is an entry point and is
  // exactly right on an opening turn, so bare `explore` must not be in here.
  // Including it left a greeting with no chips at all.
  if (/\b(nearby|other|alternative|adjacent|similar)\b[^.]*\b(sector|area|option)/.test(l)
    && !ctx.hasLocation && ctx.cardCount === 0) return false

  return true
}
