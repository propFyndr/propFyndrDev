// Removes construction_updates.photo_urls entries that point at our object storage and return 404.
// (5 Nov: 13 links pointed at files that were never uploaded, even on Supabase.) A link that
// loads is never touched; a link on another host is never touched.
//
//   npx tsx scripts/storage/clear-dead-photo-links.ts                   # dev, dry run
//   npx tsx scripts/storage/clear-dead-photo-links.ts --apply           # dev, write
//   npx tsx scripts/storage/clear-dead-photo-links.ts --live --apply    # live (NEON_DB)
// Writes a JSON backup of every changed row to backend/backups before any write.
import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const apply = process.argv.includes('--apply')
const live = process.argv.includes('--live')
const OURS = /^https:\/\/[a-z0-9-]+\.storage\.[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech\//

async function isDead(url: string): Promise<boolean> {
  const r = await fetch(url, { method: 'HEAD' })
  return r.status === 404
}

async function main() {
  const dbUrl = live ? process.env.NEON_DB : process.env.DATABASE_URL
  if (!dbUrl) throw new Error('database url not set')
  const host = new URL(dbUrl).host
  if (!live && host.includes('ep-super-water')) throw new Error('DATABASE_URL points at LIVE; pass --live explicitly')
  const prisma = new PrismaClient({ datasourceUrl: dbUrl })
  try {
    console.log(`db: ${host}  mode: ${apply ? 'APPLY' : 'dry run'}`)
    const rows = await prisma.$queryRaw<Array<{ id: string; photo_urls: string[] }>>`
      SELECT id, photo_urls FROM construction_updates WHERE cardinality(photo_urls) > 0`
    const changes: Array<{ id: string; before: string[]; after: string[] }> = []
    for (const r of rows) {
      const keep: string[] = []
      for (const u of r.photo_urls) keep.push(...((OURS.test(u) && (await isDead(u))) ? [] : [u]))
      if (keep.length !== r.photo_urls.length) changes.push({ id: r.id, before: r.photo_urls, after: keep })
    }
    const removed = changes.reduce((n, c) => n + c.before.length - c.after.length, 0)
    console.log(`rows with photos: ${rows.length}; dead links to remove: ${removed} in ${changes.length} rows`)
    if (!apply || !changes.length) return
    mkdirSync(join(__dirname, '../../backups'), { recursive: true })
    const backup = join(__dirname, `../../backups/dead-photo-links-${live ? 'live' : 'dev'}-${Date.now()}.json`)
    writeFileSync(backup, JSON.stringify(changes, null, 2))
    console.log(`backup: ${backup}`)
    await prisma.$transaction(changes.map((c) => prisma.$executeRaw`UPDATE construction_updates SET photo_urls = ${c.after} WHERE id = ${c.id}`))
    console.log('done')
  } finally {
    await prisma.$disconnect()
  }
}
main().catch((e) => { console.error('ERR', e?.message ?? e); process.exit(1) })
