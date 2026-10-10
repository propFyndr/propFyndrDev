import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/lib/db'
import { backfillFactVerification, KEEP_TIER_PROJECT_FIELDS } from '../backfillFactVerification'

describe('backfillFactVerification', () => {
  let projectId: string
  let unitTypeId: string
  let builderId: string

  before(async () => {
    const builder = await prisma.builder.create({ data: { name: `Backfill Test Builder ${Date.now()}`, slug: `backfill-test-builder-${Date.now()}` } })
    builderId = builder.id
    const project = await prisma.project.create({
      data: {
        name: 'Backfill Test Project', slug: `backfill-test-${Date.now()}`,
        builder_id: builder.id, city: 'Noida', sector: 'Sector 1', status: 'ready_to_move',
        description: 'has a value',
      },
    })
    projectId = project.id
    const unit = await prisma.unitType.create({
      data: { project_id: project.id, name: '3BHK', bhk: 3, carpet_area_sqft: 1200, super_area_sqft: 1500 },
    })
    unitTypeId = unit.id
  })

  after(async () => {
    await prisma.factVerification.deleteMany({ where: { entityId: { in: [projectId, unitTypeId] } } })
    await prisma.unitType.deleteMany({ where: { id: unitTypeId } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.builder.deleteMany({ where: { id: builderId } })
    await prisma.$disconnect()
  })

  it('creates a SCRAPED FactVerification row for every non-null KEEP-tier field', async () => {
    await backfillFactVerification({ onlyEntityIds: [projectId, unitTypeId] })

    const rows = await prisma.factVerification.findMany({ where: { entityId: { in: [projectId, unitTypeId] } } })
    const byField = new Map(rows.map(r => [`${r.entityType}.${r.fieldName}`, r]))

    assert.ok(byField.has('Project.description'), 'description was non-null, should get a row')
    assert.equal(byField.get('Project.description')?.tier, 'SCRAPED')
    assert.equal(byField.get('Project.description')?.verifiedAt, null)

    assert.ok(byField.has('UnitType.carpet_area_sqft'))
    assert.ok(byField.has('UnitType.super_area_sqft'))
  })

  it('is idempotent — running it twice does not duplicate rows', async () => {
    await backfillFactVerification({ onlyEntityIds: [projectId, unitTypeId] })
    const rows = await prisma.factVerification.findMany({ where: { entityId: { in: [projectId, unitTypeId] } } })
    const keys = rows.map(r => `${r.entityType}:${r.entityId}:${r.fieldName}`)
    assert.equal(new Set(keys).size, keys.length, 'no duplicate (entityType, entityId, fieldName) rows')
  })

  it('KEEP_TIER_PROJECT_FIELDS does not include any field dropped in Task 1', () => {
    for (const f of ['women_safety_score', 'legal_flag', 'nri_eligible', 'aqi_annual_avg']) {
      assert.ok(!KEEP_TIER_PROJECT_FIELDS.includes(f as never), `${f} was dropped and must not be in the keep list`)
    }
  })
})
