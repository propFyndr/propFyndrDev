import { prisma } from './db'

/**
 * A question about a city we list no projects in, recorded as launch demand.
 *
 * Not a lead: it never touches `callback_requests`, carries no lead tier and
 * never reaches the SALES queue. Attributed like every anonymous action here —
 * `user_id ?? guest_token` — so the count is of people, not page loads.
 */
export interface DemandSignalInput {
  city: string
  questionKind: 'market' | 'vote'
  wantsNotify?: boolean
  budgetMaxCr?: number
  bhk?: number
  userId?: string
  guestToken?: string
  sessionId?: string
}

/** Fire-and-forget. A failed telemetry write must never cost the buyer a turn. */
export function recordDemandSignal(d: DemandSignalInput): void {
  if (process.env.NODE_ENV === 'test') return
  prisma.demandSignal
    .create({
      data: {
        city: d.city,
        question_kind: d.questionKind,
        wants_notify: d.wantsNotify ?? false,
        budget_max_cr: d.budgetMaxCr ?? null,
        bhk: d.bhk ?? null,
        user_id: d.userId ?? null,
        guest_token: d.userId ? null : d.guestToken ?? null,
        session_id: d.sessionId ?? null,
      },
    })
    .catch((err: Error) => console.warn('[DEMAND_SIGNAL]', err.message))
}
