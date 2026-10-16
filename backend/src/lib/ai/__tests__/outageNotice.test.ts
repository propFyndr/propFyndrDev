import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OUTAGE_NOTICE, outageTokenEvent } from '../outageNotice'

describe('outage notice token event', () => {
  it('retracts a half-written answer instead of appending to it', () => {
    // followup-coverage 2026-10-16: "The EMI would be ₹1,02,108 per month." then the notice.
    assert.deepEqual(outageTokenEvent(true), { token: OUTAGE_NOTICE, replace: true })
  })
  it('appends normally when nothing was shown', () => {
    assert.deepEqual(outageTokenEvent(false), { token: OUTAGE_NOTICE })
  })
})
