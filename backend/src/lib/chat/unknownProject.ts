/**
 * What to say when a buyer names a project we do not hold.
 *
 * Three behaviours are possible and only one is acceptable:
 *
 *   1. Substitute. Show other projects and let the buyer assume their question
 *      was answered. This is what the code did — a `city contains 'Noida'`
 *      query, eight arbitrary rows printed under "Verified Projects Status",
 *      and a "Recommendation" naming two of them. It is the worst thing this
 *      product can do: the buyer leaves with an answer to a question they did
 *      not ask and no signal that it happened.
 *   2. Refuse flatly. Honest, but a dead end for someone who has heard a real
 *      project name we simply have not onboarded.
 *   3. Say we do not have it, then look — with what the web reports kept
 *      visibly separate from what we verify.
 *
 * This does (3), by delegating to runGroundedAnswer with an ENTITY detection.
 * That path already enforces the grounding contract we want: our own tables
 * first, live web only for the gap, every ungrounded sentence stripped before
 * the buyer sees it, and no raw URLs or provenance tags in the output. Writing
 * a second grounding path here would mean two sets of rules to keep honest.
 */

import { runGroundedAnswer } from '../ai/groundedAnswer'
import type { OpenQueryDetection } from '../discovery/openQuery'

export interface UnknownProjectReply {
  text: string
  /** True when live web results contributed — drives the confidence signal. */
  fromWeb: boolean
}

/**
 * A project name safe to send to a search provider.
 *
 * The raw message is the untrusted half of the turn and may carry an injected
 * instruction, so only the extracted name goes out, reduced to characters that
 * can appear in a real project name.
 */
export function sanitizeProjectName(raw: string): string | null {
  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s&'.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  // Two characters is not a project name; a bare number is a sector.
  if (cleaned.length < 3 || /^\d+$/.test(cleaned)) return null
  return cleaned
}

/** The honest dead end. Asks what they meant; never offers inventory instead. */
export function projectNotFoundReply(name: string): string {
  // "in our database" is the phrasing `rewriteFraming` strips from model
  // output. It only runs on the chain, so our own strings were exempt — and
  // this one shipped it. HARD RULE 7 applies to us too.
  return `I don't have a verified record for **${name}**.

Is that a project name, a builder, or a consultancy? Tell me which and what you wanted to know, and I'll check it properly rather than guess.`
}

export async function buildUnknownProjectReply(
  rawName: string,
  options: {
    city: string
    userId?: string | null
    sessionId?: string | null
    /** Injectable for tests — avoids a live provider and a network call. */
    ground?: typeof runGroundedAnswer
  },
): Promise<UnknownProjectReply> {
  const name = sanitizeProjectName(rawName)
  if (!name) return { text: projectNotFoundReply(rawName.slice(0, 40)), fromWeb: false }

  const detection: OpenQueryDetection = {
    topic: 'ENTITY',
    entity: name,
    reason: 'named project absent from the database',
  }

  const ground = options.ground ?? runGroundedAnswer
  let answer = null
  try {
    answer = await ground({
      message: `What is ${name} in ${options.city}? Who is the developer and what is its status?`,
      detection,
      city: options.city,
      userId: options.userId,
      sessionId: options.sessionId,
    })
  } catch (err) {
    console.warn('[UNKNOWN_PROJECT:GROUNDING_ERROR]', err)
  }

  /**
   * Nothing to ground on is a real outcome, not a failure to paper over — and
   * "the model wrote something" is not grounding.
   *
   * `fromWeb` is the only signal that a live source contributed. Without it the
   * paragraph below is the model's own recollection of a building it has never
   * heard of, which is exactly the input that produces confident fiction.
   * Measured: asked about an invented name, the reply described "a prominent
   * high-rise residential development ... developed by **Supertech Limited**, a
   * leading real estate firm with over thirty years of experience" — a building
   * that does not exist, credited to a developer HARD RULES forbids
   * recommending, with a compliment attached. The disclaimer above it does not
   * make that acceptable; a buyer who skims takes away the builder's name.
   *
   * So an ungrounded answer is discarded and the honest dead end is used
   * instead. It offers the advisory handoff, which is the useful thing we can
   * actually do for someone naming a project we have not onboarded.
   */
  if (!answer?.text?.trim()) {
    return { text: projectNotFoundReply(name), fromWeb: false }
  }
  if (!answer.fromWeb) {
    console.log('[UNKNOWN_PROJECT:UNGROUNDED_DISCARDED]', { name })
    return { text: projectNotFoundReply(name), fromWeb: false }
  }

  // The lead line is non-negotiable and must come before anything sourced from
  // the web, so the buyer reads "not ours" before they read the content.
  return {
    text: `**${name}** isn't in our verified database, so nothing below is checked by us.

${answer.text.trim()}

If you're seriously considering it, our advisory team can run a proper verification — RERA registration, promoter standing, registry status — and tell you what actually holds up.`,
    fromWeb: answer.fromWeb,
  }
}
