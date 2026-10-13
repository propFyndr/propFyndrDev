import { describe, it, after } from 'node:test'
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

describe('POST /api/v1/referral/arrive — concurrency and revoke', () => {
  const run = `${Date.now()}`
  const tokens: string[] = []
  const roots: string[] = []
  const t = (n: string) => {
    const g = `guest-conc-${run}-${n}`
    tokens.push(g)
    return g
  }
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
  const arriveAs = (guestToken: string, code?: string) =>
    request(buildApp()).post('/api/v1/referral/arrive').set('User-Agent', iphone).send({ guestToken, code })

  after(async () => {
    const visits = await prisma.referralVisit.findMany({ where: { guest_token: { in: tokens } }, select: { own_code: true } })
    await prisma.referralVisit.deleteMany({ where: { guest_token: { in: tokens } } })
    await prisma.referralLink.deleteMany({ where: { code: { in: [...roots, ...visits.map((v) => v.own_code)] } } })
  })

  it('five devices opening a fresh ROOT link at once: exactly one holder, the rest under it', async () => {
    const code = `RACE${run.slice(-6)}`
    roots.push(code)
    await prisma.referralLink.create({ data: { code, kind: 'ROOT', label: 'race', greeting_name: 'Sana' } })
    const racers = ['a', 'b', 'c', 'd', 'e'].map(t)
    const results = await Promise.all(racers.map((g) => arriveAs(g, code)))
    assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200, 200])

    const link = await prisma.referralLink.findUnique({ where: { code } })
    const visits = await prisma.referralVisit.findMany({ where: { guest_token: { in: racers } } })
    const gen1 = visits.filter((v) => v.generation === 1)
    assert.equal(gen1.length, 1)
    assert.equal(gen1[0].guest_token, link?.holder_guest_token)
    for (const v of visits.filter((v) => v.generation !== 1)) {
      assert.equal(v.generation, 2)
      assert.equal(v.parent_guest_token, link?.holder_guest_token)
    }
  })

  it('one device arriving five times at once: one visit, all 200, one own code', async () => {
    const g = t('dup')
    const results = await Promise.all(Array.from({ length: 5 }, () => arriveAs(g)))
    assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200, 200])
    assert.equal(new Set(results.map((r) => r.body.ownCode)).size, 1)
    assert.equal(await prisma.referralVisit.count({ where: { guest_token: g } }), 1)
  })

  it('revoking a ROOT stops its tree growing through members\' personal links; the tree is kept', async () => {
    const code = `TRE${run.slice(-6)}`
    roots.push(code)
    await prisma.referralLink.create({ data: { code, kind: 'ROOT', label: 'tree revoke' } })
    const holder = await arriveAs(t('tr-holder'), code)
    const child = await arriveAs(t('tr-child'), holder.body.ownCode)
    assert.equal((await prisma.referralVisit.findUnique({ where: { guest_token: t('tr-child') } }))?.generation, 2)

    await prisma.referralLink.update({ where: { code }, data: { revoked_at: new Date() } })
    const late = await arriveAs(t('tr-late'), child.body.ownCode)
    assert.equal(late.status, 200)
    const v = await prisma.referralVisit.findUnique({ where: { guest_token: t('tr-late') } })
    assert.equal(v?.generation, 0)
    assert.equal(v?.parent_guest_token, null)
    assert.notEqual(v?.root_code, code)
    assert.equal(await prisma.referralVisit.count({ where: { root_code: code } }), 2, 'existing tree kept')
  })

  it('a revoked ROOT link gives no greeting and no attribution', async () => {
    const code = `RVK${run.slice(-6)}`
    roots.push(code)
    await prisma.referralLink.create({ data: { code, kind: 'ROOT', label: 'revoked', greeting_name: 'Sana', revoked_at: new Date() } })
    const g = t('revoked')
    const res = await arriveAs(g, code)
    assert.equal(res.status, 200)
    assert.equal(res.body.greeting, null)
    const v = await prisma.referralVisit.findUnique({ where: { guest_token: g } })
    assert.equal(v?.generation, 0)
    assert.equal((await prisma.referralLink.findUnique({ where: { code } }))?.holder_guest_token, null)
  })
})
