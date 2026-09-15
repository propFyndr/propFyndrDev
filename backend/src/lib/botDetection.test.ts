import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isBotUserAgent } from './botDetection'

const REAL_BROWSERS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  // Safari on iPhone — the most common client this product will actually see
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  // Chrome on Android
  'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  // Firefox on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0',
  // Edge
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
]

const NON_HUMANS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot',
  'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.23.20.0',
  'curl/8.7.1',
  'python-requests/2.32.3',
  'axios/1.7.7',
  'node-fetch/1.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
  'UptimeRobot/2.0; http://www.uptimerobot.com/',
]

describe('bot detection', () => {
  it('does not misread a real browser as a bot', () => {
    // A false positive here silently drops a real buyer out of the metrics,
    // which is the exact failure this module exists to prevent.
    for (const ua of REAL_BROWSERS) {
      assert.equal(isBotUserAgent(ua), false, `flagged a real browser: ${ua.slice(0, 60)}`)
    }
  })

  it('flags crawlers, unfurlers, monitors and scripting clients', () => {
    for (const ua of NON_HUMANS) {
      assert.equal(isBotUserAgent(ua), true, `missed: ${ua.slice(0, 60)}`)
    }
  })

  it('treats a missing user agent as non-human', () => {
    // Every browser sends one. A request without it is a script.
    assert.equal(isBotUserAgent(undefined), true)
    assert.equal(isBotUserAgent(''), true)
  })
})
