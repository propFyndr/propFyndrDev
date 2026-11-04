// Applies prisma/migrations/20261104090000_property_events_session_optional (one statement).
//   npx tsx scripts/apply-property-events-session-optional.ts          # dev (DATABASE_URL)
//   npx tsx scripts/apply-property-events-session-optional.ts --live   # live (NEON_DB)
// Idempotent: reports the column's nullability before and after.
import { PrismaClient } from '@prisma/client'

const live = process.argv.includes('--live')

async function main() {
  const url = live ? process.env.NEON_DB : process.env.DATABASE_URL
  if (!url) throw new Error(live ? 'NEON_DB not set' : 'DATABASE_URL not set')
  const host = new URL(url).host
  if (!live && host.includes('ep-super-water')) throw new Error('DATABASE_URL points at LIVE; pass --live explicitly')
  const prisma = new PrismaClient({ datasourceUrl: url })
  const nullable = async () =>
    (await prisma.$queryRaw<Array<{ is_nullable: string }>>`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'property_events' AND column_name = 'session_id'`)[0]?.is_nullable
  try {
    console.log(`db: ${host}`)
    console.log(`session_id nullable before: ${await nullable()}`)
    await prisma.$executeRawUnsafe('ALTER TABLE "property_events" ALTER COLUMN "session_id" DROP NOT NULL')
    console.log(`session_id nullable after:  ${await nullable()}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
