/**
 * PropFyndr — seed pgvector embeddings for builder news and projects.
 *
 * Run AFTER migrate-pgvector.ts, which drops and re-adds both columns.
 *
 * Every vector stored before 2026-09-25 was untrustworthy for two independent
 * reasons, which is why the migration clears the columns rather than topping
 * them up:
 *
 *   - the embedding cache key encoded only the first 36 bytes of input, so
 *     rows sharing a prefix were handed each other's vectors;
 *   - documents were embedded with `input_type: 'search_query'`, putting the
 *     whole corpus in the wrong subspace relative to the queries run against it.
 *
 * Both are fixed in vectorSearch.ts. This script passes 'search_document',
 * which is the side corpus text sits on.
 *
 * Usage:
 *   npx tsx scripts/seed-embeddings.ts              # only rows with no vector
 *   npx tsx scripts/seed-embeddings.ts --force      # re-embed everything
 */

import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { getEmbeddingsBatch } from '../src/lib/ai/vectorSearch'

const FORCE = process.argv.includes('--force')

/** Ids that already hold a vector, so a default run can skip them. */
async function alreadyEmbedded(table: 'builder_news' | 'projects'): Promise<Set<string>> {
  if (FORCE) return new Set()
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM ${table} WHERE embedding IS NOT NULL;`
  )
  return new Set(rows.map((r) => r.id))
}

async function store(table: 'builder_news' | 'projects', id: string, vector: number[]) {
  await prisma.$executeRawUnsafe(
    `UPDATE ${table} SET embedding = $1::vector WHERE id = $2;`,
    `[${vector.join(',')}]`,
    id
  )
}

async function seed() {
  console.log(`[seed] mode: ${FORCE ? 'force (re-embed all)' : 'only rows missing a vector'}`)
  let failures = 0

  // ── Builder news ──────────────────────────────────────────────────────────
  // Only what a buyer can actually be shown. The previous version walked every
  // row regardless of status, spending embedding calls on drafts and archived
  // posts that searchNewsSemantic filters out at query time anyway.
  const newsDone = await alreadyEmbedded('builder_news')
  const newsItems = await prisma.builderNews.findMany({
    where: { status: 'published', archived_at: null },
    include: { builder: { select: { name: true } } },
    orderBy: { created_at: 'asc' },
  })
  const newsTodo = newsItems.filter((n) => !newsDone.has(n.id))
  console.log(`[seed] news: ${newsTodo.length} of ${newsItems.length} published rows to embed`)

  const newsVectors = await getEmbeddingsBatch(
    newsTodo.map((item) => `${item.builder?.name || ''} - ${item.title}: ${item.description}`),
    'search_document'
  )
  for (let i = 0; i < newsTodo.length; i++) {
    const item = newsTodo[i]
    const vector = newsVectors[i]
    if (!vector) {
      console.error(`[seed] news FAILED: ${item.id} "${item.title.slice(0, 45)}"`)
      failures++
      continue
    }
    await store('builder_news', item.id, vector)
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  // Every project, not an arbitrary slice. The previous version took 30 rows
  // with no orderBy and called them "flagship projects", which described
  // nothing — it was whatever order Postgres returned. There is no flagship
  // flag on Project, so there was no selection rule to preserve; embedding the
  // whole catalogue removes the need for one, and --only-missing (the default)
  // keeps reruns cheap as it grows.
  const projectsDone = await alreadyEmbedded('projects')
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      sector: true,
      description: true,
      builder: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })
  const projectsTodo = projects.filter((p) => !projectsDone.has(p.id))
  console.log(`[seed] projects: ${projectsTodo.length} of ${projects.length} rows to embed`)

  const projectVectors = await getEmbeddingsBatch(
    projectsTodo.map((p) => {
      const where = p.sector ? ` in ${p.sector} Noida` : ' in Noida'
      const by = p.builder?.name ? ` by ${p.builder.name}` : ''
      return `${p.name}${by}${where}. ${p.description || ''}`.trim()
    }),
    'search_document'
  )
  for (let i = 0; i < projectsTodo.length; i++) {
    const p = projectsTodo[i]
    const vector = projectVectors[i]
    if (!vector) {
      console.error(`[seed] project FAILED: ${p.id} "${p.name}"`)
      failures++
      continue
    }
    await store('projects', p.id, vector)
  }

  const counts = await prisma.$queryRawUnsafe<Array<{ news: bigint; projects: bigint }>>(
    `SELECT
       (SELECT COUNT(*) FROM builder_news WHERE embedding IS NOT NULL) AS news,
       (SELECT COUNT(*) FROM projects     WHERE embedding IS NOT NULL) AS projects;`
  )
  console.log('[seed] rows now holding a vector:', {
    builder_news: Number(counts[0]?.news ?? 0),
    projects: Number(counts[0]?.projects ?? 0),
  })

  if (failures > 0) {
    throw new Error(`${failures} embedding(s) failed — see the FAILED lines above`)
  }
  console.log('[seed] Done.')
}

seed()
  .catch((err) => {
    // The previous version used a bare .finally(), so a rejection here became an
    // unhandled rejection and the process still exited 0.
    console.error('[seed] FAILED:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
