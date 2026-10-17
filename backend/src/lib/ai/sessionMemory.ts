/**
 * Phase 0: Session Memory Store
 * Hydrates and persists conversation intent across turns
 *
 * ⚠️ DB-SAFE: Reads only. Writes via UPSERT with transaction safety.
 */

import { prisma } from '../db'
import type { Intent } from '../discovery'
import { normalizeRequirementState, RequirementStateSchema, type RequirementState } from '../discovery/requirementState'

/**
 * A field's stated values in order, with consecutive repeats collapsed.
 *
 * Six entries is plenty: it answers "my first", "my original" and "before that"
 * without turning session memory into an audit log.
 */
function appendRevision<T>(history: T[] | undefined, value: T | undefined | null): T[] | undefined {
  if (value === undefined || value === null) return history
  const prev = history ?? []
  if (prev.length > 0 && prev[prev.length - 1] === value) return prev
  return [...prev, value].slice(-6)
}

export async function getSessionMemory(sessionId: string) {
  try {
    const memory = await prisma.sessionMemory.findUnique({
      where: { session_id: sessionId },
    })
    return memory
  } catch (err) {
    console.error(`[SESSION-MEMORY:GET] Error for session ${sessionId}:`, err)
    return null
  }
}

/**
 * Hydrate intent from session memory
 * Used at turn start to restore user preferences
 */
/**
 * "in greater noida", "any area", "anywhere": the buyer widened the search to a
 * whole area, so an old sector must not come back. Live session ed1ac3ff (17 Oct
 * 2026): "3 bhk in greater noida within 1.5cr" kept "Sector 10" and a stale
 * ₹2.5 Cr floor, returned no cards, and the model told the buyer we hold no 3 BHK
 * under ₹1.5 Cr in Greater Noida - three times.
 */
const WHOLE_AREA = /\b(?:any\s*(?:area|where|sector|location|locality)|anywhere|all\s+(?:sectors|areas)|(?:in|across)\s+(?:greater\s+noida(?:\s+west)?|noida\s+extension|gnw|central\s+noida|noida)(?![\s,]+sector))\b/i

export async function hydrateIntentFromMemory(
  sessionId: string,
  currentIntent: Intent,
  message = '',
): Promise<Intent> {
  const memory = await getSessionMemory(sessionId)
  if (!memory?.extracted_intent) return currentIntent

  const stored = memory.extracted_intent as Partial<Intent>

  // Merge: stored intent as fallback, current intent overrides
  return reconcileIntent({
    ...currentIntent,
    // Only fill gaps in current intent. The budget survives a sector change:
    // moving the search to another sector does not change what the buyer can
    // spend, and dropping it made "still within your 1.5cr" impossible the
    // moment they looked elsewhere. A new figure this turn still overrides.
    bhk: currentIntent.bhk ?? stored.bhk,
    sector: currentIntent.sector ?? (WHOLE_AREA.test(message) ? undefined : stored.sector),
    // A stored floor at or over this turn's ceiling is superseded, not restored
    // (the session above ended with a 2.5 floor and a 1.5 ceiling at once).
    budgetMin: currentIntent.budgetMin
      ?? (currentIntent.budgetMax != null && stored.budgetMin != null && stored.budgetMin >= currentIntent.budgetMax ? undefined : stored.budgetMin),
    // A stored ceiling at or under this turn's floor ("2.5 cr+") is superseded, not restored.
    budgetMax: currentIntent.budgetMax
      ?? (currentIntent.budgetMin != null && stored.budgetMax != null && stored.budgetMax <= currentIntent.budgetMin ? undefined : stored.budgetMax),
    purpose: currentIntent.purpose ?? stored.purpose,
    possession: currentIntent.possession ?? stored.possession,
    // The workplace is stated once and matters for the rest of the
    // conversation, so it has to survive every later turn.
    //
    // `extracted_intent` is written whole, so these were already being
    // persisted — this function just never read them back, and the list above
    // is an explicit allowlist rather than a spread. A buyer who said "my
    // office is in Sector 63" on turn 7 had lost it by turn 8, which is the
    // turn that asks for the shortlist.
    //
    // Like budget, a workplace is NOT reset when the sector changes: moving
    // the search from one belt to another does not move where they work.
    workplace: currentIntent.workplace ?? stored.workplace,
    workplace_belt: currentIntent.workplace_belt ?? stored.workplace_belt,

    /**
     * Lifestyle preferences last as long as the workplace does.
     *
     * Measured: "i want a peaceful low density area, 3bhk under 2cr" extracted
     * `lifestyleKeywords` on turn 1, and by turn 2 — "yes show me the
     * shortlist" — it was `undefined`. So did "a happening area with nightlife
     * and cafes" and "with a mall nearby". All three then produced the
     * identical answer: the same micro-market price table. Three different
     * buyers, three different needs, one output.
     *
     * The cause is this function being an explicit allowlist rather than a
     * spread — the same reason the workplace was being lost. A buyer states a
     * preference once and expects it to hold.
     */
    /**
     * Where the buyer's stated constraints have BEEN, not just where they are.
     *
     * Measured: "let's stick to my very first budget… what was my first budget
     * again?" was answered "Your maximum budget recorded in our system is ₹1.4
     * Cr". The first was ₹1.8 Cr; ₹1.4 Cr was the second. Intent holds one
     * current value per field, so any question about what CHANGED — first,
     * original, earlier, before — has nothing to read.
     *
     * Appended here rather than in the router because this is the one function
     * that sees the stored value and the new one together. Capped: a revision
     * log is context, not an archive.
     */
    // Carried through only. The append happens in the router, where intent is
    // final: this function runs in parallel with extraction and therefore sees
    // the PREVIOUS turn's values, so appending here lagged the log by one turn
    // and "what was my first budget" read back the second one.
    budgetHistory: currentIntent.budgetHistory ?? stored.budgetHistory,
    sectorHistory: currentIntent.sectorHistory ?? stored.sectorHistory,
    lifestyleKeywords: currentIntent.lifestyleKeywords ?? stored.lifestyleKeywords,
    // Added to Intent without being added here, it would silently stop surviving a
    // turn (the same way workplace and lifestyleKeywords once did).
    facing: currentIntent.facing ?? stored.facing,
    areaMin: currentIntent.areaMin ?? stored.areaMin,
    areaMax: currentIntent.areaMax ?? stored.areaMax,
    riskProfile: currentIntent.riskProfile ?? stored.riskProfile,
    journeyStage: currentIntent.journeyStage ?? stored.journeyStage,
  }, message)
}

const FLOOR_PHRASE = /\d\s*(?:cr|crore|l|lakh)?\s*\+|\b(?:above|over|onwards|more than|at least|minimum|starting|and above|or more)\b/i

/**
 * The merged intent must be one a search can satisfy.
 *
 * The extractor carries earlier fields forward on its own, so restoring less
 * from memory was not enough: live transcript rerun 3 (17 Oct 2026) still held a
 * 2.5 floor with a 1.5 ceiling, "Sector 78" with Sector 78 also excluded and the
 * buyer saying "in greater noida" - zero results, "no 3 BHK under 1.5 Cr", twice.
 */
export function reconcileIntent(intent: Intent, message = ''): Intent {
  const out = { ...intent }
  if (out.budgetMin != null && out.budgetMax != null && out.budgetMin > out.budgetMax) {
    // Keep what this message asked for: a floor phrase keeps the floor, else the ceiling wins.
    if (FLOOR_PHRASE.test(message)) out.budgetMax = undefined
    else out.budgetMin = undefined
  }
  const excluded = (out as { excludeSectors?: string[] }).excludeSectors ?? []
  const sectorExcluded = typeof out.sector === 'string' && excluded.some((x) => out.sector!.toLowerCase().startsWith(x.toLowerCase()))
  if (sectorExcluded || (WHOLE_AREA.test(message) && !/\bsector[\s-]*\d/i.test(message))) out.sector = undefined
  return out
}

/**
 * Persist intent to session memory after each turn
 * Safe UPSERT: creates if missing, updates if exists
 */
export async function persistIntentToMemory(
  sessionId: string,
  userId: string | undefined,
  intent: Intent
) {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    })
    if (!session) return

    await prisma.sessionMemory.upsert({
      where: { session_id: sessionId },
      create: {
        session_id: sessionId,
        user_id: userId,
        extracted_intent: intent as any,
      },
      update: {
        extracted_intent: intent as any,
        updated_at: new Date(),
      },
    })
  } catch (err) {
    console.error(`[SESSION-MEMORY:PERSIST] Error for session ${sessionId}:`, err)
    // Silent fail — memory is nice-to-have, not blocking
  }
}

/**
 * Hydrate RequirementState from session memory and fold in the current turn.
 *
 * Mirrors hydrateIntentFromMemory's role (read the prior snapshot, combine with
 * this turn) but does NOT hand-write a field-by-field allowlist the way that
 * function does. hydrateIntentFromMemory shipped a real bug precisely because
 * of that shape: workplace and lifestyleKeywords were added to Intent without
 * being added to the allowlist, and silently stopped surviving a turn. Instead,
 * the merge is delegated entirely to normalizeRequirementState's own
 * effectivePrevState logic, which is already written field-by-field against
 * every sub-object (location, budget, unit, preferences, control) and was
 * simply never given a real previous state to merge against — the call site
 * in chat-router.ts only ever passed 2 of its 4 parameters.
 *
 * ponytail: no multi-entry history yet (prevStateHistory is always []), so
 * "go back to the original budget" (BACKTRACK against >1 turn back) still only
 * works when the budget figure is restated in the same message. Add a bounded
 * history array (same pattern as appendRevision above) if that's ever needed.
 */
/**
 * Pure: validates a raw stored JSON value against the current RequirementState
 * schema. Separated from hydrateRequirementStateFromMemory so the
 * schema-drift fallback (an older stored shape that no longer validates)
 * is unit-testable without a database.
 */
export function parseStoredRequirementState(raw: unknown, sessionIdForLogging = 'unknown'): RequirementState | undefined {
  if (!raw) return undefined
  const parsed = RequirementStateSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  console.warn(`[SESSION-MEMORY:REQSTATE] Stored state failed schema validation for session ${sessionIdForLogging}, ignoring it`, parsed.error.issues)
  return undefined
}

export async function hydrateRequirementStateFromMemory(
  sessionId: string,
  currentTurnText: string,
  currentIntent: Partial<Intent> = {},
): Promise<RequirementState> {
  const memory = await getSessionMemory(sessionId)
  const storedState = parseStoredRequirementState(memory?.requirement_state, sessionId)
  return normalizeRequirementState(currentTurnText, currentIntent, storedState, [])
}

/**
 * Persist RequirementState to session memory after each turn.
 * Safe UPSERT: creates if missing, updates if exists. Mirrors
 * persistIntentToMemory's error-handling posture exactly — this is
 * nice-to-have memory, not a blocking write.
 */
export async function persistRequirementStateToMemory(
  sessionId: string,
  userId: string | undefined,
  requirementState: RequirementState,
) {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    })
    if (!session) return

    await prisma.sessionMemory.upsert({
      where: { session_id: sessionId },
      create: {
        session_id: sessionId,
        user_id: userId,
        requirement_state: requirementState as any,
      },
      update: {
        requirement_state: requirementState as any,
        updated_at: new Date(),
      },
    })
  } catch (err) {
    console.error(`[SESSION-MEMORY:PERSIST-REQSTATE] Error for session ${sessionId}:`, err)
    // Silent fail — memory is nice-to-have, not blocking
  }
}

/**
 * Track property reactions in session memory
 * Called when user shows interest/rejection signals
 * DEFENSIVE: Checks session exists before update to prevent FK violations
 */
export async function trackPropertyReaction(
  sessionId: string,
  projectId: string,
  sentiment: 'interested' | 'concerned' | 'rejected',
  signals: string[] = []
) {
  try {
    // Defensive: verify session exists first
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    })
    if (!session) {
      console.warn(`[SESSION-MEMORY:REACTION] Session ${sessionId} not found, skipping reaction track`)
      return
    }

    const memory = await getSessionMemory(sessionId)
    const reactions = (memory?.property_reactions as any[] | null) ?? []

    // Remove if exists, re-add with new sentiment
    const filtered = reactions.filter((r: any) => r.projectId !== projectId)
    const updated = [
      ...filtered,
      {
        projectId,
        sentiment,
        signals,
        timestamp: new Date().toISOString(),
      },
    ]

    await prisma.sessionMemory.update({
      where: { session_id: sessionId },
      data: {
        property_reactions: updated,
        updated_at: new Date(),
      },
    })
  } catch (err) {
    console.error(`[SESSION-MEMORY:REACTION] Error for session ${sessionId}:`, err)
  }
}

/**
 * Get property reactions for display/export
 */
export async function getPropertyReactions(sessionId: string) {
  const memory = await getSessionMemory(sessionId)
  return (memory?.property_reactions as any[] | null) ?? []
}
