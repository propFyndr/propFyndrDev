/**
 * The reply sent when every provider leg has failed.
 *
 * It lives in its own leaf module because two unrelated places need to agree on
 * it: `fallbackChain` writes it, and `chipPolicy` has to recognise it so the
 * turn does not offer shortcuts on top of an outage. Importing one from the
 * other would close a cycle (fallbackChain -> discovery -> chipPolicy), and a
 * copy in each would drift the first time the wording changed.
 *
 * Measured before this existed: on a fully degraded turn the buyer saw
 * "I couldn't get you a reliable answer just now" followed by a row of chips
 * — "Compare these 3", "What are the trade-offs?" — offering to do more of
 * exactly the thing that had just failed. The card was already suppressed for
 * this case; the chips were not, because `chipsAreWelcome` only knew how to
 * recognise an answer that DECLINED something, and an outage notice does not
 * read like a refusal.
 */
export const OUTAGE_NOTICE =
  "I couldn't get you a reliable answer just now — our AI service is briefly unavailable, " +
  "and I'd rather say so than guess.\n\n" +
  'Ask me again in a moment, or use **Book Site Visit** or **Callback** and our advisory team ' +
  'will pick it up directly.'

/**
 * A fragment distinctive enough to spot the notice inside a longer transcript,
 * and stable enough not to break if the trailing handoff sentence is reworded.
 */
const OUTAGE_FINGERPRINT = "couldn't get you a reliable answer"

/** True when this text is (or contains) the outage notice. */
export function isOutageNotice(text: string | undefined | null): boolean {
  if (!text) return false
  return text.includes(OUTAGE_FINGERPRINT)
}

/**
 * The token event that delivers the notice. When part of an answer is already
 * on screen (a leg died mid-reply and no leg finished it), `replace` tells the
 * client to swap that fragment for the notice instead of appending to it.
 */
/**
 * What to show instead of the notice when code already answered the turn.
 *
 * Day 7 corpus (26 Oct): 21 of 23 failures were "best …" questions where the
 * ranking table or the cards were already on screen, and the stalled model
 * chain appended "our AI service is briefly unavailable" under them. The rows
 * were the answer; only the prose failed. Null when nothing was shown.
 */
export function outageOverShownAnswer(shownBefore: string, cardsShown: number, rowsAnswer = ''): string | null {
  // With cards, the row-written search summary (searchSummary) is the answer a plain search gets.
  if (cardsShown > 0)
    return `${shownBefore}${rowsAnswer || "The projects that match are on the cards above. Tell me which one to open up, or what matters most (budget, possession, metro) and I'll narrow them down."}`
  if (shownBefore.trim())
    return `${shownBefore}Ask me about any project in this table, or tell me your budget and BHK and I'll narrow it down.`
  return null
}

export function outageTokenEvent(partialShown: boolean): { token: string; replace?: true } {
  return partialShown ? { token: OUTAGE_NOTICE, replace: true } : { token: OUTAGE_NOTICE }
}
