import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isPublicAdminPath } from '../../lib/adminGuard'

/**
 * The admin surface is eight routers, not one. A guard inside admin.ts covers
 * only admin.ts — which is how /admin/promotions, /admin/conversations,
 * /admin/email and /admin/intelligence stayed reachable by any signed-in user
 * after the in-file role floor was added. Conversation transcripts carry buyer
 * names, phone numbers and lead summaries, so that was PII, not just privilege.
 *
 * The gate is therefore mounted on the PATH PREFIX in index.ts. These tests
 * protect the two properties that makes correct: the mount exists and runs
 * before the routers, and the public exemptions stay exactly two.
 */
describe('admin area guard', () => {
  const index = readFileSync(join(__dirname, '..', '..', 'index.ts'), 'utf8')

  it('is mounted on the admin prefix', () => {
    assert.ok(
      index.includes("app.use('/api/v1/admin', adminAreaGuard)"),
      'the versioned admin prefix is no longer gated',
    )
    assert.ok(
      index.includes("app.use('/api/admin', adminAreaGuard)"),
      'the unversioned /api/admin prefix is no longer gated — adminPromotionsRouter is mounted there too',
    )
  })

  it('runs before every admin router', () => {
    const guardAt = index.indexOf("app.use('/api/v1/admin', adminAreaGuard)")
    assert.ok(guardAt > -1)

    const adminMounts = [...index.matchAll(/^app\.use\('(\/api\/v1\/admin[^']*|\/api\/admin[^']*)',\s*(\w+)\)/gm)]
      .filter(([, , handler]) => handler !== 'adminAreaGuard')

    assert.ok(adminMounts.length > 0, 'no admin routers found — has the mount block moved?')
    for (const match of adminMounts) {
      assert.ok(
        (match.index ?? 0) > guardAt,
        `${match[1]} is mounted before the guard and is therefore ungated`,
      )
    }
  })

  it('exempts login and invite-acceptance, and nothing else', () => {
    // Without these two the product breaks in ways that look like a bad
    // password: nobody can sign in, and no invited builder or partner can ever
    // set one.
    assert.equal(isPublicAdminPath('/auth'), true)
    assert.equal(isPublicAdminPath('/team/accept-invite'), true)

    for (const path of [
      '/promotions',
      '/conversations',
      '/leads',
      '/team',
      '/email/send',
      '/intelligence/batch',
      '/channel-partners',
      '/projects',
      // Near-misses: a prefix match here would reopen the hole.
      '/authx',
      '/auth/../leads',
      '/team/accept-invite-not-really',
    ]) {
      assert.equal(isPublicAdminPath(path), false, `${path} must require a staff session`)
    }
  })
})
