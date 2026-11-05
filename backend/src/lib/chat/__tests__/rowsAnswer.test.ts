import { test } from 'node:test'
import assert from 'node:assert/strict'
import { answerFromRows, costSheetNotOnRecord } from '../rowsAnswer'
import { executeWithFallbackChain } from '../../ai/fallbackChain'
import { OUTAGE_NOTICE } from '../../ai/outageNotice'

// Plan of 27 Oct, Day 0 task 3: with every provider down, price, possession,
// RERA, payment plan and cost sheet still get an answer from rows; only
// open-ended questions get the outage notice.

const project = {
  name: 'Test Heights',
  status: 'under_construction',
  possession_date: '2027-06-01',
  rera_number: 'UPRERAPRJ000001',
  unit_types: [{ name: 'Classic', bhk: 3, super_area_sqft: 1500, price_min_cr: 1.5, price_max_cr: 1.7 }],
  payment_plans: [{ plan_name: 'Construction linked', description: '10% at booking' }],
}

test('the four row topics answer from rows', () => {
  assert.match(answerFromRows(project, 'price of Test Heights')!, /₹1\.5 Cr – ₹1\.7 Cr/)
  assert.match(answerFromRows(project, 'possession date of Test Heights')!, /Jun 2027/)
  assert.match(answerFromRows(project, 'rera number of Test Heights')!, /UPRERAPRJ000001/)
  assert.match(answerFromRows(project, 'payment plan of Test Heights')!, /Construction linked/)
})

test('a field we do not hold is said to be not on record', () => {
  const bare = { name: 'Bare' }
  assert.match(answerFromRows(bare, 'rera of Bare')!, /not on record for Bare/)
  assert.match(answerFromRows(bare, 'price of Bare')!, /not on record for Bare/)
})

test('an open-ended question gets no rows answer', () => {
  assert.equal(answerFromRows(project, 'tell me about the neighbourhood vibe'), null)
})

test('every provider down: the chain shows the rows answer, not the notice', async () => {
  const prev = { NODE_ENV: process.env.NODE_ENV, LLM_STUB: process.env.LLM_STUB, LLM_STUB_MODE: process.env.LLM_STUB_MODE }
  Object.assign(process.env, { NODE_ENV: 'test', LLM_STUB: '1', LLM_STUB_MODE: 'outage' })
  try {
    const run = async (rows: () => string | null) => {
      const tokens: string[] = []
      const r = await executeWithFallbackChain({
        systemPrompt: 's', messages: [{ role: 'user', content: 'q' }],
        send: (ev: string, d: any) => { if (ev === 'token') tokens.push(d.token) },
        onToolCall: async () => ({}), config: { maxTokens: 10, tools: false }, answerFromRows: rows,
      } as any)
      return { r, shown: tokens.join('') }
    }
    const cost = await run(() => costSheetNotOnRecord('Bare'))
    assert.match(cost.shown, /Cost sheet:\*\* not on record for Bare/)
    assert.ok(!cost.shown.includes(OUTAGE_NOTICE))
    assert.equal(cost.r.degraded, true)

    const open = await run(() => null)
    assert.ok(open.r.text === OUTAGE_NOTICE)
  } finally {
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
})
