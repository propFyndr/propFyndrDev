import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { executeJevDecision, parseMonthlyRent, type JevExecutionContext } from '../execute'
import type { JevDecision } from '../decision'
import type { Intent } from '../../discovery/types'

const decision = (task: JevDecision['task'], clarify: string | null = null): JevDecision => ({
  task,
  sources: ['general'],
  shape: 'lookup',
  fields: [],
  clarify,
  via: 'llm',
})

async function run(message: string, d: JevDecision) {
  const events: Array<{ event: string; data: any }> = []
  const ctx: JevExecutionContext = {
    res: { end: () => {}, writableEnded: false } as any,
    send: (event, data) => events.push({ event, data }),
    sessionId: 's',
    message,
    intent: {} as Intent,
  }
  const handled = await executeJevDecision(d, ctx)
  return { handled, text: events.filter((e) => e.event === 'token').map((e) => e.data.token).join('') }
}

describe('JEV leaves questions with a dedicated handler alone', () => {
  it('a Sports City registry question is not answered with the generic registration guide', async () => {
    const r = await run('is sector 150 sports city registry problem solved now? which projects are affected', decision('legal_process'))
    assert.equal(r.handled, false)
  })

  it('an EOI question is not cut short by an LLM clarify', async () => {
    const r = await run('ace new launch sector 150 asking 10 lakh EOI. refundable hai? should i pay', decision('legal_process', 'Which project do you mean?'))
    assert.equal(r.handled, false)
  })

  it('a resale-without-registry question reaches the legal-risk answer, not the resale pitch', async () => {
    const r = await run('resale flat mil raha gaur city side, seller ke paas registry nahi hai, builder bol raha baad me transfer kar denge. safe hai?', decision('out_of_scope'))
    assert.equal(r.handled, false)
  })

  it('a buyer-quoted BSP goes to the total-outflow handler', async () => {
    const r = await run('bsp 1.2 cr for 3bhk under construction on expressway. total kitna padega sab milake?', decision('calculate'))
    assert.equal(r.handled, false)
  })

  it('"1.5 cr all inclusive, what can I get" is a budget, never a made-up cost sheet', async () => {
    const r = await run('1.5 cr all inclusive, need 3bhk noida, office in sec 62. what can i actually get?', decision('calculate'))
    assert.equal(r.handled, false)
  })

  it('the registration guide still answers a process question', async () => {
    const r = await run('what is the process of registry in noida, steps?', decision('legal_process'))
    assert.equal(r.handled, true)
    assert.match(r.text, /Registration/)
  })
})

describe('JEV calculators compute on the buyer\'s numbers only', () => {
  it('reads rent as written', () => {
    assert.equal(parseMonthlyRent('rent is 25000'), 25000)
    assert.equal(parseMonthlyRent('rent 25k'), 25000)
    assert.equal(parseMonthlyRent('₹25,000 per month'), 25000)
    assert.equal(parseMonthlyRent('expected rent around 32 thousand'), 32000)
    assert.equal(parseMonthlyRent('what yield will I get'), null)
  })

  it('a yield question without a rent is not answered with a default rent', async () => {
    const r = await run('what is the rental yield on a 1.5 cr flat', decision('calculate'))
    assert.equal(r.handled, false)
  })

  it('a yield on the buyer\'s rent and price is computed', async () => {
    const r = await run('rental yield if rent is 25000 and property value is 1.5 cr', decision('calculate'))
    assert.equal(r.handled, true)
    assert.match(r.text, /₹25,000/)
  })

  it('a loading question without two areas is not answered with NaN', async () => {
    const r = await run('what is a good loading percentage', decision('calculate'))
    assert.equal(r.handled, false)
  })

  it('a loading ratio on two stated areas is computed', async () => {
    const r = await run('loading on 1,200 sqft super and 850 sqft carpet', decision('calculate'))
    assert.equal(r.handled, true)
    assert.match(r.text, /29\.17%/)
    assert.doesNotMatch(r.text, /NaN/)
  })
})
