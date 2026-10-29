// Must stay the first import: Redis off, so sessions live in this process.
import '../../lib/eval/replayEnv'
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../index'
import { prisma } from '../../lib/db'
import { createIdentitySession } from '../../lib/adminIdentity'

// The two new routes over HTTP, on dev: a builder proposes only for its own
// flat types, only our roles review, and a rejection reaches the builder's list.
// Rejecting changes no catalogue row; the proposal and audit rows are deleted after.
describe('builder listing changes over HTTP (dev DB)', () => {
  const created: string[] = []
  const started = new Date()
  after(async () => {
    await prisma.listingChange.deleteMany({ where: { id: { in: created } } })
    await prisma.auditLog.deleteMany({ where: { action: 'REJECT', created_at: { gte: started }, actor: 'http-test-analyst@realtyask.dev' } })
    await prisma.$disconnect()
  })

  const session = (role: 'BUILDER' | 'ANALYST', builderId: string | null, email: string) =>
    createIdentitySession({ ip: '127.0.0.1', userAgent: 'test', adminUserId: randomUUID(), email, role, builderId, partnerId: null })

  it('scopes, roles, propose and reject', async () => {
    const unit = await prisma.unitType.findFirst({ where: { availability: 'available', price_min_cr: { not: null } }, select: { id: true, price_min_cr: true, project: { select: { builder_id: true } } } })
    assert.ok(unit)
    const other = await prisma.builder.findFirst({ where: { id: { not: unit.project.builder_id } }, select: { id: true } })
    assert.ok(other)
    const own = await session('BUILDER', unit.project.builder_id, 'http-test-builder@realtyask.dev')
    const foreign = await session('BUILDER', other.id, 'http-test-foreign@realtyask.dev')
    const analyst = await session('ANALYST', null, 'http-test-analyst@realtyask.dev')
    const body = { kind: 'price', unit_type_id: unit.id, price_min_cr: unit.price_min_cr! + 0.07, price_max_cr: unit.price_min_cr! + 0.17 }
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

    assert.equal((await request(app).post('/api/v1/portal/builder/listing-changes').set(auth(foreign)).send(body)).status, 404, 'another builder reached this flat type')
    assert.equal((await request(app).post('/api/v1/portal/builder/listing-changes').set(auth(analyst)).send(body)).status, 403, 'our role proposed')
    assert.equal((await request(app).post('/api/v1/portal/builder/listing-changes').set(auth(own)).send({ ...body, price_max_cr: 0.05 })).status, 400)

    const made = await request(app).post('/api/v1/portal/builder/listing-changes').set(auth(own)).send(body)
    assert.equal(made.status, 201, JSON.stringify(made.body))
    created.push(made.body.id)

    assert.equal((await request(app).get('/api/v1/admin/listing-changes').set(auth(own))).status, 403, 'a builder reached the review queue')
    const queue = await request(app).get('/api/v1/admin/listing-changes').set(auth(analyst))
    assert.equal(queue.status, 200)
    assert.ok(queue.body.changes.some((c: { id: string }) => c.id === made.body.id))

    assert.equal((await request(app).post(`/api/v1/admin/listing-changes/${made.body.id}/reject`).set(auth(analyst)).send({ reason: '' })).status, 400)
    assert.equal((await request(app).post(`/api/v1/admin/listing-changes/${made.body.id}/reject`).set(auth(analyst)).send({ reason: 'Price list not attached' })).status, 200)

    const mine = await request(app).get('/api/v1/portal/builder/unit-types').set(auth(own))
    const row = mine.body.projects.flatMap((p: { unit_types: Array<{ id: string; listing_changes: Array<{ id: string; status: string; reject_reason: string }> }> }) => p.unit_types).find((u: { id: string }) => u.id === unit.id)
    const seen = row.listing_changes.find((c: { id: string }) => c.id === made.body.id)
    assert.equal(seen.status, 'rejected')
    assert.equal(seen.reject_reason, 'Price list not attached')
  })
})
