import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { preferredInviteOrigin } from '../adminTeam'

// Found live 8 Sep 2026: inviting a real admin returned a link on
// realty-pals-dev-frontend-three.vercel.app instead of the real domain, because
// FRONTEND_URL is a comma-separated list and the code took the first entry
// blindly. Pinned so it cannot regress silently.
//
// 13 Oct 2026: the real domain is realtyask.in; propfyndr.in is 308'd to it.
describe('preferredInviteOrigin', () => {
  it('prefers the real domain over an earlier-listed Vercel preview URL', () => {
    const env = 'https://realty-pals-dev-frontend-three.vercel.app,https://realtyask.in'
    assert.equal(preferredInviteOrigin(env), 'https://realtyask.in')
  })

  it('prefers the real domain regardless of which position it is in', () => {
    const env = 'https://realtyask.in,https://realty-pals-dev-frontend-three.vercel.app'
    assert.equal(preferredInviteOrigin(env), 'https://realtyask.in')
  })

  it('falls back to the first entry when no entry is the real domain', () => {
    const env = 'https://some-preview.vercel.app,https://another-preview.vercel.app'
    assert.equal(preferredInviteOrigin(env), 'https://some-preview.vercel.app')
  })

  it('falls back to the hardcoded default when the env var is unset', () => {
    assert.equal(preferredInviteOrigin(undefined), 'https://realtyask.in')
    assert.equal(preferredInviteOrigin(''), 'https://realtyask.in')
  })

  it('trims whitespace around comma-separated entries', () => {
    const env = ' https://preview.vercel.app , https://realtyask.in '
    assert.equal(preferredInviteOrigin(env), 'https://realtyask.in')
  })

  it('invite links go to the apex, never the app.* buyer host', () => {
    assert.equal(preferredInviteOrigin('https://app.realtyask.in'), 'https://realtyask.in')
    assert.equal(preferredInviteOrigin('https://app.realtyask.in,https://preview.vercel.app'), 'https://realtyask.in')
  })

  it('an env still listing the retired propfyndr.in gets realtyask.in', () => {
    assert.equal(preferredInviteOrigin('https://propfyndr.in'), 'https://realtyask.in')
    assert.equal(preferredInviteOrigin('https://app.propfyndr.in,https://preview.vercel.app'), 'https://realtyask.in')
    assert.equal(preferredInviteOrigin('https://propfyndr.in,https://realtyask.in'), 'https://realtyask.in')
  })
})
