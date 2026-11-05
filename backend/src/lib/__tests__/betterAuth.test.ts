import { test } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { hashPassword } from 'better-auth/crypto'
import { verifyAnyPassword, trustedOrigins, AUTH_RATE_LIMIT } from '../betterAuth'
import { parseExport } from '../../../scripts/auth/import-supabase-users'

// Supabase stored bcrypt ($2a$10$…). An imported buyer must sign in with the
// password they already have; a new one gets Better Auth's scrypt.

test('a Supabase bcrypt hash verifies with the right password only', async () => {
  const hash = await bcrypt.hash('correct horse', 10)
  assert.match(hash, /^\$2[ab]\$10\$/)
  assert.equal(await verifyAnyPassword({ hash, password: 'correct horse' }), true)
  assert.equal(await verifyAnyPassword({ hash, password: 'wrong' }), false)
})

test('a password set through Better Auth (scrypt) still verifies', async () => {
  const hash = await hashPassword('new password 1')
  assert.doesNotMatch(hash, /^\$2/)
  assert.equal(await verifyAnyPassword({ hash, password: 'new password 1' }), true)
  assert.equal(await verifyAnyPassword({ hash, password: 'nope' }), false)
})

test('the export keeps ids, lowercases emails and drops what it cannot import', () => {
  const { users, skipped } = parseExport([
    { id: '11111111-1111-4111-8111-111111111111', email: ' Buyer@Example.com ', encrypted_password: '$2a$10$abcdefghijklmnopqrstuuJ8D3s6Yq1m3a0eH0u8m1oJ2hZxw1b2C', email_confirmed_at: '2026-10-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z', name: 'Asha' },
    { id: '22222222-2222-4222-8222-222222222222', email: 'buyer@example.com', encrypted_password: null, email_confirmed_at: null, created_at: null },
    { id: 'not-a-uuid', email: 'x@y.z', encrypted_password: null, email_confirmed_at: null, created_at: null },
    { id: '33333333-3333-4333-8333-333333333333', email: null, encrypted_password: null, email_confirmed_at: null, created_at: null },
  ])
  assert.equal(users.length, 1)
  assert.equal(users[0].id, '11111111-1111-4111-8111-111111111111')
  assert.equal(users[0].email, 'buyer@example.com')
  assert.equal(users[0].emailVerified, true)
  assert.ok(users[0].passwordHash?.startsWith('$2a$10$'))
  assert.deepEqual(skipped.map((s) => s.reason), ['duplicate email', 'id is not a UUID', 'no email'])
})

test('trusted origins are an explicit list, never a wildcard', () => {
  for (const o of trustedOrigins()) assert.ok(!o.includes('*'), o)
})

test('behind the proxy the limits are shared, so session checks are unlimited and credential paths have a ceiling', () => {
  assert.equal(AUTH_RATE_LIMIT.customRules['/get-session'], false)
  const signIn = AUTH_RATE_LIMIT.customRules['/sign-in/email']
  assert.ok(signIn.max >= 10 && signIn.max <= 30, 'sign-in: enough for real buyers, still stops guessing')
})
