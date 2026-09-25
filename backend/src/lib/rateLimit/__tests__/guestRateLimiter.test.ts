import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { checkGuestRateLimit, resetGuestRateLimit } from '../guestRateLimiter'

/**
 * NODE_ENV is 'test' here, so these exercise the in-memory fallback window —
 * the path a production box takes when Upstash is unreachable. It has to hold
 * the cap on its own, because failing open on a chat endpoint means failing
 * open on the AI bill.
 */
describe('checkGuestRateLimit', () => {
  beforeEach(() => resetGuestRateLimit())

  it('allows up to the limit and refuses the one after', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await checkGuestRateLimit('guest_a', 3, 60_000)
      assert.equal(r.allowed, true, `hit ${i + 1}`)
    }
    const blocked = await checkGuestRateLimit('guest_a', 3, 60_000)
    assert.equal(blocked.allowed, false)
    assert.equal(blocked.remaining, 0)
    assert.ok(blocked.retryAfterSeconds >= 1, 'must tell the client when to come back')
  })

  it('counts each guest token separately', async () => {
    await checkGuestRateLimit('guest_b', 1, 60_000)
    assert.equal((await checkGuestRateLimit('guest_b', 1, 60_000)).allowed, false)
    assert.equal((await checkGuestRateLimit('guest_c', 1, 60_000)).allowed, true)
  })

  it('frees the slot once the window has passed', async () => {
    assert.equal((await checkGuestRateLimit('guest_d', 1, 20)).allowed, true)
    assert.equal((await checkGuestRateLimit('guest_d', 1, 20)).allowed, false)
    await new Promise((r) => setTimeout(r, 30))
    assert.equal((await checkGuestRateLimit('guest_d', 1, 20)).allowed, true)
  })

  it('does not throttle a turn that carries no guest token', async () => {
    for (let i = 0; i < 5; i++) {
      assert.equal((await checkGuestRateLimit('', 1, 60_000)).allowed, true)
    }
  })
})
