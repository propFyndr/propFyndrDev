import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isPublicAdminPath } from '../../lib/adminGuard'

/**
 * The properties here are the ones whose absence is invisible in a demo and
 * expensive in the wild: an account-enumeration oracle, a reset that leaves
 * old sessions alive, a guard that locks out exactly the person who needs the
 * page. Source-level assertions rather than HTTP, because these are structural
 * choices rather than behaviours that vary per request.
 */
describe('admin auth flows', () => {
  const src = readFileSync(join(__dirname, '..', 'adminAuthFlows.ts'), 'utf8')

  it('forgot and reset are reachable without a session; change is not', () => {
    // A person who has lost their password has no session by definition.
    assert.equal(isPublicAdminPath('/auth-flows/forgot'), true)
    assert.equal(isPublicAdminPath('/auth-flows/reset'), true)
    // Changing a password requires proving you hold the current one.
    assert.equal(isPublicAdminPath('/auth-flows/change'), false)
    // Near-misses must not open anything.
    assert.equal(isPublicAdminPath('/auth-flows'), false)
    assert.equal(isPublicAdminPath('/auth-flows/forgot-everything'), false)
  })

  it('forgot answers identically whether or not the account exists', () => {
    // Two branches returning different shapes is an account-enumeration oracle:
    // an attacker learns which emails are registered by diffing responses.
    const forgot = src.slice(src.indexOf("router.post('/forgot'"), src.indexOf("router.post('/reset'"))
    assert.ok(forgot.includes('const generic'), 'the shared response object is gone')
    assert.equal(
      (forgot.match(/res\.json\(generic\)/g) ?? []).length,
      2,
      'both the invalid-input and the found/not-found paths must return the same object',
    )
    assert.ok(
      !/res\.status\(404\)/.test(forgot),
      'a 404 on an unknown email tells an attacker the address is not registered',
    )
  })

  it('a reset and a change both end every existing session', () => {
    // A password changed because someone else may know it, with their session
    // still live, has not been changed in any sense that matters.
    const resetBlock = src.slice(src.indexOf("router.post('/reset'"), src.indexOf("router.post('/change'"))
    const changeBlock = src.slice(src.indexOf("router.post('/change'"))
    assert.ok(resetBlock.includes('revokeAllSessions'), 'reset must revoke sessions')
    assert.ok(changeBlock.includes('revokeAllSessions'), 'change must revoke sessions')
  })

  it('a consumed reset also kills any outstanding invite', () => {
    // A reset proves control of the mailbox, which is what the invite was
    // waiting for. Leaving the invite live keeps a second way in.
    const resetBlock = src.slice(src.indexOf("router.post('/reset'"), src.indexOf("router.post('/change'"))
    assert.ok(resetBlock.includes('invite_token: null'), 'reset must clear a pending invite token')
  })

  it('reset tokens expire and are checked for it', () => {
    const resetBlock = src.slice(src.indexOf("router.post('/reset'"), src.indexOf("router.post('/change'"))
    assert.ok(resetBlock.includes('reset_expires_at'), 'expiry must be read')
    assert.ok(/reset_expires_at\s*<\s*new Date\(\)/.test(resetBlock), 'expiry must actually be compared to now')
    assert.ok(resetBlock.includes('reset_token: null'), 'a used token must be consumed')
  })

  it('the reset link goes through the outbox, never straight to a provider', () => {
    // Rewritten 2026-09-17. This previously asserted that nothing here sent
    // anything, which was true while no dispatcher existed — a reset link was
    // parked in NotificationOutbox and reached the requester only if a super
    // admin opened the outbox screen and copied it out by hand.
    //
    // What must stay true is narrower and more durable: the row is written
    // first, and this file never calls a provider directly. `enqueueAndSend`
    // does both in that order, so a send that fails leaves a queued row with
    // its error rather than a lost link and a log line.
    assert.ok(src.includes('enqueueAndSend'), 'the reset link must go through the outbox')

    // Comments stripped before the provider check: the header comment explains
    // that the dispatcher sends via Resend, and a bare source grep counted that
    // sentence as a provider call.
    const code = src
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*') && !l.trimStart().startsWith('/*'))
      .join('\n')
    assert.ok(
      !/sendEmail|resend|twilio|nodemailer/i.test(code),
      'no direct provider call here: every message is an outbox row first',
    )
  })
})
