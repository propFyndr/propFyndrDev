// backend/scripts/ci/export-ci-catalogue.ts
//
// Writes the CI catalogue fixture from the database DATABASE_URL points at.
// Read-only: findMany only. Run from backend/:
//   npx tsx scripts/ci/export-ci-catalogue.ts
import 'dotenv/config'
import { gzipSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { PrismaClient, Prisma } from '@prisma/client'
import { CATALOGUE_MODELS, REDACTED_FIELDS, FIXTURE_PATH, delegateName } from './catalogue'

// Primary-key fields per model, so rows come out in the same order every run
// and an unchanged catalogue produces a byte-identical fixture (no noise diffs
// from the weekly refresh).
function primaryKey(model: string): string[] {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model)
  if (!m) return []
  const id = m.fields.find((f) => f.isId)
  return id ? [id.name] : m.primaryKey?.fields ? [...m.primaryKey.fields] : []
}

async function main() {
  const prisma = new PrismaClient()
  const out: Record<string, unknown[]> = {}
  try {
    for (const model of CATALOGUE_MODELS) {
      const pk = primaryKey(model)
      const rows = (await (prisma as any)[delegateName(model)].findMany({
        orderBy: pk.map((f) => ({ [f]: 'asc' })),
      })) as Record<string, unknown>[]
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
  // EXPORT_FIXTURE_PATH writes elsewhere (e.g. a one-off copy for the dev
  // database) without touching the committed CI fixture.
  const outPath = process.env.EXPORT_FIXTURE_PATH || FIXTURE_PATH
  writeFileSync(outPath, gzipSync(json))
  console.log(`wrote ${outPath} (${(json.length / 1024 / 1024).toFixed(1)} MB raw)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
