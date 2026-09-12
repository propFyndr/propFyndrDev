import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * `requireAdmin` validates that a session exists and never reads its role.
 * `adminAuth` and `adminIdentity` share one session store and one key prefix,
 * so a BUILDER or PARTNER token satisfies it — which, before the guard this
 * test protects, meant a channel partner could read every lead on the platform
 * from /admin/leads.
 *
 * The fix is one `router.use(requireRole(...))` placed after the two /auth
 * routes, relying on Express matching in registration order. That makes the
 * protection POSITIONAL, and positional protection fails silently: a new route
 * added above the guard is simply unguarded, with nothing to notice it. Hence a
 * source-order test rather than a behavioural one.
 */
describe('admin router role floor', () => {
  const src = readFileSync(join(__dirname, '..', 'admin.ts'), 'utf8')

  const guardAt = src.indexOf("router.use(requireRole(")
  const identityAt = src.indexOf('router.use(requireIdentity)')

  it('the role floor is installed', () => {
    assert.ok(guardAt > -1, 'router.use(requireRole(...)) has been removed from admin.ts')
    assert.ok(identityAt > -1, 'router.use(requireIdentity) has been removed from admin.ts')
    assert.ok(identityAt < guardAt, 'requireIdentity must run before requireRole, which reads the session it attaches')
  })

  it('denies BUILDER and PARTNER', () => {
    const call = src.slice(guardAt, src.indexOf(')', guardAt) + 1)
    for (const role of ['BUILDER', 'PARTNER']) {
      assert.ok(
        !call.includes(role),
        `${role} is allowed through the admin role floor — it has its own console and must not reach /admin/*`,
      )
    }
    assert.ok(call.includes('SUPER_ADMIN'), 'SUPER_ADMIN must be allowed')
  })

  it('only the two auth routes are registered above the floor', () => {
    const above = src.slice(0, guardAt)
    const routes = [...above.matchAll(/^router\.(get|post|put|patch|delete)\('([^']*)'/gm)].map((m) => m[2])

    assert.deepEqual(
      [...new Set(routes)].sort(),
      ['/auth'],
      'a route was registered above the role floor and is therefore reachable by any signed-in user, ' +
        'including a builder or a channel partner. Move it below the router.use() guards.',
    )
  })
})
