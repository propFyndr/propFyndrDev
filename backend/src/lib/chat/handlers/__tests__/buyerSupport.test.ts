import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesPressureQuestion, matchesSiteVisitQuestion, matchesCompromiseQuestion, PRESSURE_ANSWER, SITE_VISIT_ANSWER, COMPROMISE_ANSWER } from '../buyerSupport'

describe('buyer support questions', () => {
  it('claims a booking deadline, a site-visit checklist and a trade-off question', () => {
    assert.ok(matchesPressureQuestion('The salesperson says prices will rise soon and I should book today. What would make you advise me to walk away?'))
    assert.ok(matchesSiteVisitQuestion('what should I inspect during a site visit before deciding'))
    assert.ok(matchesCompromiseQuestion('What should I compromise on at this budget?'))
  })

  it('leaves ordinary project, price and booking-a-visit questions alone', () => {
    assert.ok(!matchesPressureQuestion('what is the price of gulshan botnia'))
    assert.ok(!matchesSiteVisitQuestion('I want to schedule a site visit'))
    assert.ok(!matchesCompromiseQuestion('compare sector 150 and sector 137'))
  })

  it('states no price, and the only percentage is the RERA advance limit', () => {
    for (const a of [PRESSURE_ANSWER, SITE_VISIT_ANSWER, COMPROMISE_ANSWER]) {
      assert.doesNotMatch(a, /₹\s*\d/)
      assert.match(a, /\?\s*$/, 'ends with the next question')
    }
    const percentages = [PRESSURE_ANSWER, SITE_VISIT_ANSWER, COMPROMISE_ANSWER].join('\n').match(/\d+\s*%/g)
    assert.deepEqual(percentages, ['10%'])
  })

  it('cites RERA Section 13 for that limit', () => {
    assert.match(PRESSURE_ANSWER, /10% of the cost as an advance/)
    assert.match(PRESSURE_ANSWER, /Section 13/)
  })

  it('writes what to check as GFM task items, so the chat can render tickable boxes', () => {
    const tasks = (a: string) => (a.match(/^- \[ \] /gm) ?? []).length
    assert.ok(tasks(SITE_VISIT_ANSWER) >= 8)
    assert.equal(tasks(PRESSURE_ANSWER), 5)
    assert.equal(tasks(COMPROMISE_ANSWER), 0, 'an ordering of trade-offs is not a to-do list')
  })
})
