// backend/scripts/corpus/benchmark-day2.ts
//
// Runs the Day 2 benchmark questions (docs/benchmark/DAY2_QUESTIONS_2026-10-16.md)
// through the real chat route with the REAL model chain, against whatever
// DATABASE_URL is set (run it against dev). Each question gets a fresh guest.
// Writes docs/benchmark/answers/realtyask-<label>.json.
//
//   REDIS_KEY_PREFIX=dev: npx tsx scripts/corpus/benchmark-day2.ts before
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

export const QUESTIONS: string[][] = [
  ['3BHK in Noida under 1.5 crore, possession within a year. What are my options?'],
  ['2BHK in Greater Noida West around 80 lakh.', 'Actually make that 1 crore, what changes?'],
  ['Is Supertech Supernova Astralis in Sector 94 on track for possession, and what is the risk if it slips?'],
  ['I need to move in within 6 months. Which ready-to-move 3BHKs in Noida should I look at?'],
  ['Which projects near a metro station in Noida fit a 1.2 crore budget?'],
  ['I work in Sector 62. Which sectors give me the shortest commute for a 2BHK under 1 crore?'],
  ['Can I trust Supertech as a builder? What happened with their delayed projects?'],
  ['Jaypee Klassic in Sector 134 vs Gulshan Ikebana in Sector 143: which builder is safer?'],
  ['For a 1.4 crore flat in Noida, what is the total cost including stamp duty, registration and GST?'],
  ['If I take an 80% loan on a 1.5 crore flat, what is my EMI and how much cash do I need up front?'],
]

async function main() {
  const label = process.argv[2] ?? 'run'
  let lastTrace: TurnTraceDraft | null = null
  const stop = onTurnTrace((t) => { lastTrace = t })
  const out = []
  for (let i = 0; i < QUESTIONS.length; i++) {
    const guestToken = randomUUID()
    let sessionId: string | null = null
    let intent: Record<string, unknown> = {}
    const turns = []
    for (const q of QUESTIONS[i]) {
      lastTrace = null
      const t0 = Date.now()
      let firstMs: number | null = null
      let body = ''
      await request(app)
        .post('/api/v1/chat')
        .set('x-guest-token', guestToken)
        .send({ action: { type: 'TEXT_MESSAGE', payload: { text: q } }, sessionId, guestToken, intent })
        .buffer(true)
        .parse((r, cb) => {
          r.setEncoding('utf8')
          r.on('data', (d: string) => { if (firstMs === null && d.includes('event: token')) firstMs = Date.now() - t0; body += d })
          r.on('end', () => cb(null, body))
        })
      for (let w = 0; w < 20 && !lastTrace; w++) await new Promise((r) => setTimeout(r, 10))
      const events = body.split('\n\n').flatMap((p) => {
        const ev = /^event: (\w+)/m.exec(p); const data = /^data: (.+)$/m.exec(p)
        if (!ev || !data) return []
        try { return [{ event: ev[1], data: JSON.parse(data[1]) }] } catch { return [] }
      })
      const answer = events.filter((e) => e.event === 'token').map((e) => String(e.data.token ?? '')).join('')
      const done = events.find((e) => e.event === 'done')
      if (done?.data.sessionId) sessionId = String(done.data.sessionId)
      if (done?.data.intent) intent = done.data.intent
      const cards = events.filter((e) => /project|card|result/i.test(e.event)).length
      const trace = lastTrace as TurnTraceDraft | null
      turns.push({ q, lane: trace?.lane ?? 'no-trace', firstMs, totalMs: Date.now() - t0, chars: answer.length, cardEvents: cards, answer })
      process.stderr.write(`Q${i + 1} ${trace?.lane} ${Date.now() - t0}ms ${answer.length}ch\n`)
    }
    out.push({ n: i + 1, turns })
  }
  stop()
  const dir = join(__dirname, '../../../docs/benchmark/answers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `realtyask-${label}.json`), JSON.stringify(out, null, 2) + '\n')
  await prisma.$disconnect()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
