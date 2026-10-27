/**
 * Grows a 5-generation referral tree through the real HTTP endpoints, then
 * reads it back through the admin tree endpoints.
 *
 *   # 1. a backend on :3005 (non-test NODE_ENV, or every chat is marked is_bot
 *   #    and the tree drops it; blank WEBHOOK_URL so demo leads go nowhere)
 *   NODE_ENV=production FRONTEND_URL=https://realtyask.in PORT=3005 REDIS_KEY_PREFIX=dev: WEBHOOK_URL= npx tsx src/index.ts
 *   # 2. the demo, against the same DATABASE_URL
 *   NODE_ENV=production FRONTEND_URL=https://realtyask.in npx tsx scripts/demo-referral-tree.ts [--root=CODE] [--base=http://localhost:3005]
 *
 * Without --root it mints a throwaway ROOT link labelled "Demo — …".
 * The admin reads (and the mint) go through adminReferralsRouter in-process
 * with a SUPER_ADMIN identity, the way the referral tests do: the running
 * server's adminAreaGuard wants a browser session this script does not have.
 *
 *   A  gen1  Android Chrome (wa)    opens the ROOT link; 3 chats, saves, callback
 *   ├─ B  gen2  iPhone Safari (wa)  2 chats (compare), site visit
 *   │  └─ C  gen3  Instagram (ig)   3 chats (EMI, Hinglish), saves
 *   │     └─ D  gen4  Mac Safari (sms)   1 chat, stops
 *   │        └─ E  gen5  Android (wa)    3 chats, save, callback and site visit
 *   └─ B2 gen2  Windows Chrome (copy)    opens the link, never chats
 *
 * Every guest token starts with `guest-demo-<run>-`, so leftovers can be found
 * by prefix. Nothing is deleted at the end: the tree is the point.
 */
import 'dotenv/config'
import { randomUUID } from 'crypto'
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'

const BASE = process.argv.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:3005'
const ROOT_ARG = process.argv.find((a) => a.startsWith('--root='))?.slice(7)?.toUpperCase()
const ADMIN_EMAIL = process.env.REFERRAL_ADMIN_EMAIL ?? 's.admin@realtyask.in'
const RUN = randomUUID().slice(0, 6)
const API = `${BASE}/api/v1`

// No "WhatsApp" in any UA: the arrive endpoint treats it as a link-preview bot
// (204, no visit) and the chat router marks the session is_bot. A WhatsApp
// share is an ordinary browser UA plus channel=wa.
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  instagram: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36 Instagram 349.0.0.40.103 Android',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}

interface Person {
  name: string
  parent: string | null // null = opens the ROOT link
  ua: string
  channel: string
  ip: string
  phone: string
  chats: string[][]
  save?: number[] // indexes into the picked projects
  callback?: number
  siteVisit?: number
}

let projects: { id: string; slug: string; name: string }[] = []

function people(): Person[] {
  const [p0, p1] = projects
  return [
    {
      name: 'A', parent: null, ua: UA.android, channel: 'wa', ip: '203.0.113.11', phone: '9000000001',
      chats: [
        ['3BHK in Sector 150 under 1.5 Cr, possession within a year', 'Which of these is closest to a metro station?'],
        [`Tell me about ${p0.name}`, 'What is the payment plan?'],
        ['What would the EMI be on a 1.2 crore loan over 20 years at 8.5%?'],
      ],
      save: [0], callback: 0,
    },
    {
      name: 'B', parent: 'A', ua: UA.iphone, channel: 'wa', ip: '203.0.113.12', phone: '9000000002',
      chats: [
        [`Compare ${p0.name} and ${p1.name}`, 'Which has the better builder track record?'],
        ['I want to see a property this weekend, what should I check on a site visit?'],
      ],
      siteVisit: 1,
    },
    { name: 'B2', parent: 'A', ua: UA.windows, channel: 'copy', ip: '203.0.113.13', phone: '9000000003', chats: [] },
    {
      name: 'C', parent: 'B', ua: UA.instagram, channel: 'ig', ip: '203.0.113.14', phone: '9000000004',
      chats: [
        ['Mujhe 2BHK chahiye Greater Noida West mein 80 lakh tak'],
        ['EMI kitni banegi 60 lakh loan pe 15 saal ke liye?'],
        ['Ready to move options near Noida Sector 62 metro under 1 Cr'],
      ],
      save: [0, 1],
    },
    { name: 'D', parent: 'C', ua: UA.mac, channel: 'sms', ip: '203.0.113.15', phone: '9000000005', chats: [['Is Sector 150 good for families with school-going kids?']] },
    {
      name: 'E', parent: 'D', ua: UA.android, channel: 'wa', ip: '203.0.113.16', phone: '9000000006',
      chats: [
        ['4BHK in Noida under 3 Cr, ready to move'],
        [`What is the RERA number and possession date of ${p1.name}?`],
        ['What is the stamp duty for a woman buyer in Noida on a 2 Cr flat?'],
      ],
      save: [1], callback: 1, siteVisit: 1,
    },
  ]
}

const token = (name: string) => `guest-demo-${RUN}-${name.toLowerCase()}-${randomUUID().slice(0, 8)}`
const tokens = new Map<string, string>()
const ownCodes = new Map<string, string>()

function headers(p: Person): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'User-Agent': p.ua,
    'X-Forwarded-For': p.ip,
    'CF-Connecting-IP': p.ip,
    'X-Guest-Token': tokens.get(p.name)!,
  }
}

async function post(p: Person, path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: headers(p), body: JSON.stringify(body) })
  return { status: res.status, json: res.headers.get('content-type')?.includes('json') ? await res.json() : null }
}

/** lib/referral.ts arrive(): { guestToken, code, channel }. */
async function arrive(p: Person, code: string) {
  const r = await post(p, '/referral/arrive', { guestToken: tokens.get(p.name), code, channel: p.channel })
  if (r.status !== 200 || !r.json?.ownCode) throw new Error(`${p.name} arrive: HTTP ${r.status} ${JSON.stringify(r.json)}`)
  ownCodes.set(p.name, r.json.ownCode)
  console.log(`  ${p.name} arrived on ${code} via ${p.channel} -> own code ${r.json.ownCode}${r.json.greeting ? ` (greeted "${r.json.greeting.name}")` : ''}`)
}

/** lib/backend-api.ts streamChat(): one turn, SSE read to the end. */
async function chatTurn(p: Person, text: string, sessionId: string | null): Promise<string | null> {
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { ...headers(p), 'X-Turn-Id': randomUUID() },
    body: JSON.stringify({ action: { type: 'TEXT_MESSAGE', payload: { text } }, sessionId: sessionId ?? undefined, guestToken: tokens.get(p.name) }),
  })
  const raw = await res.text()
  let sid = sessionId
  let answer = ''
  let error = ''
  for (const block of raw.split('\n\n')) {
    const ev = /^event: (.+)$/m.exec(block)?.[1]
    const data = /^data: (.+)$/m.exec(block)?.[1]
    if (!ev || !data) continue
    try {
      const d = JSON.parse(data)
      if (ev === 'token' && typeof d.token === 'string') answer += d.token
      if (ev === 'done' && d.sessionId) sid = d.sessionId
      if (ev === 'error') error = d.message
    } catch { /* keep-alive */ }
  }
  console.log(`    [${p.name}] "${text.slice(0, 60)}" -> HTTP ${res.status}, ${answer.length} chars${error ? `, error: ${error}` : ''}`)
  return sid
}

async function act(p: Person) {
  for (const chat of p.chats) {
    let sid: string | null = null
    for (const turn of chat) sid = await chatTurn(p, turn, sid)
  }
  for (const i of p.save ?? []) {
    const r = await post(p, '/saved', { project_id: projects[i].id })
    console.log(`    [${p.name}] save ${projects[i].slug} -> HTTP ${r.status}`)
  }
  if (p.callback !== undefined) {
    const pr = projects[p.callback]
    const r = await post(p, '/leads/callback', {
      name: `Demo buyer ${p.name}`, phone: p.phone, project_slug: pr.slug, project_name: pr.name,
      intent_tier: 'immediate', consent_given: true, guestToken: tokens.get(p.name),
    })
    console.log(`    [${p.name}] callback ${pr.slug} -> HTTP ${r.status}`)
  }
  if (p.siteVisit !== undefined) {
    const pr = projects[p.siteVisit]
    const r = await post(p, '/leads/site-visit', {
      project_slug: pr.slug, project_name: pr.name, name: `Demo buyer ${p.name}`, phone: p.phone,
      visit_date: new Date(Date.now() + 3 * 86_400_000).toISOString(), time_slot: '11:00 AM', guestToken: tokens.get(p.name),
    })
    console.log(`    [${p.name}] site visit ${pr.slug} -> HTTP ${r.status}`)
  }
}

async function main() {
  // Required after dotenv so lib/db sees DATABASE_URL.
  const { prisma } = require('../src/lib/db') as typeof import('../src/lib/db')
  const { adminReferralsRouter } = require('../src/routes/adminReferrals') as typeof import('../src/routes/adminReferrals')

  const admin = await prisma.adminUser.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin || admin.role !== 'SUPER_ADMIN') throw new Error(`${ADMIN_EMAIL} is not a SUPER_ADMIN here`)
  const adminApp = express()
  adminApp.use(express.json())
  adminApp.use((req: Request & { adminIdentity?: unknown }, _res: Response, next: NextFunction) => {
    req.adminIdentity = { adminUserId: admin.id, email: admin.email, role: admin.role, builderId: null, partnerId: null }
    next()
  })
  adminApp.use('/api/v1/admin/referrals', adminReferralsRouter)

  projects = await prisma.project.findMany({
    where: { sector: { contains: '150' } },
    select: { id: true, slug: true, name: true },
    orderBy: { name: 'asc' },
    take: 2,
  })
  if (projects.length < 2) throw new Error('need two Sector 150 projects in this database')

  let root = ROOT_ARG
  if (!root) {
    const r = await request(adminApp).post('/api/v1/admin/referrals').send({ label: `Demo — 5-gen tree ${RUN}`, greetingName: 'Demo', note: 'scripts/demo-referral-tree.ts' })
    if (r.status !== 201) throw new Error(`mint ROOT: HTTP ${r.status}`)
    root = r.body.code as string
  }
  console.log(`run ${RUN}, ROOT ${root}, projects ${projects.map((p) => p.slug).join(', ')}`)

  for (const p of people()) {
    tokens.set(p.name, token(p.name))
    await arrive(p, p.parent ? ownCodes.get(p.parent)! : root)
    await act(p)
  }

  const tree = await request(adminApp).get(`/api/v1/admin/referrals/${root}/tree`)
  if (tree.status !== 200) throw new Error(`tree: HTTP ${tree.status}`)
  const nameOf = new Map([...tokens].map(([n, t]) => [t, n]))
  console.log(`\nTREE ${tree.body.root.code} "${tree.body.root.label}"`)
  for (const n of tree.body.nodes) {
    const node = await request(adminApp).get(`/api/v1/admin/referrals/nodes/${n.guestToken}`)
    const who = nameOf.get(n.guestToken) ?? n.guestToken
    console.log(
      `${'  '.repeat(n.generation)}gen${n.generation} ${who} parent=${nameOf.get(n.parentGuestToken) ?? n.parentGuestToken ?? 'ROOT'} ` +
      `${n.os}/${n.deviceClass}/${n.appGuess} ch=${n.shareChannel} msgs=${n.messageCount} stage=${n.funnelStage} ` +
      `drawer=${JSON.stringify(node.body.node?.actions)} chats=${node.body.node?.chats?.length}`,
    )
  }
  const missing = [...tokens].filter(([, t]) => !tree.body.nodes.some((n: any) => n.guestToken === t)).map(([n]) => n)
  if (missing.length) console.log(`MISSING FROM TREE: ${missing.join(', ')}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
