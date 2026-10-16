// One-off (2026-10-16, owner-approved): back up, then
//   1. delete placeholder competitor rows a script wrote with no real project
//      behind them ("Nearby Micro-Market Development", "Adjacent Premium
//      Project in Sector N", "Sector N Micro-Market Benchmark Society", ...), and
//   2. blank projects.expected_handover_quarter = 'Q4 2026' (the column holds only
//      "Delivered" and "Q4 2026"; the latter is a script default, not data).
// Runs on Supabase (DATABASE_URL) first, then Neon (NEON_DB). Backups go to
// C:\Users\Furqan\Desktop\RealtyPals-db-backups\. Without --apply it only backs up and counts.
//
//   node --env-file=.env --require tsx/cjs scripts/cleanup-placeholder-competitors-2026-10-16.ts --apply
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

const PH = `competitor_name ~* '^(Nearby Micro-Market Development|Adjacent Premium Project in Sector|Sector [^ ]+ (Alternate Landmark|Micro-Market Benchmark Society|Secondary Ready Enclave))' and competitor_project_id is null`

async function run(label: string, url: string, apply: boolean) {
  const db = new PrismaClient({ datasources: { db: { url } } })
  try {
    const comps = await db.$queryRawUnsafe<any[]>(`select * from project_competitors where ${PH} order by id`)
    const quarters = await db.$queryRawUnsafe<any[]>(`select id, slug, expected_handover_quarter from projects where expected_handover_quarter = 'Q4 2026' order by id`)
    const file = `C:/Users/Furqan/Desktop/RealtyPals-db-backups/${label.toLowerCase()}-2026-10-16-placeholder-competitors-and-handover.json`
    writeFileSync(file, JSON.stringify({ label, taken_at: new Date().toISOString(), competitors: comps, handover_quarters: quarters }, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2))
    console.log(label, 'backed up', comps.length, 'competitor rows and', quarters.length, 'handover quarters to', file)
    if (!apply) return
    const [del, upd] = await db.$transaction([
      db.$executeRawUnsafe(`delete from project_competitors where id = any($1)`, comps.map((c) => c.id)),
      db.$executeRawUnsafe(`update projects set expected_handover_quarter = null where id = any($1)`, quarters.map((q) => q.id)),
    ])
    const [left] = await db.$queryRawUnsafe<any[]>(`select (select count(*)::int from project_competitors where ${PH}) comps, (select count(*)::int from projects where expected_handover_quarter = 'Q4 2026') q4`)
    console.log(label, 'deleted', del, 'competitor rows; blanked', upd, 'handover quarters; left', left)
  } finally {
    await db.$disconnect()
  }
}

;(async () => {
  const apply = process.argv.includes('--apply')
  await run('SUPABASE', process.env.DATABASE_URL!, apply)
  await run('NEON', process.env.NEON_DB!, apply)
})().catch((e) => {
  console.error(String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '<url>'))
  process.exit(1)
})
