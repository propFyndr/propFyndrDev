/**
 * Context and contract for the chat topic handlers.
 *
 * chat-router.ts grew a single ~3,900-line POST handler containing fourteen
 * hardcoded topic branches, each doing its own database work, writing its own
 * response and returning early before the generic gateway path below them ever
 * ran. That shape is why every fabrication bug found in this codebase lived in
 * one file: fourteen independent places to get honesty right is fourteen places
 * to get it wrong, and they drifted — one of them still instructed buyers to
 * visit up-rera.in, which the system prompt explicitly forbids.
 *
 * Extracting them behind this contract does three things:
 *   - each topic becomes a file small enough to review and test on its own
 *   - the context is an explicit type, so a handler cannot silently depend on
 *     some incidental local variable — the compiler is the verifier
 *   - a handler can be deleted once the generic path answers its topic as well,
 *     one at a time, with a test per removal
 */

import type { Response } from 'express'
import type { LangfuseTraceClient } from 'langfuse'
import type { Intent } from '../discovery'

/** The catalogue columns the router caches. Structural, so handlers stay decoupled. */
export interface CatalogEntry {
  id: string
  name: string
  slug: string
  sector: string
  status: string
  price_min_cr: number | null
  price_range_label: string | null
}

/** The builder columns the router selects. Structural, so handlers stay decoupled. */
export interface BuilderRow {
  id: string
  name: string
  slug: string | null
  projects_delivered_count: number | null
  total_projects_count: number | null
  average_delay_months: number | null
  delivered_units: number | null
  /**
   * Ranking only — never a column, never a sentence.
   *
   * See BUYER_OPAQUE_SCORES in `projectExposure.ts`. These order the league
   * table; the columns beside them carry counts and dates a buyer can check.
   */
  delivery_score: number | null
  construction_quality_score: number | null
  rera_compliance_score: number | null
  founded_year: number | null
  company_overview: string | null
}

/** A chip as emitted to the client. Structural, so handlers can build literals. */
export interface ChatChip {
  id: string
  actionType: string
  label: string
  icon?: string
  analyticsId?: string
  priority?: number
  payload?: Record<string, unknown>
}

export interface UiState {
  stage: string
  thinking: string
  chips: ChatChip[]
  missingFields?: string[]
  confidence?: string
  [key: string]: unknown
}

/**
 * Everything a topic handler is allowed to reach.
 *
 * Deliberately narrow: a handler gets the buyer's message, the resolved intent,
 * the session identity, and the two emit functions. Anything it needs beyond
 * this it must import directly, which keeps the dependency visible.
 */
export interface ChatHandlerContext {
  /** Sanitised user message for this turn. */
  message: string
  /** Intent after hydration and post-processing. */
  intent: Intent
  /** Session id used for chip dedup and persistence — always present. */
  sessionId: string
  userId?: string
  guestToken?: string

  /** Raw SSE writer. */
  send: (event: string, data: Record<string, unknown>) => void
  /**
   * The single exit for ui_state. Applies sector filtering, session dedup and
   * the chip cap. Handlers must use this rather than send('ui_state', …) —
   * bypassing it is how chips the buyer had already dismissed came back.
   */
  emitUiState: (state: UiState, opts?: { fallbackChips?: ChatChip[]; skipDedup?: boolean }) => void

  /** For handlers that must end the response themselves. */
  res: Response

  /**
   * Projects carried over from the previous turn, used when the buyer says
   * "these" or asks a follow-up without naming anything. May be empty.
   */
  cachedProjects: ReadonlyArray<{ id: string }>

  /** Classification flags computed once per turn by the router. */
  flags: Readonly<Record<string, boolean>>

  /**
   * Builder rows the router already fetched for this turn.
   *
   * Passed in rather than re-queried: the router needs them anyway to decide
   * whether the message names two builders, and a handler issuing its own
   * findMany for the same rows is how the old inline blocks each grew a
   * private copy of the same query.
   */
  builders: ReadonlyArray<BuilderRow>

  /**
   * The project the turn is about, when one resolved.
   *
   * Either the first name the extractor found or the id it resolved to — the
   * same value the router's own branches keyed off, so a handler and the router
   * cannot disagree about which project is in scope.
   */
  activeProjectName?: string

  /**
   * The lightweight project catalogue the router already loaded for this turn.
   *
   * Name and sector only — enough for a handler to resolve which project the
   * buyer meant without issuing its own findMany against every row.
   */
  catalog: ReadonlyArray<CatalogEntry>

  /** Conversation state as the router computed it for this turn. */
  intentState: string

  /**
   * This turn's Langfuse trace, when observability is configured.
   *
   * `recordTableRendered` was already being called by the cost-sheet and
   * payment-plan handlers as `(ctx as any).trace` — a field this interface has
   * never had, so it was `undefined` on every call and the helper returned at
   * its own null check. Every deterministic table this product renders was
   * invisible in Langfuse.
   *
   * A handler-answered turn returns before `runFallbackChain`, which builds
   * the trace for model-answered turns, so these turns need their own or they
   * have none at all.
   */
  trace?: LangfuseTraceClient | null

  /** Sectors named in the message, in order. Empty when none were. */
  sectorMatches: ReadonlyArray<string>

  /**
   * Writes this turn's answer into the semantic cache.
   *
   * Handlers that produce a deterministic answer should call it; the next
   * buyer asking the same thing then costs nothing.
   */
  setCachedResponse: (
    message: string,
    payload: { token: string; chips?: ChatChip[]; intentState?: string; responseMode?: string },
    ttlMs?: number,
    scope?: string,
  ) => void
}

export interface ChatTopicHandler {
  /** Stable id, used in logs and tests. */
  id: string
  /** One line: which buyer question this answers. */
  description: string
  /** Cheap predicate over the precomputed flags and intent. No I/O. */
  matches: (ctx: ChatHandlerContext) => boolean
  /**
   * Produce the answer. Writes to the socket and ends the response.
   * Returning `false` means "declined after inspection" — the router carries
   * on to the next handler, which lets a matcher stay cheap while the handler
   * bails on a condition only visible after a lookup.
   */
  handle: (ctx: ChatHandlerContext) => Promise<boolean | void>
}

/**
 * Runs the first matching handler. Returns true when one produced a response,
 * in which case the router must not continue.
 *
 * **It closes the response itself.** Ending an SSE stream is not something
 * thirty-five separate branches should each have to remember, and they did not:
 * across the handlers, 35 branches emitted a `done` event and 2 called
 * `res.end()`. The other 33 left the HTTP response open — the answer arrived,
 * then the socket sat there taking a `ping` every three seconds until the
 * client gave up, which on screen is a reply that never finishes. The router's
 * call site just `return`s, so nothing downstream closed it either. The 3s
 * heartbeat is cleared on the response's `finish` event, so each hung request
 * also leaked its own interval.
 *
 * A handler that already ends the response is unaffected: `writableEnded`
 * makes this a no-op for the two that do.
 */
export async function runTopicHandlers(
  handlers: readonly ChatTopicHandler[],
  ctx: ChatHandlerContext,
): Promise<boolean> {
  for (const handler of handlers) {
    if (!handler.matches(ctx)) continue
    const handled = await handler.handle(ctx)
    if (handled === false) continue
    if (!ctx.res.writableEnded) {
      console.log('[CHAT:TOPIC_LANE_CLOSED]', { handler: handler.id })
      ctx.res.end()
    }
    return true
  }
  return false
}
