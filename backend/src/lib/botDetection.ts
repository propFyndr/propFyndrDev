import type { Request } from 'express'

/**
 * Is this request a crawler, a monitor, or our own tooling?
 *
 * Production holds 43,275 chat sessions, 40,790 of them from the last 30 days,
 * averaging 1.3 messages each — and 763 leads from four distinct phone numbers.
 * That is not buyer behaviour. It is crawlers, uptime checks, smoke tests and
 * corpus runs, and it makes every number in the product unreadable: session
 * counts, conversion rates, message depth, provider spend.
 *
 * This does NOT block anything. A user agent is trivially forged and a real
 * buyer on an unusual client must never be turned away to tidy a dashboard —
 * rate limiting already handles abuse. It marks the session so analytics and
 * any later query can exclude the noise, and so beta metrics mean something.
 */

/**
 * Matched against the user agent, lowercased.
 *
 * Deliberately conservative: a false positive here silently drops a real
 * buyer's session out of the metrics, which is the failure this is meant to
 * prevent, not cause.
 */
const BOT_PATTERNS: RegExp[] = [
  // Search and AI crawlers
  /\bbot\b|crawler|spider|crawling/,
  /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp/,
  /gptbot|claudebot|anthropic|perplexity|ccbot|bytespider|amazonbot|applebot/,
  // Link unfurlers and previewers
  /facebookexternalhit|whatsapp|telegrambot|slackbot|twitterbot|linkedinbot|embedly|quora link preview/,
  // Monitors and probes
  /uptimerobot|pingdom|statuscake|newrelic|datadog|better ?uptime|site24x7/,
  // Scripting clients and headless browsers — our own corpus runs land here
  /^curl\/|^wget\/|python-requests|axios\/|node-fetch|go-http-client|okhttp|postman|insomnia/,
  /headlesschrome|phantomjs|puppeteer|playwright|selenium|scrapy/,
]

/** True when the user agent names a known non-human client. */
export function isBotUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return true // A browser always sends one; a script often does not.
  const ua = userAgent.toLowerCase()
  return BOT_PATTERNS.some(re => re.test(ua))
}

/** True when this request should be kept out of product metrics. */
export function isBotRequest(req: Pick<Request, 'get'>): boolean {
  // The test suite's integration tests (chat.test.ts, conversationalFlows.test.ts)
  // hit the real Express app in-process via supertest, writing through the real
  // Prisma client into whatever DATABASE_URL is configured -- there is no
  // separate test database. Until now these sessions were only caught by
  // supertest's user agent happening to match a BOT_PATTERN, which is an
  // incidental side effect of a library default, not a guarantee -- a future
  // supertest upgrade could change that string and silently put real test
  // traffic back into product metrics with no caller aware it had stopped
  // being caught. test-runner.ts already sets NODE_ENV=test for every run, so
  // this makes that unconditional rather than relying on what happens to match.
  if (process.env.NODE_ENV === 'test') return true
  return isBotUserAgent(req.get('user-agent') ?? undefined)
}

/**
 * The website's guest token: `guest-` + crypto.randomUUID(), or, in a browser without it,
 * `guest-` + 16–22 base36 characters (frontend/lib/guestToken.ts). Scripts used look-alikes
 * ("guest-stress_1_…", "guest-audit") and the server mints `guest_…` when none is sent, so a
 * token in any other shape is not a person. Exported as a string for SQL (`guest_token ~ …`).
 */
export const WEBSITE_GUEST_TOKEN =
  '^guest-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9]{16,22})$'
const WEBSITE_GUEST_TOKEN_RE = new RegExp(WEBSITE_GUEST_TOKEN)

export function isWebsiteGuestToken(token: string | null | undefined): boolean {
  return !!token && WEBSITE_GUEST_TOKEN_RE.test(token)
}

/** Device class from the user agent, for analytics only. */
export function deviceFromUserAgent(userAgent: string | undefined): 'phone' | 'tablet' | 'desktop' | null {
  if (!userAgent) return null
  const ua = userAgent.toLowerCase()
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return 'tablet'
  if (/iphone|ipod|android.*mobile|mobile/.test(ua)) return 'phone'
  return 'desktop'
}
