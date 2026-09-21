import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { setCached, getCached, deleteCached } from '../../lib/cache'
import { revokeAllSessions, createIdentitySession } from '../../lib/adminIdentity'

describe('Phase 1.4: Admin Auth Lockout and Session Revocation', () => {
  const adminSrc = readFileSync(join(__dirname, '..', 'admin.ts'), 'utf8')
  const testEmail = 'lockout-test@propfyndr.in'

  it('admin.ts enforces account lockout check before password verification', () => {
    assert.ok(adminSrc.includes('admin:lockout:'), 'admin.ts must check admin:lockout key')
    assert.ok(adminSrc.includes('res.status(423)'), 'admin.ts must return HTTP 423 on lockout')
    assert.ok(adminSrc.includes('attempts >= 5'), 'admin.ts must lock account after 5 failed attempts')
    assert.ok(adminSrc.includes('deleteCached(`admin:lockout:'), 'admin.ts must clear lockout on valid login')
  })

  it('cache stores and expires lockout state properly', async () => {
    await deleteCached(`admin:lockout:${testEmail}`)
    let isLocked = await getCached<boolean>(`admin:lockout:${testEmail}`)
    assert.equal(isLocked, null)

    await setCached(`admin:lockout:${testEmail}`, true, 900)
    isLocked = await getCached<boolean>(`admin:lockout:${testEmail}`)
    assert.equal(isLocked, true)

    await deleteCached(`admin:lockout:${testEmail}`)
    isLocked = await getCached<boolean>(`admin:lockout:${testEmail}`)
    assert.equal(isLocked, null)
  })

  it('revokeAllSessions purges all active tokens for an admin user ID', async () => {
    const dummyUserId = 'test-lockout-user-123'
    const token1 = await createIdentitySession({
      ip: '127.0.0.1',
      userAgent: 'test-agent-1',
      adminUserId: dummyUserId,
      email: testEmail,
      role: 'SUPER_ADMIN',
      builderId: null,
      partnerId: null,
    })

    const token2 = await createIdentitySession({
      ip: '127.0.0.1',
      userAgent: 'test-agent-2',
      adminUserId: dummyUserId,
      email: testEmail,
      role: 'SUPER_ADMIN',
      builderId: null,
      partnerId: null,
    })

    assert.ok(typeof token1 === 'string' && token1.length > 0)
    assert.ok(typeof token2 === 'string' && token2.length > 0)

    const revokedCount = await revokeAllSessions(dummyUserId)
    assert.ok(revokedCount >= 2, `Expected at least 2 sessions revoked, got ${revokedCount}`)
  })
})
