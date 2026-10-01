// Must stay the first import: it stubs the model and turns Redis off before
// the app is loaded. node --test runs each file in its own process, so these
// env changes cannot leak into other test files.
import './replayEnv'
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from '../../index'
import { prisma } from '../db'
import { runReplay, formatResults, parseSse, checkTurn, type ReplayCase } from './routeReplay'

const cases = JSON.parse(readFileSync(join(__dirname, 'route-replay.json'), 'utf8')) as ReplayCase[]

describe('route replay — the real chat route, model stubbed', () => {
  after(() => prisma.$disconnect())

  it('every case reaches the lane and content it is pinned to', async () => {
    const results = await runReplay(app as never, cases)
    const failed = results.filter((r) => r.failures.length)
    assert.equal(failed.length, 0, `\n${formatResults(results)}\n`)
  })

  it('parses SSE frames and skips keep-alive comments', () => {
    const events = parseSse('event: token\ndata: {"token":"a"}\n\n: ping\n\nevent: done\ndata: {"sessionId":"s"}\n\n')
    assert.deepEqual(events.map((e) => e.event), ['token', 'done'])
  })

  it('reports each kind of mismatch', () => {
    const f = checkTurn(
      { lane: 'topic:x', llm: false, contains: ['hello'], notContains: ['bad'], intent: { budgetMax: 1.5 } },
      { caseId: 'c', turn: 1, text: 't', lane: 'OPEN', usedLlm: true, answer: 'bad answer', intent: { budgetMax: 2 }, ms: 0 },
    )
    assert.equal(f.length, 5)
  })
})
