// One-off, 2026-10-27, owner-approved: script tokens that start with "guest-" out of live numbers.
// The website mints `guest-<uuid>` (frontend/lib/guestToken.ts); "guest-stress_1_…", "guest-audit"
// and the like are test scripts. Their sessions become is_bot=true; ids saved to backend/backups.
// Dry run by default; pass --apply.
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const neon = new PrismaClient({ datasources: { db: { url: process.env.NEON_DB } } })
const UUID_TOKEN = '^guest-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

async function main() {
  const rows = await neon.$queryRaw<Array<{ id: string; guest_token: string }>>`
    SELECT id, guest_token FROM chat_sessions
    WHERE is_bot = false AND user_id IS NULL AND guest_token LIKE 'guest-%' AND guest_token !~ ${UUID_TOKEN}`
  console.log(`script sessions: ${rows.length}, tokens: ${new Set(rows.map((r) => r.guest_token)).size}`)
  if (!process.argv.includes('--apply')) return console.log('Dry run. Pass --apply to write.')
  const file = path.join(__dirname, '..', 'backups', `live-script-guests-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(file, JSON.stringify(rows))
  console.log('Backup:', file)
  const n = await neon.$executeRaw`UPDATE chat_sessions SET is_bot = true WHERE id = ANY(${rows.map((r) => r.id)})`
  console.log(`Flagged ${n} sessions.`)
}

main().finally(() => neon.$disconnect())
