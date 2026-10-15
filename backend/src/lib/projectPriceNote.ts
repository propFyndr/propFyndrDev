// backend/src/lib/projectPriceNote.ts
//
// The clause that sits next to a price the advisor states: who confirmed it and
// when, or that no confirmation date is on record. Read from FactVerification
// (see priceVerification.ts for the rules).
import { prisma } from './db'
import { combinePriceFreshness, priceDateNote, UNDATED_NOTE, type PriceRecord } from './priceVerification'

interface Loaded {
  projects: Array<{ id: string }>
  units: Array<{ id: string; project_id: string }>
  rows: Array<{ entityType: string; entityId: string } & PriceRecord>
}

/** Three small reads however many projects are asked for. */
async function loadFromDb(projectIds: string[]): Promise<Loaded> {
  const [projects, units] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: projectIds }, price_min_cr: { not: null } }, select: { id: true } }),
    prisma.unitType.findMany({ where: { project_id: { in: projectIds }, price_min_cr: { not: null } }, select: { id: true, project_id: true } }),
  ])
  const rows = await prisma.factVerification.findMany({
    where: {
      fieldName: 'price_min_cr',
      OR: [
        { entityType: 'Project', entityId: { in: projects.map((p) => p.id) } },
        { entityType: 'UnitType', entityId: { in: units.map((u) => u.id) } },
      ],
    },
    select: { entityType: true, entityId: true, tier: true, verifiedAt: true },
  })
  return { projects, units, rows }
}

/**
 * One note per project id.
 *
 * A date is an annotation on a price, never a condition for answering. If the
 * lookup fails (a missing table, a dropped connection) every project gets the
 * undated note, which is true: we could not confirm a date. The failure is
 * logged, and the buyer still gets their answer.
 */
export async function projectPriceNotes(
  projectIds: string[],
  now: Date = new Date(),
  load: (ids: string[]) => Promise<Loaded> = loadFromDb,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (projectIds.length === 0) return out

  let loaded: Loaded
  try {
    loaded = await load(projectIds)
  } catch (err) {
    console.warn('[priceNote] lookup failed, saying the date is not on record:', err instanceof Error ? err.message : err)
    for (const id of projectIds) out.set(id, UNDATED_NOTE)
    return out
  }

  const { projects, units, rows } = loaded
  const byEntity = new Map<string, PriceRecord>(rows.map((r) => [`${r.entityType}:${r.entityId}`, r]))

  for (const id of projectIds) {
    // A price we hold with no row is "no confirmation", never skipped.
    const held = [
      ...projects.filter((p) => p.id === id).map((p) => byEntity.get(`Project:${p.id}`) ?? null),
      ...units.filter((u) => u.project_id === id).map((u) => byEntity.get(`UnitType:${u.id}`) ?? null),
    ]
    out.set(id, priceDateNote(combinePriceFreshness(held, now)))
  }
  return out
}
