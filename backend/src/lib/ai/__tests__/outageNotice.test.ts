import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OUTAGE_NOTICE, outageTokenEvent, outageOverShownAnswer, isOutageNotice } from '../outageNotice'

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

it('with cards, uses the row-written summary when one is given', () => {
  assert.equal(outageOverShownAnswer('', 6, '**6 projects match** 3 BHK in Noida.'), '**6 projects match** 3 BHK in Noida.')
})
