// backend/src/lib/eval/routeReplay.ts
//
// Replays buyer conversations through the REAL chat route — every gate, every
// handler, the JEV layer, the fact bypass — with the model stubbed out, and
// records which lane answered each turn and what code wrote.
//
// Why: nearly every bug fixed on 2026-10-02 was a routing bug (one of ~40
// gates claiming a question meant for another), and the red-team scorecards
// could not see it because they exercise `requirementState`/`compileQueryPlan`,
// which the live path does not call. This tests the path a buyer actually hits.
//
// It costs nothing: no tokens (ai/llmStub.ts), no Redis (replayEnv.ts), and the
// only DB writes are the replay's own guest sessions, deleted afterwards.
//
// Import `./replayEnv` before this module.

import { randomUUID } from 'crypto'
import request from 'supertest'
import type { Express } from 'express'
import { prisma } from '../db'
import { onTurnTrace, type TurnTraceDraft } from '../turnTrace'
import { LLM_STUB_ANSWER } from '../ai/llmStub'

export interface ReplayExpect {
  /** Exact lane, e.g. "topic:price_fairness". */
  lane?: string
  /** Any of these lanes. */
  laneOneOf?: string[]
  /** None of these lanes (prefix match: "topic:" excludes every topic lane). */
  laneNot?: string[]
  /** true: the model must have been asked. false: code must have answered. */
  llm?: boolean
  /** Case-insensitive substrings the streamed answer must contain. */
  contains?: string[]
  /** Case-insensitive substrings it must not contain. */
  notContains?: string[]
  /** Intent fields after the turn, e.g. { budgetMax: 1.5 }. Compared loosely. */
  intent?: Record<string, unknown>
}

export interface ReplayTurn {
  text: string
  expect?: ReplayExpect
}

export interface ReplayCase {
  id: string
  /** Where the case came from: claudeQueries.md, a red-team spec, a fixed bug. */
  source?: string
  turns: ReplayTurn[]
}

export interface TurnResult {
  caseId: string
  turn: number
  text: string
  lane: string
  usedLlm: boolean
  answer: string
  intent: Record<string, unknown>
  failures: string[]
  ms: number
}

/** Parses an SSE body into events. Comment lines (": ping") are skipped. */
export function parseSse(body: string): Array<{ event: string; data: Record<string, unknown> }> {
  const out: Array<{ event: string; data: Record<string, unknown> }> = []
  for (const part of body.split('\n\n')) {
    const ev = /^event: (\w+)/m.exec(part)
    const data = /^data: (.+)$/m.exec(part)
    if (!ev || !data) continue
    try { out.push({ event: ev[1], data: JSON.parse(data[1]) }) } catch { /* partial frame */ }
  }
  return out
}

function looseEqual(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.length === actual.length && expected.every((e, i) => looseEqual(actual[i], e))
  }
  if (expected === null) return actual === null || actual === undefined
  return actual === expected
}

export function checkTurn(expect: ReplayExpect | undefined, r: Omit<TurnResult, 'failures'>): string[] {
  if (!expect) return []
  const f: string[] = []
  const answer = r.answer.toLowerCase()
  if (expect.lane && r.lane !== expect.lane) f.push(`lane ${r.lane}, expected ${expect.lane}`)
  if (expect.laneOneOf && !expect.laneOneOf.includes(r.lane)) f.push(`lane ${r.lane}, expected one of ${expect.laneOneOf.join(' | ')}`)
  for (const bad of expect.laneNot ?? []) if (r.lane.startsWith(bad)) f.push(`lane ${r.lane} is excluded (${bad})`)
  if (expect.llm === true && !r.usedLlm) f.push('expected the model to answer; code did')
  if (expect.llm === false && r.usedLlm) f.push('expected code to answer; the model was asked')
  for (const s of expect.contains ?? []) if (!answer.includes(s.toLowerCase())) f.push(`answer lacks "${s}"`)
  for (const s of expect.notContains ?? []) if (answer.includes(s.toLowerCase())) f.push(`answer contains "${s}"`)
  for (const [k, v] of Object.entries(expect.intent ?? {})) {
    if (!looseEqual(r.intent[k], v)) f.push(`intent.${k} = ${JSON.stringify(r.intent[k])}, expected ${JSON.stringify(v)}`)
  }
  return f
}

/** Runs every case, one fresh guest per case, and deletes the sessions after. */
export async function runReplay(app: Express, cases: readonly ReplayCase[]): Promise<TurnResult[]> {
  const results: TurnResult[] = []
  const guests: string[] = []
  let lastTrace: TurnTraceDraft | null = null
  const stop = onTurnTrace((t) => { lastTrace = t })

  try {
    for (const c of cases) {
      const guestToken = randomUUID()
      guests.push(guestToken)
      let sessionId: string | null = null
      let intent: Record<string, unknown> = {}

      for (let i = 0; i < c.turns.length; i++) {
        const turn = c.turns[i]
        lastTrace = null
        const started = Date.now()
        const res = await request(app)
          .post('/api/v1/chat')
          .set('x-guest-token', guestToken)
          .send({ action: { type: 'TEXT_MESSAGE', payload: { text: turn.text } }, sessionId, guestToken, intent })
          .buffer(true)
          .parse((r, cb) => { let s = ''; r.setEncoding('utf8'); r.on('data', (d: string) => { s += d }); r.on('end', () => cb(null, s)) })
        // `finish` (which records the trace) can land a tick after the body ends.
        for (let w = 0; w < 20 && !lastTrace; w++) await new Promise((r) => setTimeout(r, 10))

        const events = parseSse(typeof res.body === 'string' ? res.body : '')
        const answer = events.filter((e) => e.event === 'token').map((e) => String(e.data.token ?? '')).join('')
        const done = events.find((e) => e.event === 'done')
        if (done?.data.sessionId) sessionId = String(done.data.sessionId)
        if (done?.data.intent && typeof done.data.intent === 'object') intent = done.data.intent as Record<string, unknown>

        const trace = lastTrace as TurnTraceDraft | null
        const base = {
          caseId: c.id,
          turn: i + 1,
          text: turn.text,
          lane: trace?.lane ?? (res.status !== 200 ? `http_${res.status}` : 'no-trace'),
          usedLlm: answer.includes(LLM_STUB_ANSWER),
          answer,
          intent,
          ms: Date.now() - started,
        }
        results.push({ ...base, failures: checkTurn(turn.expect, base) })
      }
    }
  } finally {
    stop()
    // The router persists in the background after the response ends; let
    // those writes land before deleting, or they race the delete (FK errors,
    // or a session row recreated after cleanup).
    await new Promise((r) => setTimeout(r, 2500))
    await prisma.chatSession.deleteMany({ where: { guest_token: { in: guests } } }).catch((e: Error) =>
      console.warn('[ROUTE_REPLAY:CLEANUP]', e.message))
  }
  return results
}

/** One line per turn, for the CLI and for failing-test messages. */
export function formatResults(results: readonly TurnResult[]): string {
  return results.map((r) =>
    `${r.failures.length ? 'FAIL' : 'ok  '} ${r.caseId}#${r.turn} [${r.lane}]${r.usedLlm ? ' (llm)' : ''} ${r.ms}ms  "${r.text.slice(0, 70)}"` +
    (r.failures.length ? `\n       - ${r.failures.join('\n       - ')}` : ''),
  ).join('\n')
}
