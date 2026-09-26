// backend/scripts/apply-migration.ts
//
//   npx tsx scripts/apply-migration.ts <migration_name>
//
// Applies ONE folder under prisma/migrations and records it in the
// _prisma_migrations ledger, in a single transaction.
//
// `prisma migrate deploy` is deliberately not used: this database carries
// unapplied migrations that nobody has decided to run (one drops a table), and
// deploy would run them all. See scripts/apply-forensic-nullable.ts and the
// 2026-09-04 entry in MEMORY.md.
//
// Safe to run twice: returns early if the ledger already carries the name.

import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/lib/db'

async function main(): Promise<void> {
  const name = process.argv[2]
  if (!name || !/^[a-z0-9_]+$/.test(name)) throw new Error('usage: apply-migration.ts <migration_name>')
  const sql = readFileSync(join(__dirname, '..', 'prisma', 'migrations', name, 'migration.sql'), 'utf8')

  const [{ count }] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT count(*)::int AS count FROM _prisma_migrations WHERE migration_name = $1`,
    name,
  )
  if (count > 0) {
    console.log(`${name} is already applied — nothing to do.`)
    return
  }

  // Comment lines stripped, then split on statement terminators. Migrations
  // applied this way must not contain semicolons inside string literals.
  const statements = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  await prisma.$transaction(async (tx) => {
    for (const s of statements) await tx.$executeRawUnsafe(s)
    await tx.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
       VALUES ($1, $2, now(), $3, now(), 1)`,
      randomUUID(),
      createHash('sha256').update(sql).digest('hex'),
      name,
    )
  })
  console.log(`${name} applied (${statements.length} statements).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
