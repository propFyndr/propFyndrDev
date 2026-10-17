/**
 * Old-brand values left in the catalogue by the seed scripts (17 Oct 2026).
 *
 *   npx tsx scripts/fix-old-brand-values.ts --db=dev            # dry run: every column holding "PropFyndr"
 *   npx tsx scripts/fix-old-brand-values.ts --db=dev --apply    # backs up the rows, then clears attribution columns
 *   npx tsx scripts/fix-old-brand-values.ts --db=live --apply   # the same on Neon
 *
 * Seeds wrote `verified_by: 'PropFyndr Audit Desk'`, 'PropFyndr Site Inspection
 * Team' and the like. yieldTable prints a sector row's verified_by to buyers, and
 * "Site Inspection" claims an inspection nobody made. Attribution columns
 * (verified_by, source) are cleared to NULL: nobody we can name verified them.
 * Blog bylines are renamed to RealtyAsk. Any other column holding the old name
 * (admin emails, audit logs, past chat transcripts) is listed, not changed:
 * those are records of what happened, not claims shown as current.
 */
import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'

const APPLY = process.argv.includes('--apply')
const DB = process.argv.find((a) => a.startsWith('--db='))?.split('=')[1] ?? ''
const URL = DB === 'dev' ? process.env.DATABASE_URL : DB === 'live' ? process.env.NEON_DB : undefined
if (!URL) {
  console.error('Pass --db=dev (DATABASE_URL, Supabase) or --db=live (NEON_DB).')
  process.exit(1)
}
const db = new PrismaClient({ datasources: { db: { url: URL } } })
const CLEARED = new Set(['verified_by', 'source'])
// Public bylines: the brand was renamed, the author is the same desk.
const RENAMED = new Set(['blog_posts.author_name'])
const q = (id: string) => `"${id.replace(/"/g, '""')}"`

async function main(): Promise<void> {
  console.log(`== old brand on ${DB} (${APPLY ? 'APPLY' : 'dry run'}) ==`)
  const cols = await db.$queryRawUnsafe<{ table_name: string; column_name: string; data_type: string }[]>(
    `SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND data_type IN ('text', 'character varying', 'jsonb', 'json')`,
  )
  const backup: Record<string, unknown[]> = {}
  mkdirSync('backups', { recursive: true })
  const file = join('backups', `old-brand-${DB}-${Date.now()}.json`)
  for (const c of cols) {
    const where = `${q(c.column_name)}::text ILIKE '%propfyndr%'`
    const [{ n }] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${q(c.table_name)} WHERE ${where}`)
    if (Number(n) === 0) continue
    const rename = RENAMED.has(`${c.table_name}.${c.column_name}`)
    const clear = !rename && CLEARED.has(c.column_name) && c.data_type !== 'jsonb' && c.data_type !== 'json'
    const [sample] = await db.$queryRawUnsafe<{ v: string }[]>(`SELECT ${q(c.column_name)}::text AS v FROM ${q(c.table_name)} WHERE ${where} LIMIT 1`)
    console.log(`${rename ? 'RENAME' : clear ? 'CLEAR' : 'list '} ${c.table_name}.${c.column_name}: ${n} rows  e.g. ${String(sample?.v).slice(0, 80)}`)
    if (!(clear || rename) || !APPLY) continue
    backup[`${c.table_name}.${c.column_name}`] = await db.$queryRawUnsafe(`SELECT * FROM ${q(c.table_name)} WHERE ${where}`)
    writeFileSync(file, JSON.stringify(backup, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)) // before the write
    const value = rename ? `regexp_replace(${q(c.column_name)}, 'prop\\s*fyndr', 'RealtyAsk', 'gi')` : 'NULL'
    const updated = await db.$executeRawUnsafe(`UPDATE ${q(c.table_name)} SET ${q(c.column_name)} = ${value} WHERE ${where}`)
    console.log(`  cleared ${updated}`)
  }
  if (APPLY && Object.keys(backup).length) console.log(`backup: ${file}`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => db.$disconnect())
