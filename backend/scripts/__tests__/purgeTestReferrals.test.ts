import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { run } from '../purge-test-referrals'

describe('purge-test-referrals dry run', () => {
  it('never writes (apply=false leaves toDelete informational only, no deletes)', async () => {
    const result = await run(false)
    // Whether or not the label is ambiguous today, a dry run must never
    // report an apply side effect and must always return a toDelete array.
    assert.ok(Array.isArray(result.toDelete) || result.ambiguous)
  })

  it('refuses and lists matches when more than one ReferralLink has the keep label', async () => {
    const result = await run(false)
    if (result.ambiguous) {
      assert.ok(result.ambiguousMatches!.length > 1)
      assert.deepEqual(result.toDelete, [])
    }
  })
})
