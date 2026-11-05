// Imports buyer accounts exported from Supabase Auth into Better Auth's tables,
// keeping each user's Supabase id (so chats, saves and leads stay theirs) and
// their bcrypt password hash (so nobody has to reset a password).
//
// Export (Supabase dashboard → SQL editor), saved as JSON OUTSIDE the repo:
//   select id, email, encrypted_password, email_confirmed_at, created_at,
//          raw_user_meta_data->>'name' as name
//   from auth.users;
//
//   npx tsx scripts/auth/import-supabase-users.ts <export.json>                  # dev, dry run
//   npx tsx scripts/auth/import-supabase-users.ts <export.json> --apply          # dev, write
//   npx tsx scripts/auth/import-supabase-users.ts <export.json> --live --apply   # live, only on Furqan's yes
//
// Never prints a hash. Writes a backup of the auth tables to backend/backups
// before any write. Re-runnable: an id already imported is updated, not duplicated.
import 'dotenv/config'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

export interface ExportRow {
  id: string
  email: string | null
  encrypted_password: string | null
  email_confirmed_at: string | null
  created_at: string | null
  name?: string | null
}

export interface ImportUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
  createdAt: Date
  passwordHash: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validates and normalises the export. Rows without an email are skipped and counted. */
export function parseExport(rows: unknown): { users: ImportUser[]; skipped: Array<{ id: string; reason: string }> } {
  if (!Array.isArray(rows)) throw new Error('export must be a JSON array of rows')
  const users: ImportUser[] = []
  const skipped: Array<{ id: string; reason: string }> = []
  const seen = new Set<string>()
  for (const r of rows as ExportRow[]) {
    const id = String(r?.id ?? '')
    if (!UUID.test(id)) { skipped.push({ id, reason: 'id is not a UUID' }); continue }
    const email = (r.email ?? '').trim().toLowerCase()
    if (!email.includes('@')) { skipped.push({ id, reason: 'no email' }); continue }
    if (seen.has(email)) { skipped.push({ id, reason: 'duplicate email' }); continue }
    seen.add(email)
    const hash = r.encrypted_password && /^\$2[aby]\$\d\d\$/.test(r.encrypted_password) ? r.encrypted_password : null
    users.push({
      id,
      email,
      name: (r.name ?? '').trim() || email.split('@')[0],
      emailVerified: Boolean(r.email_confirmed_at),
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
      passwordHash: hash,
    })
  }
  return { users, skipped }
}

async function main() {
  const file = process.argv[2]
  if (!file || file.startsWith('--')) throw new Error('usage: import-supabase-users.ts <export.json> [--apply] [--live]')
  const apply = process.argv.includes('--apply')
  const live = process.argv.includes('--live')
  const url = live ? process.env.NEON_DB : process.env.DATABASE_URL
  if (!url) throw new Error(live ? 'NEON_DB not set' : 'DATABASE_URL not set')
  const host = new URL(url).host
  if (!live && host.includes('ep-super-water')) throw new Error('DATABASE_URL points at LIVE; pass --live explicitly')

  const { users, skipped } = parseExport(JSON.parse(readFileSync(file, 'utf8')))
  const prisma = new PrismaClient({ datasourceUrl: url })
  try {
    console.log(`db: ${host}  mode: ${apply ? 'APPLY' : 'dry run'}`)
    console.log(`export: ${users.length} users to import, ${users.filter((u) => u.passwordHash).length} with a bcrypt hash, ${users.filter((u) => u.emailVerified).length} verified; skipped ${skipped.length}`)
    for (const s of skipped) console.log(`  skipped ${s.id || '(no id)'}: ${s.reason}`)

    const ids = users.map((u) => u.id)
    const existing = await prisma.authUser.findMany({ where: { id: { in: ids } }, select: { id: true } })
    const chats = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(DISTINCT user_id) AS n FROM chat_sessions WHERE user_id = ANY(${ids})`
    console.log(`already imported: ${existing.length}; of these ids, ${chats[0]?.n ?? 0} own chat sessions in this database`)
    if (!apply) { console.log('dry run: nothing written. Re-run with --apply.'); return }

    mkdirSync(join(__dirname, '../../backups'), { recursive: true })
    const backup = join(__dirname, `../../backups/auth-before-import-${live ? 'live' : 'dev'}-${Date.now()}.json`)
    const snapshot = {
      users: await prisma.authUser.findMany(),
      accounts: (await prisma.authAccount.findMany()).map((a) => ({ ...a, password: a.password ? '[redacted]' : null })),
    }
    writeFileSync(backup, JSON.stringify(snapshot, null, 2))
    console.log(`backup: ${backup}`)

    for (const u of users) {
      await prisma.$transaction(async (tx) => {
        await tx.authUser.upsert({
          where: { id: u.id },
          create: { id: u.id, email: u.email, name: u.name, emailVerified: u.emailVerified, createdAt: u.createdAt, updatedAt: new Date() },
          update: { email: u.email, name: u.name, emailVerified: u.emailVerified },
        })
        if (u.passwordHash) {
          const acc = await tx.authAccount.findFirst({ where: { userId: u.id, providerId: 'credential' } })
          if (acc) await tx.authAccount.update({ where: { id: acc.id }, data: { password: u.passwordHash } })
          else await tx.authAccount.create({ data: { id: randomUUID(), accountId: u.id, providerId: 'credential', userId: u.id, password: u.passwordHash, createdAt: u.createdAt, updatedAt: new Date() } })
        }
      })
    }
    console.log(`imported ${users.length} users. Delete the export file now: it holds password hashes.`)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
