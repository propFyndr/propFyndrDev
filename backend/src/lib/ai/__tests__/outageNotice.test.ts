import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OUTAGE_NOTICE, outageTokenEvent, outageOverShownAnswer, isOutageNotice, DATABASE_NOTICE, isDatabaseUnavailable } from '../outageNotice'

describe('outage notice token event', () => {
  it('retracts a half-written answer instead of appending to it', () => {
    // followup-coverage 2026-10-16: "The EMI would be ₹1,02,108 per month." then the notice.
    assert.deepEqual(outageTokenEvent(true), { token: OUTAGE_NOTICE, replace: true })
  })
  it('appends normally when nothing was shown', () => {
    assert.deepEqual(outageTokenEvent(false), { token: OUTAGE_NOTICE })
  })
})

// Day 7 corpus, 26 Oct: a ranking table or cards, then "our AI service is briefly unavailable".
describe('outage after code already answered', () => {
  it('keeps the table and closes without the notice', () => {
    const t = outageOverShownAnswer('| Budget | Project |\n\n', 0)!
    assert.match(t, /^\| Budget \| Project \|/)
    assert.ok(!isOutageNotice(t))
  })
  it('points at the cards when cards were shown', () => {
    assert.match(outageOverShownAnswer('', 4)!, /on the cards above/)
  })
  it('is null when nothing was shown, so the notice stands', () => {
    assert.equal(outageOverShownAnswer('', 0), null)
  })
})

// 6 Nov load test: Prisma P2024 (pool of 3) was reported to buyers as "high traffic".
describe('database failure notice', () => {
  it('recognises pool timeouts, unreachable and dropped connections', () => {
    for (const code of ['P2024', 'P1001', 'P1002', 'P1008', 'P1017', 'P2037']) assert.ok(isDatabaseUnavailable({ code }), code)
    assert.ok(isDatabaseUnavailable({ name: 'PrismaClientInitializationError' }))
  })
  it('does not treat other errors as a database outage', () => {
    for (const e of [new Error('429 rate limit'), { code: 'P2025' }, { code: 'ECONNRESET' }, null, undefined, 'P2024']) assert.ok(!isDatabaseUnavailable(e))
  })
  it('names the database, not traffic, and still counts as an outage reply so it is never cached', () => {
    assert.match(DATABASE_NOTICE, /database is briefly unreachable/)
    assert.doesNotMatch(DATABASE_NOTICE, /traffic/i)
    assert.ok(isOutageNotice(DATABASE_NOTICE))
  })
})

it('with cards, uses the row-written summary when one is given', () => {
  assert.equal(outageOverShownAnswer('', 6, '**6 projects match** 3 BHK in Noida.'), '**6 projects match** 3 BHK in Noida.')
})
