import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword, generateInviteToken, requireRole, requireScope } from './adminIdentity'
import type { AdminIdentitySession } from './adminIdentity'
import type { Request, Response } from 'express'

describe('password hashing', () => {
  it('verifies a correct password', () => {
    const stored = hashPassword('correct horse battery staple')
    assert.equal(verifyPassword('correct horse battery staple', stored), true)
  })

  it('rejects a wrong password', () => {
    const stored = hashPassword('correct horse battery staple')
    assert.equal(verifyPassword('wrong password', stored), false)
  })

  it('two hashes of the same password differ (salted)', () => {
    const a = hashPassword('same password')
    const b = hashPassword('same password')
    assert.notEqual(a, b)
  })

  it('rejects a malformed stored hash rather than throwing', () => {
    assert.equal(verifyPassword('anything', 'not-a-valid-hash'), false)
    assert.equal(verifyPassword('anything', ''), false)
  })
})

describe('invite tokens', () => {
  it('generates a long, unpredictable token each time', () => {
    const a = generateInviteToken()
    const b = generateInviteToken()
    assert.notEqual(a, b)
    assert.ok(a.length >= 32)
  })
})

function mockReq(session: AdminIdentitySession | undefined): Request {
  return { adminIdentity: session } as unknown as Request
}
function mockRes(): { res: Response; status: number | null; body: unknown } {
  const state = { status: null as number | null, body: undefined as unknown }
  const res = {
    status(code: number) { state.status = code; return res },
    json(body: unknown) { state.body = body; return res },
  } as unknown as Response
  return { res, get status() { return state.status }, get body() { return state.body } } as never
}

describe('requireRole', () => {
  it('passes a session whose role is in the allowed list', () => {
    const req = mockReq({ adminUserId: 'a1', email: 'a@x.com', role: 'SUPER_ADMIN', builderId: null, partnerId: null, ip: '', userAgent: '', createdAt: '', lastSeen: '' })
    let called = false
    const { res } = mockRes()
    requireRole('SUPER_ADMIN', 'ANALYST')(req, res, () => { called = true })
    assert.equal(called, true)
  })

  it('blocks a session whose role is not in the allowed list', () => {
    const req = mockReq({ adminUserId: 'a1', email: 'a@x.com', role: 'BUILDER', builderId: 'b1', partnerId: null, ip: '', userAgent: '', createdAt: '', lastSeen: '' })
    let called = false
    const wrapper = mockRes()
    requireRole('SUPER_ADMIN')(req, wrapper.res, () => { called = true })
    assert.equal(called, false)
    assert.equal(wrapper.status, 403)
  })

  it('blocks a request with no session at all', () => {
    const req = mockReq(undefined)
    let called = false
    const wrapper = mockRes()
    requireRole('SUPER_ADMIN')(req, wrapper.res, () => { called = true })
    assert.equal(called, false)
    assert.equal(wrapper.status, 403)
  })
})

describe('requireScope', () => {
  it('never calls resolveOwnerId for SUPER_ADMIN/ANALYST/SALES — always passes', async () => {
    const req = mockReq({ adminUserId: 'a1', email: 'a@x.com', role: 'SUPER_ADMIN', builderId: null, partnerId: null, ip: '', userAgent: '', createdAt: '', lastSeen: '' })
    let called = false
    let resolverCalled = false
    const { res } = mockRes()
    await requireScope(async () => { resolverCalled = true; return null })(req, res, () => { called = true })
    assert.equal(called, true)
    assert.equal(resolverCalled, false)
  })

  it('a BUILDER session passes only when the resolved owner matches their own builder_id', async () => {
    const req = mockReq({ adminUserId: 'a1', email: 'a@x.com', role: 'BUILDER', builderId: 'builder-1', partnerId: null, ip: '', userAgent: '', createdAt: '', lastSeen: '' })
    let called = false
    const { res } = mockRes()
    await requireScope(async () => 'builder-1')(req, res, () => { called = true })
    assert.equal(called, true)
  })

  it('a BUILDER session is refused a resource belonging to a different builder', async () => {
    const req = mockReq({ adminUserId: 'a1', email: 'a@x.com', role: 'BUILDER', builderId: 'builder-1', partnerId: null, ip: '', userAgent: '', createdAt: '', lastSeen: '' })
    let called = false
    const wrapper = mockRes()
    await requireScope(async () => 'builder-2')(req, wrapper.res, () => { called = true })
    assert.equal(called, false)
    assert.equal(wrapper.status, 403)
  })

  it('a BUILDER session with no builder_id is refused rather than treated as unscoped', async () => {
    const req = mockReq({ adminUserId: 'a1', email: 'a@x.com', role: 'BUILDER', builderId: null, partnerId: null, ip: '', userAgent: '', createdAt: '', lastSeen: '' })
    let called = false
    const wrapper = mockRes()
    await requireScope(async () => 'builder-1')(req, wrapper.res, () => { called = true })
    assert.equal(called, false)
    assert.equal(wrapper.status, 403)
  })
})
