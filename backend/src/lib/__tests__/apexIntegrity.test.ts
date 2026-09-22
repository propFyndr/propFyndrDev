import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../db'

describe('Project Integrity: Apex Golf Avenue', () => {
  it('Apex Golf Avenue exists only in Sector 1, Greater Noida West and never in Sector 150', async () => {
    const rows = await prisma.project.findMany({
      where: { name: { contains: 'Apex Golf', mode: 'insensitive' } },
      select: { id: true, name: true, sector: true, city: true, rera_number: true }
    })

    assert.equal(rows.length, 1, `Expected exactly 1 Apex Golf Avenue record, but found ${rows.length}`)
    const p = rows[0]
    assert.equal(p.name, 'Apex Golf Avenue')
    assert.equal(p.sector, 'Sector 1')
    assert.equal(p.city, 'Greater Noida West')
    assert.equal(p.rera_number, 'UPRERAPRJ8585')

    const in150 = await prisma.project.findMany({
      where: {
        sector: { contains: '150', mode: 'insensitive' },
        name: { contains: 'Apex', mode: 'insensitive' }
      }
    })
    assert.equal(in150.length, 0, 'No Apex projects should exist in Sector 150')
  })
})
