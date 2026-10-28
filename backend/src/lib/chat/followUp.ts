// backend/src/lib/chat/followUp.ts
//
// Is this message a question about the project already in focus?
//
// Measured 2026-10-16 (scripts/corpus/followup-coverage.ts): after "Tell me
// about Prateek Laurel", "What payment plans do they offer?" lost the project,
// because the router's word list had `payment\s*plan\b` (no plural) and "they"
// was not a pronoun it knew. The answer was generic Noida plans, though the
// project's own plan is on record. Every attribute a buyer asks about on a
// follow-up is listed here, plurals included.
//
// The stress run of 16 Oct 2026 added the verdict, legal, OC, registry and
// price-per-sq-ft words: "What's the catch?" after "Tell me about Godrej Palm
// Retreat" was answered about another project or not at all.

/**
 * A new subject in this message: a place, a builder search, a list request, or
 * a market-wide question ("average price per sq ft in Noida").
 */
const NEW_SUBJECT =
  /\b(sector\s*\d+|expressway|greater\s*noida|noida\s*extension|central\s*noida|in\s+noida|noida\s+(?:me|mein)|average|across|overall|market\s+rate|city[- ]wide|projects\s*by|(?:show|find)\s+me\s+(?:\w+\s+){0,3}(?:projects|flats|apartments|options|societies)|list\s+(?:all|the)\s+projects|projects\s+(?:in|near)|flats\s+in|options\s+in)\b/i

const ATTRIBUTE =
  /\b(this\s+project|the\s+project|payment\s*plans?|floor\s*plans?|cost\s*sheets?|charges|construction|possession|handover|rera|who\s+is|amenit(?:y|ies)|layouts?|bhk\s*sizes|sizes?|carpet|super\s*area|configurations?|specifications?|specs|flooring|fittings|builder|developer|track\s*record|price\s+(?:history|trend)|prices?\s+(?:gone|go|went|increase|risen)|appreciation|nearest\s+metro|metro\s+station|connectivity|how\s+far\s+is|similar\s+projects?|competitors?|compare\s+it|total\s+cost|stamp\s+duty|emi|loan|catch|sales\s+team|price\s+fair|fair(?:ly)?\s+priced|over\s*priced|worth\s+(?:it|the\s+(?:money|price))|value\s+for\s+money|good\s+deal|litigation|legal|court|cases?|disputes?|nclt|insolvency|oc|occupancy|completion\s+certificate|registry|registration|sub[- ]?lease|payment\s+(?:options?|schedule|structure|terms)|down\s*payment|price\s+per\s+sq|per\s+sq\.?\s*ft|psf|rate\s+per|should\s+i\s+buy|buy\s+(?:here|it|this)|avoid\s+it|maintenance|water\s+(?:supply|source)|power\s+backup|parking|lifts?|delay(?:ed)?|on\s+track)\b/i

/** A search the message states itself: a BHK, a sector, an amount, a list request. */
const OWN_SEARCH = /\b\d\s*bhk\b|\bsector\s*\d|\d+(?:\.\d+)?\s*(?:cr|crores?|lakhs?|lacs?|l)\b|\b(?:show|find|list|suggest|recommend)\b/i

/**
 * A market-wide question with no search of its own: "Will property prices in
 * Noida double in 5 years?". The search carried from earlier turns (4BHK,
 * Sector 150, under ₹80 L) ran anyway, found nothing, and the answer ended with
 * that no-match line (stress run 3, 16 Oct 2026).
 */
export function asksMarketWide(message: string): boolean {
  return /\b(prices?|rates?|apprecia\w*|market|growth|returns?)\b/i.test(message) && NEW_SUBJECT.test(message) && !OWN_SEARCH.test(message)
}

const SLOT = /\bsector\s*\d+[a-z]?\b|\b\d\s*bhks?\b|\d(?:\.\d+)?\s*(?:cr|crores?|lakhs?|lacs?|l)\b/gi
const REFINE_FILLER = /\b(?:a|an|and|or|ok(?:ay)?|actually|then|what|how|about|in|budget|make|it|that|just|only|the|ones|show|me|under|below|above|over|upto|up|to|within|max(?:imum)?|min(?:imum)?|around|between|rs|inr)\b/gi

/**
 * Nothing but a revised slot: "1 cr", "Budget -2 cr", "what about Sector 150?",
 * "just the ones above 3.8 cr". The search the intent carries is the answer;
 * live (Oct 2026) each of these went to the model and waited 20–50 s.
 * A bare number with no unit ("30000") is not a slot: it may be rent or an EMI.
 * Nor is an amount answering our own ask for a price ("Tell me the property
 * price or your budget" from the EMI check): that figure belongs to the check.
 */
export function isBareRefinement(message: string, previousReply = ''): boolean {
  const text = message ?? ''
  if (!text.match(SLOT)) return false
  if (/\b(?:emi|cash[- ]flow|income|salary|rent|loan|quoted|asking|property price|seller|per sq)/i.test(previousReply)) return false
  return text.replace(SLOT, ' ').replace(REFINE_FILLER, ' ').replace(/[\s\d.,:?!₹\-–]+/g, '') === ''
}

/** Words that point at the project on screen. */
const FOCUS_PRONOUN = /\b(it|its|this|that|they|them|their|here|there)\b/i

/** An attribute question with no new subject: it is about the project in focus. */
export function asksAboutFocusAttribute(message: string): boolean {
  return ATTRIBUTE.test(message) && !NEW_SUBJECT.test(message)
}

export function mentionsFocusPronoun(message: string): boolean {
  return FOCUS_PRONOUN.test(message)
}

/**
 * The project a follow-up refers to, from what the session says is in focus.
 *
 * The router used to fall back to "the first card of the last list shown", so
 * after a sector table led with ACE Parkway, every later question in an ATS
 * Pious Hideaways conversation was answered about ACE Parkway. A list is not a
 * focus: only a single card, or the session's saved focus, counts.
 */
export function focusFallback<T extends { id: string; name: string }>(
  focusProjectId: string | null | undefined,
  catalog: readonly T[],
  lastCards: readonly { id: string; name: string }[] | null | undefined,
): { id: string; name: string } | null {
  const saved = focusProjectId ? catalog.find((p) => p.id === focusProjectId) : undefined
  if (saved) return { id: saved.id, name: saved.name }
  return lastCards && lastCards.length === 1 ? { id: lastCards[0].id, name: lastCards[0].name } : null
}

/**
 * A focus set aside for one turn, not ended.
 *
 * "How many projects has Godrej delivered in Noida?" between two questions
 * about Godrej Palm Retreat is a builder question; the next "what's the catch
 * with this project?" is still about Palm Retreat. The step-aside cleared the
 * project from the intent the next turn reads, and the follow-up went to the
 * model with no project (stress re-run, 16 Oct 2026). Parked on the intent,
 * restored by the next follow-up, dropped by a new search.
 */
export function parkFocus(intent: Record<string, unknown>, previous: Record<string, unknown> | null | undefined, keep: boolean): void {
  const name = (previous?.projectNames as unknown[] | undefined)?.[0] ?? (previous?.parkedFocus as { name?: unknown } | undefined)?.name
  if (keep && typeof name === 'string') {
    intent.parkedFocus = { name, id: previous?.targetProjectId ?? (previous?.parkedFocus as { id?: unknown } | undefined)?.id }
  } else {
    delete intent.parkedFocus
  }
}

export function parkedFocus(previous: Record<string, unknown> | null | undefined): { name?: string; id?: string } {
  const p = previous?.parkedFocus as { name?: unknown; id?: unknown } | undefined
  return { name: typeof p?.name === 'string' ? p.name : undefined, id: typeof p?.id === 'string' ? p.id : undefined }
}

export const BARE_YES = /^\s*(?:yes|yeah|yep|yup|sure|ok(?:ay)?|go on|go ahead|please do|do it|haan|ha)\b[\s,.!]*(?:(?:yes|please|sure|show(?: me| them)?|go ahead|do it|do that|now)[\s,.!]*){0,3}$/i
// The last alternative is our own either/or prompt: "I can search all of Noida instead of
// Sector 10, or look at 1 BHK: which would you like?" (live, 27 Oct 2026). "Okay" to it re-ran
// the same Sector 10 search because no offer was found, so the reply looped.
const OFFER = /\b(?:would|do|shall|should) you (?:like|want) (?:me )?to ([^?]{4,160})\?|\bwant me to ([^?]{4,160})\?|\bshall i ([^?]{4,160})\?|\bi can ([^?:]{4,160}?)\s*[:?]\s*which (?:would you like|do you prefer|one)/gi

/**
 * "yes" after an offer means the offer.
 *
 * Live session ed1ac3ff (17 Oct 2026): "Would you like me to show you options in
 * the ₹2.5 Cr+ range?" -> "yes please" -> the same no-match answer, four times,
 * because "yes" reached the router with no subject. The buyer's word is kept and
 * the offer appended, so the transcript still shows what they typed.
 */
export function expandAffirmation(message: string, history: ReadonlyArray<{ role: string; content: string }>): string {
  if (!BARE_YES.test(message ?? '')) return message
  const last = [...history].reverse().find((m) => m.role === 'assistant')?.content ?? ''
  const offers = [...last.matchAll(OFFER)].map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4]).trim())
  const offer = offers[offers.length - 1]
  if (!offer) {
    // "Are you looking to move in immediately?" -> "yes": the question carries the
    // meaning ("2 bhk… yes" was read with no subject and the model improvised).
    const question = /([^.?!\n]{6,200}\?)[^?]*$/.exec(last.replace(/\*+/g, ''))?.[1]?.trim()
    return question ? `${message.trim()} (answering: ${question})` : message
  }
  // "show you X, or explore Y" -> the first option is what "yes" accepts.
  const first = offer.split(/,?\s+or\s+/i)[0]
    .replace(/\byou\b/gi, 'me').replace(/\byour\b/gi, 'my').trim()
  return `${message.trim()} (${first})`
}
