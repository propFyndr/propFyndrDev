// backend/scripts/apply-forensic-nullable.ts
//
//   npx tsx scripts/apply-forensic-nullable.ts
//
// Applies prisma/migrations/forensic_columns_nullable ONLY, and records it in
// the _prisma_migrations ledger.
//
// `prisma migrate deploy` is deliberately not used: `migrate status` reports
// five unapplied migrations on this database, four of them unrelated to this
// change — add_callback_is_test, add_lead_first_contacted_at,
// add_site_visit_partner_assignment and drop_builder_accounts. Running deploy
// would apply all five, and one of them drops a table. Whether those four
// should run is a separate decision from this one.
//
// Everything below is a single transaction. If any statement fails, nothing is
// committed and the ledger row is not written.
//
// Safe to run twice: it returns early if the ledger already carries the name.

import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/lib/db'

const NAME = 'forensic_columns_nullable'
const COLS = [
  'oc_status',
  'amitabh_kant_clearance',
  'water_source_type',
  'shahdara_drain_impact',
  'lift_act_compliant',
  'power_supply_type',
]

async function main(): Promise<void> {
  const sql = readFileSync(join(__dirname, '..', 'prisma', 'migrations', NAME, 'migration.sql'), 'utf8')

  const [{ count: already }] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT count(*)::int AS count FROM _prisma_migrations WHERE migration_name = $1`,
    NAME,
  )
  if (already > 0) {
    console.log(`${NAME} is already applied — nothing to do.`)
    await prisma.$disconnect()
    return
  }

  // Pre-flight, printed before anything is written. `would_lose_a_real_value`
  // is the one that matters: it counts rows the UPDATE would touch that hold
  // something other than the schema default. It must be 0, or the discriminator
  // is wrong and the UPDATE would erase researched data.
  const [before] = await prisma.$queryRawUnsafe<Array<Record<string, number>>>(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE water_tds_range IS NULL AND all_in_cost_multiplier IS NULL)::int AS will_null,
      count(*) FILTER (WHERE water_tds_range IS NOT NULL AND all_in_cost_multiplier IS NULL)::int AS disagree_a,
      count(*) FILTER (WHERE water_tds_range IS NULL AND all_in_cost_multiplier IS NOT NULL)::int AS disagree_b,
      count(*) FILTER (WHERE water_tds_range IS NULL AND all_in_cost_multiplier IS NULL AND (
        oc_status <> 'NONE' OR amitabh_kant_clearance OR water_source_type <> 'MIXED'
        OR shahdara_drain_impact OR lift_act_compliant OR power_supply_type <> 'SINGLE_POINT_BULK'
      ))::int AS would_lose_a_real_value
    FROM projects`)
  console.log('pre-flight:', before)
  if (before.would_lose_a_real_value !== 0) {
    throw new Error(
      `${before.would_lose_a_real_value} rows in the UPDATE's range hold a non-default value. ` +
      `The enrichment discriminator is wrong — refusing to run.`,
    )
  }

  let updated = 0
  await prisma.$transaction(async (tx) => {
    for (const c of COLS) {
      await tx.$executeRawUnsafe(`ALTER TABLE "projects" ALTER COLUMN "${c}" DROP NOT NULL`)
      await tx.$executeRawUnsafe(`ALTER TABLE "projects" ALTER COLUMN "${c}" DROP DEFAULT`)
    }
    updated = await tx.$executeRawUnsafe(`
      UPDATE "projects"
      SET    "oc_status" = NULL, "amitabh_kant_clearance" = NULL, "water_source_type" = NULL,
             "shahdara_drain_impact" = NULL, "lift_act_compliant" = NULL, "power_supply_type" = NULL
      WHERE  "water_tds_range" IS NULL AND "all_in_cost_multiplier" IS NULL`)
    await tx.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
       VALUES ($1, $2, now(), $3, now(), 1)`,
      randomUUID(),
      createHash('sha256').update(sql).digest('hex'),
      NAME,
    )
  })
  console.log(`rows corrected: ${updated} (expected ${before.will_null})`)

  const cols = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT column_name, is_nullable, column_default FROM information_schema.columns
     WHERE table_name='projects' AND column_name = ANY($1::text[]) ORDER BY column_name`,
    COLS,
  )
  console.table(cols)

  const [after] = await prisma.$queryRawUnsafe<Array<Record<string, number>>>(`
    SELECT count(*)::int AS total,
           count(oc_status)::int AS oc_set,
           count(amitabh_kant_clearance)::int AS kant_set,
           count(water_source_type)::int AS water_set,
           count(shahdara_drain_impact)::int AS drain_set,
           count(lift_act_compliant)::int AS lift_set,
           count(power_supply_type)::int AS power_set
    FROM projects`)
  console.log('non-null counts after:', after)
  await prisma.$disconnect()
}

main().catch(async (e: unknown) => {
  console.error('FAILED — transaction rolled back, database unchanged:', (e as Error).message)
  await prisma.$disconnect()
  process.exit(1)
})
