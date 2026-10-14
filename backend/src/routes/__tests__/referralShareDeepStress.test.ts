// backend/src/routes/__tests__/referralShareDeepStress.test.ts
//
// Deep stress-test suite of the entire share referral feature:
// 1. Root referral link created by s.admin@realtyask.in via admin API.
// 2. Preview bots (WhatsApp crawler) hit the link -> 204, no attribution.
// 3. Person 1 (Holder) arrives on root link via /arrive -> gets own personal code & greeting.
// 4. Person 1 has 3 completely distinct chats (different topics, messages, locations, budgets).
// 5. Person 1's repeat arrival / page refresh tests idempotency (visit_count increments, tree intact).
// 6. Person 1 shares their personal code to 3 more people (Gen 2: P2, P3, P4) across channels.
// 7. Gen 2 actions: P2 has 2 chats + callback request (converted), P3 chats shallow, P4 arrives without chat.
// 8. Person 2 shares their personal code further to Gen 3 (P5, P6), and P5 shares to Gen 4 (P7).
// 9. Edge cases stressed:
//    - Bot session exclusion (bot chats do not pollute human message count or activation).
//    - Anti-hijack immunity (P3 clicking another admin's code cannot be stolen from P1).
//    - Direct root-link reuse downstream (P8 arrives via root code -> depth_inferred: true).
//    - Link revocation: s.admin@realtyask.in revokes link; new arrivals treated as organic, existing tree preserved.
// 10. Deep chain verification across Tree, Admin links list, Person drawer, and Network metrics.

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import { adminReferralsRouter } from '../adminReferrals'
import { referralRouter } from '../referral'
import { prisma } from '../../lib/db'

const runId = randomUUID().slice(0, 8)
const ADMIN_EMAIL = 's.admin@realtyask.in'
let ADMIN_ID = ''
let createdAdmin = false
const pToken = (name: string) => `deep-stress-${runId}-${name}`

function buildApp() {
  const app = express()
  app.use(express.json())

  // Mock admin authentication for admin routes
  app.use('/api/v1/admin', (req: Request & { adminIdentity?: any }, _res: Response, next: NextFunction) => {
    req.adminIdentity = {
      adminUserId: ADMIN_ID,
      email: ADMIN_EMAIL,
      role: 'SUPER_ADMIN',
    }
    next()
  })

  app.use('/api/v1/referral', referralRouter)
  app.use('/api/v1/admin/referrals', adminReferralsRouter)
  return app
}

describe('Share Referral Feature — Deep Stress Test & Chain Tracking', () => {
  let app: express.Express

  let rootCode: string
  let p1OwnCode: string
  let p2OwnCode: string
  let p3OwnCode: string
  let p4OwnCode: string
  let p5OwnCode: string
  let p6OwnCode: string
  let p7OwnCode: string

  const trackedTokens: string[] = []

  before(async () => {
    // 1. Ensure s.admin@realtyask.in exists in AdminUser table
    let admin = await prisma.adminUser.findUnique({ where: { email: ADMIN_EMAIL } })
    if (!admin) {
      admin = await prisma.adminUser.create({
        data: {
          email: ADMIN_EMAIL,
          role: 'SUPER_ADMIN',
          password_hash: 'mock_hash_for_test',
        },
      })
      createdAdmin = true
    } else if (admin.role !== 'SUPER_ADMIN') {
      await prisma.adminUser.update({ where: { id: admin.id }, data: { role: 'SUPER_ADMIN' } })
    }
    ADMIN_ID = admin.id
    app = buildApp()
  })

  after(async () => {
    // Cleanup all test entities
    if (trackedTokens.length > 0) {
      await prisma.dossier.deleteMany({ where: { guest_token: { in: trackedTokens } } })
      await prisma.callbackRequest.deleteMany({ where: { guest_token: { in: trackedTokens } } })
      await prisma.chatSession.deleteMany({ where: { guest_token: { in: trackedTokens } } })
      await prisma.referralVisit.deleteMany({ where: { guest_token: { in: trackedTokens } } })
      await prisma.referralLink.deleteMany({ where: { owner_guest_token: { in: trackedTokens } } })
    }
    if (rootCode) {
      await prisma.referralVisit.deleteMany({ where: { root_code: rootCode } })
      await prisma.referralLink.deleteMany({ where: { code: rootCode } })
    }
    if (createdAdmin && ADMIN_ID) {
      await prisma.adminUser.deleteMany({ where: { id: ADMIN_ID } })
    }
  })

  it('Step 1: s.admin@realtyask.in generates a ROOT referral link', async () => {
    const res = await request(app)
      .post('/api/v1/admin/referrals')
      .send({
        label: 'Founder Alpha Outreach — Rahul',
        greetingName: 'Super Admin',
        note: 'High-touch founder invite link for deep stress test',
      })

    assert.equal(res.status, 201)
    assert.ok(res.body.code)
    assert.equal(res.body.url, `/r/${res.body.code}`)

    rootCode = res.body.code

    // Check DB
    const dbLink = await prisma.referralLink.findUnique({ where: { code: rootCode } })
    assert.ok(dbLink)
    assert.equal(dbLink.kind, 'ROOT')
    assert.equal(dbLink.created_by_admin_id, ADMIN_ID)
    assert.equal(dbLink.label, 'Founder Alpha Outreach — Rahul')
    assert.equal(dbLink.greeting_name, 'Super Admin')
    assert.equal(dbLink.holder_guest_token, null)
  })

  it('Step 2: Preview bot (WhatsApp scraper) hits the root link -> returns 204 with no node created', async () => {
    const res = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'WhatsApp/2.23.20.0 A')
      .send({
        code: rootCode,
        guestToken: pToken('bot-crawler-wa'),
      })

    assert.equal(res.status, 204)

    // Verify DB remains clean
    const botVisit = await prisma.referralVisit.findUnique({
      where: { guest_token: pToken('bot-crawler-wa') },
    })
    assert.equal(botVisit, null)

    const link = await prisma.referralLink.findUnique({ where: { code: rootCode } })
    assert.equal(link?.holder_guest_token, null, 'Bot crawler must not become holder')
  })

  it('Step 3: Person 1 (Holder) arrives via WhatsApp on root link -> gets own code & personal greeting', async () => {
    const p1Token = pToken('p1-holder')
    trackedTokens.push(p1Token)

    const res = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
      .send({
        code: rootCode,
        guestToken: p1Token,
        channel: 'wa',
      })

    assert.equal(res.status, 200)
    assert.ok(res.body.ownCode)
    assert.deepEqual(res.body.greeting, { name: 'Super Admin' })

    p1OwnCode = res.body.ownCode

    // Verify DB attribution
    const link = await prisma.referralLink.findUnique({ where: { code: rootCode } })
    assert.equal(link?.holder_guest_token, p1Token)

    const visit = await prisma.referralVisit.findUnique({ where: { guest_token: p1Token } })
    assert.ok(visit)
    assert.equal(visit.generation, 1)
    assert.equal(visit.parent_guest_token, null)
    assert.equal(visit.root_code, rootCode)
    assert.equal(visit.device_class, 'mobile')
    assert.equal(visit.os, 'ios')
    assert.equal(visit.share_channel, 'wa')
    assert.equal(visit.visit_count, 1)
  })

  it('Step 4: Person 1 repeat arrival / page refresh tests idempotency without creating duplicate node', async () => {
    const p1Token = pToken('p1-holder')

    const res = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
      .send({
        code: rootCode,
        guestToken: p1Token,
      })

    assert.equal(res.status, 200)
    assert.equal(res.body.ownCode, p1OwnCode)

    const visit = await prisma.referralVisit.findUnique({ where: { guest_token: p1Token } })
    assert.equal(visit?.visit_count, 2)
    assert.equal(visit?.generation, 1)
    assert.equal(visit?.parent_guest_token, null)
  })

  it('Step 5: Person 1 engages in 3 completely distinct chats with different requirements', async () => {
    const p1Token = pToken('p1-holder')
    const now = new Date()

    // Chat 1: Luxury Apartments Gurgaon
    await prisma.chatSession.create({
      data: {
        guest_token: p1Token,
        message_count: 3,
        summary_location: 'Golf Course Extension Road, Gurgaon',
        summary_financial: 'Budget INR 4.5 Cr, High yield',
        summary_timeline: 'Ready to Move',
        created_at: new Date(now.getTime() - 3600_000 * 5),
        last_active: new Date(now.getTime() - 3600_000 * 4),
        is_bot: false,
      },
    })

    // Chat 2: Plots & Villas Noida
    await prisma.chatSession.create({
      data: {
        guest_token: p1Token,
        message_count: 4,
        summary_location: 'Sector 150, Noida Expressway',
        summary_financial: 'Budget INR 2.8 Cr',
        summary_timeline: 'Possession in 1 year',
        created_at: new Date(now.getTime() - 3600_000 * 3),
        last_active: new Date(now.getTime() - 3600_000 * 2),
        is_bot: false,
      },
    })

    // Chat 3: Due diligence & RERA litigation
    await prisma.chatSession.create({
      data: {
        guest_token: p1Token,
        message_count: 2,
        summary_location: 'Dwarka Expressway, Gurgaon',
        summary_financial: 'Self-financed',
        summary_timeline: 'Immediate verification',
        created_at: new Date(now.getTime() - 3600_000 * 1),
        last_active: now,
        is_bot: false,
      },
    })

    // Additional bot chat on Person 1 to stress test bot exclusion
    await prisma.chatSession.create({
      data: {
        guest_token: p1Token,
        message_count: 20,
        is_bot: true,
        created_at: now,
        last_active: now,
      },
    })
  })

  it('Step 6: Person 1 shares their personal code to 3 more people (Gen 2: P2, P3, P4)', async () => {
    // Person 2 arrives via WhatsApp
    const p2Token = pToken('p2-buyer')
    trackedTokens.push(p2Token)
    const resP2 = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36')
      .send({
        code: p1OwnCode,
        guestToken: p2Token,
        channel: 'wa',
      })
    assert.equal(resP2.status, 200)
    assert.ok(resP2.body.ownCode)
    assert.equal(resP2.body.greeting, null, 'Personal codes get generic/no custom greeting')
    p2OwnCode = resP2.body.ownCode

    // Person 3 arrives via Copied link on Desktop Windows Chrome
    const p3Token = pToken('p3-investor')
    trackedTokens.push(p3Token)
    const resP3 = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0')
      .send({
        code: p1OwnCode,
        guestToken: p3Token,
        channel: 'copy',
      })
    assert.equal(resP3.status, 200)
    p3OwnCode = resP3.body.ownCode

    // Person 4 arrives via Native Share Sheet
    const p4Token = pToken('p4-browser')
    trackedTokens.push(p4Token)
    const resP4 = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
      .send({
        code: p1OwnCode,
        guestToken: p4Token,
        channel: 'native',
      })
    assert.equal(resP4.status, 200)
    p4OwnCode = resP4.body.ownCode

    // Verify Gen 2 attributions in DB
    const visits = await prisma.referralVisit.findMany({
      where: { guest_token: { in: [p2Token, p3Token, p4Token] } },
    })
    assert.equal(visits.length, 3)
    for (const v of visits) {
      assert.equal(v.generation, 2)
      assert.equal(v.parent_guest_token, pToken('p1-holder'))
      assert.equal(v.root_code, rootCode)
      assert.equal(v.depth_inferred, false)
    }
  })

  it('Step 7: Gen 2 users perform differentiated actions (P2 converts, P3 chats shallow, P4 browses only)', async () => {
    const p2Token = pToken('p2-buyer')
    const p3Token = pToken('p3-investor')
    const now = new Date()

    // Person 2: 2 chats + requests a developer callback (converts!)
    await prisma.chatSession.create({
      data: {
        guest_token: p2Token,
        message_count: 2,
        summary_location: 'DLF Phase 5',
        created_at: now,
        last_active: now,
        is_bot: false,
      },
    })
    await prisma.chatSession.create({
      data: {
        guest_token: p2Token,
        message_count: 2,
        summary_financial: 'Budget 6 Cr',
        created_at: now,
        last_active: now,
        is_bot: false,
      },
    })
    await prisma.callbackRequest.create({
      data: {
        guest_token: p2Token,
        name: 'Person 2 VIP',
        phone: '9876543210',
      },
    })

    // Person 3: 1 single question
    await prisma.chatSession.create({
      data: {
        guest_token: p3Token,
        message_count: 1,
        created_at: now,
        last_active: now,
        is_bot: false,
      },
    })

    // Person 4: no chats created (remains arrived_no_chat)
  })

  it('Step 8: Deep cascade — Person 2 shares further to Gen 3 (P5, P6), and P5 shares to Gen 4 (P7)', async () => {
    const now = new Date()

    // Person 5 (Gen 3, child of P2) arrives
    const p5Token = pToken('p5-dossier-user')
    trackedTokens.push(p5Token)
    const resP5 = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
      .send({ code: p2OwnCode, guestToken: p5Token, channel: 'wa' })
    assert.equal(resP5.status, 200)
    p5OwnCode = resP5.body.ownCode

    // Person 5 generates a comparison dossier (converts)
    await prisma.dossier.create({
      data: {
        token: `dossier-${runId}-p5`,
        guest_token: p5Token,
        payload: { title: 'Gurgaon Comparison' },
        expires_at: new Date(Date.now() + 86400_000 * 7),
      },
    })

    // Person 6 (Gen 3, child of P2) arrives and has a 24h+ return visit
    const p6Token = pToken('p6-retained-user')
    trackedTokens.push(p6Token)
    const resP6 = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14)')
      .send({ code: p2OwnCode, guestToken: p6Token, channel: 'sms' })
    assert.equal(resP6.status, 200)
    p6OwnCode = resP6.body.ownCode

    // P6 sends 1 msg on day 1, returns 30h later for another msg
    await prisma.chatSession.create({
      data: {
        guest_token: p6Token,
        message_count: 1,
        created_at: new Date(now.getTime() - 3600_000 * 30),
        last_active: new Date(now.getTime() - 3600_000 * 30),
        is_bot: false,
      },
    })
    await prisma.chatSession.create({
      data: {
        guest_token: p6Token,
        message_count: 1,
        created_at: now,
        last_active: now,
        is_bot: false,
      },
    })

    // Person 7 (Gen 4, child of P5) arrives via P5's code
    const p7Token = pToken('p7-deep-child')
    trackedTokens.push(p7Token)
    const resP7 = await request(app)
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .send({ code: p5OwnCode, guestToken: p7Token, channel: 'wa' })
    assert.equal(resP7.status, 200)
    p7OwnCode = resP7.body.ownCode

    // P7 chats 3 messages (activated)
    await prisma.chatSession.create({
      data: {
        guest_token: p7Token,
        message_count: 3,
        created_at: now,
        last_active: now,
        is_bot: false,
      },
    })

    // Verify Generations in DB
    const v5 = await prisma.referralVisit.findUnique({ where: { guest_token: p5Token } })
    const v6 = await prisma.referralVisit.findUnique({ where: { guest_token: p6Token } })
    const v7 = await prisma.referralVisit.findUnique({ where: { guest_token: p7Token } })

    assert.equal(v5?.generation, 3)
    assert.equal(v5?.parent_guest_token, pToken('p2-buyer'))
    assert.equal(v5?.root_code, rootCode)

    assert.equal(v6?.generation, 3)
    assert.equal(v6?.parent_guest_token, pToken('p2-buyer'))
    assert.equal(v6?.root_code, rootCode)

    assert.equal(v7?.generation, 4)
    assert.equal(v7?.parent_guest_token, pToken('p5-dossier-user'))
    assert.equal(v7?.root_code, rootCode)
  })

  it('Step 9: Anti-hijack & First-touch immutability stress test', async () => {
    // Person 3 (already child of Person 1) clicks another referral link from another admin
    const foreignCode = `OTHER${runId}`.toUpperCase().slice(0, 8)
    await prisma.referralLink.create({
      data: { code: foreignCode, kind: 'ROOT', label: 'Competitor Link' },
    })

    const p3Token = pToken('p3-investor')
    const res = await request(app)
      .post('/api/v1/referral/arrive')
      .send({ code: foreignCode, guestToken: p3Token })

    assert.equal(res.status, 200)
    assert.equal(res.body.ownCode, p3OwnCode, 'Must return existing own code')

    // Verify attribution DID NOT change
    const v3 = await prisma.referralVisit.findUnique({ where: { guest_token: p3Token } })
    assert.equal(v3?.root_code, rootCode, 'Root code must remain unchanged')
    assert.equal(v3?.parent_guest_token, pToken('p1-holder'), 'Parent must remain Person 1')
    assert.equal(v3?.generation, 2)

    await prisma.referralLink.delete({ where: { code: foreignCode } })
  })

  it('Step 10: Direct root link reuse when holder already set -> depth_inferred: true', async () => {
    const p8Token = pToken('p8-direct-root')
    trackedTokens.push(p8Token)

    const res = await request(app)
      .post('/api/v1/referral/arrive')
      .send({ code: rootCode, guestToken: p8Token, channel: 'link' })

    assert.equal(res.status, 200)

    const v8 = await prisma.referralVisit.findUnique({ where: { guest_token: p8Token } })
    assert.equal(v8?.generation, 2)
    assert.equal(v8?.parent_guest_token, pToken('p1-holder'))
    assert.equal(v8?.depth_inferred, true, 'Downstream arrival on root link must be depth_inferred')
  })

  it('Step 11: Inspect entire referral tree hierarchy & funnel classifications', async () => {
    const res = await request(app).get(`/api/v1/admin/referrals/${rootCode}/tree`)
    assert.equal(res.status, 200)

    assert.equal(res.body.root.code, rootCode)
    assert.equal(res.body.root.label, 'Founder Alpha Outreach — Rahul')
    assert.equal(res.body.root.revoked, false)

    const nodes = res.body.nodes
    assert.equal(nodes.length, 8, '8 real human devices tracked')

    const nodeMap = new Map<string, any>(nodes.map((n: any) => [n.guestToken, n]))

    // 1. Person 1 (Holder)
    const p1 = nodeMap.get(pToken('p1-holder'))
    assert.ok(p1)
    assert.equal(p1.generation, 1)
    assert.equal(p1.parentGuestToken, null)
    assert.equal(p1.label, 'Founder Alpha Outreach — Rahul')
    // 3 + 4 + 2 = 9 human messages. Bot session (20 msgs) must be ignored!
    assert.equal(p1.messageCount, 9, 'Human messages correctly summed across all 3 chats')
    assert.equal(p1.funnelStage, 'activated')
    assert.equal(p1.activated, true)

    // 2. Person 2 (Gen 2)
    const p2 = nodeMap.get(pToken('p2-buyer'))
    assert.ok(p2)
    assert.equal(p2.generation, 2)
    assert.equal(p2.parentGuestToken, pToken('p1-holder'))
    assert.equal(p2.funnelStage, 'converted', 'Callback request promotes to converted')

    // 3. Person 3 (Gen 2)
    const p3 = nodeMap.get(pToken('p3-investor'))
    assert.ok(p3)
    assert.equal(p3.generation, 2)
    assert.equal(p3.messageCount, 1)
    assert.equal(p3.funnelStage, 'chatted_shallow')

    // 4. Person 4 (Gen 2)
    const p4 = nodeMap.get(pToken('p4-browser'))
    assert.ok(p4)
    assert.equal(p4.generation, 2)
    assert.equal(p4.messageCount, 0)
    assert.equal(p4.funnelStage, 'arrived_no_chat')

    // 5. Person 5 (Gen 3)
    const p5 = nodeMap.get(pToken('p5-dossier-user'))
    assert.ok(p5)
    assert.equal(p5.generation, 3)
    assert.equal(p5.parentGuestToken, pToken('p2-buyer'))
    assert.equal(p5.funnelStage, 'converted', 'Dossier creation promotes to converted')

    // 6. Person 6 (Gen 3)
    const p6 = nodeMap.get(pToken('p6-retained-user'))
    assert.ok(p6)
    assert.equal(p6.generation, 3)
    assert.equal(p6.parentGuestToken, pToken('p2-buyer'))
    assert.equal(p6.funnelStage, 'activated', '24h+ return visit activates')

    // 7. Person 7 (Gen 4)
    const p7 = nodeMap.get(pToken('p7-deep-child'))
    assert.ok(p7)
    assert.equal(p7.generation, 4)
    assert.equal(p7.parentGuestToken, pToken('p5-dossier-user'))
    assert.equal(p7.funnelStage, 'activated', '3 messages activate')

    // 8. Person 8 (Gen 2 Inferred)
    const p8 = nodeMap.get(pToken('p8-direct-root'))
    assert.ok(p8)
    assert.equal(p8.generation, 2)
    assert.equal(p8.depthInferred, true)
  })

  it('Step 12: Inspect Person 1 Drawer (/nodes/:guestToken) — verifies all 3 chats and summaries', async () => {
    const res = await request(app).get(`/api/v1/admin/referrals/nodes/${pToken('p1-holder')}`)
    assert.equal(res.status, 200)

    const node = res.body.node
    assert.ok(node)
    assert.equal(node.guestToken, pToken('p1-holder'))
    assert.equal(node.os, 'ios')
    assert.equal(node.deviceClass, 'mobile')

    // Check chats array: includes our 3 distinct human sessions (+ bot session)
    assert.ok(Array.isArray(node.chats))
    assert.equal(node.chats.length, 4)

    // Summary reflects latest populated fields
    assert.ok(node.summary)
    assert.equal(node.summary.location, 'Dwarka Expressway, Gurgaon')
    assert.equal(node.summary.financial, 'Self-financed')
    assert.equal(node.summary.timeline, 'Immediate verification')
  })

  it('Step 13: Inspect Admin Links List — s.admin@realtyask.in ownership and metrics', async () => {
    const res = await request(app).get('/api/v1/admin/referrals?scope=mine')
    assert.equal(res.status, 200)

    const link = res.body.links.find((l: any) => l.code === rootCode)
    assert.ok(link, 'Link must be listed under scope=mine')
    assert.equal(link.createdByEmail, ADMIN_EMAIL)
    assert.equal(link.devicesReached, 8)
    assert.equal(link.deepestGeneration, 4)
    // Activated devices: P1 (activated), P2 (converted), P5 (converted), P6 (activated), P7 (activated) = 5
    assert.equal(link.activatedCount, 5)
  })

  it('Step 14: Inspect Global Referral Metrics — Leaderboard and K-Factor', async () => {
    const res = await request(app).get('/api/v1/admin/referrals/metrics')
    assert.equal(res.status, 200)

    const adminStats = res.body.byAdmin.find((a: any) => a.adminId === ADMIN_ID)
    assert.ok(adminStats)
    assert.equal(adminStats.email, ADMIN_EMAIL)
    assert.ok(adminStats.totalDevicesReached >= 8, `Expected at least 8 devices reached, got ${adminStats.totalDevicesReached}`)
    assert.ok(adminStats.linksCreated >= 1)
    assert.ok(adminStats.blendedKFactor !== null)
  })

  it('Step 15: Revoke link by s.admin@realtyask.in — new arrivals become organic, tree remains intact', async () => {
    // Revoke
    const revokeRes = await request(app).post(`/api/v1/admin/referrals/${rootCode}/revoke`)
    assert.equal(revokeRes.status, 200)
    assert.equal(revokeRes.body.success, true)

    // Verify DB
    const revokedLink = await prisma.referralLink.findUnique({ where: { code: rootCode } })
    assert.ok(revokedLink?.revoked_at)
    assert.equal(revokedLink?.revoked_by_admin_id, ADMIN_ID)

    // New visitor arrives on revoked link
    const postRevokeToken = pToken('visitor-post-revoke')
    trackedTokens.push(postRevokeToken)

    const arriveRes = await request(app)
      .post('/api/v1/referral/arrive')
      .send({ code: rootCode, guestToken: postRevokeToken })

    assert.equal(arriveRes.status, 200)
    // Revoked code arrivals become organic origin (generation 0, root_code = ownCode)
    const postVisit = await prisma.referralVisit.findUnique({ where: { guest_token: postRevokeToken } })
    assert.equal(postVisit?.generation, 0)
    assert.equal(postVisit?.parent_guest_token, null)
    assert.notEqual(postVisit?.root_code, rootCode)

    // Verify existing tree still has 8 nodes and revoked flag
    const treeRes = await request(app).get(`/api/v1/admin/referrals/${rootCode}/tree`)
    assert.equal(treeRes.status, 200)
    assert.equal(treeRes.body.root.revoked, true)
    assert.equal(treeRes.body.nodes.length, 8)
  })
})
