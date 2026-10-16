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

/** A new subject in this message: a place, a builder search, or a list request. */
const NEW_SUBJECT =
  /\b(sector\s*\d+|expressway|greater\s*noida|noida\s*extension|central\s*noida|projects\s*by|(?:show|find)\s+me\s+(?:\w+\s+){0,3}(?:projects|flats|apartments|options|societies)|list\s+(?:all|the)\s+projects|projects\s+(?:in|near)|flats\s+in|options\s+in)\b/i

const ATTRIBUTE =
  /\b(this\s+project|the\s+project|payment\s*plans?|floor\s*plans?|cost\s*sheets?|charges|construction|possession|handover|rera|who\s+is|amenit(?:y|ies)|layouts?|bhk\s*sizes|sizes?|carpet|super\s*area|configurations?|specifications?|specs|flooring|fittings|builder|developer|track\s*record|price\s+(?:history|trend)|prices?\s+(?:gone|go|went|increase|risen)|appreciation|nearest\s+metro|metro\s+station|connectivity|how\s+far\s+is|similar\s+projects?|competitors?|compare\s+it|total\s+cost|stamp\s+duty|emi|loan)\b/i

/** Pronouns that point at the project on screen. */
const FOCUS_PRONOUN = /\b(it|its|this|that|they|them|their)\b/i

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
