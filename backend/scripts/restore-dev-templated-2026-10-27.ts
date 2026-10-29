// One-off, 2026-10-27, owner-approved: put back on DEV the values pass 3 cleared on 2026-10-16,
// so dev answers project questions the way live does (live was never cleared).
//
// Source: backups/templated-pass3-dev-2026-10-16T14-16-41-477Z.json (full rows taken before pass 3).
// Only fields that are empty now and held a value in the backup are written, so anything edited
// on dev since 16 Oct is left alone. Bookkeeping and the duplicate-archive marker are skipped.
// The current values of every touched row are saved to backups/ first.
//
// Dev only: refuses to run when DATABASE_URL is Neon. Dry run by default; pass --apply.
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { isLiveDatabase } from '../src/lib/liveDatabase'

const APPLY = process.argv.includes('--apply')
if (!process.env.DATABASE_URL || isLiveDatabase(process.env.DATABASE_URL)) {
  console.error('DATABASE_URL must be the dev (Supabase) database.')
  process.exit(1)
}
const prisma = new PrismaClient()
const backup = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backups', 'templated-pass3-dev-2026-10-16T14-16-41-477Z.json'), 'utf8'))
const SKIP = new Set(['id', 'created_at', 'updated_at', 'archived_duplicate_of', 'embedding'])

const isEmpty = (v: unknown) => v === null || v === undefined || (Array.isArray(v) && v.length === 0) || v === ''

type Table = { name: string; rows: Array<Record<string, any>>; load: (ids: string[]) => Promise<Array<Record<string, any>>>; write: (id: string, data: Record<string, unknown>) => Promise<unknown> }

const TABLES: Table[] = [
  {
    name: 'cost_sheets',
    rows: backup.cost_sheets,
    load: (ids) => prisma.costSheet.findMany({ where: { id: { in: ids } } }),
    write: (id, data) => prisma.costSheet.update({ where: { id }, data }),
  },
  {
    name: 'projects',
    rows: backup.projects,
    load: (ids) => prisma.project.findMany({ where: { id: { in: ids } } }),
    write: (id, data) => prisma.project.update({ where: { id }, data }),
  },
  {
    name: 'builders',
    rows: backup.builders,
    load: (ids) => prisma.builder.findMany({ where: { id: { in: ids } } }),
    write: (id, data) => prisma.builder.update({ where: { id }, data }),
  },
]

async function main() {
  const plan: Array<{ table: string; id: string; data: Record<string, unknown>; before: Record<string, unknown> }> = []
  for (const t of TABLES) {
    const current = new Map((await t.load(t.rows.map((r) => r.id))).map((r) => [r.id, r]))
    const fieldCounts: Record<string, number> = {}
    for (const old of t.rows) {
      const now = current.get(old.id)
      if (!now) continue
      const data: Record<string, unknown> = {}
      const before: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(old)) {
        if (SKIP.has(k) || !(k in now) || isEmpty(v) || !isEmpty(now[k])) continue
        data[k] = v
        before[k] = now[k]
        fieldCounts[k] = (fieldCounts[k] ?? 0) + 1
      }
      if (Object.keys(data).length) plan.push({ table: t.name, id: old.id, data, before })
    }
    const top = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])
    console.log(`${t.name}: ${plan.filter((p) => p.table === t.name).length} rows, fields: ${top.map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`)
  }
  if (!APPLY) return console.log('Dry run. Pass --apply to write.')

  const file = path.join(__dirname, '..', 'backups', `dev-before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(file, JSON.stringify(plan.map(({ table, id, before }) => ({ table, id, before }))))
  console.log('Backup of current values:', file)
  let done = 0
  for (const p of plan) {
    await TABLES.find((t) => t.name === p.table)!.write(p.id, p.data)
    done++
  }
  console.log(`Restored ${done} rows.`)
}

main().finally(() => prisma.$disconnect())
