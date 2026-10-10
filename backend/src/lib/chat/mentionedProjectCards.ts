/**
 * Cards for the projects an open answer actually named.
 *
 * The OPEN lane answers general questions from grounded prose and, by design,
 * emitted no cards. That is right for "who founded Elite Group" and wrong for
 * "what are the most premium gated communities in Sector 78" — a question the
 * classifier reads as open, but whose answer names four real projects we hold.
 * The buyer got prose with inline links and no way to compare, save or open
 * anything, and had to re-ask in listing phrasing to get cards.
 *
 * The lane already resolves those projects against the database to build the
 * inline links, so the ids are in hand. This turns them into cards.
 *
 * Two properties make it safe under the "answer only what was asked" rule:
 *
 *   - The set is exactly what the answer named. Nothing is added, no sector is
 *     back-filled, no "similar projects" are appended. If the answer named one
 *     project, one card appears.
 *   - Names are matched against Project rows, so a name the model invented
 *     resolves to nothing and produces no card.
 */

import { prisma } from '../db'

/** The include the chat card renderer expects. Mirrors the detail pipeline. */
const CARD_INCLUDE = {
  builder: { select: { id: true, name: true, slug: true } },
  unit_types: {
    select: {
      name: true,
      bhk: true,
      bathrooms: true,
      super_area_sqft: true,
      carpet_area_sqft: true,
      price_min_cr: true,
      price_max_cr: true,
      price_label: true,
    },
  },
  images: { take: 3, orderBy: { sort_order: 'asc' as const } },
  amenities: { take: 10 },
  connectivity: { take: 5, orderBy: { distance_km: 'asc' as const } },
  decision_profile: true,
} as const

/**
 * Loads cards for the given ids, preserving the order they were mentioned in —
 * the answer's own ordering is the ranking the buyer just read, and re-sorting
 * would contradict the prose above the cards.
 */
export async function loadMentionedProjectCards(
  mentioned: ReadonlyArray<{ id: string; name: string }>,
  limit = 4,
): Promise<unknown[]> {
  const ids = [...new Set(mentioned.map(m => m.id))].slice(0, limit)
  if (ids.length === 0) return []

  try {
    const rows = await (prisma as { project: { findMany: (a: unknown) => Promise<Array<{ id: string }>> } }).project.findMany({
      where: { id: { in: ids } },
      include: CARD_INCLUDE,
    })
    const byId = new Map(rows.map(r => [r.id, r]))
    return ids.map(id => byId.get(id)).filter(Boolean) as unknown[]
  } catch (err) {
    // Cards are an enhancement to an answer that already stands on its own.
    // Never let this failure take down the turn.
    console.warn('[OPEN_LANE:CARD_LOAD_FAILED]', err)
    return []
  }
}
