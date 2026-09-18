import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { Request, Response, NextFunction } from 'express'
import { createIdentitySession, requireIdentity, sessionTtlForRole } from '../adminIdentity'

/**
 * The shared ADMIN_PASSWORD login was removed on 2026-09-17. It accepted a
 * password with no email and minted a SUPER_ADMIN session under the synthetic
 * id `root`, so one environment variable was a super admin with no name in the
 * audit trail.
 *
 * Removing the login alone would not have closed it: sessions it had already
 * issued live in the session store for up to seven days. These tests cover both
 * halves — that the branch is gone, and that any session it left behind is
 * refused.
 */

function fakeReq(token: string): Request {
  return { cookies: { admin_session: token }, headers: {} } as unknown as Request
}

function fakeRes(): Response & { statusCode?: number; body?: unknown } {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) { res.statusCode = code; return res },
    json(payload: unknown) { res.body = payload; return res },
  }
  return res as unknown as Response & { statusCode?: number; body?: unknown }
}

describe('root session revocation', () => {
  it('refuses a session carrying the legacy root identity', async () => {
    const token = await createIdentitySession({
      ip: '127.0.0.1',
      userAgent: 'test',
      adminUserId: 'root',
      email: 'root@bootstrap',
      role: 'SUPER_ADMIN',
      builderId: null,
      partnerId: null,
    })

    const res = fakeRes()
    let nextCalled = false
    await requireIdentity(fakeReq(token), res, (() => { nextCalled = true }) as NextFunction)

    assert.equal(nextCalled, false, 'a root session must not reach the handler')
    assert.equal(res.statusCode, 401)
  })

  it('still admits a session backed by a real AdminUser id', async () => {
    const token = await createIdentitySession({
      ip: '127.0.0.1',
      userAgent: 'test',
      adminUserId: 'c5c86456-052a-4d67-bef0-8353fab7e875',
      email: 'analyst@propfyndr.in',
      role: 'ANALYST',
      builderId: null,
      partnerId: null,
    })

    const res = fakeRes()
    let nextCalled = false
    await requireIdentity(fakeReq(token), res, (() => { nextCalled = true }) as NextFunction)

    assert.equal(nextCalled, true, 'a real identity must still pass')
    assert.equal(res.statusCode, undefined)
  })

  it('gives external roles a shorter session than staff', () => {
    // A builder or partner logs in from a sales office laptop we cannot wipe,
    // at a firm whose staff turnover we never hear about. A week-long session
    // there is a week-long window after someone leaves.
    const DAY = 24 * 60 * 60
    assert.equal(sessionTtlForRole('BUILDER'), DAY)
    assert.equal(sessionTtlForRole('PARTNER'), DAY)
    assert.equal(sessionTtlForRole('SUPER_ADMIN'), 7 * DAY)
    assert.equal(sessionTtlForRole('ANALYST'), 7 * DAY)
    assert.equal(sessionTtlForRole('SALES'), 7 * DAY)
  })

  it('leaves no ADMIN_PASSWORD branch in the login handler', () => {
    const source = readFileSync(join(__dirname, '../../routes/admin.ts'), 'utf-8')
    const code = source
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
      .join('\n')

    assert.ok(
      !code.includes('process.env.ADMIN_PASSWORD'),
      'admin.ts must not read ADMIN_PASSWORD outside comments',
    )
  })
})
