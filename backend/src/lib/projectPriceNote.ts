// backend/src/lib/projectPriceNote.ts
//
// The clause that sits next to a price the advisor states: who confirmed it and
// when, or that no confirmation date is on record. Read from FactVerification
// (see priceVerification.ts for the rules).
import { prisma } from './db'
import { combinePriceFreshness, priceDateNote, type PriceRecord } from './priceVerification'

/** One note per project id. Three small reads however many projects are asked for. */
export async function projectPriceNotes(projectIds: string[], now: Date = new Date()): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (projectIds.length === 0) return out

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
