// One-off, 2026-10-27, owner-approved: keep our own test traffic out of live numbers.
//
// Before 15 Oct, live and tests shared one database, and Neon holds that copy.
//   1. Chat sessions created before 15 Oct that are provably tests become is_bot=true.
//      Tests means: the first message is a chat.test.ts fixture, the session has no
//      messages, or it carries a test guest token or the title "test". Nothing is deleted;
//      flip is_bot back using the ids in the backup.
//   2. Callback requests on the dummy number 9876543210 are deleted. Rows and their
//      LeadObjection children are saved to the backup first.
//
// Dry run by default. Usage: npx tsx scripts/clean-live-test-traffic-2026-10-27.ts --db=live [--apply]
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const DB = process.argv.find((a) => a.startsWith('--db='))?.slice(5)
const APPLY = process.argv.includes('--apply')
const URL = DB === 'dev' ? process.env.DATABASE_URL : DB === 'live' ? process.env.NEON_DB : undefined
if (!URL) {
  console.error('Pass --db=dev (DATABASE_URL, Supabase) or --db=live (NEON_DB).')
  process.exit(1)
}
const prisma = new PrismaClient({ datasources: { db: { url: URL } } })

const SPLIT = '2026-10-15'
const FIXTURES = ['test', 'What is the price of non-existent project XYZ?', 'Show me 3BHK properties under 1.5 crore in Noida']
const DUMMY_PHONES = ['9876543210', '+919876543210']

async function main() {
  const sessions = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT cs.id FROM chat_sessions cs
    WHERE cs.is_bot = false AND cs.created_at < ${SPLIT}::date AND (
      (SELECT content FROM chat_messages WHERE session_id = cs.id AND role = 'user' ORDER BY created_at LIMIT 1) = ANY(${FIXTURES})
      OR NOT EXISTS (SELECT 1 FROM chat_messages WHERE session_id = cs.id)
      OR COALESCE(cs.guest_token, '') ~ '^(verify|probe-|smoke-|test|adv_|deep-s)'
      OR cs.title = 'test'
    )`
  const callbacks = await prisma.callbackRequest.findMany({ where: { phone: { in: DUMMY_PHONES } }, include: { objections: true } })
  console.log(`[${DB}] sessions to flag: ${sessions.length}, callbacks to delete: ${callbacks.length}`)
  if (!APPLY) return console.log('Dry run. Pass --apply to write.')

  const dir = path.join(__dirname, '..', 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `live-test-traffic-${DB}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(file, JSON.stringify({ flaggedSessionIds: sessions.map((s) => s.id), deletedCallbacks: callbacks }, null, 1))
  console.log('Backup:', file)

  const ids = sessions.map((s) => s.id)
  // One array parameter: 40k ids as separate binds exceed Postgres's 32,767 limit.
  const [flagged, deleted] = await prisma.$transaction([
    prisma.$executeRaw`UPDATE chat_sessions SET is_bot = true WHERE id = ANY(${ids})`,
    prisma.$executeRaw`DELETE FROM callback_requests WHERE id = ANY(${callbacks.map((c) => c.id)})`,
  ], { timeout: 120_000 })
  console.log(`Flagged ${flagged} sessions, deleted ${deleted} callbacks.`)
}

main().finally(() => prisma.$disconnect())
