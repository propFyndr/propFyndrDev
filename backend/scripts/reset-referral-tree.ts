/**
 * Clears the referral tree and starts it again from one ROOT link.
 *
 *   npx tsx scripts/reset-referral-tree.ts --db=dev            # dry run: counts only
 *   npx tsx scripts/reset-referral-tree.ts --db=dev --apply    # backup, then delete + create in one transaction
 *   npx tsx scripts/reset-referral-tree.ts --db=live --apply   # the same on Neon
 *
 * Deletes every ROOT referral_links row (except one already labelled for
 * Furqan Arth, which is kept and then no new one is made), every
 * referral_visits row under those roots, and the PERSONAL links those
 * visitors own. Visits outside a ROOT tree (organic, generation 0) and every
 * chat, save and lead are left alone. Then creates one ROOT link by the admin
 * furqan@realtyask.in, labelled "Furqan Arth — RealtyAsk.in".
 *
 * Every deleted row is written to
 * C:\Users\Furqan\Desktop\RealtyPals-db-backups\referral-reset-<db>-<timestamp>.json
 * before anything is deleted.
 */
import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { Prisma, PrismaClient } from '@prisma/client'
import { generateReferralCode } from '../src/lib/referralCode'

const APPLY = process.argv.includes('--apply')
const DB = process.argv.find((a) => a.startsWith('--db='))?.split('=')[1]
const URL = DB === 'dev' ? process.env.DATABASE_URL : DB === 'live' ? process.env.NEON_DB : undefined
if (!URL) {
  console.error('Pass --db=dev (DATABASE_URL, Supabase) or --db=live (NEON_DB).')
  process.exit(1)
}

const OWNER_EMAIL = 'furqan@realtyask.in'
const LABEL = 'Furqan Arth — RealtyAsk.in'
const GREETING = 'Furqan'
const KEEP_LABEL = /furqan arth/i
const BACKUP_DIR = 'C:\\Users\\Furqan\\Desktop\\RealtyPals-db-backups'

const db = new PrismaClient({ datasources: { db: { url: URL } } })

async function main(): Promise<void> {
  const owner = await db.adminUser.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true, role: true } })

  const roots = await db.referralLink.findMany({ where: { kind: 'ROOT' } })
  const kept = roots.find((r) => r.label && KEEP_LABEL.test(r.label)) ?? null
  const doomedRoots = roots.filter((r) => r !== kept)
  const rootCodes = doomedRoots.map((r) => r.code)

  const visits = rootCodes.length ? await db.referralVisit.findMany({ where: { root_code: { in: rootCodes } } }) : []
  const tokens = visits.map((v) => v.guest_token)
  const personal: typeof roots = []
  for (let i = 0; i < tokens.length; i += 1000) {
    personal.push(...(await db.referralLink.findMany({
      where: { kind: 'PERSONAL', owner_guest_token: { in: tokens.slice(i, i + 1000) } },
    })))
  }

  const byCreator: Record<string, number> = {}
  for (const r of doomedRoots) byCreator[r.created_by_admin_id ?? '(none)'] = (byCreator[r.created_by_admin_id ?? '(none)'] ?? 0) + 1

  console.log(`[${DB}] ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`  ROOT links to delete:      ${doomedRoots.length}`, byCreator)
  console.log(`  referral_visits to delete: ${visits.length}`)
  console.log(`  PERSONAL links to delete:  ${personal.length}`)
  if (!owner) {
    // Checked before the backup and the transaction: a missing owner changes nothing.
    console.error(`  OWNER MISSING: no admin_users row for ${OWNER_EMAIL} on ${DB}. Nothing changed.`)
    process.exitCode = 1
    return
  }
  console.log(`  owner admin ${OWNER_EMAIL}: ${owner.id} (${owner.role})`)
  console.log(kept ? `  kept ROOT ${kept.code} "${kept.label}" — no new link created` : `  new ROOT link: "${LABEL}", greeting "${GREETING}", created by ${owner.id}`)
  if (!APPLY) return

  mkdirSync(BACKUP_DIR, { recursive: true })
  const takenAt = new Date().toISOString()
  const file = join(BACKUP_DIR, `referral-reset-${DB}-${takenAt.replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify({ taken_at: takenAt, db: DB, root_links: doomedRoots, referral_visits: visits, personal_links: personal }, null, 2))
  console.log(`  backup: ${file}`)

  let code = generateReferralCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!(await db.referralLink.findUnique({ where: { code } }))) break
    code = generateReferralCode()
  }

  const result = await db.$transaction(async (tx) => {
    // PERSONAL first: it is selected through the visits deleted next.
    const personalDeleted = rootCodes.length
      ? await tx.$executeRaw`
          DELETE FROM referral_links WHERE kind = 'PERSONAL' AND owner_guest_token IN (
            SELECT guest_token FROM referral_visits WHERE root_code IN (${Prisma.join(rootCodes)}))`
      : 0
    const visitsDeleted = rootCodes.length ? (await tx.referralVisit.deleteMany({ where: { root_code: { in: rootCodes } } })).count : 0
    const rootsDeleted = rootCodes.length ? (await tx.referralLink.deleteMany({ where: { code: { in: rootCodes } } })).count : 0
    if (!kept) {
      await tx.referralLink.create({
        data: { code, kind: 'ROOT', label: LABEL, greeting_name: GREETING, created_by_admin_id: owner.id },
      })
    }
    return { personalDeleted, visitsDeleted, rootsDeleted }
  }, { timeout: 120_000 })

  console.log(`  deleted: ${result.rootsDeleted} ROOT, ${result.visitsDeleted} visits, ${result.personalDeleted} PERSONAL`)
  if (!kept) console.log(`  new ROOT code ${code}  ->  https://realtyask.in/r/${code}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
