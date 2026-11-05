// Moves every object from Supabase Storage to Neon Object Storage (same bucket
// names, same keys) and rewrites stored Supabase URLs to the new ones.
//
//   npx tsx scripts/storage/migrate-supabase-storage.ts                   # dev, dry run (lists only)
//   npx tsx scripts/storage/migrate-supabase-storage.ts --apply           # dev: copy objects + rewrite dev rows
//   npx tsx scripts/storage/migrate-supabase-storage.ts --live --apply    # live: only on Furqan's yes, with the
//                                                                         # live STORAGE_* env and NEON_DB
// Copy is idempotent (an object already present with the same size is skipped).
// URL rewrite: every text/array column found holding a Supabase storage URL
// (5 Nov scan: construction_updates.photo_urls only). A JSON backup of every
// row it changes is written to backend/backups first.
import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { putObject, listObjects, publicUrl, type BucketName } from '../../src/lib/objectStorage'

const BUCKETS: BucketName[] = ['property-images', 'project-docs']
const apply = process.argv.includes('--apply')
const live = process.argv.includes('--live')

async function listSupabase(sb: ReturnType<typeof createClient>, bucket: string, prefix = ''): Promise<Array<{ key: string; size: number; mime: string }>> {
  const out: Array<{ key: string; size: number; mime: string }> = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw error
    for (const item of data ?? []) {
      const key = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id == null) out.push(...(await listSupabase(sb, bucket, key))) // a folder
      else out.push({ key, size: Number((item.metadata as any)?.size ?? 0), mime: String((item.metadata as any)?.mimetype ?? 'application/octet-stream') })
    }
    if (!data || data.length < 1000) break
  }
  return out
}

/** Supabase public URL → the same object's Neon URL, or null when it is not a Supabase storage URL. */
export function rewriteUrl(url: string): string | null {
  const m = url.match(/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/(property-images|project-docs)\/(.+)$/)
  return m ? publicUrl(m[1] as BucketName, decodeURIComponent(m[2])) : null
}

async function main() {
  const dbUrl = live ? process.env.NEON_DB : process.env.DATABASE_URL
  if (!dbUrl) throw new Error('database url not set')
  const host = new URL(dbUrl).host
  if (!live && host.includes('ep-super-water')) throw new Error('DATABASE_URL points at LIVE; pass --live explicitly')
  console.log(`db: ${host}  storage: ${process.env.STORAGE_S3_ENDPOINT}  mode: ${apply ? 'APPLY' : 'dry run'}`)

  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  for (const bucket of BUCKETS) {
    const src = await listSupabase(sb, bucket)
    const have = new Map((await listObjects(bucket)).map((o) => [o.key, o.size]))
    const todo = src.filter((o) => have.get(o.key) !== o.size)
    console.log(`${bucket}: ${src.length} on Supabase (${(src.reduce((n, o) => n + o.size, 0) / 1e6).toFixed(1)} MB), ${src.length - todo.length} already on Neon, ${todo.length} to copy`)
    if (!apply) continue
    for (const o of todo) {
      const { data, error } = await sb.storage.from(bucket).download(o.key)
      if (error || !data) throw new Error(`download ${bucket}/${o.key}: ${error?.message}`)
      await putObject(bucket, o.key, Buffer.from(await data.arrayBuffer()), o.mime, { overwrite: true })
    }
    const after = new Map((await listObjects(bucket)).map((o) => [o.key, o.size]))
    const missing = src.filter((o) => after.get(o.key) !== o.size)
    console.log(`${bucket}: copied; ${missing.length} missing or size-mismatched after copy`)
    if (missing.length) throw new Error(`${bucket}: copy incomplete, stopping before any row rewrite`)
  }

  // Rows holding a Supabase storage URL.
  const prisma = new PrismaClient({ datasourceUrl: dbUrl })
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; photo_urls: string[] }>>`
      SELECT id, photo_urls FROM construction_updates
      WHERE EXISTS (SELECT 1 FROM unnest(photo_urls) u WHERE u LIKE 'https://%.supabase.co/storage/v1/object/public/%')`
    const changes = rows.map((r) => ({ id: r.id, before: r.photo_urls, after: r.photo_urls.map((u) => rewriteUrl(u) ?? u) }))
    console.log(`construction_updates: ${changes.length} rows, ${changes.reduce((n, c) => n + c.before.filter((u, i) => u !== c.after[i]).length, 0)} URLs to rewrite`)
    if (!apply || !changes.length) return
    mkdirSync(join(__dirname, '../../backups'), { recursive: true })
    const backup = join(__dirname, `../../backups/storage-url-rewrite-${live ? 'live' : 'dev'}-${Date.now()}.json`)
    writeFileSync(backup, JSON.stringify(changes, null, 2))
    console.log(`backup: ${backup}`)
    await prisma.$transaction(changes.map((c) => prisma.$executeRaw`UPDATE construction_updates SET photo_urls = ${c.after} WHERE id = ${c.id}`))
    const left = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM construction_updates, unnest(photo_urls) u WHERE u LIKE '%supabase.co%'`
    console.log(`rewritten; Supabase URLs left in construction_updates: ${left[0].n}`)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) main().catch((e) => { console.error('ERR', e?.message ?? e); process.exit(1) })
