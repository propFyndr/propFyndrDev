// Applies prisma/migrations/20261105120000_better_auth (additive: four new tables).
//   npx tsx scripts/auth/apply-better-auth-tables.ts          # dev (DATABASE_URL)
//   npx tsx scripts/auth/apply-better-auth-tables.ts --live   # live (NEON_DB), only on Furqan's yes
// Idempotent (CREATE ... IF NOT EXISTS). Prints which tables exist before and after.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const live = process.argv.includes('--live')
const TABLES = ['auth_user', 'auth_session', 'auth_account', 'auth_verification']

async function main() {
  const url = live ? process.env.NEON_DB : process.env.DATABASE_URL
  if (!url) throw new Error(live ? 'NEON_DB not set' : 'DATABASE_URL not set')
  const host = new URL(url).host
  if (!live && host.includes('ep-super-water')) throw new Error('DATABASE_URL points at LIVE; pass --live explicitly')
  const prisma = new PrismaClient({ datasourceUrl: url })
  const present = async () =>
    (await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${TABLES})`).map((r) => r.table_name).sort()
  try {
    console.log(`db: ${host}`)
    console.log(`before: ${(await present()).join(', ') || '(none)'}`)
    const sql = readFileSync(join(__dirname, '../../prisma/migrations/20261105120000_better_auth/migration.sql'), 'utf8')
    // Strip comment lines first: a statement that follows a comment block must not be skipped.
    const statements = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
      .split(';').map((s) => s.trim()).filter(Boolean)
    await prisma.$transaction(statements.map((s) => prisma.$executeRawUnsafe(s)))
    console.log(`after:  ${(await present()).join(', ')}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
