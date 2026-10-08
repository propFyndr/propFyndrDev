/**
 * Langfuse LLM Observability Client
 * Centralized tracing for prompt tokens, model generation latency, and fallback chains.
 */

import { Langfuse } from 'langfuse'
import type { LangfuseTraceClient } from 'langfuse'
import { redactPii } from '../redactPii'

let langfuse: Langfuse | null = null

/** Longest string kept in a trace input/output. Tool results and long answers
 *  past this are cut, so one turn cannot ship a megabyte to Langfuse. */
export const LANGFUSE_MAX_STRING = 4000

/**
 * Applied by the SDK to every `input` and `output` it sends — traces, spans,
 * generations, events — so no call site can forget it. Buyers type phone
 * numbers and emails into chat; those never leave the server.
 */
export function maskForLangfuse(data: unknown): unknown {
  if (typeof data === 'string') {
    const clean = redactPii(data)
    return clean.length > LANGFUSE_MAX_STRING
      ? `${clean.slice(0, LANGFUSE_MAX_STRING)}… [truncated ${clean.length - LANGFUSE_MAX_STRING} chars]`
      : clean
  }
  if (Array.isArray(data)) return data.map(maskForLangfuse)
  if (data && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, maskForLangfuse(v)]))
  }
  return data
}

export function getLangfuse(): Langfuse | null {
  if (langfuse) return langfuse

  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com'

  // Test runs never trace: they would fill the production project with
  // fixture turns.
  if (!secretKey || !publicKey || process.env.NODE_ENV === 'test') {
    return null
  }

  try {
    langfuse = new Langfuse({
      secretKey,
      publicKey,
      baseUrl,
      // Batched: one request per 15 events or 5s instead of one per event.
      // flushLangfuse() on shutdown (index.ts) sends the remainder.
      flushInterval: 5000,
      flushAt: 15,
      // Separates dev and prod turns in one Langfuse project.
      environment: process.env.LANGFUSE_ENVIRONMENT
        || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
      mask: ({ data }) => maskForLangfuse(data),
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

export function startTraceSpan(trace: LangfuseTraceClient | null | undefined, name: string, input?: any) {
  if (!trace) return null
  try {
    return (trace as any).span({
      name,
      input,
      startTime: new Date(),
    })
  } catch {
    return null
  }
}

export function endTraceSpan(span: any, output?: any, metadata?: Record<string, any>) {
  if (!span) return
  try {
    span.end({
      output,
      metadata,
      endTime: new Date(),
    })
  } catch {
    // never block on telemetry
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
