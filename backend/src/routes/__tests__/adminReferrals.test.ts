import { describe, it } from 'node:test'
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
