// backend/scripts/backfillFactVerification.ts
//
// Phase 1 backfill: one FactVerification row (tier=SCRAPED, verifiedAt=null)
// per non-null KEEP-tier field on Project/UnitType, so a fact that already
// held real data doesn't drop to `missing` the moment Task 7+ reads start
// checking FactVerification instead of raw non-null-ness. SCRAPED, not
// VERIFIED: honest about not actually knowing when or how these values were
// sourced — that's the whole reason this migration exists.
//
//   npx tsx scripts/backfillFactVerification.ts

import { prisma } from '../src/lib/db'

/** The spec's "Kept as-is" list for Project, minus anything computed elsewhere. */
export const KEEP_TIER_PROJECT_FIELDS = [
  'description', 'long_description', 'rera_number', 'rera_url', 'price_min_cr',
  'price_range_label', 'possession_confidence', 'possession_confidence_note',
  'oc_obtained', 'oc_obtained_date', 'oc_valid_until', 'oc_restrictions',
  'rera_valid_until', 'project_risk_flag', 'registry_status',
  'registry_embargo_reasons', 'nclt_moratorium_active', 'location_advantages',
  'location_concerns', 'location_verdict', 'walkability_score',
  'flood_waterlogging_risk', 'commute_matrix', 'design_theme', 'architect',
  'interior_designer', 'lat', 'lng',
] as const

export const KEEP_TIER_UNIT_TYPE_FIELDS = [
  'carpet_area_sqft', 'super_area_sqft', 'super_area_range_sqft',
  'carpet_to_super_ratio_pct', 'balconies', 'balcony_area_sqft', 'bathrooms',
  'price_min_cr', 'price_max_cr', 'price_label', 'price_per_sqft',
  'built_up_area_sqft', 'common_area_shaft_sqft',
] as const

export async function backfillFactVerification(opts: { onlyEntityIds?: string[] } = {}): Promise<{ projectRows: number; unitTypeRows: number }> {
  const projects = await prisma.project.findMany({
    where: opts.onlyEntityIds ? { id: { in: opts.onlyEntityIds } } : undefined,
    select: Object.fromEntries(['id', ...KEEP_TIER_PROJECT_FIELDS].map(f => [f, true])) as Record<string, true>,
  })

  let projectRows = 0
  for (const p of projects) {
    const data = (KEEP_TIER_PROJECT_FIELDS as readonly string[])
      .filter(f => (p as Record<string, unknown>)[f] != null)
      .map(f => ({ entityType: 'Project', entityId: (p as { id: string }).id, fieldName: f, tier: 'SCRAPED' as const, verifiedAt: null }))
    if (data.length === 0) continue
    const result = await prisma.factVerification.createMany({ data, skipDuplicates: true })
    projectRows += result.count
  }

  const unitTypes = await prisma.unitType.findMany({
    where: opts.onlyEntityIds ? { id: { in: opts.onlyEntityIds } } : undefined,
    select: Object.fromEntries(['id', ...KEEP_TIER_UNIT_TYPE_FIELDS].map(f => [f, true])) as Record<string, true>,
  })

  let unitTypeRows = 0
  for (const u of unitTypes) {
    const data = (KEEP_TIER_UNIT_TYPE_FIELDS as readonly string[])
      .filter(f => (u as Record<string, unknown>)[f] != null)
      .map(f => ({ entityType: 'UnitType', entityId: (u as { id: string }).id, fieldName: f, tier: 'SCRAPED' as const, verifiedAt: null }))
    if (data.length === 0) continue
    const result = await prisma.factVerification.createMany({ data, skipDuplicates: true })
    unitTypeRows += result.count
  }

  return { projectRows, unitTypeRows }
}

if (require.main === module) {
  backfillFactVerification().then(r => {
    console.log(`[BACKFILL] ${r.projectRows} Project rows, ${r.unitTypeRows} UnitType rows`)
    return prisma.$disconnect()
  }).catch(e => { console.error(e); process.exit(1) })
}
