// The browser half of the role matrix.
//
// These predicates decide which buttons render. They are NOT security — the
// server refuses the call either way (backend/src/lib/adminPolicy.ts) — but
// getting them wrong shows a salesperson a "Delete builder" button whose only
// possible outcome is a permission error, which is how a console starts feeling
// broken.
//
// Kept in step with the server matrix by hand. If a cell changes there, it
// changes here, and `backend/scripts/audit-page-permissions.ts` is what notices
// when the two disagree.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canEditCatalogue, canDeleteRecords, isOwner, type AdminRole } from '../adminRole'

const ROLES: AdminRole[] = ['SUPER_ADMIN', 'ANALYST', 'SALES', 'BUILDER', 'PARTNER']

describe('canEditCatalogue — projects, builders, content', () => {
  for (const [role, expected] of [
    ['SUPER_ADMIN', true],
    ['ANALYST', true],
    ['SALES', false],
    ['BUILDER', false],
    ['PARTNER', false],
  ] as Array<[AdminRole, boolean]>) {
    it(`${role} -> ${expected}`, () => assert.equal(canEditCatalogue(role), expected))
  }
})

describe('canDeleteRecords — deletes and bulk imports', () => {
  for (const [role, expected] of [
    ['SUPER_ADMIN', true],
    ['ANALYST', false],
    ['SALES', false],
  ] as Array<[AdminRole, boolean]>) {
    it(`${role} -> ${expected}`, () => assert.equal(canDeleteRecords(role), expected))
  }
})

describe('isOwner — team, outbox, audit trail, spend', () => {
  it('is super admin alone', () => {
    assert.equal(isOwner('SUPER_ADMIN'), true)
    for (const role of ROLES.filter((r) => r !== 'SUPER_ADMIN')) {
      assert.equal(isOwner(role), false, role)
    }
  })

  it('is false while the role is still unknown', () => {
    // isOwner gates the most sensitive surfaces. Unlike the other two it must
    // NOT be optimistic before the role has loaded, or spend figures flash on
    // screen for an analyst on first paint.
    assert.equal(isOwner(null), false)
  })
})

describe('an unknown role does not flicker the UI', () => {
  it('assumes permission for the ordinary predicates until the role arrives', () => {
    // null means "/portal/me has not answered yet". Returning false here would
    // mount the page without its controls and then pop them in, which reads as
    // a bug to the people who DO have them. The server is still the authority.
    assert.equal(canEditCatalogue(null), true)
    assert.equal(canDeleteRecords(null), true)
  })
})
