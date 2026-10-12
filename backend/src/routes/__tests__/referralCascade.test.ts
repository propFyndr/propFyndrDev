// backend/src/routes/__tests__/referralCascade.test.ts
//
// One referral link, four generations, a chosen chat history per device —
// then every admin number checked end to end through the real routes:
// funnel stage per device, bot exclusion, reach, activated count, deepest
// generation, per-admin and blended K-factor, and IST trend buckets.
//
// Each device is there to exercise exactly one rule:
//
//   gen 1  h  holder         1 chat × 4 msgs                 → activated (3+ messages)
//   gen 2  a  ← h            2 chats × 2 msgs                → activated (summed across chats)
//   gen 2  b  ← h            1 msg                           → chatted
//   gen 2  c  ← h            no chat                         → arrived
//   gen 3  d  ← a            1 msg + callback request        → converted
//   gen 3  e  ← a            2 bot chats × 9 msgs            → left out entirely (bot-only)
//   gen 3  f  ← a            1 msg, then 1 msg 30h later     → activated (came back 24h+)
//   gen 3  g  ← b            2 msgs                          → chatted
//   gen 4  i  ← d            dossier only                    → converted
//   gen 4  j  ← f            no chat                         → arrived
//   gen 4  k  ← f            bot chat × 9 + human chat × 1   → chatted (bot messages ignored)
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import { adminReferralsRouter } from '../adminReferrals'
import { prisma } from '../../lib/db'

const run = randomUUID().slice(0, 8)
const ADMIN = `cascade-admin-${run}`
const CODE = `CS${run.toUpperCase()}`.slice(0, 10)
const tok = (n: string) => `cascade-${run}-${n}`

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((req: Request & { adminIdentity?: any }, _res: Response, next: NextFunction) => {
    req.adminIdentity = { adminUserId: ADMIN, email: 'cascade@test.local', role: 'SUPER_ADMIN' }
    next()
  })
  app.use('/api/v1/admin/referrals', adminReferralsRouter)
  return app
}

// 2026-09-01T20:00Z is 01:30 IST on 2 Sept — a UTC bucket would say 1 Sept.
const ARRIVE_LATE_NIGHT = new Date('2026-09-01T20:00:00Z')
const t = (hours: number) => new Date(Date.UTC(2026, 8, 3, 6) + hours * 3600_000)

const DEVICES: { name: string; gen: number; parent: string | null; arrived: Date }[] = [
  { name: 'h', gen: 1, parent: null, arrived: ARRIVE_LATE_NIGHT },
  { name: 'a', gen: 2, parent: 'h', arrived: t(1) },
  { name: 'b', gen: 2, parent: 'h', arrived: t(2) },
  { name: 'c', gen: 2, parent: 'h', arrived: t(3) },
  { name: 'd', gen: 3, parent: 'a', arrived: t(4) },
  { name: 'e', gen: 3, parent: 'a', arrived: t(5) },
  { name: 'f', gen: 3, parent: 'a', arrived: t(6) },
  { name: 'g', gen: 3, parent: 'b', arrived: t(7) },
  { name: 'i', gen: 4, parent: 'd', arrived: t(8) },
  { name: 'j', gen: 4, parent: 'f', arrived: t(9) },
  { name: 'k', gen: 4, parent: 'f', arrived: t(10) },
]

const CHATS: { name: string; messages: number; start: Date; end: Date; bot?: boolean }[] = [
  { name: 'h', messages: 4, start: t(0), end: t(1) },
  { name: 'a', messages: 2, start: t(1), end: t(2) },
  { name: 'a', messages: 2, start: t(3), end: t(4) },
  { name: 'b', messages: 1, start: t(2), end: t(2) },
  { name: 'd', messages: 1, start: t(4), end: t(4) },
  { name: 'e', messages: 9, start: t(5), end: t(5), bot: true },
  { name: 'e', messages: 9, start: t(6), end: t(6), bot: true },
  { name: 'f', messages: 1, start: t(6), end: t(6) },
  { name: 'f', messages: 1, start: t(36), end: t(36) },
  { name: 'g', messages: 2, start: t(7), end: t(8) },
  { name: 'k', messages: 9, start: t(10), end: t(10), bot: true },
  { name: 'k', messages: 1, start: t(11), end: t(11) },
]

const EXPECTED_STAGE: Record<string, string> = {
  h: 'activated', a: 'activated', b: 'chatted_shallow', c: 'arrived_no_chat',
  d: 'converted', f: 'activated', g: 'chatted_shallow',
  i: 'converted', j: 'arrived_no_chat', k: 'chatted_shallow',
}
const EXPECTED_MESSAGES: Record<string, number> = { h: 4, a: 4, b: 1, c: 0, d: 1, f: 2, g: 2, i: 0, j: 0, k: 1 }

describe('referral cascade: 4 generations, end to end', () => {
  before(async () => {
    await prisma.referralLink.create({ data: { code: CODE, kind: 'ROOT', label: 'Cascade test', created_by_admin_id: ADMIN } })
    for (const d of DEVICES) {
      await prisma.referralVisit.create({
        data: {
          guest_token: tok(d.name),
          own_code: `${CODE}${d.name}`.toUpperCase(),
          arrived_via_code: d.parent ? `${CODE}${d.parent}`.toUpperCase() : CODE,
          root_code: CODE,
          parent_guest_token: d.parent ? tok(d.parent) : null,
          generation: d.gen,
          device_class: 'mobile',
          os: 'android',
          app_guess: 'whatsapp',
          share_channel: 'whatsapp',
          first_seen_at: d.arrived,
          last_seen_at: d.arrived,
        },
      })
    }
    for (const c of CHATS) {
      await prisma.chatSession.create({
        data: { guest_token: tok(c.name), message_count: c.messages, created_at: c.start, last_active: c.end, is_bot: Boolean(c.bot) },
      })
    }
    await prisma.callbackRequest.create({ data: { name: 'Cascade D', phone: '0000000000', guest_token: tok('d') } })
    await prisma.dossier.create({
      data: { token: `cascade-${run}`, payload: {}, expires_at: new Date(Date.now() + 86400_000), guest_token: tok('i') },
    })
  })

  after(async () => {
    const tokens = DEVICES.map((d) => tok(d.name))
    await prisma.dossier.deleteMany({ where: { token: `cascade-${run}` } })
    await prisma.callbackRequest.deleteMany({ where: { guest_token: { in: tokens } } })
    await prisma.chatSession.deleteMany({ where: { guest_token: { in: tokens } } })
    await prisma.referralVisit.deleteMany({ where: { guest_token: { in: tokens } } })
    await prisma.referralLink.deleteMany({ where: { code: CODE } })
  })

  it('tree: each device gets its expected stage and message count; the bot-only device is left out', async () => {
    const res = await request(buildApp()).get(`/api/v1/admin/referrals/${CODE}/tree`)
    assert.equal(res.status, 200)
    const byToken = new Map<string, any>(res.body.nodes.map((n: any) => [n.guestToken, n]))
    assert.equal(byToken.has(tok('e')), false, 'bot-only device e must not appear')
    assert.equal(res.body.nodes.length, 10)
    for (const [name, stage] of Object.entries(EXPECTED_STAGE)) {
      const node = byToken.get(tok(name))
      assert.ok(node, `device ${name} missing`)
      assert.equal(node.funnelStage, stage, `device ${name}`)
      assert.equal(node.messageCount, EXPECTED_MESSAGES[name], `device ${name} messages`)
    }
  })

  it('list: reach, activated (converted included) and deepest generation', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/referrals?scope=all')
    assert.equal(res.status, 200)
    const link = res.body.links.find((l: any) => l.code === CODE)
    assert.ok(link)
    assert.equal(link.devicesReached, 10)
    assert.equal(link.activatedCount, 5) // h, a, f + converted d, i
    assert.equal(link.deepestGeneration, 4)
  })

  it('metrics: per-admin reach and blended K-factor', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/referrals/metrics')
    assert.equal(res.status, 200)
    const mine = res.body.byAdmin.find((a: any) => a.adminId === ADMIN)
    assert.ok(mine)
    assert.equal(mine.totalDevicesReached, 10)
    // Activated by generation: g1 h · g2 a · g3 d,f · g4 i.
    // Blended = generations 2+ (a,d,f,i = 4) / generations 0-1 (h = 1).
    assert.equal(mine.blendedKFactor, 4)
  })

  it('trends: buckets are India days, so a 01:30 IST arrival lands on its IST date', async () => {
    const res = await request(buildApp()).get(`/api/v1/admin/referrals/${CODE}/trends?granularity=daily`)
    assert.equal(res.status, 200)
    const byDate = new Map<string, number>(res.body.buckets.map((b: any) => [b.date, b.newArrivals]))
    assert.equal(byDate.get('2026-09-02'), 1, 'h arrived 01:30 IST on 2 Sept')
    assert.equal(byDate.get('2026-09-01'), undefined)
    assert.equal(byDate.get('2026-09-03'), 9) // a..k minus bot-only e
  })
})
