import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { referralRouter } from '../referral'
import { prisma } from '../../lib/db'

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

  it('a second arrival from the same guest token increments visit_count and last_seen_at without changing attribution', async () => {
    const guestToken = `guest-repeat-${Date.now()}`
    const app = buildApp()

    const first = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
      .send({ guestToken })
    assert.equal(first.status, 200)

    const afterFirst = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
    assert.ok(afterFirst)
    assert.equal(afterFirst!.visit_count, 1)
    const parentBefore = afterFirst!.parent_guest_token
    const generationBefore = afterFirst!.generation
    const rootCodeBefore = afterFirst!.root_code

    const second = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
      .send({ guestToken })
    assert.equal(second.status, 200)
    assert.equal(second.body.ownCode, first.body.ownCode)

    const afterSecond = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
    assert.ok(afterSecond)
    assert.equal(afterSecond!.visit_count, 2)
    assert.ok(afterSecond!.last_seen_at.getTime() >= afterFirst!.last_seen_at.getTime())
    assert.equal(afterSecond!.parent_guest_token, parentBefore)
    assert.equal(afterSecond!.generation, generationBefore)
    assert.equal(afterSecond!.root_code, rootCodeBefore)

    // cleanup
    await prisma.referralVisit.delete({ where: { guest_token: guestToken } }).catch(() => {})
    await prisma.referralLink.delete({ where: { code: afterSecond!.own_code } }).catch(() => {})
  })
})
