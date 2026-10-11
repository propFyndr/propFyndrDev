import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { referralRouter } from '../referral'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/referral', referralRouter)
  return app
}

describe('POST /api/v1/referral/arrive', () => {
  it('rejects a request with no guest token', async () => {
    const res = await request(buildApp()).post('/api/v1/referral/arrive').send({})
    assert.equal(res.status, 400)
  })

  it('returns 204 and does not error for a known preview-bot user agent', async () => {
    const res = await request(buildApp())
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'WhatsApp/2.23.20.0 A')
      .send({ guestToken: 'guest-bot-test' })
    assert.equal(res.status, 204)
  })

  it('a real request with a guest token and no code gets its own code back', async () => {
    const res = await request(buildApp())
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
      .send({ guestToken: `guest-organic-${Date.now()}` })
    assert.equal(res.status, 200)
    assert.equal(typeof res.body.ownCode, 'string')
    assert.equal(res.body.ownCode.length, 8)
  })
})
