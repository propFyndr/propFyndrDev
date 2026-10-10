import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../db'
import { getFactVerification, getFactVerificationsFor } from '../factPresentation'

describe('getFactVerification / getFactVerificationsFor', () => {
  const entityId = 'test-project-fact-presentation'

  before(async () => {
    await prisma.factVerification.createMany({
      data: [
        { entityType: 'Project', entityId, fieldName: 'rera_number', tier: 'VERIFIED', verifiedAt: new Date('2026-09-01') },
        { entityType: 'Project', entityId, fieldName: 'price_min_cr', tier: 'SCRAPED' },
      ],
    })
  })

  after(async () => {
    await prisma.factVerification.deleteMany({ where: { entityId } })
    await prisma.$disconnect()
  })

  it('returns null for a field with no FactVerification row', async () => {
    const r = await getFactVerification('Project', entityId, 'description')
    assert.equal(r, null)
  })

  it('returns the row for a field that has one', async () => {
    const r = await getFactVerification('Project', entityId, 'rera_number')
    assert.ok(r)
    assert.equal(r?.tier, 'VERIFIED')
    assert.deepEqual(r?.verifiedAt, new Date('2026-09-01'))
  })

  it('getFactVerificationsFor batches every row for one entity into a Map', async () => {
    const m = await getFactVerificationsFor('Project', entityId)
    assert.equal(m.size, 2)
    assert.equal(m.get('rera_number')?.tier, 'VERIFIED')
    assert.equal(m.get('price_min_cr')?.tier, 'SCRAPED')
    assert.equal(m.get('description'), undefined)
  })
})
