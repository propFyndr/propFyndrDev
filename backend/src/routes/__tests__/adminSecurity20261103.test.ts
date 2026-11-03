import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../index'
import { isAuditedRead } from '../../lib/adminReadAudit'

// Admin audit, 3 Nov 2026.

describe('promotion counters cannot be moved from outside', () => {
  it('refuses a public "conversion": conversions come only from a callback after a click', async () => {
    const res = await request(app).post('/api/v1/promotionals/any-id/interaction').send({ interaction_type: 'conversion' })
    assert.equal(res.status, 400)
  })
  it('does not count a hit that names no person', async () => {
    const res = await request(app).post('/api/v1/promotionals/any-id/interaction').send({ interaction_type: 'click' })
    assert.equal(res.status, 202)
    assert.equal(res.body.ok, false)
  })
  it('does not count a bot', async () => {
    const res = await request(app)
      .post('/api/v1/promotionals/any-id/interaction')
      .set('User-Agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)')
      .set('x-guest-token', 'guest-0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d')
      .send({ interaction_type: 'impression' })
    assert.equal(res.status, 202)
    assert.equal(res.body.ok, false)
  })
})

describe('reads of one buyer are recorded', () => {
  it('covers the transcript path the client uses, the Lead Brief and the dossier', () => {
    assert.ok(isAuditedRead('GET', '/beta/conversations/abc'))
    assert.ok(isAuditedRead('GET', '/leads/abc/brief'))
    assert.ok(isAuditedRead('GET', '/callback/abc/dossier'))
    assert.equal(isAuditedRead('GET', '/leads'), false)
  })
})

describe('the lead dossier is not open to every staff role', () => {
  it('still refuses an anonymous caller', async () => {
    const res = await request(app).get('/api/v1/leads/callback/any-id/dossier')
    assert.ok(res.status === 401 || res.status === 403)
  })
})
