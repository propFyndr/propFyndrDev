//
// Pure helpers for the referral tree: code generation, bot detection, and
// best-effort device/app parsing from a user-agent string. No raw user-agent
// or IP address is ever stored — only what this file derives from it.
import crypto from 'crypto'

/** Crockford-style, minus visually ambiguous characters (0/O, 1/I/L). */
export const REFERRAL_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function generateReferralCode(): string {
  const bytes = crypto.randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += REFERRAL_CODE_ALPHABET[bytes[i] % REFERRAL_CODE_ALPHABET.length]
  }
  return code
}

/**
 * Link-preview fetchers (WhatsApp, iMessage via Apple's bot, Facebook,
 * Telegram, Slack, Twitter/X, Discord, LinkedIn, Google) must never create a
 * ReferralVisit row — every share of a link triggers one of these before a
 * human ever taps it.
 */
const BOT_UA_PATTERNS = [
  /whatsapp/i,
  /facebookexternalhit/i,
  /telegrambot/i,
  /slackbot/i,
  /twitterbot/i,
  /discordbot/i,
  /linkedinbot/i,
  /googlebot/i,
  /bingbot/i,
  /applebot/i,
  /embedly/i,
  /quora link preview/i,
  /outbrain/i,
  /pinterest/i,
  /vkshare/i,
  /w3c_validator/i,
]

export function isPreviewBotUserAgent(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false
  return BOT_UA_PATTERNS.some((rx) => rx.test(userAgent))
}

export interface ParsedDeviceInfo {
  device_class: 'mobile' | 'desktop' | 'tablet'
  os: 'ios' | 'android' | 'windows' | 'macos' | 'other'
  app_guess: 'instagram' | 'facebook' | 'unknown'
}

/**
 * Best-effort, from the user agent only. In-app browsers (Instagram,
 * Facebook) identify themselves in the UA; SMS and iMessage open plain
 * Safari/Chrome and are indistinguishable from an organic visit — that
 * ambiguity is intentional, see the design doc's "Gap 2" section.
 */
export function parseDeviceInfo(userAgent: string | undefined | null): ParsedDeviceInfo {
  const ua = userAgent || ''

  let app_guess: ParsedDeviceInfo['app_guess'] = 'unknown'
  if (/instagram/i.test(ua)) app_guess = 'instagram'
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) app_guess = 'facebook'

  let os: ParsedDeviceInfo['os'] = 'other'
  if (/iphone|ipad|ipod/i.test(ua)) os = 'ios'
  else if (/android/i.test(ua)) os = 'android'
  else if (/windows/i.test(ua)) os = 'windows'
  else if (/macintosh|mac os x/i.test(ua)) os = 'macos'

  let device_class: ParsedDeviceInfo['device_class'] = 'desktop'
  if (/ipad|tablet/i.test(ua)) device_class = 'tablet'
  else if (/iphone|ipod|android.*mobile|mobile.*android/i.test(ua)) device_class = 'mobile'
  else if (os === 'ios' || os === 'android') device_class = 'mobile'

  return { device_class, os, app_guess }
}
