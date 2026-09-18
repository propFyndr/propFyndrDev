import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderHtml } from '../outboxDispatcher'

/**
 * These messages carry one-time credentials — an invite or reset link sets a
 * password for whoever opens it. The rendering is therefore the security
 * surface: an unescaped body would let anything that reaches `body` inject
 * markup next to a live credential link.
 */
describe('outbox email rendering', () => {
  it('escapes HTML in the body', () => {
    const html = renderHtml('admin_invite', '<script>alert(1)</script>', null)
    assert.ok(!html.includes('<script>'), 'raw script tag must not survive')
    assert.ok(html.includes('&lt;script&gt;'), 'it should appear escaped instead')
  })

  it('escapes the action url rather than trusting it', () => {
    const html = renderHtml('password_reset', 'Reset requested.', 'https://x.test/r?a=1&b="2"')
    assert.ok(!html.includes('&b="2"'), 'raw quotes must not break out of the href attribute')
    assert.ok(html.includes('&amp;b=&quot;2&quot;'))
  })

  it('labels the button per template', () => {
    const invite = renderHtml('admin_invite', 'hello', 'https://x.test/i')
    const reset = renderHtml('password_reset', 'hello', 'https://x.test/r')
    assert.ok(invite.includes('Set your password'))
    assert.ok(reset.includes('Choose a new password'))
  })

  it('repeats the url as text so a reader who distrusts the button still has it', () => {
    const html = renderHtml('admin_invite', 'hello', 'https://x.test/invite?token=abc')
    const occurrences = html.split('https://x.test/invite?token=abc').length - 1
    assert.equal(occurrences, 2, 'once in the href, once as visible text')
  })

  it('omits the button entirely when there is no action url', () => {
    const html = renderHtml('partner_approved', 'Your firm was approved.', null)
    assert.ok(!html.includes('<a href'), 'no link element when there is nothing to link to')
    assert.ok(html.includes('Your firm was approved.'))
  })

  it('splits blank-line-separated text into paragraphs', () => {
    const html = renderHtml('admin_invite', 'First para.\n\nSecond para.', null)
    assert.equal(html.split('<p style="margin:0 0 16px;line-height:1.6').length - 1, 2)
  })
})
