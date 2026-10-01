import { prisma } from '../src/lib/db'

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "web_facts" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "query_key" TEXT NOT NULL UNIQUE,
      "query_text" TEXT,
      "answer_snippet" TEXT NOT NULL,
      "results_json" TEXT,
      "source_url" TEXT NOT NULL,
      "source_name" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'general',
      "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expires_at" TIMESTAMP(3) NOT NULL
    );
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "web_facts_query_key_expires_at_idx" ON "web_facts"("query_key", "expires_at");
  `)

  console.log('web_facts table and indexes verified successfully.')
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
