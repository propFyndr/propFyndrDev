import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseJevDecision } from '../decision'

describe('parseJevDecision', () => {
  it('reads the jev block beside the intent fields', () => {
    const d = parseJevDecision('{"bhk":[3],"jev":{"task":"discover","source":["db"],"shape":"advisory","fields":[],"clarify":null}}')
    assert.deepEqual(d, { task: 'discover', sources: ['db'], shape: 'advisory', fields: [], clarify: null, via: 'llm' })
  })

  it('returns null when the block is missing or the task is not ours', () => {
    assert.equal(parseJevDecision('{"bhk":[3]}'), null)
    assert.equal(parseJevDecision('{"jev":{"task":"book_a_flight"}}'), null)
    assert.equal(parseJevDecision('not json'), null)
  })

  it('orders sources canonically and drops unknown ones', () => {
    const d = parseJevDecision('{"jev":{"task":"market_explain","source":["web","db","scrape"]}}')
    assert.deepEqual(d?.sources, ['db', 'web'])
  })

  it('drops any field outside the topic allowlist, so no column name can leak through', () => {
    const d = parseJevDecision('{"jev":{"task":"project_fact","fields":["payment_plan","embedding","saved_by"]}}')
    assert.deepEqual(d?.fields, ['payment_plan'])
  })

  it('treats an empty clarify as none', () => {
    assert.equal(parseJevDecision('{"jev":{"task":"meta","clarify":"  "}}')?.clarify, null)
  })
})
