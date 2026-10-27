// One-off, 2026-10-27, owner-approved: only real people in live numbers.
//
//   1. Supabase Auth: delete 23 fake sign-ups (keyboard-mash/test emails, June–Aug).
//   2. Neon: delete the owner's 2 test callbacks ("furqan", "furqam").
//   3. Neon: set is_bot=true on every remaining session that the website did not create.
//      The website has always sent a `guest-<uuid>` token (frontend/lib/guestToken.ts) or a
//      signed-in account. Server-minted `guest_…` tokens (no token sent) and hand-made ones
//      (rf_, stress-, smoke_, g-17…) are scripts, and the 23 fake accounts' sessions go too.
//
// Everything changed is saved to backend/backups first. Dry run by default; pass --apply.
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const APPLY = process.argv.includes('--apply')
const supabase = new PrismaClient() // DATABASE_URL: the Supabase project that holds auth.users
const neon = new PrismaClient({ datasources: { db: { url: process.env.NEON_DB } } })

const FAKE_EMAILS = [
  'user@user.com', 'user@user.testt', 'test@test.com', 'furqan@test.in', 'furqannn@test.in', 'testtt@test.in',
  'test@test.combfg', 'vdfvdv@f.in', 'dfvdfv@ferfe.in', 'dfvfdvdfv@feeve.in', 'fffrefe@gfevf.in',
  'gfdggrtgrtz@regregeg.kn', 'erfreferfre@frewfre.in', 'tgrtgtrgr@grgr.kn', 'hdhdh@djdj.in', 'gdfgfdg@gd.in',
  'fsfsfsd@dgfdf.in', 'vfdvdfvd@dfvdfd.vin', 'rhttrg@frewger.in', 'evwerwv@fefwe.in', 'svdvdfs@wfrfein',
  'ferfrefw@fref.in', 'fdsfdf@frfe.in',
]
const OWNER_TEST_LEADS = [{ phone: '9988881178', name: 'furqan' }, { phone: '9876543213', name: 'furqam' }]

async function main() {
  const fakeUsers = await supabase.$queryRaw<Array<{ id: string; email: string }>>`
    SELECT id::text, email FROM auth.users WHERE email = ANY(${FAKE_EMAILS})`
  const identities = await supabase.$queryRaw<any[]>`
    SELECT * FROM auth.identities WHERE user_id::text = ANY(${fakeUsers.map((u) => u.id)})`
  const fakeIds = fakeUsers.map((u) => u.id)

  const leads = await neon.callbackRequest.findMany({ where: { OR: OWNER_TEST_LEADS } })
  const sessions = await neon.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM chat_sessions
    WHERE is_bot = false AND (
      (user_id IS NULL AND COALESCE(guest_token, '') NOT LIKE 'guest-%')
      OR user_id = ANY(${fakeIds})
    )`

  console.log(`fake accounts found: ${fakeUsers.length}/${FAKE_EMAILS.length}`)
  console.log(`owner test leads: ${leads.length}, script/fake sessions to flag: ${sessions.length}`)
  if (fakeUsers.length !== FAKE_EMAILS.length) throw new Error('Account list mismatch; nothing written.')
  if (!APPLY) return console.log('Dry run. Pass --apply to write.')

  const dir = path.join(__dirname, '..', 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const authRows = await supabase.$queryRaw<any[]>`SELECT * FROM auth.users WHERE id::text = ANY(${fakeIds})`
  const file = path.join(dir, `live-fake-users-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(file, JSON.stringify({ authUsers: authRows, identities, deletedLeads: leads, flaggedSessionIds: sessions.map((s) => s.id) }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 1))
  console.log('Backup:', file)

  const [flagged, deletedLeads] = await neon.$transaction([
    neon.$executeRaw`UPDATE chat_sessions SET is_bot = true WHERE id = ANY(${sessions.map((s) => s.id)})`,
    neon.$executeRaw`DELETE FROM callback_requests WHERE id = ANY(${leads.map((l) => l.id)})`,
  ])
  console.log(`Neon: flagged ${flagged} sessions, deleted ${deletedLeads} leads.`)
  const deletedUsers = await supabase.$executeRaw`DELETE FROM auth.users WHERE id::text = ANY(${fakeIds})`
  console.log(`Supabase: deleted ${deletedUsers} accounts.`)
}

main().finally(() => Promise.all([supabase.$disconnect(), neon.$disconnect()]))
