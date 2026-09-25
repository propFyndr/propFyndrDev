// backend/src/lib/chat/focusCarry.ts
//
// Does this turn keep talking about the project we were talking about?
//
// This replaced a forty-alternative regex (`ATTRIBUTE_FOLLOWUP`) that listed
// every noun a buyer might ask about. A whitelist of phrasings loses by
// construction: the ways to ask about a thing are unbounded, so every phrasing
// nobody enumerated dropped the subject silently and answered about Noida in
// general one message after the buyer was shown a building.
//
// The complement is small and already computed upstream. A turn brings its own
// subject when it names a location, names a builder, or asks for a list — all
// of which set `clearPersistedFocus` in chat-router before this runs. Anything
// else is still about the thing on the buyer's screen.

/**
 * A greeting is not a question about anything.
 *
 * The old whitelist excluded these for free by never matching them. Under a
 * default-carry rule they would hand a downstream handler a subject for
 * "thanks", which is how an acknowledgement becomes an unasked-for cost sheet.
 */
const BARE_COURTESY =
  /^\s*(hi|hey|hello|thanks?|thank\s*you|ok(ay)?|cool|got\s*it|sure|yes|no|yeah|nope|great|nice|hmm+)\b[\s.!,]*$/i

/** A sector NAMED IN THIS MESSAGE is a new subject; a sticky one is not. */
const NAMES_SECTOR = /\bsector\s*\d/i

export interface FocusCarryInput {
  /** The buyer's raw message, as typed. */
  message: string
  /** Did intent extraction find a project name in THIS message? */
  namesProjectThisTurn: boolean
  /** Did an upstream gate already judge this turn a fresh search? */
  clearPersistedFocus: boolean
  /** Is there a project to carry at all? */
  hasFocus: boolean
}

export function shouldCarryFocus(input: FocusCarryInput): boolean {
  if (!input.hasFocus) return false
  // The buyer named a project themselves — that one wins, not the old one.
  if (input.namesProjectThisTurn) return false
  if (input.clearPersistedFocus) return false
  if (NAMES_SECTOR.test(input.message)) return false
  if (BARE_COURTESY.test(input.message)) return false
  return true
}
