import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { filterUnitTypeArgs } from '../excludeSoldOutUnitTypes'
import { prisma } from '../db'

const AV = { not: 'sold_out' }

describe('sold-out flat types never reach a buyer read', () => {
  it('filters a direct unit type read', () => {
    assert.deepEqual(filterUnitTypeArgs('UnitType', { where: { bhk: 3 } }), { where: { bhk: 3, availability: AV } })
    assert.deepEqual(filterUnitTypeArgs('UnitType', undefined), { where: { availability: AV } })
  })

  it('filters the relation in include and select, at any depth', () => {
    assert.deepEqual(filterUnitTypeArgs('Project', { include: { unit_types: true } }), { include: { unit_types: { where: { availability: AV } } } })
    const nested = filterUnitTypeArgs('SavedProperty', {
      include: { project: { include: { unit_types: { orderBy: { bhk: 'asc' } } } } },
    }) as any
    assert.deepEqual(nested.include.project.include.unit_types, { orderBy: { bhk: 'asc' }, where: { availability: AV } })
    const sel = filterUnitTypeArgs('Project', { select: { name: true, unit_types: { select: { bhk: true } } } }) as any
    assert.deepEqual(sel.select.unit_types.where, { availability: AV })
  })

  it('filters "some" relation filters, including inside AND/OR', () => {
    const r = filterUnitTypeArgs('Project', { where: { OR: [{ unit_types: { some: { bhk: 3 } } }] } }) as any
    assert.deepEqual(r.where.OR[0].unit_types.some, { bhk: 3, availability: AV })
  })

  it('leaves an explicit availability key alone (admin, portal, approval)', () => {
    assert.deepEqual(filterUnitTypeArgs('UnitType', { where: { availability: undefined } }), { where: { availability: undefined } })
    const r = filterUnitTypeArgs('Project', { include: { unit_types: { where: { availability: undefined } } } }) as any
    assert.deepEqual(r.include.unit_types.where, { availability: undefined })
  })

  it('leaves relation counts alone', () => {
    const r = { select: { _count: { select: { unit_types: true } } } }
    assert.deepEqual(filterUnitTypeArgs('Project', r), r)
  })
})

describe('sold-out filter on the real client (dev DB, rolled back)', () => {
  after(() => prisma.$disconnect())

  it('applies inside an interactive transaction, nested and direct', async () => {
    const unit = await prisma.unitType.findFirst({ where: { availability: 'available' }, select: { id: true, project_id: true } })
    assert.ok(unit, 'dev has no unit types')
    const ROLLBACK = new Error('rollback')
    await prisma.$transaction(async (tx) => {
      await tx.unitType.update({ where: { id: unit.id }, data: { availability: 'sold_out' } })
      const project = await tx.project.findUnique({ where: { id: unit.project_id }, include: { unit_types: true } })
      assert.ok(project && !project.unit_types.some((u) => u.id === unit.id), 'nested include still returned the sold-out type')
      assert.equal(await tx.unitType.count({ where: { id: unit.id } }), 0, 'direct read still returned it')
      assert.equal(await tx.unitType.count({ where: { id: unit.id, availability: undefined } }), 1, 'opt-out lost the row')
      throw ROLLBACK
    }).catch((e) => { if (e !== ROLLBACK) throw e })
    const after = await prisma.unitType.findFirst({ where: { id: unit.id, availability: undefined }, select: { availability: true } })
    assert.equal(after?.availability, 'available')
  })
})
