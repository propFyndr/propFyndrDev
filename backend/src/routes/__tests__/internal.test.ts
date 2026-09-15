import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../index'

// The internal router is the only door into the lead queue that a machine can
// open, so the tests that matter are the ones about who cannot open it.
describe('internal API auth', () => {
  const original = process.env.INTERNAL_API_KEY

  after(() => {
    if (original === undefined) delete process.env.INTERNAL_API_KEY
    else process.env.INTERNAL_API_KEY = original
  })

  it('is disabled, not open, when no key is configured', async () => {
    delete process.env.INTERNAL_API_KEY
    const res = await request(app).get('/api/v1/internal/stale-leads')
    assert.equal(res.status, 503)
  })

  it('rejects a request carrying no key', async () => {
    process.env.INTERNAL_API_KEY = 'test-key-value'
    const res = await request(app).get('/api/v1/internal/stale-leads')
    assert.equal(res.status, 401)
  })

  it('rejects a wrong key of the same length — not only a wrong length', async () => {
    process.env.INTERNAL_API_KEY = 'test-key-value'
    const res = await request(app).get('/api/v1/internal/stale-leads').set('X-Internal-Key', 'test-key-valuX')
    assert.equal(res.status, 401)
  })

  it('rejects a key that is a prefix of the real one', async () => {
    process.env.INTERNAL_API_KEY = 'test-key-value'
    const res = await request(app).get('/api/v1/internal/stale-leads').set('X-Internal-Key', 'test-key')
    assert.equal(res.status, 401)
  })

  it('guards every route on the router, not just the first', async () => {
    process.env.INTERNAL_API_KEY = 'test-key-value'
    for (const [method, path] of [
      ['get', '/api/v1/internal/dead-letters'],
      ['post', '/api/v1/internal/dead-letters/replay'],
      ['post', '/api/v1/internal/stale-leads/ack'],
    ] as const) {
      const res = await request(app)[method](path)
      assert.equal(res.status, 401, `${method} ${path} was not guarded`)
    }
  })
})

describe('POST /api/v1/internal/stale-leads/ack', () => {
  const original = process.env.INTERNAL_API_KEY
  before(() => { process.env.INTERNAL_API_KEY = 'test-key-value' })
  after(() => {
    if (original === undefined) delete process.env.INTERNAL_API_KEY
    else process.env.INTERNAL_API_KEY = original
  })

  it('refuses an empty acknowledgement rather than reporting zero work as success', async () => {
    const res = await request(app)
      .post('/api/v1/internal/stale-leads/ack')
      .set('X-Internal-Key', 'test-key-value')
      .send({})
    assert.equal(res.status, 400)
  })

  it('ignores non-string ids instead of passing them to the database', async () => {
    const res = await request(app)
      .post('/api/v1/internal/stale-leads/ack')
      .set('X-Internal-Key', 'test-key-value')
      .send({ callback_ids: [1, null, { id: 'x' }] })
    assert.equal(res.status, 400)
  })
})
