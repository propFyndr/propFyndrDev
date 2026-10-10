// backend/scripts/resetDecisionProfilesToDraft.ts
//
// ~77% of PUBLISHED DecisionProfile content is templated per the 2026-10-10
// audit. Resetting to DRAFT means the Intelligence tab shows less until real
// analysis is written back in, rather than keep shipping known-templated
// text under a PUBLISHED badge.
//
//   npx tsx scripts/resetDecisionProfilesToDraft.ts

import { prisma } from '../src/lib/db'

export async function resetPublishedDecisionProfilesToDraft(): Promise<number> {
  const result = await prisma.decisionProfile.updateMany({
    where: { status: 'PUBLISHED' },
    data: { status: 'DRAFT' },
  })
  return result.count
}

if (require.main === module) {
  resetPublishedDecisionProfilesToDraft().then(n => {
    console.log(`[RESET] ${n} DecisionProfile row(s) moved from PUBLISHED to DRAFT`)
    return prisma.$disconnect()
  }).catch(e => { console.error(e); process.exit(1) })
}
