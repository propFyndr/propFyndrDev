// backend/src/lib/leadAssignment.ts
//
// Picking which channel partner gets the next lead.
//
// The brief was "distributed equally". Recorded here because it is a product
// decision worth being able to revisit: equal distribution is usually the wrong
// objective. A partner converting at 40% and one converting at 5% should not
// receive the same volume, and sending a buyer to the weaker firm costs that
// buyer a worse experience, not just us a sale.
//
// Shipped as equal anyway, deliberately: it is fair, it is explainable to a
// builder who asks why their partner got fewer, and it needs no conversion
// history — which we do not yet have enough of to rank anyone honestly. The
// signature is the thing designed for change: swap the body for a weighted
// strategy and no caller moves.
//
// "Round robin" here means fewest-current-assignments rather than a stored
// cursor. Same distribution, no state to keep in sync, and it self-corrects —
// a partner who is removed and re-added does not spend a cycle catching up, and
// a manual assignment is absorbed rather than ignored.
import { prisma } from './db'

export interface AssignmentCandidate {
  id: string
  name: string
  assignedCount: number
}

/**
 * The partners eligible to receive a lead from this builder.
 *
 * Approved AND active: `status` is our approval of the firm and `is_active` is
 * the builder's own switch. Both must hold — a partner the builder paused
 * should not receive work, and neither should one we have not vetted.
 */
export async function eligiblePartners(builderId: string): Promise<AssignmentCandidate[]> {
  const partners = await prisma.channelPartner.findMany({
    where: { builder_id: builderId, status: 'approved', is_active: true },
    select: { id: true, name: true, created_at: true },
    orderBy: { created_at: 'asc' },
  })
  if (partners.length === 0) return []

  const ids = partners.map((p) => p.id)
  const [callbackCounts, visitCounts] = await Promise.all([
    prisma.callbackRequest.groupBy({
      by: ['assigned_partner_id'],
      where: { assigned_partner_id: { in: ids } },
      _count: { _all: true },
    }),
    prisma.siteVisitRequest.groupBy({
      by: ['assigned_partner_id'],
      where: { assigned_partner_id: { in: ids } },
      _count: { _all: true },
    }),
  ])

  // Both lead types count toward a partner's load. A firm holding ten booked
  // site visits is not idle just because it holds no callbacks.
  const load = new Map<string, number>()
  for (const row of [...callbackCounts, ...visitCounts]) {
    if (!row.assigned_partner_id) continue
    load.set(row.assigned_partner_id, (load.get(row.assigned_partner_id) ?? 0) + row._count._all)
  }

  return partners.map((p) => ({ id: p.id, name: p.name, assignedCount: load.get(p.id) ?? 0 }))
}

/**
 * The next partner in rotation, or null when the builder has none eligible.
 *
 * Pure, so the rule can be tested without a database — which matters, because
 * "did it actually distribute evenly" is the whole question and a test that
 * needed thirteen partner rows to ask it would not get written.
 *
 * Ties break on the order given, and `eligiblePartners` orders by creation, so
 * a builder's first partner wins an even split. Deterministic beats random
 * here: a builder asking "why did they get it" deserves an answer.
 */
export function nextInRotation(candidates: readonly AssignmentCandidate[]): AssignmentCandidate | null {
  if (candidates.length === 0) return null
  let best = candidates[0]
  for (const c of candidates) {
    if (c.assignedCount < best.assignedCount) best = c
  }
  return best
}

/** Convenience for the route: eligibility and rotation in one call. */
export async function pickPartnerForBuilder(builderId: string): Promise<AssignmentCandidate | null> {
  return nextInRotation(await eligiblePartners(builderId))
}
