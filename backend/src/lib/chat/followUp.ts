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
