// backend/src/lib/excludeTestLeads.ts
//
// Test-created leads never appear in a read.
//
// `npm test` drives the real Express app through supertest against the real
// database, so every run persisted real `callback_requests` rows. 820 of 825
// stored leads were `John Doe` / `+919876543210` against a single project —
// which means the sales queue, the lead tiers, the conversion rate and every
// analytics figure derived from leads were reading almost entirely our own
// test traffic.
//
// ── Why a client extension and not a filter per query ─────────────────────
//
// There are more than twenty read sites across six files, and the ones that
// matter most are the aggregates — a `count` that forgets the filter does not
// look wrong, it just reports a number four hundred too high. Patching them
// one at a time means the next one added forgets, and forgetting is invisible.
//
// So it is applied once, at the client, to every find/count/aggregate/groupBy
// on this model. A call site that genuinely wants test rows says `is_test` in
// its own `where` and keeps it; everything else is filtered whether the author
// thought about it or not. Same reasoning as mounting the role policy at the
// admin prefix rather than inside one router.
//
// This is the `ChatSession.is_bot` problem a second time, and the second time
// it is solved where it cannot be forgotten.
import type { PrismaClient } from '@prisma/client'

/** The reads that should never see our own test traffic. */
const FILTERED_OPERATIONS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow',
  'count', 'aggregate', 'groupBy',
])

/**
 * `findUnique` is deliberately absent.
 *
 * It is addressed by id — the caller already knows exactly which row it wants,
 * and hiding it would turn "fetch this lead" into a confusing 404 for anyone
 * inspecting a test row on purpose.
 */
function alreadyDecided(where: unknown): boolean {
  return Boolean(where && typeof where === 'object' && 'is_test' in (where as Record<string, unknown>))
}

export function excludeTestLeads(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      callbackRequest: {
        async $allOperations({ operation, args, query }) {
          if (!FILTERED_OPERATIONS.has(operation)) return query(args)

          const a = (args ?? {}) as { where?: Record<string, unknown> }
          if (alreadyDecided(a.where)) return query(args)

          return query({ ...a, where: { ...(a.where ?? {}), is_test: false } } as typeof args)
        },
      },
    },
  }) as unknown as PrismaClient
}
