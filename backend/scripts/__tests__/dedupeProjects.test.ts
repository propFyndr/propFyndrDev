import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/lib/db'
import { resolveDuplicate, keepTierFieldScore } from '../dedupeProjects'

describe('resolveDuplicate', () => {
  let builderId: string
  const name = `Dedupe Test Pair ${Date.now()}`

  before(async () => {
    const builder = await prisma.builder.create({ data: { name: `Dedupe Test Builder ${Date.now()}`, slug: `dedupe-test-builder-${Date.now()}` } })
    builderId = builder.id
  })

  after(async () => {
    await prisma.project.deleteMany({ where: { builder_id: builderId } })
    await prisma.builder.deleteMany({ where: { id: builderId } })
    await prisma.$disconnect()
  })

  it('picks the row with more non-null KEEP-tier fields as the winner', async () => {
    const thin = await prisma.project.create({ data: { name, slug: `${name}-a`, builder_id: builderId, city: 'Noida', sector: 'Sector 1', status: 'ready_to_move' } })
    const rich = await prisma.project.create({ data: { name, slug: `${name}-b`, builder_id: builderId, city: 'Noida', sector: 'Sector 1', status: 'ready_to_move', description: 'full description', rera_number: 'UPRERAPRJ999' } })

    const result = await resolveDuplicate([thin.id, rich.id] as unknown as [string, string])
    assert.ok(!('skipped' in result))
    if (!('skipped' in result)) {
      assert.equal(result.winnerId, rich.id)
      assert.equal(result.loserId, thin.id)
    }

    const loser = await prisma.project.findUniqueOrThrow({ where: { id: thin.id } })
    assert.equal(loser.archived_duplicate_of, rich.id)
    const winner = await prisma.project.findUniqueOrThrow({ where: { id: rich.id } })
    assert.equal(winner.archived_duplicate_of, null)
  })

  it('breaks a tie by most recent updated_at', async () => {
    const a = await prisma.project.create({ data: { name: `${name}-tie`, slug: `${name}-tie-a`, builder_id: builderId, city: 'Noida', sector: 'Sector 2', status: 'ready_to_move' } })
    await new Promise(r => setTimeout(r, 10))
    const b = await prisma.project.create({ data: { name: `${name}-tie`, slug: `${name}-tie-b`, builder_id: builderId, city: 'Noida', sector: 'Sector 2', status: 'ready_to_move' } })

    const result = await resolveDuplicate([a.id, b.id] as unknown as [string, string])
    assert.ok(!('skipped' in result))
    if (!('skipped' in result)) assert.equal(result.winnerId, b.id, 'b was created later, should win the tiebreak')
  })

  it('skips (does not throw) when a named pair does not resolve to exactly two live rows', async () => {
    const result = await resolveDuplicate(['Nonexistent Project Name One', 'Nonexistent Project Name Two'])
    assert.ok('skipped' in result && result.skipped)
  })
})

describe('keepTierFieldScore', () => {
  it('counts non-null KEEP-tier fields', () => {
    assert.equal(keepTierFieldScore({ description: 'x', rera_number: null, price_min_cr: 1.5 }), 2)
  })
})
