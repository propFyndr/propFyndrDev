// backend/scripts/ci/seed-ci-catalogue.ts
//
// Loads the catalogue fixture into a throwaway test database. Refuses any
// DATABASE_URL that is not localhost — this must never write to production.
// Run from backend/ after `prisma db push`:
//   npx tsx scripts/ci/seed-ci-catalogue.ts
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { PrismaClient, Prisma } from '@prisma/client'
import { CATALOGUE_MODELS, FIXTURE_PATH, delegateName } from './catalogue'

const url = process.env.DATABASE_URL ?? ''
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error('Refusing to seed: DATABASE_URL is not a localhost database.')
  process.exit(1)
}

// Prisma rejects a bare null for a Json column in createMany; it needs DbNull.
function jsonFields(model: string): Set<string> {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model)
  return new Set((m?.fields ?? []).filter((f) => f.type === 'Json').map((f) => f.name))
}

async function main() {
  const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE_PATH)).toString('utf8')) as Record<string, Record<string, unknown>[]>
  const prisma = new PrismaClient()
  try {
    for (const model of CATALOGUE_MODELS) {
      const rows = fixture[model] ?? []
      const json = jsonFields(model)
      const data = rows.map((row) => {
        const copy: Record<string, unknown> = { ...row }
        for (const f of json) if (copy[f] === null) copy[f] = Prisma.DbNull
        return copy
      })
      for (let i = 0; i < data.length; i += 500) {
        await (prisma as any)[delegateName(model)].createMany({ data: data.slice(i, i + 500), skipDuplicates: true })
      }
      console.log(`${model}: ${data.length}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
