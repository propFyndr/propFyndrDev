// One-off, 2026-10-27, owner-approved: empty the dev (Supabase) chat history.
//
// Dev's chat tables were ~190 MB, almost all test runs. Sessions also on Neon (copied on
// 15 Oct) are not downloaded again: pulling them out would spend Supabase egress, which is
// what is blocked. Only the dev-only sessions and their child rows go to backend/backups.
// Deleting chat_sessions cascades to every table with a foreign key to it.
//
// Dev only: refuses to run if DATABASE_URL is Neon. Dry run by default; pass --apply.
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const APPLY = process.argv.includes('--apply')
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('neon.tech')) {
  console.error('DATABASE_URL must be the dev (Supabase) database.')
  process.exit(1)
}
const dev = new PrismaClient()
const neon = new PrismaClient({ datasources: { db: { url: process.env.NEON_DB } } })

async function main() {
  const children = await dev.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'chat_sessions' AND tc.table_schema = 'public'`

  const neonIds = new Set((await neon.$queryRaw<{ id: string }[]>`SELECT id FROM chat_sessions`).map((r) => r.id))
  const devIds = (await dev.$queryRaw<{ id: string }[]>`SELECT id FROM chat_sessions`).map((r) => r.id)
  const devOnly = devIds.filter((id) => !neonIds.has(id))
  console.log(`dev sessions: ${devIds.length}, dev-only (backed up): ${devOnly.length}`)
  console.log('child tables:', children.map((c) => `${c.table_name}.${c.column_name}`).join(', '))
  if (!APPLY) return console.log('Dry run. Pass --apply to write.')

  const backup: Record<string, unknown[]> = {
    chat_sessions: await dev.$queryRawUnsafe(`SELECT * FROM chat_sessions WHERE id = ANY($1)`, devOnly),
  }
  for (const c of children) {
    backup[`${c.table_name}.${c.column_name}`] = await dev.$queryRawUnsafe(
      `SELECT * FROM "${c.table_name}" WHERE "${c.column_name}" = ANY($1)`,
      devOnly,
    )
  }
  const dir = path.join(__dirname, '..', 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `dev-chat-history-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(file, JSON.stringify(backup, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
  console.log('Backup:', file)

  const deleted = await dev.$executeRawUnsafe(`DELETE FROM chat_sessions`)
  console.log(`Deleted ${deleted} dev sessions (children cascaded).`)
  // Space is only returned to the disk by a full vacuum, which the transaction pooler
  // (DATABASE_URL, port 6543) refuses, so it runs on the direct connection.
  const direct = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })
  for (const t of ['chat_sessions', ...new Set(children.map((c) => c.table_name))]) {
    await direct.$executeRawUnsafe(`VACUUM FULL "${t}"`)
  }
  const [size] = await direct.$queryRaw<{ size: string }[]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`
  console.log('Dev database size now:', size.size)
  await direct.$disconnect()
}

main().finally(() => Promise.all([dev.$disconnect(), neon.$disconnect()]))
