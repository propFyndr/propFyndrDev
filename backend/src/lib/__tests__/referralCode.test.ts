import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateReferralCode, isPreviewBotUserAgent, parseDeviceInfo, REFERRAL_CODE_ALPHABET } from '../referralCode'

describe('generateReferralCode', () => {
  it('returns an 8-character code drawn only from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode()
      assert.equal(code.length, 8)
      for (const ch of code) {
        assert.ok(REFERRAL_CODE_ALPHABET.includes(ch), `unexpected character ${ch} in ${code}`)
      }
    }
  })

  it('excludes ambiguous characters', () => {
    for (const bad of ['0', 'O', '1', 'I', 'L']) {
      assert.ok(!REFERRAL_CODE_ALPHABET.includes(bad), `alphabet must not contain ${bad}`)
    }
  })

  it('does not produce the same code on consecutive calls (sanity, not a uniqueness guarantee)', () => {
    const a = generateReferralCode()
    const b = generateReferralCode()
    assert.notEqual(a, b)
  })
})

describe('isPreviewBotUserAgent', () => {
  it('flags known link-preview fetchers', () => {
    assert.equal(isPreviewBotUserAgent('WhatsApp/2.23.20.0 A'), true)
    assert.equal(isPreviewBotUserAgent('facebookexternalhit/1.1'), true)
    assert.equal(isPreviewBotUserAgent('TelegramBot (like TwitterBot)'), true)
    assert.equal(isPreviewBotUserAgent('Slackbot-LinkExpanding 1.0'), true)
  })

  it('does not flag a real browser', () => {
    assert.equal(isPreviewBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), false)
  })

  it('treats a missing user agent as not a bot (caller decides what to do with no UA)', () => {
    assert.equal(isPreviewBotUserAgent(undefined), false)
    assert.equal(isPreviewBotUserAgent(null), false)
    assert.equal(isPreviewBotUserAgent(''), false)
  })
})

describe('parseDeviceInfo', () => {
  it('detects iOS mobile Safari', () => {
    const info = parseDeviceInfo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    assert.equal(info.device_class, 'mobile')
    assert.equal(info.os, 'ios')
    assert.equal(info.app_guess, 'unknown')
  })

  it('detects Android mobile', () => {
    const info = parseDeviceInfo('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36')
    assert.equal(info.device_class, 'mobile')
    assert.equal(info.os, 'android')
  })

  it('detects the Instagram in-app browser', () => {
    const info = parseDeviceInfo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 302.0.0.23.114')
    assert.equal(info.app_guess, 'instagram')
  })

  it('detects the Facebook in-app browser', () => {
    const info = parseDeviceInfo('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 [FBAN/FB4A;FBAV/450.0.0.0.0]')
    assert.equal(info.app_guess, 'facebook')
  })

  it('detects desktop Windows and macOS', () => {
    assert.equal(parseDeviceInfo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0').device_class, 'desktop')
    assert.equal(parseDeviceInfo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0').os, 'windows')
    assert.equal(parseDeviceInfo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15').os, 'macos')
  })

  it('detects an iPad as tablet', () => {
    assert.equal(parseDeviceInfo('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15').device_class, 'tablet')
  })

  it('falls back to desktop/other/unknown for an unrecognised or missing user agent', () => {
    const info = parseDeviceInfo(undefined)
    assert.equal(info.device_class, 'desktop')
    assert.equal(info.os, 'other')
    assert.equal(info.app_guess, 'unknown')
  })
})
