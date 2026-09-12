import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalisePortalSubdomain, RESERVED_SUBDOMAINS } from '../portalSubdomain'

/**
 * This runs on the write path. Its counterpart, frontend/lib/subdomain.ts,
 * runs on the read path and decides whether an incoming host is a tenant. A
 * name accepted here but rejected there produces a builder whose advertised
 * portal address silently serves the buyer homepage — so the two lists have to
 * stay in step, and these cases are the ones that would drift first.
 */
describe('portal subdomain validation', () => {
  it('accepts and normalises an ordinary name', () => {
    assert.deepEqual(normalisePortalSubdomain('lotus'), { ok: true, value: 'lotus' })
    assert.deepEqual(normalisePortalSubdomain('  Lotus  '), { ok: true, value: 'lotus' })
    assert.deepEqual(normalisePortalSubdomain('godrej-properties'), { ok: true, value: 'godrej-properties' })
    assert.deepEqual(normalisePortalSubdomain('m3m'), { ok: true, value: 'm3m' })
  })

  it('treats empty as clearing, not as an error', () => {
    // Removing a tenant's subdomain is a legitimate edit.
    for (const empty of [null, undefined, '', '   ']) {
      assert.deepEqual(normalisePortalSubdomain(empty), { ok: true, value: null }, `${JSON.stringify(empty)}`)
    }
  })

  it('refuses names that would shadow our own infrastructure', () => {
    for (const reserved of ['api', 'admin', 'www', 'app', 'mail', 'login', 'portal', 'cdn']) {
      assert.ok(RESERVED_SUBDOMAINS.has(reserved))
      const r = normalisePortalSubdomain(reserved)
      assert.equal(r.ok, false, `${reserved} must be refused`)
    }
    // Case must not be an escape hatch.
    assert.equal(normalisePortalSubdomain('API').ok, false)
  })

  it('refuses anything that is not a valid DNS label', () => {
    for (const bad of ['-lotus', 'lotus-', 'a', 'lo tus', 'lotus_builder', 'lotus.co', 'LOTUS!', 'x'.repeat(64)]) {
      assert.equal(normalisePortalSubdomain(bad).ok, false, `"${bad}" must be refused`)
    }
  })

  it('refuses a non-string', () => {
    for (const bad of [42, true, {}, []]) {
      assert.equal(normalisePortalSubdomain(bad).ok, false, `${JSON.stringify(bad)} must be refused`)
    }
  })
})
