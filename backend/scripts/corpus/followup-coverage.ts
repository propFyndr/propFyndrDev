// backend/scripts/corpus/followup-coverage.ts
//
// Can the chat answer every kind of data we hold about a project, on a
// FOLLOW-UP turn that never repeats the project's name? One conversation per
// project: "Tell me about X", then one follow-up per data domain. Each answer
// is checked against that project's own rows: it must contain at least one
// value only that domain's rows hold (a plan name, a parking charge, a metro
// station, a RERA number, ...). Real model chain, whatever DATABASE_URL is
// set (run it against dev). Writes docs/benchmark/answers/followup-<label>.json.
//
//   npx tsx scripts/corpus/followup-coverage.ts run1 [project-slug ...]
process.env.LANGFUSE_SECRET_KEY = ''
process.env.LANGFUSE_PUBLIC_KEY = ''
if (!process.env.REDIS_KEY_PREFIX) process.env.REDIS_KEY_PREFIX = 'dev:' // never write live cache keys

import { randomUUID } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import request from 'supertest'
import { app } from '../../src/index'
import { prisma } from '../../src/lib/db'
import { onTurnTrace, type TurnTraceDraft } from '../../src/lib/turnTrace'

const lakh = (rs: number) => `${(rs / 100_000).toFixed(rs % 100_000 ? 2 : 0).replace(/\.?0+$/, '')}`
const words = (s: string | null | undefined) => (s ?? '').split(/[\s,/()-]+/).filter((w) => w.length >= 5)

type Domain = { id: string; ask: string; expect: (p: any) => string[] }

/** Distinctive values per domain; an answer passes when it contains any of them. */
const DOMAINS: Domain[] = [
  { id: 'payment_plans', ask: 'What payment plans do they offer?', expect: (p) => p.payment_plans.flatMap((x: any) => [x.plan_name, x.plan_type]).filter(Boolean) },
  { id: 'cost_sheet', ask: 'Show me the cost sheet. What are the extra charges?', expect: (p) => {
    const c = p.cost_sheet; if (!c) return []
    return [c.parking_cost, c.club_membership, c.ifms].filter((n: any) => n).flatMap((n: number) => [n.toLocaleString('en-IN'), `${lakh(n)} lakh`, `${lakh(n)} L`])
  } },
  { id: 'location', ask: 'How far is the nearest metro station?', expect: (p) => p.connectivity.filter((c: any) => /metro/i.test(c.type) || /metro/i.test(c.name)).flatMap((c: any) => [c.name, ...words(c.name).slice(0, 2)]) },
  { id: 'amenities', ask: 'What amenities are there?', expect: (p) => p.amenities.map((a: any) => a.name).filter(Boolean) },
  { id: 'units', ask: 'What sizes are the flats and what do they cost?', expect: (p) => p.unit_types.flatMap((u: any) => [u.super_area_sqft, u.carpet_area_sqft].filter(Boolean).map((n: number) => n.toLocaleString('en-IN'))) },
  { id: 'price_history', ask: 'Has the price gone up over time?', expect: (p) => p.price_history.flatMap((h: any) => [h.price_per_sqft].filter(Boolean).map((n: number) => n.toLocaleString('en-IN'))) },
  { id: 'rera', ask: 'Is it RERA registered?', expect: (p) => [p.rera_number].filter(Boolean) },
  { id: 'possession', ask: 'When is possession, and how far along is construction?', expect: (p) => [p.possession_label, p.possession_date ? String(new Date(p.possession_date).getFullYear()) : null, ...p.construction_milestones.map((m: any) => m.name)].filter(Boolean) },
  { id: 'builder', ask: "What is the builder's track record?", expect: (p) => [p.builder?.name, ...(p.builder?.delivered_projects ?? [])].filter(Boolean) },
  { id: 'specs', ask: 'What are the specifications, like flooring and fittings?', expect: (p) => p.spec_items.flatMap((s: any) => [s.value, s.brand, ...words(s.value)]).filter(Boolean) },
  { id: 'competitors', ask: 'Which similar projects should I compare it with?', expect: (p) => p.competitors.map((c: any) => c.competitor_name).filter(Boolean) },
  { id: 'total_cost', ask: 'What is the total cost of the cheapest flat including stamp duty and registration?', expect: () => ['stamp duty', 'Stamp duty'] },
  { id: 'emi', ask: 'What would the EMI be on that with an 80% loan?', expect: () => ['a month', '/month', 'per month'] },
]

async function main() {
  const label = process.argv[2] ?? 'run'
  const slugs = process.argv.slice(3).length ? process.argv.slice(3) : ['prateek-laurel-sector-120-noida', 'ats-pious-hideaways-sector-150']
  let lastTrace: TurnTraceDraft | null = null
  const stop = onTurnTrace((t) => { lastTrace = t })
  const report: any[] = []
  // Other projects' names, to catch an answer about the wrong project or a list.
  const catalogNames = (await prisma.project.findMany({ select: { name: true } })).map((r) => r.name).filter((n) => n.length >= 8)

  for (const slugish of slugs) {
    const p: any = await prisma.project.findFirst({
      where: { OR: [{ slug: slugish }, { slug: { startsWith: slugish } }] },
      include: {
        payment_plans: true, cost_sheet: true, connectivity: true, amenities: true, unit_types: true, price_history: true,
        construction_milestones: true, spec_items: true, builder: true, competitors: true,
      },
    })
    if (!p) { console.error(`no project ${slugish}`); continue }
    const guestToken = randomUUID()
    let sessionId: string | null = null
    let intent: Record<string, unknown> = {}
    const turns: any[] = []
    for (const d of [{ id: 'opening', ask: `Tell me about ${p.name}`, expect: () => [p.name] } as Domain, ...DOMAINS]) {
      lastTrace = null
      const t0 = Date.now()
      let body = ''
      await request(app)
        .post('/api/v1/chat')
        .set('x-guest-token', guestToken)
        .send({ action: { type: 'TEXT_MESSAGE', payload: { text: d.ask } }, sessionId, guestToken, intent })
        .buffer(true)
        .parse((r, cb) => { r.setEncoding('utf8'); r.on('data', (c: string) => { body += c }); r.on('end', () => cb(null, body)) })
      for (let w = 0; w < 20 && !lastTrace; w++) await new Promise((r) => setTimeout(r, 10))
      const events = body.split('\n\n').flatMap((part) => {
        const ev = /^event: (\w+)/m.exec(part); const data = /^data: (.+)$/m.exec(part)
        if (!ev || !data) return []
        try { return [{ event: ev[1], data: JSON.parse(data[1]) }] } catch { return [] }
      })
      const answer = events.filter((e) => e.event === 'token').map((e) => String(e.data.token ?? '')).join('')
      const done = events.find((e) => e.event === 'done')
      if (done?.data.sessionId) sessionId = String(done.data.sessionId)
      if (done?.data.intent) intent = done.data.intent
      const expected = [...new Set(d.expect(p).map(String).filter((s) => s.length >= 3))]
      const hits = expected.filter((v) => answer.toLowerCase().includes(v.toLowerCase()))
      const outage = /briefly unavailable/i.test(answer)
      const focusWord = p.name.split(/[s/]+/)[0].toLowerCase()
      const others = d.id === 'competitors' || d.id === 'builder' ? [] : catalogNames.filter((n) => n !== p.name && !n.toLowerCase().startsWith(focusWord) && answer.includes(n))
      const aboutFocus = answer.toLowerCase().includes(focusWord)
      const verdict = outage ? 'OUTAGE'
        : others.length >= 3 ? 'LIST'
        : others.length > 0 && !aboutFocus ? 'WRONG_PROJECT'
        : expected.length === 0 ? 'NO_DATA' : hits.length ? 'PASS' : 'MISS'
      const trace = lastTrace as TurnTraceDraft | null
      turns.push({ domain: d.id, ask: d.ask, lane: trace?.lane ?? 'no-trace', ms: Date.now() - t0, verdict, hits: hits.slice(0, 4), expectedSample: expected.slice(0, 4), uiEvents: [...new Set(events.map((e) => e.event))], answer })
      process.stderr.write(`${p.slug} ${d.id.padEnd(14)} ${verdict.padEnd(7)} ${String(trace?.lane).padEnd(28)} ${Date.now() - t0}ms\n`)
    }
    report.push({ project: p.name, slug: p.slug, turns })
  }
  stop()
  const dir = join(__dirname, '../../../docs/benchmark/answers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `followup-${label}.json`), JSON.stringify(report, null, 2) + '\n')
  await prisma.$disconnect()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
