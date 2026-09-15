import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { memoryKeyFor } from '../saved'

// SavedProperty stores a guest as `guest_<token>` in its own user_id column,
// while UserMemory stores the same person in guest_token. Getting this backwards
// writes a memory row that nothing ever reads — which is how projects_saved sat
// at 0 for every lead and left 760 of 763 of them scored COLD.
describe('memoryKeyFor', () => {
  it('routes a guest to guest_token, with the prefix stripped', () => {
    assert.deepEqual(memoryKeyFor('guest_abc123'), { guest_token: 'abc123' })
  })

  it('routes an authenticated user to user_id, untouched', () => {
    assert.deepEqual(memoryKeyFor('9f1c2e44-0000-4a11-9c3a-1b2c3d4e5f60'), {
      user_id: '9f1c2e44-0000-4a11-9c3a-1b2c3d4e5f60',
    })
  })

  it('does not mistake a user id that merely contains "guest" for a guest', () => {
    assert.deepEqual(memoryKeyFor('user-guest-relations-42'), { user_id: 'user-guest-relations-42' })
  })
})
