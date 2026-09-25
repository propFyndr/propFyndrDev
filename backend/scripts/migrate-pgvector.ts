/**
 * PropFyndr — pgvector column and index migration.
 *
 * Both embedding columns were declared as bare `vector`, with no dimension.
 * pgvector cannot index an unconstrained column, so the CREATE INDEX that used
 * to live here failed every run with "column does not have dimensions" — and
 * the failure was swallowed by a `.catch` that logged "expected if unseeded",
 * a cause nobody had established. Measured before this rewrite: no ivfflat or
 * hnsw index existed on either table, so every semantic query was a sequential
 * scan computing exact distance for every row.
 *
 * HNSW rather than IVFFlat: IVFFlat builds its lists from the data present at
 * CREATE INDEX time, so on an empty or freshly-truncated column it produces a
 * useless index. HNSW does not care. The old attempt also passed `lists = 20`
 * against a corpus of roughly 40 rows, which is more lists than rows.
 *
 * Dropping and re-adding the column is safe here precisely because every stored
 * vector is being regenerated anyway — see the header of seed-embeddings.ts.
 *
 * Run: npx tsx scripts/migrate-pgvector.ts
 */

import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { EMBEDDING_DIMENSIONS } from '../src/lib/ai/vectorSearch'

const TABLES = ['builder_news', 'projects'] as const

async function migrate() {
  console.log('[migrate] Enabling pgvector extension...')
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;')

  for (const table of TABLES) {
    console.log(`[migrate] ${table}: constraining embedding to vector(${EMBEDDING_DIMENSIONS})...`)

    // Dropped rather than altered: an unconstrained column may hold vectors of
    // any dimension, so ALTER TYPE would fail on the first row that disagrees.
    await prisma.$executeRawUnsafe(`ALTER TABLE ${table} DROP COLUMN IF EXISTS embedding;`)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${table} ADD COLUMN embedding vector(${EMBEDDING_DIMENSIONS});`
    )

    console.log(`[migrate] ${table}: creating hnsw cosine index...`)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_${table}_embedding
         ON ${table} USING hnsw (embedding vector_cosine_ops);`
    )
  }

  // Verify rather than assume. The previous script printed "Migration complete"
  // whether or not the index existed.
  const columns = await prisma.$queryRawUnsafe<Array<{ tbl: string; typ: string }>>(
    `SELECT c.relname AS tbl, format_type(a.atttypid, a.atttypmod) AS typ
       FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
      WHERE a.attname = 'embedding' AND c.relname = ANY($1::text[]);`,
    [...TABLES]
  )
  const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string; tablename: string }>>(
    `SELECT indexname, tablename FROM pg_indexes
      WHERE tablename = ANY($1::text[]) AND indexdef ILIKE '%hnsw%';`,
    [...TABLES]
  )

  console.log('[migrate] columns:', columns)
  console.log('[migrate] hnsw indexes:', indexes)

  const expected = `vector(${EMBEDDING_DIMENSIONS})`
  for (const table of TABLES) {
    const column = columns.find((c) => c.tbl === table)
    if (column?.typ !== expected) {
      throw new Error(`${table}.embedding is ${column?.typ ?? 'absent'}, expected ${expected}`)
    }
    if (!indexes.some((i) => i.tablename === table)) {
      throw new Error(`${table} has no hnsw index on embedding`)
    }
  }

  console.log('[migrate] Done. Every embedding is now null — run seed-embeddings.ts next.')
}

migrate()
  .catch((err) => {
    // Loudly, and with a non-zero exit. The previous version caught everything
    // and exited 0, so a failed migration looked like a successful one in CI.
    console.error('[migrate] FAILED:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
