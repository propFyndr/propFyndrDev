// Deletes guest chat sessions and referral tracking data older than the
// 12-month retention window stated in /privacy (§12). Dry-run by default —
// prints what WOULD be deleted. Pass --apply to actually delete.
//
// Usage:
//   npx tsx scripts/purge-retention.ts            # dry run, prints counts
//   npx tsx scripts/purge-retention.ts --apply     # actually deletes
import { prisma } from '../src/lib/db'

const RETENTION_MONTHS = 12

export function computeCutoff(now: Date): Date {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS)
  return cutoff
}

export async function run(apply: boolean): Promise<{ chatSessions: number; referralVisits: number }> {
  const cutoff = computeCutoff(new Date())

  // Guest chat sessions (user_id null) older than the window. ChatMessage
  // rows cascade with the session (see the ChatSession model's existing
  // relation), so no separate message cleanup is needed.
  const staleSessions = await prisma.chatSession.findMany({
    where: { user_id: null, last_active: { lt: cutoff } },
    select: { id: true },
  })

  // Referral visits older than the window — and ONLY the ones with no
  // associated sign-in (user_id null), since a signed-in user's own account
  // data is governed by account deletion, not this guest-data purge.
  const staleVisits = await prisma.referralVisit.findMany({
    where: { user_id: null, first_seen_at: { lt: cutoff } },
    select: { guest_token: true, own_code: true },
  })

  if (apply) {
    if (staleSessions.length > 0) {
      await prisma.chatSession.deleteMany({ where: { id: { in: staleSessions.map((s) => s.id) } } })
    }
    if (staleVisits.length > 0) {
      await prisma.referralVisit.deleteMany({ where: { guest_token: { in: staleVisits.map((v) => v.guest_token) } } })
      await prisma.referralLink.deleteMany({ where: { code: { in: staleVisits.map((v) => v.own_code) }, kind: 'PERSONAL' } })
    }
  }

  return { chatSessions: staleSessions.length, referralVisits: staleVisits.length }
}

if (require.main === module) {
  const apply = process.argv.includes('--apply')
  run(apply).then((counts) => {
    console.log(apply ? 'Deleted:' : 'Would delete (dry run — pass --apply to actually delete):', counts)
    process.exit(0)
  }).catch((err) => {
    console.error('[PURGE_RETENTION:FAILED]', err)
    process.exit(1)
  })
}
