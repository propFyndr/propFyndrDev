import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import { adminReferralsRouter } from '../adminReferrals'

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
})
