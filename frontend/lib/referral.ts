//
// Client-side half of referral tracking: stores this device's own referral
// code, calls the arrive endpoint once, and appends the code to any URL this
// device shares onward (dossier, shortlist, the share button). See
// docs/archive/superpowers/specs/2026-10-11-referral-tracking-design.md.
import { API_BASE } from './env'
import { readSharedCookie, writeSharedCookie } from './sharedIdentity'

export const REFERRAL_CODE_STORAGE_KEY = 'propfyndr_referral_code'
/** Mirror on `.realtyask.in`: the same device keeps one code on both hosts. */
export const REFERRAL_CODE_COOKIE = 'ra_referral_code'

export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(REFERRAL_CODE_STORAGE_KEY) || readSharedCookie(REFERRAL_CODE_COOKIE)
  } catch {
    return null
  }
}

export function storeReferralCode(code: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code)
    writeSharedCookie(REFERRAL_CODE_COOKIE, code)
  } catch {
    // non-fatal: the device just won't carry a code into its own shares this session
  }
}

export interface ArriveResponse {
  ownCode: string
  greeting: { name: string } | null
}

export async function arrive(code: string | null, channel?: string): Promise<ArriveResponse | null> {
  if (typeof window === 'undefined') return null
  const { getOrCreateGuestToken } = await import('./guestToken')
  const guestToken = getOrCreateGuestToken()
  if (!guestToken) return null

  try {
    const res = await fetch(`${API_BASE}/referral/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestToken, code: code || undefined, channel }),
    })
    if (!res.ok) return null
    return (await res.json()) as ArriveResponse
  } catch {
    return null
  }
}

/** Appends `?r=<code>` (or `&r=<code>`) to a relative URL, using this device's own stored code. */
export function appendReferralParams(url: string): string {
  const code = getStoredReferralCode()
  if (!code) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}r=${code}`
}
