// backend/src/routes/__tests__/referralChain.live.test.ts
//
// Live, end-to-end stress test of the share/referral chain. Unlike
// referralCascade.test.ts (which seeds referral_visits directly), every row
// here is produced by the real routes a browser hits:
//
//   s.admin@realtyask.in ── POST /admin/referrals ──▶ ROOT link
//     └─ P (holder, gen 1)         3 different real chats via POST /chat
//          ├─ Q1 (gen 2, wa)       2 chats
//          │    ├─ R1 (gen 3)      1 chat
//          │    ├─ R2 (gen 3)      no chat
//          │    └─ R3 (gen 3)      1 chat ── shares on ── W1 (gen 4)
//          ├─ Q2 (gen 2, sms)      1 chat
//          │    ├─ R4 (gen 3)      no chat
//          │    └─ R5 (gen 3)      1 chat
//          ├─ Q3 (gen 2, copy)     no chat; personal link later revoked
//          └─ S  (gen 2, inferred) P forwarded the admin's ROOT link itself
//
// Then: preview bots, lowercase codes, re-arrival on a second code (first
// touch), a device with prior chats, unknown code, revoked personal link,
// revoked ROOT, concurrent first arrivals on a fresh ROOT (holder race), the
// same device arriving concurrently, and the per-device rate limit.
//
// OPT-IN ONLY: writes to whatever DATABASE_URL is configured and spends real
// LLM quota. Skipped unless REFERRAL_LIVE=1. It must NOT run under
// NODE_ENV=test: chat-router marks every test-env session is_bot, and the
// referral tree drops bot-only devices, so every chatting person would vanish.
//
//   cd backend
//   REFERRAL_LIVE=1 NODE_ENV=production FRONTEND_URL=https://realtyask.in DISABLE_RATE_LIMIT=false node --env-file=.env --require tsx/cjs \
//     --test --test-concurrency=1 src/routes/__tests__/referralChain.live.test.ts
//
// Every row carries the run prefix and is deleted in after(). AiUsageEvent
// rows are kept on purpose: that spend really happened.
import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'

const LIVE = process.env.REFERRAL_LIVE === '1' && process.env.NODE_ENV !== 'test'
const ADMIN_EMAIL = process.env.REFERRAL_ADMIN_EMAIL ?? 's.admin@realtyask.in'

const run = randomUUID().slice(0, 8)
const PREFIX = `stress-${run}-`
const tok = (name: string) => `${PREFIX}${name}`

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID_IG = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 Instagram 340.0.0.0'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36'
const WHATSAPP_BOT = 'WhatsApp/2.24.10.0 A'

// Lazily required so a skipped run never loads the app (and its env checks).
let app: express.Express
let adminApp: express.Express
let prisma: typeof import('../../lib/db').prisma

// Every device gets its own client IP, as real phones would; otherwise the
// per-IP limit (60 / 10 min) would be what this test measures.
let ipSeq = 1
const ipFor = new Map<string, string>()
const ip = (name: string) => {
  if (!ipFor.has(name)) ipFor.set(name, `198.51.100.${ipSeq++}`)
  return ipFor.get(name)!
}

interface Arrival { status: number; ownCode?: string; greeting?: { name: string } | null; revoked?: boolean; ms: number }

async function arrive(name: string, code: string | null, opts: { ua?: string; channel?: string } = {}): Promise<Arrival> {
  const t0 = Date.now()
  const res = await request(app)
    .post('/api/v1/referral/arrive')
    .set('User-Agent', opts.ua ?? IPHONE)
    .set('X-Forwarded-For', ip(name))
    .send({ guestToken: tok(name), code: code ?? undefined, channel: opts.channel })
  return { status: res.status, ...(res.body ?? {}), ms: Date.now() - t0 }
}

interface ChatTurn { sessionId: string | null; answer: string; status: number; ms: number; error?: string }

/** One real buyer turn through POST /api/v1/chat. sessionId null starts a new chat. */
async function chat(name: string, text: string, sessionId: string | null): Promise<ChatTurn> {
  const t0 = Date.now()
  const res = await request(app)
    .post('/api/v1/chat')
    .set('User-Agent', IPHONE)
    .set('X-Forwarded-For', ip(name))
    .set('x-guest-token', tok(name))
    .send({ action: { type: 'TEXT_MESSAGE', payload: { text } }, sessionId, guestToken: tok(name) })
    .buffer(true)
    .parse((r, cb) => {
      let body = ''
      r.setEncoding('utf8')
      r.on('data', (c: string) => { body += c })
      r.on('end', () => cb(null, body))
    })
  const raw = typeof res.body === 'string' ? res.body : ''
  let answer = ''
  let sid: string | null = sessionId
  let error: string | undefined
  for (const block of raw.split('\n\n')) {
    const ev = /^event: (.+)$/m.exec(block)?.[1]
    const data = /^data: (.+)$/m.exec(block)?.[1]
    if (!ev || !data) continue
    try {
      const parsed = JSON.parse(data)
      if (ev === 'token' && typeof parsed.token === 'string') answer += parsed.token
      if (ev === 'done' && parsed.sessionId) sid = parsed.sessionId
      if (ev === 'error') error = parsed.message
    } catch { /* keep-alive or partial frame */ }
  }
  return { sessionId: sid, answer, status: res.status, ms: Date.now() - t0, error }
}

// ─── shared state, filled as the chain grows ────────────────────────────────
let ROOT = ''
let ROOT2 = ''
let adminId = ''
const own = new Map<string, string>() // device -> own personal code
const chatLog: { device: string; chat: number; turn: string; ms: number; answerChars: number; error?: string }[] = []
const findings: { severity: 'BUG' | 'GAP' | 'NOTE'; title: string; detail: string }[] = []
const timings: Record<string, number[]> = {}
const time = (k: string, ms: number) => { (timings[k] ??= []).push(ms) }

/** Runs each buyer's chats; every chat is a new session, every turn a real model call. */
async function haveChats(device: string, chats: string[][]) {
  for (let c = 0; c < chats.length; c++) {
    let sid: string | null = null
    for (const turn of chats[c]) {
      const r = await chat(device, turn, sid)
      time('chatTurn', r.ms)
      chatLog.push({ device, chat: c + 1, turn, ms: r.ms, answerChars: r.answer.length, error: r.error })
      assert.equal(r.status, 200, `${device} chat ${c + 1}: HTTP ${r.status}`)
      assert.ok(r.sessionId, `${device} chat ${c + 1}: no sessionId in done event`)
      sid = r.sessionId
    }
  }
}

async function tree(code: string) {
  const res = await request(adminApp).get(`/api/v1/admin/referrals/${code}/tree`)
  assert.equal(res.status, 200)
  return new Map<string, any>(res.body.nodes.map((n: any) => [n.guestToken, n]))
}

/**
 * The live pooler (connection_limit=3) dropped connections mid-run on the
 * first attempt, failing 12 tests on "Can't reach database server". Wait for a
 * trivial query before each test so a pooler blip is not read as a referral
 * bug; the wait is recorded in the report.
 */
async function waitForDb(maxMs = 180_000): Promise<number> {
  const t0 = Date.now()
  for (;;) {
    try {
      await prisma.$queryRaw`SELECT 1`
      return Date.now() - t0
    } catch (e) {
      if (Date.now() - t0 > maxMs) throw e
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

async function visit(name: string) {
  return prisma.referralVisit.findUnique({ where: { guest_token: tok(name) } })
}

describe('referral chain — live end-to-end stress', { skip: !LIVE && 'set REFERRAL_LIVE=1 and a non-test NODE_ENV' }, () => {
  before(async () => {
    // require, not import(): dynamic import() bypasses the tsx/cjs hook.
    ;({ app } = require('../../index'))
    ;({ prisma } = require('../../lib/db'))
    const { adminReferralsRouter } = require('../adminReferrals')
    await waitForDb(300_000)

    const admin = await prisma.adminUser.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true, email: true, role: true } })
    assert.ok(admin, `${ADMIN_EMAIL} has no admin_users row`)
    assert.equal(admin.role, 'SUPER_ADMIN', `${ADMIN_EMAIL} is ${admin.role}; the referrals area is SUPER_ADMIN only`)
    adminId = admin.id
    console.log(`[referral-chain] run prefix ${PREFIX} (every row this run writes carries it)`)

    // adminAreaGuard needs a live admin session cookie; the identity it would
    // attach is attached here from the real admin row instead.
    adminApp = express()
    adminApp.use(express.json())
    adminApp.use((req: Request & { adminIdentity?: any }, _res: Response, next: NextFunction) => {
      req.adminIdentity = { adminUserId: admin.id, email: admin.email, role: admin.role, builderId: null, partnerId: null }
      next()
    })
    adminApp.use('/api/v1/admin/referrals', adminReferralsRouter)
  })

  beforeEach(async () => {
    const waited = await waitForDb()
    if (waited > 0) time('dbWait', waited)
  })

  after(async () => {
    if (!prisma) return
    await waitForDb(300_000)
    const report = await buildReport().catch((e) => ({ error: String(e) }))
    const out = process.env.REFERRAL_REPORT ?? `referral-chain-report-${run}.json`
    writeFileSync(out, JSON.stringify(report, null, 2))
    console.log(`\n[referral-chain] report written to ${out}`)

    if (process.env.REFERRAL_KEEP === '1') return
    const startsWith = { startsWith: PREFIX }
    const visits = await prisma.referralVisit.findMany({ where: { guest_token: startsWith }, select: { own_code: true } })
    await prisma.chatSession.deleteMany({ where: { guest_token: startsWith } }) // messages, memory, analytics cascade
    await prisma.userMemory.deleteMany({ where: { guest_token: startsWith } })
    await prisma.chatAnalytics.deleteMany({ where: { guest_token: startsWith } })
    await prisma.propertyEvent.deleteMany({ where: { guest_token: startsWith } })
    await prisma.demandSignal.deleteMany({ where: { guest_token: startsWith } })
    await prisma.promotionalInteraction.deleteMany({ where: { guest_token: startsWith } })
    await prisma.referralVisit.deleteMany({ where: { guest_token: startsWith } })
    await prisma.referralLink.deleteMany({
      where: { OR: [{ code: { in: [ROOT, ROOT2, ...visits.map((v) => v.own_code)].filter(Boolean) } }, { owner_guest_token: startsWith }] },
    })
  })

  // ── 1. Admin mints the link ─────────────────────────────────────────────
  it('s.admin creates a labelled ROOT link', async () => {
    const res = await request(adminApp).post('/api/v1/admin/referrals').send({ label: `Stress ${run} — Priya`, greetingName: 'Sana', note: 'live chain stress test' })
    assert.equal(res.status, 201)
    ROOT = res.body.code
    assert.match(ROOT, /^[23456789A-HJKMNP-Z]{8}$/)
    const row = await prisma.referralLink.findUnique({ where: { code: ROOT } })
    assert.equal(row?.kind, 'ROOT')
    assert.equal(row?.created_by_admin_id, adminId)
    assert.equal(row?.holder_guest_token, null)
  })

  // ── 2. The link is shared on WhatsApp: the preview bot fetches first ────
  it('the WhatsApp preview fetch creates nothing and does not claim the holder seat', async () => {
    const r = await arrive('wa-preview', ROOT, { ua: WHATSAPP_BOT })
    assert.equal(r.status, 204)
    assert.equal(await visit('wa-preview'), null)
    const row = await prisma.referralLink.findUnique({ where: { code: ROOT } })
    assert.equal(row?.holder_guest_token, null)
  })

  // ── 3. P opens it (lowercased by a messenger) ───────────────────────────
  it('P is the first real device: holder, generation 1, greeted by name', async () => {
    const r = await arrive('P', ROOT.toLowerCase(), { channel: 'wa' })
    time('arrive', r.ms)
    assert.equal(r.status, 200)
    assert.deepEqual(r.greeting, { name: 'Sana' })
    own.set('P', r.ownCode!)
    const v = await visit('P')
    assert.equal(v?.generation, 1)
    assert.equal(v?.root_code, ROOT)
    assert.equal(v?.parent_guest_token, null)
    assert.equal(v?.arrived_via_code, ROOT)
    const link = await prisma.referralLink.findUnique({ where: { code: ROOT } })
    assert.equal(link?.holder_guest_token, tok('P'))
    const personal = await prisma.referralLink.findUnique({ where: { code: r.ownCode! } })
    assert.equal(personal?.kind, 'PERSONAL')
    assert.equal(personal?.owner_guest_token, tok('P'))
  })

  it('P has three different chats (real model turns)', async () => {
    await haveChats('P', [
      ['3BHK in Sector 150 under 1.5 Cr, possession within a year', 'Which of these is closest to a metro station?'],
      ['What would the EMI be on a 1.2 crore loan over 20 years?'],
      ['Ready to move 2BHK in Greater Noida West under 80 lakh'],
    ])
    const sessions = await prisma.chatSession.findMany({ where: { guest_token: tok('P') }, select: { id: true, message_count: true, is_bot: true } })
    assert.equal(sessions.length, 3, 'three separate chat sessions')
    assert.ok(sessions.every((s) => !s.is_bot), 'a real browser UA must not be marked bot')
  })

  // ── 4. P shares their personal link with three people ───────────────────
  it('Q1, Q2, Q3 arrive on P\'s personal code: generation 2, parent P, same root', async () => {
    for (const [name, channel, ua] of [['Q1', 'wa', ANDROID_IG], ['Q2', 'sms', IPHONE], ['Q3', 'copy', DESKTOP]] as const) {
      const r = await arrive(name, own.get('P')!, { channel, ua })
      time('arrive', r.ms)
      assert.equal(r.status, 200, name)
      assert.equal(r.greeting, null, `${name}: greeting is for the ROOT holder only`)
      own.set(name, r.ownCode!)
      const v = await visit(name)
      assert.equal(v?.generation, 2, name)
      assert.equal(v?.parent_guest_token, tok('P'), name)
      assert.equal(v?.root_code, ROOT, name)
      assert.equal(v?.depth_inferred, false, name)
      assert.equal(v?.share_channel, channel, name)
    }
    const q1 = await visit('Q1')
    assert.equal(q1?.app_guess, 'instagram')
    assert.equal(q1?.os, 'android')
    assert.equal((await visit('Q3'))?.device_class, 'desktop')
  })

  it('P also forwards the admin\'s original ROOT link to S: generation 2 via the holder, depth inferred', async () => {
    const r = await arrive('S', ROOT)
    assert.equal(r.status, 200)
    assert.equal(r.greeting?.name, 'Sana', 'S also opened the labelled link, so is greeted')
    own.set('S', r.ownCode!)
    const v = await visit('S')
    assert.equal(v?.generation, 2)
    assert.equal(v?.parent_guest_token, tok('P'))
    assert.equal(v?.depth_inferred, true)
    const link = await prisma.referralLink.findUnique({ where: { code: ROOT } })
    assert.equal(link?.holder_guest_token, tok('P'), 'holder never changes after the first device')
  })

  it('generation 2 chats: Q1 two chats, Q2 one, Q3 none', async () => {
    await haveChats('Q1', [['2BHK under 1 Cr near Noida Sector 62 metro'], ['Tell me about builder track record of Gaurs in Greater Noida West']])
    await haveChats('Q2', [['Is Sector 150 good for families?', 'What is stamp duty for a woman buyer in Noida?']])
  })

  // ── 5. Generation 3 and 4 ───────────────────────────────────────────────
  it('Q1 shares with R1–R3, Q2 with R4–R5; R3 shares on to W1 (generation 4)', async () => {
    const hops: [string, string][] = [['R1', 'Q1'], ['R2', 'Q1'], ['R3', 'Q1'], ['R4', 'Q2'], ['R5', 'Q2']]
    for (const [name, parent] of hops) {
      const r = await arrive(name, own.get(parent)!, { channel: 'wa' })
      time('arrive', r.ms)
      assert.equal(r.status, 200, name)
      own.set(name, r.ownCode!)
      const v = await visit(name)
      assert.equal(v?.generation, 3, name)
      assert.equal(v?.parent_guest_token, tok(parent), name)
      assert.equal(v?.root_code, ROOT, name)
    }
    await haveChats('R1', [['Show me 3BHK in Sector 76']])
    await haveChats('R3', [['Under construction projects in Sector 1 Greater Noida West']])
    await haveChats('R5', [['Compare ready to move vs under construction for an investor']])

    const w = await arrive('W1', own.get('R3')!, { channel: 'sms' })
    assert.equal(w.status, 200)
    own.set('W1', w.ownCode!)
    const v = await visit('W1')
    assert.equal(v?.generation, 4)
    assert.equal(v?.parent_guest_token, tok('R3'))
    assert.equal(v?.root_code, ROOT)
  })

  // ── 6. Edge cases inside the live tree ──────────────────────────────────
  it('first touch wins: R2 later opens Q2\'s link — parent, generation and root unchanged, visit counted', async () => {
    const before = await visit('R2')
    const r = await arrive('R2', own.get('Q2')!)
    assert.equal(r.status, 200)
    assert.equal(r.ownCode, own.get('R2'), 'same own code returned')
    const afterV = await visit('R2')
    assert.equal(afterV?.parent_guest_token, tok('Q1'))
    assert.equal(afterV?.generation, 3)
    assert.equal(afterV?.visit_count, (before?.visit_count ?? 0) + 1)
  })

  it('a device that already chatted before arriving is organic (prior_user), never joins the tree', async () => {
    await prisma.chatSession.create({ data: { guest_token: tok('X-prior'), message_count: 2, is_bot: false } })
    const r = await arrive('X-prior', own.get('Q2')!)
    assert.equal(r.status, 200)
    const v = await visit('X-prior')
    assert.equal(v?.generation, 0)
    assert.equal(v?.prior_user, true)
    assert.equal(v?.parent_guest_token, null)
    assert.notEqual(v?.root_code, ROOT)
  })

  it('an unknown code is an organic arrival rooted at the device\'s own code', async () => {
    const r = await arrive('X-unknown', 'ZZZZZZZZ')
    assert.equal(r.status, 200)
    const v = await visit('X-unknown')
    assert.equal(v?.generation, 0)
    assert.equal(v?.root_code, r.ownCode)
    assert.equal(v?.arrived_via_code, 'ZZZZZZZZ')
  })

  it('a revoked personal link (Q3) attributes nothing: the arrival is organic', async () => {
    const rv = await request(adminApp).post(`/api/v1/admin/referrals/${own.get('Q3')}/revoke`)
    assert.equal(rv.status, 200)
    const r = await arrive('X-revokedQ3', own.get('Q3')!)
    assert.equal(r.status, 200)
    const v = await visit('X-revokedQ3')
    assert.equal(v?.generation, 0)
    assert.equal(v?.parent_guest_token, null)
    const again = await arrive('Q3', null)
    assert.equal(again.revoked, true, 'Q3 is told its own link is revoked on its next visit')
  })

  // ── 7. The admin view of the whole chain ────────────────────────────────
  it('tree: every device at the right generation under the right parent; organic devices absent', async () => {
    const nodes = await tree(ROOT)
    const expected: Record<string, [number, string | null]> = {
      P: [1, null], Q1: [2, 'P'], Q2: [2, 'P'], Q3: [2, 'P'], S: [2, 'P'],
      R1: [3, 'Q1'], R2: [3, 'Q1'], R3: [3, 'Q1'], R4: [3, 'Q2'], R5: [3, 'Q2'], W1: [4, 'R3'],
    }
    assert.equal(nodes.size, Object.keys(expected).length, `tree has ${[...nodes.keys()].join(', ')}`)
    for (const [name, [gen, parent]] of Object.entries(expected)) {
      const n = nodes.get(tok(name))
      assert.ok(n, `${name} missing from tree`)
      assert.equal(n.generation, gen, `${name} generation`)
      assert.equal(n.parentGuestToken, parent ? tok(parent) : null, `${name} parent`)
    }
    for (const outsider of ['X-prior', 'X-unknown', 'X-revokedQ3', 'wa-preview']) assert.equal(nodes.has(tok(outsider)), false, outsider)
    assert.equal(nodes.get(tok('P')).label, `Stress ${run} — Priya`)

    // Message counts in the tree equal what the chat route stored.
    for (const name of ['P', 'Q1', 'Q2', 'R1', 'R3', 'R5']) {
      const sessions = await prisma.chatSession.findMany({ where: { guest_token: tok(name) }, select: { message_count: true } })
      const stored = sessions.reduce((s, x) => s + x.message_count, 0)
      assert.equal(nodes.get(tok(name)).messageCount, stored, `${name} message count`)
      assert.ok(stored > 0, `${name} chatted, so the stored count must be > 0`)
    }
    for (const name of ['Q3', 'R2', 'R4', 'W1', 'S']) assert.equal(nodes.get(tok(name)).funnelStage, 'arrived_no_chat', name)

    // How many stored messages does one buyer turn produce? Recorded, not
    // asserted: it decides what "3+ messages = activated" really means.
    const r1 = await prisma.chatSession.findFirst({ where: { guest_token: tok('R1') }, select: { message_count: true } })
    if (r1 && r1.message_count >= 2) {
      findings.push({
        severity: 'NOTE',
        title: 'Activation threshold counts assistant replies',
        detail: `One buyer turn stores message_count=${r1.message_count}. "Activated = 3+ messages" therefore means 2 buyer questions, and R1 (1 question) is "${nodes.get(tok('R1')).funnelStage}".`,
      })
    }
  })

  it('person drawer: P shows all three chats', async () => {
    const res = await request(adminApp).get(`/api/v1/admin/referrals/nodes/${tok('P')}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.node.chats.length, 3)
    assert.equal(res.body.node.generation, 1)
    assert.equal(res.body.node.rootCode, ROOT)
  })

  it('links list: reach, deepest generation and creator email for s.admin', async () => {
    const res = await request(adminApp).get('/api/v1/admin/referrals?scope=mine')
    assert.equal(res.status, 200)
    const link = res.body.links.find((l: any) => l.code === ROOT)
    assert.ok(link)
    assert.equal(link.devicesReached, 11)
    assert.equal(link.deepestGeneration, 4)
    assert.equal(link.createdByEmail, ADMIN_EMAIL)
    assert.equal(link.hasHolder, true)
    assert.equal(link.broadcastFlagged, false, 'two direct arrivals is not a broadcast')
  })

  it('metrics: s.admin\'s per-admin row includes this chain (timed: it scans every live session)', async () => {
    const t0 = Date.now()
    const res = await request(adminApp).get('/api/v1/admin/referrals/metrics')
    time('metrics', Date.now() - t0)
    assert.equal(res.status, 200)
    const mine = res.body.byAdmin.find((a: any) => a.adminId === adminId)
    assert.ok(mine)
    assert.ok(mine.totalDevicesReached >= 11)
    if (mine.bestChannel !== null) assert.equal(typeof mine.bestChannel, 'string')
  })

  // ── 8. Revoking the ROOT ────────────────────────────────────────────────
  it('revoking the ROOT stops arrivals on the ROOT code; the tree is kept', async () => {
    const rv = await request(adminApp).post(`/api/v1/admin/referrals/${ROOT}/revoke`)
    assert.equal(rv.status, 200)
    const r = await arrive('X-afterRevokeRoot', ROOT)
    assert.equal(r.status, 200)
    assert.equal(r.greeting, null, 'no greeting on a revoked link')
    assert.equal((await visit('X-afterRevokeRoot'))?.generation, 0)
    assert.equal((await tree(ROOT)).size, 11, 'existing tree kept')
  })

  it('after ROOT revoke, members\' personal links attribute nothing either', async () => {
    const r = await arrive('X-viaR1AfterRevoke', own.get('R1')!)
    assert.equal(r.status, 200)
    const v = await visit('X-viaR1AfterRevoke')
    if (v?.root_code === ROOT) {
      findings.push({
        severity: 'GAP',
        title: 'Revoking a ROOT link does not stop its tree from growing',
        detail: `After revoking ${ROOT}, a new device arriving on R1's personal code joined the revoked tree at generation ${v.generation}.`,
      })
    }
    assert.equal(v?.generation, 0)
    assert.notEqual(v?.root_code, ROOT)
    assert.equal((await tree(ROOT)).size, 11, 'existing tree kept')
  })

  // ── 9. Concurrency and limits ───────────────────────────────────────────
  it('concurrent first arrivals on a fresh ROOT: exactly one holder at generation 1', async () => {
    const res = await request(adminApp).post('/api/v1/admin/referrals').send({ label: `Stress ${run} — race`, greetingName: 'Sana' })
    ROOT2 = res.body.code
    const racers = ['C1', 'C2', 'C3', 'C4', 'C5']
    const results = await Promise.all(racers.map((n) => arrive(n, ROOT2)))
    assert.ok(results.every((r) => r.status === 200), `statuses: ${results.map((r) => r.status).join(',')}`)
    const visits = await prisma.referralVisit.findMany({ where: { guest_token: { in: racers.map(tok) } } })
    const gen1 = visits.filter((v) => v.generation === 1)
    const link = await prisma.referralLink.findUnique({ where: { code: ROOT2 } })
    const greeted = results.filter((r) => r.greeting).length
    if (gen1.length !== 1) {
      findings.push({
        severity: 'BUG',
        title: 'Holder race: several devices become generation 1 on one ROOT link',
        detail: `${gen1.length} of 5 simultaneous first arrivals were recorded as holder (generation 1, no parent); link.holder_guest_token is ${link?.holder_guest_token?.replace(PREFIX, '')}, so ${gen1.length - 1} gen-1 node(s) are orphans that no longer match the holder. The read-check-then-update in /arrive is not atomic.`,
      })
    }
    assert.equal(gen1.length, 1, `${gen1.length} devices claimed the holder seat`)
    assert.equal(gen1[0].guest_token, link?.holder_guest_token)
    assert.ok(visits.filter((v) => v.generation === 2).every((v) => v.parent_guest_token === link?.holder_guest_token))
    assert.equal(greeted, 5, 'every arrival on a live ROOT with a greeting is greeted')
  })

  it('one device arriving five times at once: one visit row, no 500s', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => arrive('D-dup', own.get('Q2')!)))
    const statuses = results.map((r) => r.status)
    const rows = await prisma.referralVisit.count({ where: { guest_token: tok('D-dup') } })
    assert.equal(rows, 1)
    const codes = new Set(results.filter((r) => r.ownCode).map((r) => r.ownCode))
    if (statuses.some((s) => s !== 200) || codes.size > 1) {
      findings.push({
        severity: 'BUG',
        title: 'Concurrent duplicate arrival from one device fails',
        detail: `Statuses ${statuses.join(',')}; distinct own codes returned: ${codes.size}. The losing requests hit the unique constraint on referral_visits.guest_token and return 500, so the client stores no code for this page load.`,
      })
    }
    assert.ok(statuses.every((s) => s === 200), `statuses: ${statuses.join(',')}`)
  })

  it('per-device limit: the 21st arrival in 10 minutes is refused', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 21; i++) statuses.push((await arrive('L-limit', null)).status)
    assert.equal(statuses.slice(0, 20).every((s) => s === 200), true, statuses.join(','))
    assert.equal(statuses[20], 429)
  })
})

async function buildReport() {
  const visits = await prisma.referralVisit.findMany({ where: { guest_token: { startsWith: PREFIX } }, orderBy: [{ generation: 'asc' }, { first_seen_at: 'asc' }] })
  const sessions = await prisma.chatSession.findMany({
    where: { guest_token: { startsWith: PREFIX } },
    select: { guest_token: true, message_count: true, is_bot: true, summary_location: true, summary_financial: true },
  })
  const nodes = ROOT ? await tree(ROOT).catch(() => new Map()) : new Map()
  const short = (g: string | null) => (g ? g.replace(PREFIX, '') : null)
  const stat = (xs: number[] = []) => (xs.length ? { n: xs.length, min: Math.min(...xs), median: [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)], max: Math.max(...xs) } : null)
  return {
    run,
    admin: ADMIN_EMAIL,
    rootCode: ROOT,
    raceRootCode: ROOT2,
    chain: visits.map((v) => ({
      device: short(v.guest_token),
      generation: v.generation,
      parent: short(v.parent_guest_token),
      root: v.root_code === ROOT ? 'ROOT' : v.root_code === ROOT2 ? 'ROOT2' : `own:${v.root_code}`,
      arrivedVia: v.arrived_via_code,
      ownCode: v.own_code,
      depthInferred: v.depth_inferred,
      priorUser: v.prior_user,
      channel: v.share_channel,
      device_class: v.device_class,
      os: v.os,
      app: v.app_guess,
      visits: v.visit_count,
      chats: sessions.filter((s) => s.guest_token === v.guest_token).length,
      storedMessages: sessions.filter((s) => s.guest_token === v.guest_token).reduce((a, s) => a + s.message_count, 0),
      adminFunnelStage: nodes.get(v.guest_token)?.funnelStage ?? '(not in ROOT tree)',
      summaries: sessions.filter((s) => s.guest_token === v.guest_token).map((s) => ({ location: s.summary_location, financial: s.summary_financial })),
    })),
    chats: chatLog,
    timingsMs: { arrive: stat(timings.arrive), chatTurn: stat(timings.chatTurn), metrics: stat(timings.metrics), dbWait: stat(timings.dbWait) },
    findings,
  }
}
