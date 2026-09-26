import { prisma } from './db'

/**
 * What the router knows about a turn by the time the response closes.
 *
 * Filled in as the turn runs — `lane` by whichever exit answers, the rest by
 * the main path — and written once, on the response's `finish` event, so every
 * one of the router's early returns records itself without a call per branch.
 * A turn that never names its lane is written as `unlabelled`, which is itself
 * the finding: an exit nobody can attribute.
 */
export interface TurnTraceDraft {
  session_id?: string
  lane: string
  query_kind?: string
  provider?: string
  model?: string
  prompt_chars?: number
  answer_chars?: number
  degraded?: boolean
  jev_shadow?: unknown
}

/** Fire-and-forget. Telemetry must never fail or slow a buyer's turn. */
export function recordTurnTrace(t: TurnTraceDraft, latencyMs: number): void {
  if (process.env.TURN_TRACE === 'off' || process.env.NODE_ENV === 'test') return
  prisma.turnTrace
    .create({
      data: {
        session_id: t.session_id ?? null,
        lane: t.lane,
        query_kind: t.query_kind ?? null,
        provider: t.provider ?? null,
        model: t.model ?? null,
        prompt_chars: t.prompt_chars ?? null,
        answer_chars: t.answer_chars ?? null,
        latency_ms: Math.round(latencyMs),
        degraded: t.degraded ?? false,
        ...(t.jev_shadow !== undefined ? { jev_shadow: t.jev_shadow as object } : {}),
      },
    })
    .catch((err: Error) => console.warn('[TURN_TRACE]', err.message))
}
