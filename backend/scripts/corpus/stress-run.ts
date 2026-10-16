// backend/scripts/corpus/stress-run.ts
//
// Multi-turn stress chats through the real chat route with the REAL model
// chain, against whatever DATABASE_URL is set (run it against dev). One guest
// per chat; turns in a chat share the session.
//
//   npx tsx scripts/corpus/stress-run.ts scripts/corpus/stress-2026-10-16.json stress-2026-10-16
process.env.LANGFUSE_SECRET_KEY = ''
process.env.LANGFUSE_PUBLIC_KEY = ''
if (!process.env.REDIS_KEY_PREFIX) process.env.REDIS_KEY_PREFIX = 'dev:' // never write live cache keys

import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import request from 'supertest'
import { app } from '../../src/index'
import { prisma } from '../../src/lib/db'
import { onTurnTrace, type TurnTraceDraft } from '../../src/lib/turnTrace'

async function main() {
  const [file, label = 'stress'] = process.argv.slice(2)
  const chats = JSON.parse(readFileSync(file, 'utf8')) as { id: string; theme: string; turns: string[] }[]
  let lastTrace: TurnTraceDraft | null = null
  const stop = onTurnTrace((t) => { lastTrace = t })
  const out = []
  for (const chat of chats) {
    const guestToken = randomUUID()
    let sessionId: string | null = null
    let intent: Record<string, unknown> = {}
    const turns = []
    for (const q of chat.turns) {
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
      const cardNames = events
        .filter((e) => /project|card|result/i.test(e.event))
        .flatMap((e) => {
          const d = e.data as Record<string, unknown>
          const list = (d.projects ?? d.cards ?? d.results ?? (d.project ? [d.project] : [])) as { name?: string }[]
          return Array.isArray(list) ? list.map((p) => p?.name).filter(Boolean) : []
        })
      const trace = lastTrace as TurnTraceDraft | null
      turns.push({ q, lane: trace?.lane ?? 'no-trace', firstMs, totalMs: Date.now() - t0, chars: answer.length, cards: cardNames, intent, answer })
      process.stderr.write(`${chat.id} | ${trace?.lane} | ${Date.now() - t0}ms | ${answer.length}ch | ${q.slice(0, 50)}\n`)
    }
    out.push({ id: chat.id, theme: chat.theme, turns })
  }
  stop()
  const dir = join(__dirname, '../../../docs/benchmark/answers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${label}.json`), JSON.stringify(out, null, 2) + '\n')
  await prisma.$disconnect()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
