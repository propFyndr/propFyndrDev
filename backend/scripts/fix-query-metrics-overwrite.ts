// backend/scripts/fix-query-metrics-overwrite.ts
//
// Until commit a279c84e, lib/analytics/tracking.ts ran
//   queryMetrics.updateMany({ where: { session_id }, data: { results_count, had_results } })
// on every search, so every earlier search of a session took the LATEST search's result
// count. Those values are not recoverable. The newest row of each session is correct
// (it was overwritten with its own count); every older row is blanked (NULL), so search
// stats skip it instead of counting a wrong zero or a wrong hit.
//
//   npx tsx scripts/fix-query-metrics-overwrite.ts --before=2026-11-04T10:00:00Z            # dry run, dev DB
//   npx tsx scripts/fix-query-metrics-overwrite.ts --before=... --apply                      # writes dev
//   npx tsx scripts/fix-query-metrics-overwrite.ts --before=... --live [--apply]             # live (NEON_DB)
//
// --before is when the fixed tracking.ts went live; rows written after it are correct.
// --apply writes a JSON backup of every row it changes to backend/backups/ first.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const apply = process.argv.includes('--apply')
const live = process.argv.includes('--live')

async function main() {
  const beforeRaw = arg('before')
  const before = beforeRaw ? new Date(beforeRaw) : null
  if (!before || Number.isNaN(before.getTime())) throw new Error('--before=<ISO time the fix went live> is required')
  const url = live ? process.env.NEON_DB : process.env.DATABASE_URL
  if (!url) throw new Error(live ? 'NEON_DB not set' : 'DATABASE_URL not set')
  const host = new URL(url).host
  if (!live && host.includes('ep-super-water')) throw new Error('DATABASE_URL points at LIVE; pass --live explicitly')
  console.log(`db: ${host}  mode: ${apply ? 'APPLY' : 'dry run'}  before: ${before.toISOString()}`)

  const prisma = new PrismaClient({ datasourceUrl: url })
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; session_id: string; created_at: Date; results_count: number | null; had_results: boolean | null }>>`
      SELECT id, session_id, created_at, results_count, had_results FROM (
        SELECT q.*, ROW_NUMBER() OVER (PARTITION BY q.session_id ORDER BY q.created_at DESC, q.id DESC) AS rn,
               COUNT(*) OVER (PARTITION BY q.session_id) AS n
        FROM query_metrics q WHERE q.created_at < ${before}
      ) r
      WHERE r.n > 1 AND r.rn > 1 AND (r.results_count IS NOT NULL OR r.had_results IS NOT NULL)`
    const [{ total, sessions }] = await prisma.$queryRaw<Array<{ total: number; sessions: number }>>`
      SELECT COUNT(*)::int AS total, COUNT(DISTINCT session_id)::int AS sessions FROM query_metrics WHERE created_at < ${before}`
    const affectedSessions = new Set(rows.map((r) => r.session_id)).size
    console.log(`query_metrics before cutoff: ${total} rows in ${sessions} sessions`)
    console.log(`rows to blank (older searches of multi-search sessions): ${rows.length} in ${affectedSessions} sessions`)
    console.log(`rows kept as they are: ${total - rows.length}`)
    if (!apply || rows.length === 0) return

    const dir = join(__dirname, '..', 'backups')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `query_metrics_overwrite_${live ? 'live' : 'dev'}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(rows, null, 2))
    console.log(`backup: ${file}`)

    let changed = 0
    for (let i = 0; i < rows.length; i += 5000) {
      const ids = rows.slice(i, i + 5000).map((r) => r.id)
      changed += await prisma.$executeRaw`UPDATE query_metrics SET results_count = NULL, had_results = NULL WHERE id = ANY(${ids})`
    }
    console.log(`blanked: ${changed}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
