import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isAuditedRead } from '../adminReadAudit'

/**
 * We have always logged who CHANGED a lead. For personal data the more
 * important question is who READ one, and it had no answer at all.
 */
describe('which reads get audited', () => {
  it('audits a single buyer contact row and their transcript', () => {
    assert.equal(isAuditedRead('GET', '/callbacks/abc-123'), true)
    assert.equal(isAuditedRead('GET', '/leads/abc-123'), true)
    assert.equal(isAuditedRead('GET', '/conversations/sess-1'), true)
    assert.equal(isAuditedRead('GET', '/beta/sessions/sess-1'), true)
    assert.equal(isAuditedRead('GET', '/referrals/nodes/guest-1'), true)
    assert.equal(isAuditedRead('GET', '/analytics/people/guest-75430cc8-b296-400b-ba86-0794dbb2a3ba/questions'), true)
  })

  it('does not audit list views', () => {
    // A row per page load per salesperson produces a log nobody can read, which
    // is the same as no log. Collections name no one person.
    assert.equal(isAuditedRead('GET', '/callbacks'), false)
    assert.equal(isAuditedRead('GET', '/leads'), false)
    assert.equal(isAuditedRead('GET', '/conversations'), false)
    assert.equal(isAuditedRead('GET', '/referrals'), false)
    assert.equal(isAuditedRead('GET', '/analytics/people'), false)
  })

  it('does not audit the catalogue', () => {
    assert.equal(isAuditedRead('GET', '/projects/abc-123'), false)
    assert.equal(isAuditedRead('GET', '/builders/abc-123'), false)
  })

  it('only audits reads — writes have their own trail', () => {
    assert.equal(isAuditedRead('PATCH', '/callbacks/abc-123'), false)
    assert.equal(isAuditedRead('DELETE', '/leads/abc-123'), false)
  })
})
