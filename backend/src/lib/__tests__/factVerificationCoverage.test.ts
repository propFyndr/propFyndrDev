import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../db'
import { getFactVerification } from '../factPresentation'

describe('every fact factPresentation.ts can present as verified has a backing row for at least one real project', () => {
  it('rera_number has a FactVerification row for at least one project that holds a rera_number', async () => {
    const project = await prisma.project.findFirst({ where: { rera_number: { not: null }, archived_duplicate_of: null } })
    assert.ok(project, 'need at least one live project with a rera_number to test this')
    const row = await getFactVerification('Project', project!.id, 'rera_number')
    assert.ok(row, `Project ${project!.id} has a rera_number but no FactVerification row backing it`)
  })

  it('price_min_cr has a FactVerification row for at least one UnitType that holds it', async () => {
    const unit = await prisma.unitType.findFirst({ where: { price_min_cr: { not: null } } })
    assert.ok(unit, 'need at least one UnitType with price_min_cr to test this')
    const row = await getFactVerification('UnitType', unit!.id, 'price_min_cr')
    assert.ok(row, `UnitType ${unit!.id} has price_min_cr but no FactVerification row backing it`)
  })
})
