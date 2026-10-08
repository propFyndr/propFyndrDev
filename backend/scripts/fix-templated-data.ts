/**
 * Clear the templated values that were reaching buyers as facts.
 *
 *   npm run fix:templated                # dry run: counts and samples, writes nothing
 *   npm run fix:templated -- --apply     # backs up every touched row, then writes
 *
 * Found on the 2026-10-04 founder test, each one a buyer-facing answer:
 *
 *   Builders   49 of 134 carry delivered_units=10000, average_delay_months=0,
 *              delayed_projects_count=0 — a seed default, not a record. Antriksh,
 *              Panchsheel, Arihant and SKA were answered as on-time builders.
 *              76 share one copy-pasted awards list.
 *   Connectivity  Hundreds of projects share identical (landmark, distance) rows
 *              across unrelated sectors: "Gaur Chowk / Sector 52 Metro Link,
 *              1.2 km" on Sector 150 projects; "Jewar airport, 34 km" on 266.
 *   Amrapali   Projects split across two builder rows. The receivership flag
 *              lives on "Amrapali Group (NBCC Supervised)"; the rest point at a
 *              clean "Amrapali / NBCC", so "what's the catch" found nothing.
 *
 * Second pass (2026-10-05 audit), each also seen in a buyer answer:
 *
 *   OC text   "Applied / In Inspection" on projects whose possession is still
 *             years away (Elite X, Dec 2028). An OC is applied for on completion.
 *   Units     One highlights list ("Optimal Carpet Area Efficiency (80%+)" next
 *             to a real 62%) and one "ideal for" list copied across 145 and 61
 *             projects.
 *   Builders  The 49 track-record template builders (first backup) also carry
 *             seeded 0-100 scores that order recommendations, and an
 *             awards_count left behind when their copied awards were cleared.
 *
 * Cleared means null or removed, never replaced with a guess. A field we do not
 * hold reads "not recorded" downstream, which is true; the template was not.
 */
import 'dotenv/config'
import { readFileSync, writeFileSync } from 'fs'
import { Prisma } from '@prisma/client'
import { prisma } from '../src/lib/db'

const APPLY = process.argv.includes('--apply')
/** The first pass's backup: the only record of which builders carried the template. */
const FIRST_PASS_BACKUP = 'backups/templated-data-2026-10-05T01-57-43-096Z.json'
/** A unit-type list repeated on more projects than this is a template. */
const MAX_PROJECTS_PER_UNIT_LIST = 3

/** A (landmark, distance) pair seen in more sectors than this was not measured per project. */
const MAX_SECTORS_PER_MEASUREMENT = 3
/** An awards list shared by more builders than this is a template. */
const MAX_BUILDERS_PER_AWARDS_LIST = 3

async function main(): Promise<void> {
  // 1. Builder track-record template.
  const templatedBuilders = await prisma.builder.findMany({
    where: { delivered_units: 10000, average_delay_months: 0, delayed_projects_count: 0 },
    select: { id: true, name: true, delivered_units: true, average_delay_months: true, delayed_projects_count: true },
  })

  const awardRows = await prisma.builder.findMany({ select: { id: true, name: true, awards: true } })
  const awardCounts = new Map<string, number>()
  for (const b of awardRows) if (b.awards.length) awardCounts.set(JSON.stringify(b.awards), (awardCounts.get(JSON.stringify(b.awards)) ?? 0) + 1)
  const templatedAwards = awardRows.filter(b => b.awards.length && (awardCounts.get(JSON.stringify(b.awards)) ?? 0) > MAX_BUILDERS_PER_AWARDS_LIST)

  // 2. Connectivity rows repeated across unrelated sectors.
  const conn = await prisma.connectivity.findMany({
    select: { id: true, project_id: true, type: true, name: true, distance_km: true, travel_time_min: true, data_source: true, project: { select: { sector: true } } },
  })
  const sectorsByMeasurement = new Map<string, Set<string>>()
  for (const c of conn) {
    const key = `${c.name}|${c.distance_km}`
    if (!sectorsByMeasurement.has(key)) sectorsByMeasurement.set(key, new Set())
    sectorsByMeasurement.get(key)!.add(c.project?.sector ?? '?')
  }
  const templatedConn = conn.filter(c => (sectorsByMeasurement.get(`${c.name}|${c.distance_km}`)?.size ?? 0) > MAX_SECTORS_PER_MEASUREMENT)

  // 3. Amrapali split.
  const amrapaliFlagged = await prisma.builder.findFirst({ where: { name: 'Amrapali Group (NBCC Supervised)' }, select: { id: true } })
  const amrapaliClean = await prisma.builder.findFirst({ where: { name: 'Amrapali / NBCC' }, select: { id: true } })
  const amrapaliProjects = amrapaliClean
    ? await prisma.project.findMany({ where: { builder_id: amrapaliClean.id }, select: { id: true, name: true, builder_id: true } })
    : []

  console.log('Builders with the track-record template:', templatedBuilders.length)
  console.log('  ', templatedBuilders.map(b => b.name).join(', '))
  console.log('Builders with a shared awards list:', templatedAwards.length)
  console.log('Connectivity rows repeated across >', MAX_SECTORS_PER_MEASUREMENT, 'sectors:', templatedConn.length, 'of', conn.length,
    'across', new Set(templatedConn.map(c => c.project_id)).size, 'projects')
  const sample = [...new Set(templatedConn.map(c => `${c.name} @ ${c.distance_km} km`))].slice(0, 12)
  console.log('  e.g.', sample.join(' | '))
  console.log('Amrapali projects to move onto the receivership builder:', amrapaliProjects.length, amrapaliFlagged ? '' : '(flagged builder row NOT FOUND — skipped)')

  // 4. OC applied for on a project more than a year from completion. Closer
  // than that an application is plausible, so those rows are left alone.
  const yearOut = new Date()
  yearOut.setFullYear(yearOut.getFullYear() + 1)
  const prematureOc = await prisma.project.findMany({
    where: { occupancy_certificate_status: 'Applied / In Inspection', possession_date: { gt: yearOut } },
    select: { id: true, name: true, occupancy_certificate_status: true, possession_date: true },
  })

  // 5. Unit-type lists copied across projects.
  const units = await prisma.unitType.findMany({ select: { id: true, project_id: true, key_highlights: true, perfect_for: true } })
  const projectsByList = new Map<string, Set<string>>()
  const listKeys = (u: typeof units[number]) => [
    u.key_highlights ? `h|${JSON.stringify(u.key_highlights)}` : null,
    u.perfect_for.length ? `p|${JSON.stringify(u.perfect_for)}` : null,
  ].filter((k): k is string => !!k)
  for (const u of units) for (const k of listKeys(u)) {
    if (!projectsByList.has(k)) projectsByList.set(k, new Set())
    projectsByList.get(k)!.add(u.project_id)
  }
  const copied = (k: string | null) => !!k && (projectsByList.get(k)?.size ?? 0) > MAX_PROJECTS_PER_UNIT_LIST
  const templatedHighlights = units.filter(u => u.key_highlights && copied(`h|${JSON.stringify(u.key_highlights)}`))
  const templatedPerfectFor = units.filter(u => u.perfect_for.length && copied(`p|${JSON.stringify(u.perfect_for)}`))

  // 6. Scores and awards_count on builders the first pass proved templated.
  const firstPass = JSON.parse(readFileSync(FIRST_PASS_BACKUP, 'utf8')) as { templatedBuilders: { id: string }[]; templatedAwards: { id: string }[] }
  const scoreFields = { delivery_score: true, construction_quality_score: true, after_sales_score: true, buyer_satisfaction_score: true, rera_compliance_score: true, financial_hygiene_score: true } as const
  const scoredTemplateBuilders = await prisma.builder.findMany({
    where: {
      id: { in: firstPass.templatedBuilders.map(b => b.id) },
      OR: Object.keys(scoreFields).map(f => ({ [f]: { not: null } })),
    },
    select: { id: true, name: true, ...scoreFields },
  })
  const staleAwardCounts = await prisma.builder.findMany({
    where: { id: { in: firstPass.templatedAwards.map(b => b.id) }, awards: { isEmpty: true }, awards_count: { gt: 0 } },
    select: { id: true, name: true, awards_count: true },
  })

  console.log('Projects with OC "applied" before possession is due:', prematureOc.length)
  console.log('  ', prematureOc.map(p => `${p.name} (${p.possession_date?.toISOString().slice(0, 7)})`).join(', '))
  console.log('Unit types with a copied highlights list:', templatedHighlights.length, '· copied "ideal for" list:', templatedPerfectFor.length)
  console.log('Template builders still carrying scores:', scoredTemplateBuilders.length, '· stale awards_count:', staleAwardCounts.length)

  if (!APPLY) {
    console.log('\nDry run. Nothing written. Re-run with --apply.')
    return
  }

  const backup = `backups/templated-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(backup, JSON.stringify({
    templatedBuilders, templatedAwards, templatedConn, amrapaliProjects,
    prematureOc, templatedHighlights, templatedPerfectFor, scoredTemplateBuilders, staleAwardCounts,
  }, null, 2))
  console.log('\nBackup written:', backup)

  await prisma.$transaction([
    prisma.builder.updateMany({
      where: { id: { in: templatedBuilders.map(b => b.id) } },
      data: { delivered_units: null, average_delay_months: null, delayed_projects_count: null },
    }),
    prisma.builder.updateMany({ where: { id: { in: templatedAwards.map(b => b.id) } }, data: { awards: [] } }),
    prisma.connectivity.deleteMany({ where: { id: { in: templatedConn.map(c => c.id) } } }),
    ...(amrapaliFlagged && amrapaliProjects.length
      ? [prisma.project.updateMany({ where: { id: { in: amrapaliProjects.map(p => p.id) } }, data: { builder_id: amrapaliFlagged.id } })]
      : []),
    prisma.project.updateMany({ where: { id: { in: prematureOc.map(p => p.id) } }, data: { occupancy_certificate_status: null } }),
    prisma.unitType.updateMany({ where: { id: { in: templatedHighlights.map(u => u.id) } }, data: { key_highlights: Prisma.DbNull } }),
    prisma.unitType.updateMany({ where: { id: { in: templatedPerfectFor.map(u => u.id) } }, data: { perfect_for: [] } }),
    prisma.builder.updateMany({
      where: { id: { in: scoredTemplateBuilders.map(b => b.id) } },
      data: { delivery_score: null, construction_quality_score: null, after_sales_score: null, buyer_satisfaction_score: null, rera_compliance_score: null, financial_hygiene_score: null },
    }),
    prisma.builder.updateMany({ where: { id: { in: staleAwardCounts.map(b => b.id) } }, data: { awards_count: null } }),
  ])
  console.log('Applied.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
