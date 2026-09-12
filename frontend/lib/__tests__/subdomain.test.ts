import test from 'node:test'
import assert from 'node:assert/strict'
import { tenantFromHost, isUsableTenantLabel, isPassThroughPath, RESERVED_SUBDOMAINS } from '../subdomain'

/**
 * The asymmetry that matters: a false negative costs a pretty URL, a false
 * positive routes a BUYER into a portal shell. Everything here is biased
 * toward returning null when unsure.
 */

test('a tenant host resolves to its label', () => {
  assert.equal(tenantFromHost('lotus.propfyndr.in'), 'lotus')
  assert.equal(tenantFromHost('Lotus.PropFyndr.in'), 'lotus', 'host matching is case-insensitive')
  assert.equal(tenantFromHost('lotus.propfyndr.in:3000'), 'lotus', 'the port is not part of the host')
  assert.equal(tenantFromHost('godrej-properties.propfyndr.in'), 'godrej-properties')
})

test('the buyer site is never a tenant', () => {
  for (const host of [
    'propfyndr.in',        // apex
    'www.propfyndr.in',    // reserved
    'localhost',
    'localhost:3000',
    '127.0.0.1:3000',
    '192.168.1.40',
    '',
  ]) {
    assert.equal(tenantFromHost(host), null, `${host || '(empty)'} must not resolve to a tenant`)
  }
  assert.equal(tenantFromHost(null), null)
  assert.equal(tenantFromHost(undefined), null)
})

test('preview deployments are the product, not tenants', () => {
  // These have a subdomain shape and would otherwise capture every preview.
  assert.equal(tenantFromHost('propfyndr-git-main-team.vercel.app'), null)
  assert.equal(tenantFromHost('propfyndr.onrender.com'), null)
})

test('infrastructure names cannot be claimed by a tenant', () => {
  for (const reserved of ['api', 'admin', 'www', 'app', 'mail', 'cdn', 'login', 'portal']) {
    assert.ok(RESERVED_SUBDOMAINS.has(reserved), `${reserved} should be reserved`)
    assert.equal(
      tenantFromHost(`${reserved}.propfyndr.in`),
      null,
      `${reserved}.propfyndr.in must stay infrastructure`,
    )
  }
})

test('a malformed label is not a tenant', () => {
  for (const label of ['-lotus', 'lotus-', 'a', '', 'lo tus', 'lotus_builder', 'LOTUS!']) {
    assert.equal(isUsableTenantLabel(label), false, `"${label}" must be rejected`)
  }
  assert.equal(isUsableTenantLabel('lotus'), true)
  assert.equal(isUsableTenantLabel('m3m'), true)
})

test('lotus.localhost works for local testing', () => {
  // Without this there is no way to exercise tenant routing on a dev machine.
  assert.equal(tenantFromHost('lotus.localhost:3000'), 'lotus')
  assert.equal(tenantFromHost('api.localhost:3000'), null, 'reserved names stay reserved locally')
})

test('assets and API calls pass through a tenant host untouched', () => {
  // Rewriting these would break the page the rewrite is trying to serve.
  for (const path of [
    '/api/v1/portal/me',
    '/_next/static/chunk.js',
    '/images/icons/logo-square-black.png',
    '/admin/login',
    '/builder/portal/leads',
    '/partner/portal',
    '/favicon.ico',
  ]) {
    assert.equal(isPassThroughPath(path), true, `${path} must not be rewritten`)
  }
  // The ones that SHOULD be rewritten to the portal entry.
  for (const path of ['/', '/discover', '/saved', '/compare']) {
    assert.equal(isPassThroughPath(path), false, `${path} should route to the portal entry on a tenant host`)
  }
})
