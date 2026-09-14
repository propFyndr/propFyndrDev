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
