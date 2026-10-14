// backend/scripts/compact-chat-storage.ts
//
// One-off / catch-up compaction of stored chat cards (see lib/chatStorage.ts):
// every chat_messages.artifacts card list, and last_projects on chats idle for
// --idle-days (default 7). The backend does the same in small batches every
// few hours; this does it all at once, in parallel, e.g. right after copying
// the database to a new host.
//
// The target URL is read from an env var NAMED by --target (default
// DATABASE_URL) and never printed:
//   node --env-file=.env --require tsx/cjs scripts/compact-chat-storage.ts --target=NEON_DB
//   ... --dry-run   counts only
import { PrismaClient, Prisma } from '@prisma/client'
import { compactArtifacts, compactCardList } from '../src/lib/chatStorage'

const arg = (name: string, dflt: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt
const target = arg('target', 'DATABASE_URL')
const idleDays = Number(arg('idle-days', '7'))
const dryRun = process.argv.includes('--dry-run')
const CONCURRENCY = 16
const BATCH = 400

const url = process.env[target]
if (!url) { console.error(`env var ${target} is not set`); process.exit(1) }
// Pooled endpoints break long batch work; use the direct host where one exists.
const prisma = new PrismaClient({ datasources: { db: { url: url.replace('-pooler.', '.') } } })

async function inParallel<T>(items: T[], fn: (t: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += CONCURRENCY) await Promise.all(items.slice(i, i + CONCURRENCY).map(fn))
}

const FULL_CARD = `jsonb_typeof(p) = 'object' AND NOT (p ? 'compact')`

async function main() {
  const t0 = Date.now()
  let messages = 0, sessions = 0
  for (;;) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; artifacts: unknown }[]>(`
      SELECT id, artifacts FROM chat_messages m
      WHERE jsonb_typeof(artifacts) = 'array' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(m.artifacts) a, jsonb_array_elements(
          CASE WHEN jsonb_typeof(a->'exactResults') = 'array' THEN a->'exactResults' ELSE '[]'::jsonb END ||
          CASE WHEN jsonb_typeof(a->'nearbyResults') = 'array' THEN a->'nearbyResults' ELSE '[]'::jsonb END) p
        WHERE ${FULL_CARD})
      LIMIT ${dryRun ? 100000 : BATCH}`)
    if (dryRun) { messages = rows.length; break }
    if (rows.length === 0) break
    await inParallel(rows, (r) => prisma.chatMessage.update({ where: { id: r.id }, data: { artifacts: compactArtifacts(r.artifacts) as Prisma.InputJsonValue } }))
    messages += rows.length
    process.stdout.write(`\rmessages compacted: ${messages}`)
  }
  const cutoff = new Date(Date.now() - idleDays * 86_400_000)
  for (;;) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; last_projects: unknown }[]>(`
      SELECT id, last_projects FROM chat_sessions s
      WHERE last_active < $1 AND jsonb_typeof(last_projects) = 'array'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.last_projects) p WHERE ${FULL_CARD})
      LIMIT ${dryRun ? 100000 : BATCH}`, cutoff)
    if (dryRun) { sessions = rows.length; break }
    if (rows.length === 0) break
    await inParallel(rows, (r) => prisma.chatSession.update({ where: { id: r.id }, data: { last_projects: compactCardList(r.last_projects) as Prisma.InputJsonValue } }))
    sessions += rows.length
    process.stdout.write(`\rsessions compacted: ${sessions}   `)
  }
  console.log(`\n${dryRun ? 'would compact' : 'compacted'}: ${messages} messages, ${sessions} sessions (idle > ${idleDays} days) in ${Math.round((Date.now() - t0) / 1000)}s`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(String(e).replace(/postgres(ql)?:\/\/\S+/g, '<url>').slice(0, 500)); await prisma.$disconnect(); process.exit(1) })
