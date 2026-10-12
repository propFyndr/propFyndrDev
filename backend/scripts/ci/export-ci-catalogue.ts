// backend/scripts/ci/export-ci-catalogue.ts
//
// Writes the CI catalogue fixture from the database DATABASE_URL points at.
// Read-only: findMany only. Run from backend/:
//   npx tsx scripts/ci/export-ci-catalogue.ts
import 'dotenv/config'
import { gzipSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { CATALOGUE_MODELS, REDACTED_FIELDS, FIXTURE_PATH, delegateName } from './catalogue'

async function main() {
  const prisma = new PrismaClient()
  const out: Record<string, unknown[]> = {}
  try {
    for (const model of CATALOGUE_MODELS) {
      const rows = (await (prisma as any)[delegateName(model)].findMany()) as Record<string, unknown>[]
      for (const field of REDACTED_FIELDS[model] ?? []) {
        for (const row of rows) if (field in row) row[field] = null
      }
      out[model] = rows
      console.log(`${model}: ${rows.length}`)
    }
  } finally {
    await prisma.$disconnect()
  }
  // Decimal and Date serialise via toJSON; BigInt has none.
  const json = JSON.stringify(out, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  writeFileSync(FIXTURE_PATH, gzipSync(json))
  console.log(`wrote ${FIXTURE_PATH} (${(json.length / 1024 / 1024).toFixed(1)} MB raw)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
