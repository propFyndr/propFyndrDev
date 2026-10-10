import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/lib/db'
import { resetPublishedDecisionProfilesToDraft } from '../resetDecisionProfilesToDraft'

describe('resetPublishedDecisionProfilesToDraft', () => {
  let projectId: string
  let profileId: string
  let builderId: string

  before(async () => {
    const builder = await prisma.builder.create({ data: { name: `Reset Test Builder ${Date.now()}`, slug: `reset-test-builder-${Date.now()}` } })
    builderId = builder.id
    const project = await prisma.project.create({ data: { name: 'Reset Test', slug: `reset-test-${Date.now()}`, builder_id: builder.id, city: 'Noida', sector: 'Sector 1', status: 'ready_to_move' } })
    projectId = project.id
    const profile = await prisma.decisionProfile.create({ data: { project_id: project.id, status: 'PUBLISHED' } })
    profileId = profile.id
  })

  after(async () => {
    await prisma.decisionProfile.deleteMany({ where: { id: profileId } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.builder.deleteMany({ where: { id: builderId } })
    await prisma.$disconnect()
  })

  it('resets every PUBLISHED row to DRAFT and returns the count', async () => {
    const n = await resetPublishedDecisionProfilesToDraft()
    assert.ok(n >= 1)
    const updated = await prisma.decisionProfile.findUniqueOrThrow({ where: { id: profileId } })
    assert.equal(updated.status, 'DRAFT')
  })
})
