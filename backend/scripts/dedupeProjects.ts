// backend/scripts/dedupeProjects.ts
//
// 16 duplicate pairs found by the 2026-10-10 catalogue audit. A loser is
// archived (archived_duplicate_of = winner's id), never hard-deleted —
// anything with an FK to its id (leads, saved properties, dossiers) stays
// valid.
//
//   npx tsx scripts/dedupeProjects.ts
//
// The 32 mis-filed city/sector rows the spec also calls for are OUT of this
// script — they need resolving from lat/lng against sector boundaries, and
// planning for Task 5 did not locate a source for that boundary data. Flagged
// as a known gap, not silently skipped.

import { prisma } from '../src/lib/db'
import { KEEP_TIER_PROJECT_FIELDS } from './backfillFactVerification'

/** Count of non-null KEEP-tier fields — the merge-winner score. */
export function keepTierFieldScore(project: Record<string, unknown>): number {
  return (KEEP_TIER_PROJECT_FIELDS as readonly string[]).filter(f => project[f] != null).length
}

export type DedupeResult =
  | { winnerId: string; loserId: string; reason: string }
  | { skipped: true; reason: string }

/** Resolves one duplicate pair, given as (project_a_id, project_b_id) OR (name_a, name_b). */
export async function resolveDuplicate(idsOrNames: [string, string]): Promise<DedupeResult> {
  const isLikelyId = (s: string) => /^[0-9a-f-]{20,}$/i.test(s)
  const selectFields = { id: true, name: true, updated_at: true, ...Object.fromEntries(KEEP_TIER_PROJECT_FIELDS.map(f => [f, true])) }
  const rows = isLikelyId(idsOrNames[0])
    ? await prisma.project.findMany({ where: { id: { in: idsOrNames } }, select: selectFields })
    : await prisma.project.findMany({ where: { name: { in: idsOrNames, mode: 'insensitive' }, archived_duplicate_of: null }, select: selectFields })

  if (rows.length !== 2) {
    return { skipped: true, reason: `expected exactly 2 live rows for ${JSON.stringify(idsOrNames)}, found ${rows.length} — needs a manual look` }
  }

  const [a, b] = rows
  const scoreA = keepTierFieldScore(a)
  const scoreB = keepTierFieldScore(b)
  let winner = a, loser = b, reason = `higher KEEP-tier field count (${scoreA} vs ${scoreB})`
  if (scoreB > scoreA) { winner = b; loser = a }
  else if (scoreA === scoreB) {
    if (b.updated_at > a.updated_at) { winner = b; loser = a } else { winner = a; loser = b }
    reason = `tied on field count (${scoreA}), broke by most recent updated_at`
  }

  await prisma.project.update({ where: { id: loser.id }, data: { archived_duplicate_of: winner.id } })
  return { winnerId: winner.id, loserId: loser.id, reason }
}

/**
 * Named, not by id — the audit transcript named these by project name, and
 * ids are assigned per environment. A name that doesn't resolve to exactly
 * two live rows is reported and skipped, not guessed at.
 */
const KNOWN_DUPLICATE_PAIRS: Array<[string, string]> = [
  ['Mahagun Moderne', 'Mahagun Moderne'],
  ['ATS One Hamlet', 'ATS One Hamlet'],
  ['Great Value Sharanam', 'Great Value Sharanam'],
  ['Jaypee Aman', 'Jaypee Aman'],
  ['ATS Destinaire', 'ATS Destinaire'],
  ['Mahagun Mezzaria', 'Mahagun Mezzaria'],
  ['Panchsheel Greens 2', 'Panchsheel Greens 2'],
  ['Eldeco Mystic Greens', 'Eldeco Mystic Greens'],
  ['ATS Dolce', 'ATS Dolce'],
  ['Paramount Golf Foreste', 'Paramount Golf Foreste'],
  ['Lotus Boulevard', 'Lotus Boulevard'],
  ['Stellar Jeevan', 'Stellar Jeevan'],
  ['Jaypee Kosmos', 'Jaypee Kosmos'],
  ['Supertech Eco Village 1', 'Supertech Eco Village 1'],
  ['Hawelia Valencia', 'Hawelia Valencia'],
  ['Supertech Ecociti', 'Supertech Ecociti'],
]

export async function dedupeKnownPairs(): Promise<DedupeResult[]> {
  const results: DedupeResult[] = []
  for (const pair of KNOWN_DUPLICATE_PAIRS) {
    results.push(await resolveDuplicate(pair))
  }
  return results
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run')
  ;(async () => {
    if (dryRun) {
      console.log('[DEDUPE] --dry-run not implemented as a separate code path — resolveDuplicate always writes. Reading this file, confirm KNOWN_DUPLICATE_PAIRS before running for real.')
      process.exit(0)
    }
    const results = await dedupeKnownPairs()
    for (const r of results) console.log('skipped' in r ? `SKIP: ${r.reason}` : `MERGED: winner=${r.winnerId} loser=${r.loserId} (${r.reason})`)
    const skipped = results.filter(r => 'skipped' in r)
    if (skipped.length) {
      console.warn(`\n${skipped.length} pair(s) need a manual look — see above.`)
    }
    await prisma.$disconnect()
  })().catch(e => { console.error(e); process.exit(1) })
}
