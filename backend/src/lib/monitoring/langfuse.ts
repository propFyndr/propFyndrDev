/**
 * Langfuse LLM Observability Client
 * Centralized tracing for prompt tokens, model generation latency, and fallback chains.
 *
 * Langfuse JS/TS SDK v6 (OpenTelemetry). The v3 `langfuse` package sent traces
 * through the legacy batch-ingestion API, which Langfuse Cloud removed on
 * 2026-11-16.
 *
 * Spans go through their own BasicTracerProvider, never the global one: Sentry
 * owns the global OpenTelemetry provider and samples it at 10% in production,
 * so a Langfuse span parented on Sentry's context would be dropped 9 times in 10.
 * Every root carries an explicit sampled parent context for the same reason.
 *
 * Callers keep the v3 shape (`trace.span()`, `.generation()`, `.event()`,
 * `.end({ output, usage, ... })`); this file translates it.
 */

import { createHash, randomUUID } from 'node:crypto'
import { AlwaysOnSampler, BasicTracerProvider } from '@opentelemetry/sdk-trace-base'
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { LangfuseOtelSpanAttributes as Attr, setLangfuseTracerProvider, startObservation } from '@langfuse/tracing'
import type { LangfuseObservation, LangfuseSpan } from '@langfuse/tracing'
import { redactPii } from '../redactPii'

/** Longest string kept in a trace input/output. Tool results and long answers
 *  past this are cut, so one turn cannot ship a megabyte to Langfuse. */
export const LANGFUSE_MAX_STRING = 4000

/**
 * Applied by the span processor to every `input` and `output` it sends — traces, spans,
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

/** The v6 processor hands input/output over as JSON strings; mask inside them
 *  so the attribute stays valid JSON. */
export function maskSpanData(data: unknown): unknown {
  if (typeof data !== 'string') return maskForLangfuse(data)
  try {
    return JSON.stringify(maskForLangfuse(JSON.parse(data)))
  } catch {
    return maskForLangfuse(data)
  }
}

let provider: BasicTracerProvider | null = null
let initialised = false

function enabled(): boolean {
  if (initialised) return provider !== null
  initialised = true

  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com'

  // Test runs never trace: they would fill the production project with
  // fixture turns.
  if (!secretKey || !publicKey || process.env.NODE_ENV === 'test') return false

  try {
    provider = new BasicTracerProvider({
      sampler: new AlwaysOnSampler(),
      spanProcessors: [
        new LangfuseSpanProcessor({
          secretKey,
          publicKey,
          baseUrl,
          // Batched: one request per 15 spans or 5 s. flushLangfuse() on
          // shutdown (index.ts) sends the remainder.
          flushAt: 15,
          flushInterval: 5,
          // Separates dev and prod turns in one Langfuse project.
          environment: process.env.LANGFUSE_ENVIRONMENT
            || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
          mask: ({ data }) => maskSpanData(data),
        }),
      ],
    })
    setLangfuseTracerProvider(provider)
    // Traffic is too thin to rely on the next turn to sweep; unref'd so it never holds the process open.
    setInterval(sweepOpenTurns, 60_000).unref()
  } catch (err) {
    console.error('Failed to initialize Langfuse tracing:', err)
    provider = null
  }
  return provider !== null
}

type Level = 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR'

/** The v3 `.end()` argument shape the callers use. */
interface EndArgs {
  output?: unknown
  usage?: { promptTokens?: number; completionTokens?: number }
  costDetails?: Record<string, number>
  level?: Level
  statusMessage?: string
  metadata?: Record<string, unknown>
}

export interface TelemetrySpan {
  end(args?: EndArgs): void
}

/** One chat turn's trace. Null-safe at every call site: telemetry never fails a turn. */
export interface TurnTrace {
  span(o: { name: string; input?: unknown; metadata?: Record<string, unknown> }): TelemetrySpan
  generation(o: { name: string; model?: string; input?: unknown; metadata?: Record<string, unknown> }): TelemetrySpan
  event(o: { name: string; input?: unknown; output?: unknown; metadata?: Record<string, unknown> }): void
}

interface TraceAttrs {
  sessionId?: string | null
  userId?: string | null
  tags?: string[]
  metadata?: Record<string, unknown>
}

interface OpenTurn {
  root: LangfuseSpan
  sessionId?: string
  userId?: string
  tags: Set<string>
  openedAt: number
  /** Set by recordChatTurn. Kept in the map so a retried request or a late
   *  model leg on the same turn id attaches here instead of opening a second root. */
  ended?: boolean
}

/**
 * Root span of every turn, by the router's id (`chat-<turnId>`), until the
 * 10-minute sweep. recordChatTurn ends it when the response closes.
 */
const openTurns = new Map<string, OpenTurn>()
/**
 * A root nobody closes is ended here so it still exports. It happens when the
 * buyer disconnects before the router registers its `close` listener: the
 * event has already fired, the turn runs on, and an unended OpenTelemetry root
 * is never sent. 3 minutes is past the slowest turn measured (109 s).
 */
const OPEN_TURN_TTL_MS = 3 * 60_000

function sweepOpenTurns(): void {
  const now = Date.now()
  for (const [key, t] of openTurns) {
    if (now - t.openedAt > OPEN_TURN_TTL_MS) {
      if (!t.ended) t.root.end()
      openTurns.delete(key)
    }
  }
}

/** OpenTelemetry ids are hex; the same turn id always gives the same trace. */
export function otelTraceId(id: string): { traceId: string; spanId: string } {
  const hash = createHash('sha256').update(id).digest('hex')
  return { traceId: hash.slice(0, 32), spanId: hash.slice(32, 48) }
}

/** Trace-level fields go on every span, which is how Langfuse files them. */
function stampTrace(obs: LangfuseObservation, turn: OpenTurn): void {
  const span = obs.otelSpan
  span.setAttribute(Attr.TRACE_NAME, 'chat_turn')
  if (turn.sessionId) span.setAttribute(Attr.TRACE_SESSION_ID, turn.sessionId)
  if (turn.userId) span.setAttribute(Attr.TRACE_USER_ID, turn.userId)
  if (turn.tags.size) span.setAttribute(Attr.TRACE_TAGS, [...turn.tags])
}

function openTurn(id: string, attrs: TraceAttrs): OpenTurn | null {
  if (!enabled()) return null
  const now = Date.now()
  let turn = openTurns.get(id)
  if (!turn) {
    const { traceId, spanId } = otelTraceId(id)
    const root = startObservation('chat_turn', {}, {
      // A parent that does not exist, marked sampled: it fixes the trace id and
      // keeps the span off Sentry's (sampled) context.
      parentSpanContext: { traceId, spanId, traceFlags: 1 },
    })
    turn = { root, tags: new Set(), openedAt: now }
    openTurns.set(id, turn)
  }
  // An ended span ignores attribute writes; children still attach to it.
  if (turn.ended) return turn
  if (attrs.sessionId) turn.sessionId = attrs.sessionId
  if (attrs.userId) turn.userId = attrs.userId
  for (const tag of attrs.tags ?? []) turn.tags.add(tag)
  for (const [k, v] of Object.entries(attrs.metadata ?? {})) {
    if (v !== undefined && v !== null) turn.root.otelSpan.setAttribute(`${Attr.TRACE_METADATA}.${k}`, String(v))
  }
  stampTrace(turn.root, turn)
  return turn
}

function closeWith(obs: LangfuseObservation, a: EndArgs = {}): void {
  try {
    const usageDetails = a.usage
      ? Object.fromEntries(
          Object.entries({ input: a.usage.promptTokens, output: a.usage.completionTokens })
            .filter(([, v]) => typeof v === 'number'),
        ) as Record<string, number>
      : undefined
    // `update` is typed per observation kind; one call covers span and generation.
    ;(obs as LangfuseSpan).update({
      output: a.output,
      level: a.level,
      statusMessage: a.statusMessage,
      metadata: a.metadata,
      ...(usageDetails ? { usageDetails } : {}),
      ...(a.costDetails ? { costDetails: a.costDetails } : {}),
    } as Parameters<LangfuseSpan['update']>[0])
    obs.end()
  } catch {
    // never block on telemetry
  }
}

const NOOP_SPAN: TelemetrySpan = { end: () => {} }

function adapter(turn: OpenTurn): TurnTrace {
  const child = (obs: LangfuseObservation): TelemetrySpan => {
    stampTrace(obs, turn)
    return { end: a => closeWith(obs, a) }
  }
  return {
    span: o => {
      try {
        return child(turn.root.startObservation(o.name, { input: o.input, metadata: o.metadata }))
      } catch {
        return NOOP_SPAN
      }
    },
    generation: o => {
      try {
        return child(turn.root.startObservation(o.name, { model: o.model, input: o.input, metadata: o.metadata }, { asType: 'generation' }))
      } catch {
        return NOOP_SPAN
      }
    },
    event: o => {
      // An event ends itself when created.
      const ev = turn.root.startObservation(o.name, { input: o.input, output: o.output, metadata: o.metadata }, { asType: 'event' })
      stampTrace(ev, turn)
    },
  }
}

/**
 * This turn's trace, for the model legs and tool calls of the fallback chain.
 * Same id as the router's, so the legs land under the turn that recordChatTurn closes.
 */
export function turnTrace(id: string, attrs: TraceAttrs = {}): TurnTrace | null {
  try {
    const turn = openTurn(id, attrs)
    return turn ? adapter(turn) : null
  } catch {
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
}): TurnTrace | null {
  try {
    const turn = openTurn(params.id ?? `chat-${randomUUID()}`, { sessionId: params.sessionId, userId: params.userId })
    if (!turn) return null
    if (!turn.ended) turn.root.update({ input: { message: params.userMessage, intent: params.intent } })
    return adapter(turn)
  } catch {
    return null
  }
}

export function startTraceSpan(trace: TurnTrace | null | undefined, name: string, input?: unknown): TelemetrySpan | null {
  if (!trace) return null
  try {
    return trace.span({ name, input })
  } catch {
    return null
  }
}

export function endTraceSpan(span: TelemetrySpan | null | undefined, output?: unknown, metadata?: Record<string, unknown>) {
  if (!span) return
  try {
    span.end({ output, metadata })
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
  try {
    const metadata = {
      lane: params.lane,
      queryKind: params.queryKind,
      latencyMs: Math.round(params.latencyMs),
      provider: params.provider,
      model: params.model,
      degraded: params.degraded ?? false,
      outage: params.outage ?? false,
      cardsShown: params.cardsShown ?? 0,
    }
    const turn = openTurn(params.id, {
      sessionId: params.sessionId,
      userId: params.userId,
      tags: ['chat', params.lane, ...(params.queryKind ? [params.queryKind] : []), ...(params.outage ? ['outage'] : [])],
      metadata,
    })
    // A retried request (same turnId) closing again: the first close wrote the record.
    if (!turn || turn.ended) return
    const input = { message: params.message }
    const output = { response: params.answer }
    turn.root.update({ input, output, metadata })
    turn.root.otelSpan.setAttribute(Attr.TRACE_INPUT, JSON.stringify(input))
    turn.root.otelSpan.setAttribute(Attr.TRACE_OUTPUT, JSON.stringify(output))
    turn.root.end()
    turn.ended = true
  } catch {
    // never block execution on telemetry
  }
}

/**
 * `trace` is nullable on purpose: it is null whenever Langfuse is
 * unconfigured, and telemetry must never be the thing that fails a turn.
 */
export function recordTableRendered(trace: TurnTrace | null | undefined, params: {
  tableType: 'payment_plan' | 'cost_sheet' | 'micro_market' | 'comparison' | 'yield_table' | 'price_trend'
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
  if (!provider) return
  try {
    for (const t of openTurns.values()) if (!t.ended) t.root.end()
    openTurns.clear()
    await provider.forceFlush()
  } catch {
    // ignore flush failure
  }
}
