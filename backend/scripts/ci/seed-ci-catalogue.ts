// backend/scripts/ci/seed-ci-catalogue.ts
//
// Loads the catalogue fixture into a throwaway test database. Refuses any
// DATABASE_URL that is not localhost — this must never write to production.
// Run from backend/ after `prisma db push`:
//   npx tsx scripts/ci/seed-ci-catalogue.ts
//
// The dev environment's own Supabase project is the one other target allowed,
// and only when named explicitly: SEED_ALLOW_SUPABASE_REF=<dev project ref>.
// The live project's ref is refused even if named. SEED_FIXTURE_PATH loads a
// fixture other than the committed one (e.g. a fresh export of live).
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { PrismaClient, Prisma } from '@prisma/client'
import { CATALOGUE_MODELS, FIXTURE_PATH, delegateName } from './catalogue'

/** The live database/auth project. Never a seed target. */
const LIVE_SUPABASE_REF = 'eargxntetfmtdpwedjbd'

const url = process.env.DATABASE_URL ?? ''
const allowRef = (process.env.SEED_ALLOW_SUPABASE_REF ?? '').trim()
const isLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
const namesRef = (ref: string) => url.includes(`postgres.${ref}:`) || url.includes(`postgres.${ref}@`) || url.includes(`db.${ref}.supabase.co`)
const isNamedDev = /^[a-z0-9]{20}$/.test(allowRef) && allowRef !== LIVE_SUPABASE_REF && namesRef(allowRef)
if (namesRef(LIVE_SUPABASE_REF) || !(isLocal || isNamedDev)) {
  console.error('Refusing to seed: DATABASE_URL is neither localhost nor the dev project named in SEED_ALLOW_SUPABASE_REF (and is never the live project).')
  process.exit(1)
}
const fixturePath = process.env.SEED_FIXTURE_PATH || FIXTURE_PATH

// Prisma rejects a bare null for a Json column in createMany; it needs DbNull.
function jsonFields(model: string): Set<string> {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model)
  return new Set((m?.fields ?? []).filter((f) => f.type === 'Json').map((f) => f.name))
}

async function main() {
  const fixture = JSON.parse(gunzipSync(readFileSync(fixturePath)).toString('utf8')) as Record<string, Record<string, unknown>[]>
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
