// The admin role matrix, as a table.
//
// Every row here was a live probe against a real SALES token before the policy
// existed, and every `false` below returned 2xx at the time: SALES created a
// builder, published a blog post, read the audit log and the AI spend, and
// cleared authorization on `DELETE /projects/:id`. `admin.ts` guarded all of
// them with `requireAdmin`, which reads no role.
//
// Pinned as a table rather than as prose because the matrix is a product
// decision, not an implementation detail — someone changing a cell should have
// to change a line that says what the cell is.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decide } from '../adminPolicy'

type Role = 'SUPER_ADMIN' | 'ANALYST' | 'SALES'

/** [method, path, { role: mayDoIt }] */
const MATRIX: Array<[string, string, Record<Role, boolean>]> = [
  // ── Leads: the sales surface. ───────────────────────────────────────────
  ['GET', '/leads', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
  ['PATCH', '/leads/abc-123', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
  ['GET', '/callbacks', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
  ['PATCH', '/callbacks/abc-123', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],

  // ── Catalogue: sales reads it to answer a buyer, never edits it. ────────
  ['GET', '/projects', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
  ['GET', '/projects/abc-123', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
  ['GET', '/builders', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
  ['GET', '/sectors', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
  ['GET', '/conversations', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
  ['PATCH', '/projects/abc-123', { SUPER_ADMIN: true, ANALYST: true, SALES: false }],
  ['POST', '/builders', { SUPER_ADMIN: true, ANALYST: true, SALES: false }],
  ['PATCH', '/builders/abc-123', { SUPER_ADMIN: true, ANALYST: true, SALES: false }],
  ['PUT', '/sectors/abc-123', { SUPER_ADMIN: true, ANALYST: true, SALES: false }],
  ['PUT', '/projects/abc-123/specs', { SUPER_ADMIN: true, ANALYST: true, SALES: false }],
  ['PATCH', '/intelligence/abc-123', { SUPER_ADMIN: true, ANALYST: true, SALES: false }],
  ['POST', '/blog', { SUPER_ADMIN: true, ANALYST: true, SALES: false }],
  ['POST', '/news', { SUPER_ADMIN: true, ANALYST: true, SALES: false }],

  // ── Irreversible and bulk: the person who can restore it. ───────────────
  ['DELETE', '/projects/abc-123', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['DELETE', '/builders/abc-123', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['POST', '/projects/bulk-import', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],

  // ── Oversight: not read by the people it covers. ────────────────────────
  ['GET', '/audit-logs', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['GET', '/analytics/ai-costs', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['GET', '/team', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['POST', '/team/invite', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['DELETE', '/team/abc-123', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['GET', '/outbox', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],

  // Other analytics stay open to staff — only spend is carved out.
  ['GET', '/analytics/funnel', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
  ['GET', '/analytics/market-demand', { SUPER_ADMIN: true, ANALYST: true, SALES: true }],
]

describe('admin role matrix', () => {
  for (const [method, path, expected] of MATRIX) {
    for (const role of ['SUPER_ADMIN', 'ANALYST', 'SALES'] as Role[]) {
      const want = expected[role]
      it(`${role} ${want ? 'may' : 'may NOT'} ${method} ${path}`, () => {
        assert.equal(decide(role, method, path).allowed, want)
      })
    }
  }
})

describe('a project changelog is not the company audit trail', () => {
  // The Changelog tab on /admin/projects/[id] calls
  // /audit-logs?entity_id=<project>. Refusing an analyst the history of data
  // they maintain breaks the tab for the person it exists for; the unfiltered
  // log stays with SUPER_ADMIN.
  it('lets an analyst read the history of one entity', () => {
    assert.equal(decide('ANALYST', 'GET', '/audit-logs', { entity_id: 'abc-123' }).allowed, true)
  })

  it('still refuses the analyst the unfiltered log', () => {
    assert.equal(decide('ANALYST', 'GET', '/audit-logs').allowed, false)
    assert.equal(decide('ANALYST', 'GET', '/audit-logs', { limit: '100' }).allowed, false)
    assert.equal(decide('ANALYST', 'GET', '/audit-logs', { entity_id: '' }).allowed, false)
  })

  it('refuses sales either way', () => {
    assert.equal(decide('SALES', 'GET', '/audit-logs', { entity_id: 'abc-123' }).allowed, false)
    assert.equal(decide('SALES', 'GET', '/audit-logs').allowed, false)
  })
})

describe('every role may change its own password', () => {
  // Not a matrix decision — `adminGuard` exempts /auth-flows/change from the
  // role floor entirely, because it acts on the caller's own account. Pinned
  // here so nobody folds it back into the matrix and locks people out.
  it('is not governed by the matrix', () => {
    // If this ever starts returning true for SALES via the matrix, the exempt
    // list in adminGuard has been removed and portal users cannot change their
    // password.
    assert.equal(decide('SALES', 'POST', '/auth-flows/change').allowed, false)
  })
})

describe('the matrix denies by default', () => {
  it('refuses a SALES write to a path nobody thought about', () => {
    // The property that matters: adding a route does not quietly grant it.
    assert.equal(decide('SALES', 'POST', '/some-feature-added-next-month').allowed, false)
    assert.equal(decide('SALES', 'DELETE', '/some-feature-added-next-month/x').allowed, false)
  })

  it('still lets SALES read a path nobody thought about', () => {
    // Reads inside the staff area are the floor's business, not this file's;
    // a new read-only console should not need a policy edit to be visible.
    assert.equal(decide('SALES', 'GET', '/some-feature-added-next-month').allowed, true)
  })

  it('refuses a role that is not staff at all', () => {
    // adminAreaGuard already refuses these at the door. Stated anyway.
    for (const role of ['BUILDER', 'PARTNER'] as unknown as Role[]) {
      assert.equal(decide(role, 'GET', '/leads').allowed, false, role)
    }
  })

  it('does not leak whether a restricted path exists', () => {
    const d = decide('SALES', 'GET', '/audit-logs')
    assert.equal(d.allowed, false)
    assert.match(d.reason ?? '', /super admin/i)
  })
})
