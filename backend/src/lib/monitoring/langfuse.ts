/**
 * Langfuse LLM Observability Client
 * Centralized tracing for prompt tokens, model generation latency, and fallback chains.
 */

import { Langfuse } from 'langfuse'
import type { LangfuseTraceClient } from 'langfuse'

let langfuse: Langfuse | null = null

export function getLangfuse(): Langfuse | null {
  if (langfuse) return langfuse

  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com'

  if (!secretKey || !publicKey) {
    return null
  }

  try {
    langfuse = new Langfuse({
      secretKey,
      publicKey,
      baseUrl,
      flushInterval: 1000,
      flushAt: 1,
    })
    return langfuse
  } catch (err) {
    console.error('Failed to initialize Langfuse client:', err)
    return null
  }
}

export function createChatTrace(params: {
  /** The turn's trace id, so handler events land on the same trace as the answer. */
  id?: string
  sessionId?: string | null
  userId?: string | null
  userMessage: string
  intent?: string
}) {
  const client = getLangfuse()
  if (!client) return null

  try {
    const trace = client.trace({
      id: params.id,
      sessionId: params.sessionId || undefined,
      userId: params.userId || undefined,
      name: 'chat_turn',
      input: { message: params.userMessage, intent: params.intent },
    })
    return trace
  } catch (err) {
    return null
  }
}

/**
 * The one record of a turn: what the buyer asked, what they were shown, and
 * which exit answered.
 *
 * Written when the response closes, so every early return records itself. It
 * used to be written at the bottom of the LLM path only — every deterministic
 * handler ends the response first — so Langfuse held the question and never
 * the answer for exactly the turns most worth reviewing.
 */
export function recordChatTurn(params: {
  id: string
  sessionId?: string | null
  userId?: string | null
  message: string
  answer: string
  lane: string
  queryKind?: string
  latencyMs: number
  /** Which provider/model actually answered, when a model leg ran. */
  provider?: string
  model?: string
  /** True when the turn fell back to a weaker leg or the deterministic floor. */
  degraded?: boolean
  /** True when every leg failed and the buyer saw the outage notice. The
   *  single most important field for triage: filters straight to the turns
   *  that failed the buyer, whatever the lane says. */
  outage?: boolean
  /** How many project cards rendered this turn, so a reviewer can tell a
   *  cards-plus-prose turn from a text-only one without opening the UI. */
  cardsShown?: number
}): void {
  const client = getLangfuse()
  if (!client) return
  try {
    client.trace({
      id: params.id,
      sessionId: params.sessionId || undefined,
      userId: params.userId || undefined,
      name: 'chat_turn',
      input: { message: params.message },
      output: { response: params.answer },
      metadata: {
        lane: params.lane,
        queryKind: params.queryKind,
        latencyMs: Math.round(params.latencyMs),
        provider: params.provider,
        model: params.model,
        degraded: params.degraded ?? false,
        outage: params.outage ?? false,
        cardsShown: params.cardsShown ?? 0,
      },
      tags: [
        'chat',
        params.lane,
        ...(params.queryKind ? [params.queryKind] : []),
        ...(params.outage ? ['outage'] : []),
      ],
    })
  } catch {
    // never block execution on telemetry
  }
}

/**
 * `trace` is nullable on purpose: it is null whenever Langfuse is
 * unconfigured, and telemetry must never be the thing that fails a turn.
 */
export function recordTableRendered(trace: LangfuseTraceClient | null | undefined, params: {
  tableType: 'payment_plan' | 'cost_sheet' | 'micro_market' | 'comparison' | 'yield_table'
  projectName?: string
  rowCount: number
  characterLength: number
  cached?: boolean
}): void {
  if (!trace) return
  try {
    trace.event({
      name: `table_rendered:${params.tableType}`,
      input: {
        projectName: params.projectName || 'general_market',
        tableType: params.tableType,
      },
      output: {
        rowCount: params.rowCount,
        characterLength: params.characterLength,
        cached: params.cached ?? false,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        tableType: params.tableType,
      },
    })
  } catch {
    // never block execution on telemetry
  }
}

export async function flushLangfuse(): Promise<void> {
  if (langfuse) {
    try {
      await langfuse.flushAsync()
    } catch {
      // ignore flush failure
    }
  }
}
