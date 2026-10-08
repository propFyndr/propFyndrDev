// A successful admin login clears its IP bucket, so only failures accumulate
// toward the 5/15min limit. Runs on the in-memory limiter — no network.
import { test } from 'node:test'
import assert from 'node:assert/strict'

delete process.env.UPSTASH_REDIS_REST_URL
delete process.env.UPSTASH_REDIS_REST_TOKEN
delete process.env.DISABLE_RATE_LIMIT
process.env.NODE_ENV = 'production' // the limiter is a no-op under 'test'

import { checkRateLimit, resetRateLimit } from '../cache'

test('resetRateLimit lets successes not count toward the login limit', async () => {
  const key = 'admin:login:203.0.113.7'
  for (let i = 0; i < 5; i++) assert.equal((await checkRateLimit(key, 5, 900)).allowed, true)
  assert.equal((await checkRateLimit(key, 5, 900)).allowed, false, '6th attempt blocked')

  await resetRateLimit(key)
  assert.equal((await checkRateLimit(key, 5, 900)).allowed, true, 'bucket cleared after success')
})
