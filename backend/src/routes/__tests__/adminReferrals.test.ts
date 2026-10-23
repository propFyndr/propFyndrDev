import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import { adminReferralsRouter } from '../adminReferrals'
import { prisma } from '../../lib/db'

// adminAreaGuard is mounted at the app level in production (backend/src/index.ts);
// this test stubs an already-authenticated SUPER_ADMIN identity the same way
// adminBoards tests do, to exercise the router in isolation.
function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((req: Request & { adminIdentity?: any }, _res: Response, next: NextFunction) => {
    req.adminIdentity = { adminUserId: 'admin-1', email: 'furqan@propfyndr.com', role: 'SUPER_ADMIN' }
    next()
  })
  app.use('/api/v1/admin/referrals', adminReferralsRouter)
  return app
}

// Every run used to leave its links, visits and a "Test Buyer" site visit in
// the database. Links this file creates carry the stub admin id above.
const startedAt = new Date()
after(async () => {
  const links = await prisma.referralLink.findMany({
    where: { created_by_admin_id: 'admin-1', created_at: { gte: startedAt } },
    select: { code: true },
  })
  const codes = links.map(l => l.code)
  const visits = await prisma.referralVisit.findMany({ where: { root_code: { in: codes } }, select: { guest_token: true } })
  await prisma.siteVisitRequest.deleteMany({ where: { guest_token: { in: visits.map(v => v.guest_token) } } })
  await prisma.referralVisit.deleteMany({ where: { root_code: { in: codes } } })
  await prisma.referralLink.deleteMany({ where: { code: { in: codes } } })
})

describe('POST /api/v1/admin/referrals', () => {
  it('creates a ROOT link with a label and greeting name', async () => {
    const res = await request(buildApp())
      .post('/api/v1/admin/referrals')
      .send({ label: 'Rahul – college', greetingName: 'Furqan' })
    assert.equal(res.status, 201)
    assert.equal(typeof res.body.code, 'string')
    assert.equal(res.body.code.length, 8)
    assert.ok(res.body.url.endsWith(res.body.code))
  })

  it('rejects a missing label', async () => {
    const res = await request(buildApp())
      .post('/api/v1/admin/referrals')
      .send({ greetingName: 'Furqan' })
    assert.equal(res.status, 400)
  })
})

describe('GET /api/v1/admin/referrals', () => {
  it('lists root links', async () => {
    await request(buildApp()).post('/api/v1/admin/referrals').send({ label: 'List test', greetingName: 'Furqan' })
    const res = await request(buildApp()).get('/api/v1/admin/referrals')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.links))
  })

  it('counts a guest activated by a site visit alone, no messages/callback/dossier', async () => {
    const createRes = await request(buildApp())
      .post('/api/v1/admin/referrals')
      .send({ label: 'Site-visit activation test', greetingName: 'Furqan' })
    const code = createRes.body.code as string
    const guestToken = `guest-sitevisit-${Date.now()}`

    await prisma.referralVisit.create({
      data: {
        guest_token: guestToken,
        own_code: `OWN${Date.now()}`,
        root_code: code,
        generation: 1,
        device_class: 'mobile',
        os: 'ios',
        app_guess: 'unknown',
      },
    })
    await prisma.siteVisitRequest.create({
      data: {
        project_id: 'test-project',
        project_slug: 'test-project',
        project_name: 'Test Project',
        name: 'Test Buyer',
        phone: '9999999999',
        visit_date: new Date(),
        time_slot: 'morning',
        guest_token: guestToken,
      },
    })

    const res = await request(buildApp()).get('/api/v1/admin/referrals')
    assert.equal(res.status, 200)
    const link = res.body.links.find((l: any) => l.code === code)
    assert.ok(link, 'created link should appear in the list')
    assert.equal(link.activatedCount, 1)
  })
})

describe('GET /api/v1/admin/referrals/:code/tree', () => {
  it('returns the node list for a root link, including the root label itself', async () => {
    const create = await request(buildApp()).post('/api/v1/admin/referrals').send({ label: 'Tree test', greetingName: 'Furqan' })
    const res = await request(buildApp()).get(`/api/v1/admin/referrals/${create.body.code}/tree`)
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.nodes))
  })

  it('404s for an unknown code', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/referrals/NOPE0000/tree')
    assert.equal(res.status, 404)
  })
})

describe('GET /api/v1/admin/referrals/nodes/:guestToken', () => {
  it('404s for a guest token with no visit', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/referrals/nodes/never-seen-guest')
    assert.equal(res.status, 404)
  })
})

describe('POST /api/v1/admin/referrals/:code/revoke', () => {
  it('sets revoked_by_admin_id from the identity session', async () => {
    const create = await request(buildApp())
      .post('/api/v1/admin/referrals')
      .send({ label: 'Revoke attribution test', greetingName: 'Furqan' })
    const code = create.body.code as string

    const res = await request(buildApp()).post(`/api/v1/admin/referrals/${code}/revoke`)
    assert.equal(res.status, 200)

    const link = await prisma.referralLink.findUnique({ where: { code } })
    assert.equal(link?.revoked_by_admin_id, 'admin-1')
    assert.ok(link?.revoked_at)
  })
})

describe('GET /api/v1/admin/referrals (extended fields)', () => {
  it('rows include createdByEmail (null/former-admin fallback) and broadcastFlagged', async () => {
    const create = await request(buildApp())
      .post('/api/v1/admin/referrals')
      .send({ label: 'Extended fields test', greetingName: 'Furqan' })
    const code = create.body.code as string

    const res = await request(buildApp()).get('/api/v1/admin/referrals')
    assert.equal(res.status, 200)
    const link = res.body.links.find((l: any) => l.code === code)
    assert.ok(link)
    assert.ok('createdByEmail' in link)
    assert.ok('revokedByEmail' in link)
    assert.ok('trendSparkline' in link)
    assert.equal(typeof link.broadcastFlagged, 'boolean')
  })

  it('flags a link as broadcast when >=10 arrivals land within a 1-hour window', async () => {
    const create = await request(buildApp())
      .post('/api/v1/admin/referrals')
      .send({ label: 'Broadcast test', greetingName: 'Furqan' })
    const code = create.body.code as string

    const base = Date.now()
    await prisma.referralVisit.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        guest_token: `guest-broadcast-${base}-${i}`,
        own_code: `BC${base}${i}`,
        arrived_via_code: code,
        root_code: code,
        generation: 1,
        device_class: 'mobile',
        os: 'ios',
        app_guess: 'unknown',
        first_seen_at: new Date(base + i * 60_000),
      })),
    })

    const res = await request(buildApp()).get('/api/v1/admin/referrals')
    const link = res.body.links.find((l: any) => l.code === code)
    assert.equal(link.broadcastFlagged, true)
  })
})

describe('GET /api/v1/admin/referrals/:code/trends', () => {
  it('respects the granularity query param and defaults to daily', async () => {
    const create = await request(buildApp())
      .post('/api/v1/admin/referrals')
      .send({ label: 'Trends test', greetingName: 'Furqan' })
    const code = create.body.code as string

    const daily = await request(buildApp()).get(`/api/v1/admin/referrals/${code}/trends`)
    assert.equal(daily.status, 200)
    assert.ok(Array.isArray(daily.body.buckets))

    const weekly = await request(buildApp()).get(`/api/v1/admin/referrals/${code}/trends?granularity=weekly`)
    assert.equal(weekly.status, 200)
    assert.ok(Array.isArray(weekly.body.buckets))

    const all = await request(buildApp()).get(`/api/v1/admin/referrals/${code}/trends?granularity=all`)
    assert.equal(all.status, 200)
    assert.ok(Array.isArray(all.body.buckets))
  })

  it('404s for an unknown code', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/referrals/NOPE0000/trends')
    assert.equal(res.status, 404)
  })
})

describe('GET /api/v1/admin/referrals/metrics', () => {
  it('returns growthSummary, byAdmin, and comparison sections with the documented shape', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/referrals/metrics')
    assert.equal(res.status, 200)
    assert.ok(res.body.growthSummary)
    assert.ok('blendedKFactor' in res.body.growthSummary)
    assert.ok('totalActiveReach' in res.body.growthSummary)
    assert.ok('bestChannel' in res.body.growthSummary)
    assert.ok('broadcastFlaggedCount' in res.body.growthSummary)
    assert.ok(Array.isArray(res.body.byAdmin))
    assert.ok(res.body.comparison)
    assert.ok('referred' in res.body.comparison)
    assert.ok('organic' in res.body.comparison)
    assert.ok('sampleSize' in res.body.comparison.referred)
    assert.ok('requirementStateBreakdown' in res.body.comparison.referred)
  })
})
