import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canManageAccess, canInvite, type AccessActor, type AccessTarget } from '../accessHierarchy'

const BUILDER_A = 'builder-a'
const BUILDER_B = 'builder-b'
const PARTNER_A = 'partner-a'
const PARTNER_B = 'partner-b'

function actor(role: AccessActor['role'], over: Partial<AccessActor> = {}): AccessActor {
  return { adminUserId: 'actor', role, builderId: null, partnerId: null, ...over }
}
function target(role: AccessTarget['role'], over: Partial<AccessTarget> = {}): AccessTarget {
  return { adminUserId: 'target', role, builderId: null, partnerId: null, ...over }
}

describe('who may switch off whose login', () => {
  it('nobody can revoke themselves', () => {
    // The rail exists so the last super admin cannot lock the company out of
    // its own admin panel with one click and no way back in.
    const self = actor('SUPER_ADMIN', { adminUserId: 'same' })
    assert.equal(canManageAccess(self, target('SUPER_ADMIN', { adminUserId: 'same' })).allowed, false)
  })

  it('a super admin can revoke every other role', () => {
    const sa = actor('SUPER_ADMIN')
    for (const role of ['SUPER_ADMIN', 'ANALYST', 'SALES', 'BUILDER', 'PARTNER'] as const) {
      assert.equal(canManageAccess(sa, target(role)).allowed, true, role)
    }
  })

  it('staff who are not owners cannot revoke anyone', () => {
    // An analyst maintains the catalogue and a salesperson works leads. Neither
    // decides who else may sign in.
    for (const role of ['ANALYST', 'SALES'] as const) {
      assert.equal(canManageAccess(actor(role), target('SALES')).allowed, false, role)
      assert.equal(canManageAccess(actor(role), target('BUILDER')).allowed, false, role)
    }
  })

  describe('a builder', () => {
    const b = actor('BUILDER', { builderId: BUILDER_A })

    it('can revoke another admin at their own organisation', () => {
      assert.equal(canManageAccess(b, target('BUILDER', { builderId: BUILDER_A })).allowed, true)
    })

    it('cannot revoke an admin at a different organisation', () => {
      assert.equal(canManageAccess(b, target('BUILDER', { builderId: BUILDER_B })).allowed, false)
    })

    it('can revoke a partner they onboarded', () => {
      const p = target('PARTNER', { partnerId: PARTNER_A, partnerOwnerBuilderId: BUILDER_A })
      assert.equal(canManageAccess(b, p).allowed, true)
    })

    it('cannot revoke a partner another builder onboarded', () => {
      const p = target('PARTNER', { partnerId: PARTNER_B, partnerOwnerBuilderId: BUILDER_B })
      assert.equal(canManageAccess(b, p).allowed, false)
    })

    it('cannot revoke a partner with no owning builder', () => {
      // Legacy rows predating builder ownership. Absent is not a match.
      const p = target('PARTNER', { partnerId: PARTNER_A, partnerOwnerBuilderId: null })
      assert.equal(canManageAccess(b, p).allowed, false)
    })

    it('cannot touch PropFyndr staff', () => {
      // The one that matters most: an external account must never be able to
      // switch off an internal one, whatever else it legitimately owns.
      for (const role of ['SUPER_ADMIN', 'ANALYST', 'SALES'] as const) {
        assert.equal(canManageAccess(b, target(role)).allowed, false, role)
      }
    })

    it('is refused when the account carries no builder scope', () => {
      const scopeless = actor('BUILDER', { builderId: null })
      assert.equal(canManageAccess(scopeless, target('BUILDER', { builderId: BUILDER_A })).allowed, false)
    })
  })

  describe('a channel partner', () => {
    const p = actor('PARTNER', { partnerId: PARTNER_A })

    it('can revoke another admin at their own firm', () => {
      assert.equal(canManageAccess(p, target('PARTNER', { partnerId: PARTNER_A })).allowed, true)
    })

    it('cannot revoke an admin at another firm', () => {
      assert.equal(canManageAccess(p, target('PARTNER', { partnerId: PARTNER_B })).allowed, false)
    })

    it('cannot revoke the builder who onboarded them', () => {
      // The relationship runs one way. A partner able to switch off its builder
      // would invert it.
      const b = target('BUILDER', { builderId: BUILDER_A })
      assert.equal(canManageAccess(p, b).allowed, false)
    })

    it('cannot touch PropFyndr staff', () => {
      assert.equal(canManageAccess(p, target('SUPER_ADMIN')).allowed, false)
    })
  })

  it('explains why without revealing whether the target exists', () => {
    const b = actor('BUILDER', { builderId: BUILDER_A })
    const d = canManageAccess(b, target('BUILDER', { builderId: BUILDER_B }))
    assert.ok(d.reason)
    assert.ok(!d.reason!.includes(BUILDER_B), 'the reason must not leak the other organisation')
  })
})

describe('who may create a login', () => {
  it('only a super admin', () => {
    assert.equal(canInvite({ adminUserId: 'a', role: 'SUPER_ADMIN', builderId: null, partnerId: null }).allowed, true)
    for (const role of ['ANALYST', 'SALES', 'BUILDER', 'PARTNER'] as const) {
      assert.equal(canInvite({ adminUserId: 'a', role, builderId: 'b', partnerId: 'p' }).allowed, false, role)
    }
  })

  it('is stricter than revocation, deliberately', () => {
    // Revoking reduces access and is reversible; creating grants it. A builder
    // may switch their own admin off but may not mint a new one — they request
    // access and we approve it.
    const b: AccessActor = { adminUserId: 'a', role: 'BUILDER', builderId: BUILDER_A, partnerId: null }
    assert.equal(canManageAccess(b, target('BUILDER', { builderId: BUILDER_A })).allowed, true)
    assert.equal(canInvite(b).allowed, false)
  })
})
