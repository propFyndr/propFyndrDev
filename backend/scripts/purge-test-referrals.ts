// Deletes every ReferralLink except the one labeled "Rahul – college" (plus
// its ReferralVisit subtree), cleaning out the test/demo campaigns created
// while building the referral-tracking feature. Dry-run by default — prints
// what WOULD be deleted. Pass --apply to actually delete. Matches
// purge-retention.ts's convention.
//
// Usage:
//   npx tsx scripts/purge-test-referrals.ts            # dry run, prints counts
//   npx tsx scripts/purge-test-referrals.ts --apply     # actually deletes
import { prisma } from '../src/lib/db'

const KEEP_LABEL = 'Rahul – college'

export interface PurgeResult {
  ambiguous: boolean
  ambiguousMatches?: { code: string; createdAt: Date }[]
  kept?: { code: string } | null
  toDelete: { code: string; label: string | null; visitCount: number }[]
}

export async function run(apply: boolean): Promise<PurgeResult> {
  const keepCandidates = await prisma.referralLink.findMany({
    where: { label: KEEP_LABEL },
    select: { code: true, created_at: true },
  })

  if (keepCandidates.length > 1) {
    return {
      ambiguous: true,
      ambiguousMatches: keepCandidates.map((c) => ({ code: c.code, createdAt: c.created_at })),
      toDelete: [],
    }
  }

  const keepCode = keepCandidates[0]?.code ?? null

  const linksToDelete = await prisma.referralLink.findMany({
    where: keepCode ? { code: { not: keepCode } } : {},
    select: { code: true, label: true },
  })

  const toDelete: { code: string; label: string | null; visitCount: number }[] = []
  for (const link of linksToDelete) {
    const visitCount = await prisma.referralVisit.count({ where: { root_code: link.code } })
    toDelete.push({ code: link.code, label: link.label, visitCount })
  }

  if (apply) {
    const codes = toDelete.map((l) => l.code)
    if (codes.length > 0) {
      await prisma.$transaction([
        prisma.referralVisit.deleteMany({ where: { root_code: { in: codes } } }),
        prisma.referralLink.deleteMany({ where: { code: { in: codes } } }),
      ])
    }
  }

  return { ambiguous: false, kept: keepCode ? { code: keepCode } : null, toDelete }
}

if (require.main === module) {
  const apply = process.argv.includes('--apply')
  run(apply)
    .then((result) => {
      if (result.ambiguous) {
        console.error(
          `[PURGE_TEST_REFERRALS] Refusing: ${result.ambiguousMatches!.length} links match label "${KEEP_LABEL}". Resolve manually:`,
        )
        console.error(result.ambiguousMatches)
        process.exit(1)
      }
      console.log(apply ? 'Deleted:' : 'Would delete (dry run — pass --apply to actually delete):')
      console.log(`Kept: ${result.kept ? result.kept.code : '(none found matching "' + KEEP_LABEL + '")'}`)
      console.log(`Links: ${result.toDelete.length}, total visits: ${result.toDelete.reduce((s, l) => s + l.visitCount, 0)}`)
      console.log(result.toDelete)
      process.exit(0)
    })
    .catch((err) => {
      console.error('[PURGE_TEST_REFERRALS:FAILED]', err)
      process.exit(1)
    })
}
