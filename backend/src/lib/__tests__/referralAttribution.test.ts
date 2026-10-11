import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAttribution, type AttributionLookup } from '../referralAttribution'

function lookup(overrides: Partial<AttributionLookup>): AttributionLookup {
  return {
    getLink: () => null,
    hasPriorChats: () => false,
    getVisit: () => null,
    getVisitByGuestToken: () => null,
    ...overrides,
  }
}

describe('resolveAttribution', () => {
  it('a device that already has a visit returns alreadyVisited and changes nothing', () => {
    const result = resolveAttribution('guest-1', 'K9X2ABCD', lookup({
      getVisit: (gt) => gt === 'guest-1' ? { own_code: 'OWN1CODE', root_code: 'ROOT1XX', generation: 2 } : null,
    }))
    assert.equal(result.alreadyVisited, true)
  })

  it('first device on a ROOT link with no holder becomes the holder at generation 1', () => {
    const result = resolveAttribution('guest-1', 'K9X2ABCD', lookup({
      getLink: (code) => code === 'K9X2ABCD' ? { kind: 'ROOT', holder_guest_token: null, owner_guest_token: null, revoked_at: null } : null,
    }))
    assert.equal(result.alreadyVisited, false)
    assert.equal(result.generation, 1)
    assert.equal(result.parent_guest_token, null)
    assert.equal(result.depth_inferred, false)
    assert.equal(result.root_code, 'K9X2ABCD')
    assert.equal(result.becameHolderOf, 'K9X2ABCD')
  })

  it('a later device on the same ROOT link is attributed to the holder, depth inferred', () => {
    const result = resolveAttribution('guest-2', 'K9X2ABCD', lookup({
      getLink: (code) => code === 'K9X2ABCD' ? { kind: 'ROOT', holder_guest_token: 'guest-1', owner_guest_token: null, revoked_at: null } : null,
      getVisitByGuestToken: (gt) => gt === 'guest-1' ? { root_code: 'K9X2ABCD', generation: 1 } : null,
    }))
    assert.equal(result.generation, 2)
    assert.equal(result.parent_guest_token, 'guest-1')
    assert.equal(result.depth_inferred, true)
    assert.equal(result.root_code, 'K9X2ABCD')
    assert.equal(result.becameHolderOf, null)
  })

  it('a PERSONAL code chains to its owner: parent + 1, same root, not inferred', () => {
    const result = resolveAttribution('guest-3', 'OWN1CODE', lookup({
      getLink: (code) => code === 'OWN1CODE' ? { kind: 'PERSONAL', holder_guest_token: null, owner_guest_token: 'guest-2' } as any : null,
      getVisitByGuestToken: (gt) => gt === 'guest-2' ? { root_code: 'K9X2ABCD', generation: 2 } : null,
    }))
    assert.equal(result.generation, 3)
    assert.equal(result.parent_guest_token, 'guest-2')
    assert.equal(result.depth_inferred, false)
    assert.equal(result.root_code, 'K9X2ABCD')
  })

  it('a device with prior chats arriving on a code is organic, prior_user is true, no parent', () => {
    const result = resolveAttribution('guest-4', 'K9X2ABCD', lookup({
      getLink: (code) => code === 'K9X2ABCD' ? { kind: 'ROOT', holder_guest_token: 'guest-1', owner_guest_token: null, revoked_at: null } : null,
      hasPriorChats: (gt) => gt === 'guest-4',
    }))
    assert.equal(result.prior_user, true)
    assert.equal(result.parent_guest_token, null)
    assert.equal(result.generation, 0)
    assert.equal(result.arrived_via_code, 'K9X2ABCD')
    // root_code is null here — the caller sets it to the device's own freshly
    // minted code once that code exists, since this function doesn't mint it.
    assert.equal(result.root_code, null)
  })

  it('an unknown or missing code is organic: generation 0, root is the device itself', () => {
    const result = resolveAttribution('guest-5', 'NOPE0000', lookup({}))
    assert.equal(result.generation, 0)
    assert.equal(result.parent_guest_token, null)
    assert.equal(result.depth_inferred, false)
    assert.equal(result.arrived_via_code, 'NOPE0000')
    assert.equal(result.root_code, null)
  })

  it('no code at all (organic visitor) behaves the same as an unknown code', () => {
    const result = resolveAttribution('guest-6', null, lookup({}))
    assert.equal(result.generation, 0)
    assert.equal(result.arrived_via_code, null)
    assert.equal(result.root_code, null)
  })

  it('a revoked ROOT link is treated as organic', () => {
    const result = resolveAttribution('guest-7', 'DEAD0000', lookup({
      getLink: (code) => code === 'DEAD0000' ? { kind: 'ROOT', holder_guest_token: 'guest-1', owner_guest_token: null, revoked_at: new Date() } : null,
    }))
    assert.equal(result.generation, 0)
    assert.equal(result.parent_guest_token, null)
    assert.equal(result.becameHolderOf, null)
  })
})
