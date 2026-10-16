/**
 * Pass 3 of the templated-data cleanup (stress run, 16 Oct 2026).
 *
 *   npx tsx scripts/fix-templated-data-pass3.ts --db=dev            # dry run: counts and samples
 *   npx tsx scripts/fix-templated-data-pass3.ts --db=dev --apply    # backs up every touched row, then writes
 *   npx tsx scripts/fix-templated-data-pass3.ts --db=live --apply   # the same on Neon
 *
 * Each item below reached a buyer as a fact in the stress run:
 *
 *   A  Duplicate projects    Same name and same RERA number, stored twice with
 *                            different builders, prices and possession dates
 *                            (ATS Destinaire). The weaker row is archived with
 *                            `archived_duplicate_of` pointing at the survivor;
 *                            every read hides it (lib/excludeArchivedProjects).
 *                            Nothing is deleted. Same name, different RERA is
 *                            reported, not merged: it may be a different phase.
 *   B  Cost-sheet templates  PLC rows, parking, IFMS, club and floor rise shared
 *                            by more than MAX_SHARED projects. Cleared.
 *   C  Base rate             A base price per sq ft no unit's price agrees with
 *                            within 25% (Godrej Palm Retreat: ₹14,028 × 1,750 sq ft
 *                            is ₹2.45 Cr against a ₹3.36 Cr unit). Cleared, with
 *                            the all-inclusive figures derived from it.
 *   D  Builder templates     projects_delivered_count (8 on 25 builders) and
 *                            total_projects_count shared by more than MAX_SHARED
 *                            builders; an on-time delay of 0 with no delivered
 *                            record behind it; a "delivered" list naming a
 *                            project that is not ready to move. Cleared.
 *   E  Marketing templates   marketing_claims, location_advantages and
 *                            location_concerns shared by more than MAX_SHARED
 *                            projects ("100% RERA compliant development with
 *                            clear titles" on a project with 6 litigations).
 *   F  Status contradictions oc_obtained = true on a project that is not ready
 *                            to move. Cleared.
 *   G  Price history label   "monthly_auto_snapshot" rows dated before the
 *                            project entered our catalogue cannot be snapshots;
 *                            relabelled historical_benchmark (rendered as an
 *                            internal benchmark estimate).
 *
 * Cleared means null or empty, never replaced with a guess: downstream reads
 * "not on record", which is true.
 */
import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { Prisma, PrismaClient } from '@prisma/client'

const APPLY = process.argv.includes('--apply')
const DB = (process.argv.find((a) => a.startsWith('--db='))?.split('=')[1] ?? '') as 'dev' | 'live'
const URL = DB === 'dev' ? process.env.DATABASE_URL : DB === 'live' ? process.env.NEON_DB : undefined
if (!URL) {
  console.error('Pass --db=dev (DATABASE_URL, Supabase) or --db=live (NEON_DB).')
  process.exit(1)
}
const db = new PrismaClient({ datasources: { db: { url: URL } } })

/** A value shared by more rows than this was written by a script, not measured. */
const MAX_SHARED = 3
const BASE_RATE_TOLERANCE = 0.25

const key = (v: unknown) => JSON.stringify(v)
const isEmpty = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0)

function sharedValues<T>(rows: T[], pick: (r: T) => unknown): Set<string> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const v = pick(r)
    if (isEmpty(v)) continue
    counts.set(key(v), (counts.get(key(v)) ?? 0) + 1)
  }
  return new Set([...counts].filter(([, n]) => n > MAX_SHARED).map(([k]) => k))
}

async function main(): Promise<void> {
  console.log(`== pass 3 on ${DB} (${APPLY ? 'APPLY' : 'dry run'}) ==`)

  // ── A. Duplicate projects ───────────────────────────────────────────────
  const projects = await db.project.findMany({
    where: { archived_duplicate_of: null },
    select: {
      id: true, name: true, rera_number: true, sector: true, status: true, oc_obtained: true, oc_obtained_date: true,
      updated_at: true, created_at: true, marketing_claims: true, location_advantages: true, location_concerns: true,
      builder: { select: { name: true } },
      _count: { select: { unit_types: true, payment_plans: true, price_history: true } },
      cost_sheet: { select: { id: true } },
    },
  })
  const groups = new Map<string, typeof projects>()
  for (const p of projects) {
    const k = p.name.trim().toLowerCase()
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  const richness = (p: (typeof projects)[number]) =>
    p._count.unit_types + p._count.payment_plans + p._count.price_history + (p.cost_sheet ? 1 : 0)
  const archive: { loser: (typeof projects)[number]; survivor: (typeof projects)[number] }[] = []
  const sameNameDifferentRera: string[] = []
  for (const rows of groups.values()) {
    if (rows.length < 2) continue
    const byRera = new Map<string, typeof projects>()
    for (const r of rows) {
      if (!r.rera_number) continue
      byRera.set(r.rera_number, [...(byRera.get(r.rera_number) ?? []), r])
    }
    for (const dupes of byRera.values()) {
      if (dupes.length < 2) continue
      const [survivor, ...losers] = [...dupes].sort((a, b) => richness(b) - richness(a) || +b.updated_at - +a.updated_at)
      for (const loser of losers) archive.push({ loser, survivor })
    }
    if (new Set(rows.map((r) => r.rera_number)).size > 1) {
      sameNameDifferentRera.push(rows.map((r) => `${r.name} [${r.sector}, ${r.rera_number ?? 'no RERA'}, ${r.builder?.name}]`).join('  |  '))
    }
  }

  // ── B, C. Cost sheets ───────────────────────────────────────────────────
  const sheets = await db.costSheet.findMany({
    include: { project: { select: { name: true, archived_duplicate_of: true, unit_types: { select: { super_area_sqft: true, price_min_cr: true } } } } },
  })
  const SHEET_FIELDS = ['plc_charges', 'other_charges', 'parking_cost', 'ifms', 'club_membership', 'floor_rise_per_floor', 'electricity_connection', 'water_sewer_connection'] as const
  const sheetShared = Object.fromEntries(SHEET_FIELDS.map((f) => [f, sharedValues(sheets, (s) => (s as any)[f])])) as Record<(typeof SHEET_FIELDS)[number], Set<string>>
  const sheetClears: { id: string; project: string; fields: string[] }[] = []
  for (const s of sheets) {
    const fields: string[] = SHEET_FIELDS.filter((f) => !isEmpty((s as any)[f]) && sheetShared[f].has(key((s as any)[f])))
    if (typeof s.base_price_per_sqft === 'number') {
      const units = s.project.unit_types.filter((u) => u.super_area_sqft && u.price_min_cr)
      const agrees = units.some((u) => Math.abs((s.base_price_per_sqft! * u.super_area_sqft!) / 1e7 - u.price_min_cr!) / u.price_min_cr! <= BASE_RATE_TOLERANCE)
      if (units.length && !agrees) fields.push('base_price_per_sqft', 'base_cost_cr', 'all_inclusive_price_cr', 'all_inclusive_per_sqft')
    }
    if (fields.length) sheetClears.push({ id: s.id, project: s.project.name, fields: [...new Set(fields)] })
  }

  // ── D. Builders ─────────────────────────────────────────────────────────
  const builders = await db.builder.findMany({
    select: {
      id: true, name: true, projects_delivered_count: true, total_projects_count: true, delivered_units: true,
      average_delay_months: true, delivered_projects: true,
      projects: { select: { name: true, status: true } },
    },
  })
  const deliveredShared = sharedValues(builders, (b) => b.projects_delivered_count)
  const totalShared = sharedValues(builders, (b) => b.total_projects_count)
  const builderEdits: { id: string; name: string; data: Record<string, unknown>; why: string[] }[] = []
  for (const b of builders) {
    const data: Record<string, unknown> = {}
    const why: string[] = []
    if (b.projects_delivered_count != null && deliveredShared.has(key(b.projects_delivered_count))) {
      data.projects_delivered_count = null; why.push(`projects_delivered_count ${b.projects_delivered_count} (templated)`)
    }
    if (b.total_projects_count != null && totalShared.has(key(b.total_projects_count))) {
      data.total_projects_count = null; why.push(`total_projects_count ${b.total_projects_count} (templated)`)
    }
    const deliveredAfter = (data.projects_delivered_count === null ? null : b.projects_delivered_count)
    if (b.average_delay_months === 0 && deliveredAfter == null && b.delivered_units == null && b.delivered_projects.length === 0) {
      data.average_delay_months = null; why.push('average_delay_months 0 with no delivered record')
    }
    const notReady = new Set(b.projects.filter((p) => p.status !== 'ready_to_move').map((p) => p.name.toLowerCase()))
    const keptDelivered = b.delivered_projects.filter((n) => !notReady.has(n.toLowerCase()))
    if (keptDelivered.length !== b.delivered_projects.length) {
      data.delivered_projects = keptDelivered
      why.push(`delivered_projects drops ${b.delivered_projects.filter((n) => notReady.has(n.toLowerCase())).join(', ')} (not ready to move)`)
    }
    if (why.length) builderEdits.push({ id: b.id, name: b.name, data, why })
  }

  // ── E, F. Project templates and contradictions ─────────────────────────
  const claimsShared = sharedValues(projects, (p) => p.marketing_claims)
  const advShared = sharedValues(projects, (p) => p.location_advantages)
  const concernsShared = sharedValues(projects, (p) => p.location_concerns)
  const projectEdits: { id: string; name: string; data: Record<string, unknown>; why: string[] }[] = []
  for (const p of projects) {
    const data: Record<string, unknown> = {}
    const why: string[] = []
    if (!isEmpty(p.marketing_claims) && claimsShared.has(key(p.marketing_claims))) { data.marketing_claims = []; why.push('marketing_claims (templated)') }
    if (!isEmpty(p.location_advantages) && advShared.has(key(p.location_advantages))) { data.location_advantages = Prisma.DbNull; why.push('location_advantages (templated)') }
    if (!isEmpty(p.location_concerns) && concernsShared.has(key(p.location_concerns))) { data.location_concerns = []; why.push('location_concerns (templated)') }
    if (p.oc_obtained === true && p.status !== 'ready_to_move') { data.oc_obtained = null; data.oc_obtained_date = null; why.push(`oc_obtained true on a ${p.status} project`) }
    if (why.length) projectEdits.push({ id: p.id, name: p.name, data, why })
  }

  // ── G. Price-history label ─────────────────────────────────────────────
  const impossibleSnapshots: { id: string }[] = await db.$queryRawUnsafe(`
    select ph.id from price_history ph join projects p on p.id = ph.project_id
    where ph.source = 'monthly_auto_snapshot' and ph.recorded_at < p.created_at - interval '1 day'`)

  // ── Report ─────────────────────────────────────────────────────────────
  console.log(`A  archive ${archive.length} duplicate project row(s):`)
  for (const a of archive) console.log(`     ${a.loser.name} [${a.loser.builder?.name}, ${a.loser.id.slice(0, 8)}] -> keep ${a.survivor.id.slice(0, 8)} [${a.survivor.builder?.name}]`)
  console.log(`   same name, different RERA (reported, not merged): ${sameNameDifferentRera.length}`)
  for (const s of sameNameDifferentRera.slice(0, 12)) console.log(`     ${s}`)
  const fieldTally = (rows: { fields?: string[]; why?: string[] }[], pick: (r: any) => string[]) => {
    const t = new Map<string, number>()
    for (const r of rows) for (const f of pick(r)) t.set(f.replace(/ \d.*| drops .*/, ''), (t.get(f.replace(/ \d.*| drops .*/, '')) ?? 0) + 1)
    return [...t].map(([f, n]) => `${f}: ${n}`).join(', ')
  }
  console.log(`B/C cost sheets touched: ${sheetClears.length} — ${fieldTally(sheetClears, (r) => r.fields)}`)
  console.log(`D  builders touched: ${builderEdits.length} — ${fieldTally(builderEdits, (r) => r.why)}`)
  console.log(`E/F projects touched: ${projectEdits.length} — ${fieldTally(projectEdits, (r) => r.why)}`)
  console.log(`G  price-history rows relabelled: ${impossibleSnapshots.length}`)
  if (!APPLY) {
    console.log('Dry run: nothing written. Re-run with --apply.')
    await db.$disconnect()
    return
  }

  // ── Backup, then write ─────────────────────────────────────────────────
  const backup = {
    db: DB,
    taken_at: new Date().toISOString(),
    projects: await db.project.findMany({ where: { id: { in: [...archive.map((a) => a.loser.id), ...projectEdits.map((e) => e.id)] } } }),
    cost_sheets: await db.costSheet.findMany({ where: { id: { in: sheetClears.map((s) => s.id) } } }),
    builders: await db.builder.findMany({ where: { id: { in: builderEdits.map((b) => b.id) } } }),
    price_history_ids_relabelled: impossibleSnapshots.map((r) => r.id),
  }
  mkdirSync('backups', { recursive: true })
  const file = join('backups', `templated-pass3-${DB}-${backup.taken_at.replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify(backup, null, 1))
  console.log(`backup written: ${file} (${backup.projects.length} projects, ${backup.cost_sheets.length} cost sheets, ${backup.builders.length} builders, ${backup.price_history_ids_relabelled.length} price rows)`)

  const clearValue = (f: string) => (f === 'plc_charges' || f === 'other_charges' ? [] : null)
  await db.$transaction([
    ...archive.map((a) => db.project.update({ where: { id: a.loser.id }, data: { archived_duplicate_of: a.survivor.id } })),
    ...sheetClears.map((s) => db.costSheet.update({ where: { id: s.id }, data: Object.fromEntries(s.fields.map((f) => [f, clearValue(f)])) as any })),
    ...builderEdits.map((b) => db.builder.update({ where: { id: b.id }, data: b.data as any })),
    ...projectEdits.map((p) => db.project.update({ where: { id: p.id }, data: p.data as any })),
    db.priceHistory.updateMany({ where: { id: { in: impossibleSnapshots.map((r) => r.id) } }, data: { source: 'historical_benchmark' } }),
  ], { timeout: 120_000 } as any)
  console.log('applied.')
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await db.$disconnect()
  process.exit(1)
})
