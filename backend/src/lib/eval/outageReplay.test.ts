// Must stay the first import: model stubbed, Redis off.
import './replayEnv'
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../../index'
import { prisma } from '../db'
import { runReplay, formatResults, type ReplayCase } from './routeReplay'

// Day 0 item 3: with every provider down, the five question types answered
// from stored rows still get a sourced answer, and only an open-ended question
// gets the outage notice. LLM_STUB_MODE=outage makes the stub take the chain's
// real no-model path (fallbackChain.endWithoutModel).
process.env.LLM_STUB_MODE = 'outage'

const NOTICE = 'briefly unavailable'
const fact = (id: string, text: string, containsAny: string[]): ReplayCase =>
  ({ id, source: 'Day 0: all providers down', turns: [{ text, expect: { notContains: [NOTICE], containsAny } }] })

const cases: ReplayCase[] = [
  fact('outage-price', 'What is the price of a 3 BHK at ACE Parkway?', ['₹']),
  fact('outage-price-hinglish', 'Elite X price kya hai?', ['₹', 'Price']),
  fact('outage-possession', 'When is possession for Godrej Palm Retreat?', ['Possession']),
  fact('outage-possession-hinglish', 'ACE Parkway ka possession kab hai?', ['Possession']),
  fact('outage-rera', 'what is the rera number for Godrej Woods?', ['UPRERA', 'RERA']),
  fact('outage-payment-plan', 'What is the payment plan for Elite X?', ['Payment']),
  fact('outage-cost-sheet', 'Show me the cost sheet for Elite X', ['Stamp Duty', 'Cost']),
  { id: 'outage-open-ended', source: 'Day 0: all providers down', turns: [{ text: 'Is Noida a good place to invest for the long term?', expect: { contains: [NOTICE] } }] },
]

describe('every provider down', () => {
  after(() => prisma.$disconnect())
  it('fact questions are answered from rows; only the open-ended one gets the notice', async () => {
    const results = await runReplay(app as never, cases)
    if (process.env.SHOW_ANSWERS) for (const r of results) console.log(`ANS ${r.caseId} [${r.lane}] ${r.answer.replace(/\s+/g, ' ').slice(0, 260)}`)
    const failed = results.filter((r) => r.failures.length)
    assert.equal(failed.length, 0, `\n${formatResults(results)}\n`)
  })
})
