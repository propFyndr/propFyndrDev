//
// One buyer identity across realtyask.in and app.realtyask.in.
//
// The buyer app lives on app.realtyask.in; the marketing site and share links
// on realtyask.in. localStorage is per host, so the guest token (which owns a
// guest's chats, saves and referral visit) and the referral code would be
// different on each — and Supabase's auth cookies were host-only, so a login
// did not cross either. Every identity value is mirrored into a cookie scoped
// to `.realtyask.in`, which both hosts can read.
//
// Other hosts (localhost, *.vercel.app previews, *.onrender.com) are left
// exactly as before: no shared domain, nothing mirrored.

export const SHARED_COOKIE_DOMAIN = '.realtyask.in'
export const APP_HOST = 'app.realtyask.in'
const APEX_HOSTS = new Set(['realtyask.in', 'www.realtyask.in'])
/** Buyer-chat routes that belong on the app host. Share links (/property, /dossier, /s) stay on the apex. */
const APP_ROUTES = ['/discover', '/saved']

const ONE_YEAR_S = 365 * 24 * 60 * 60

export function sharedDomainFor(hostname: string): string | null {
  const h = hostname.toLowerCase()
  return h === 'realtyask.in' || h.endsWith('.realtyask.in') ? SHARED_COOKIE_DOMAIN : null
}

function currentSharedDomain(): string | null {
  return typeof window === 'undefined' ? null : sharedDomainFor(window.location.hostname)
}

export function readSharedCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
}

export function writeSharedCookie(name: string, value: string): void {
  const domain = currentSharedDomain()
  if (!domain) return
  document.cookie = `${name}=${encodeURIComponent(value)}; Domain=${domain}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax; Secure`
}

export function clearSharedCookie(name: string): void {
  const domain = currentSharedDomain()
  if (!domain) return
  document.cookie = `${name}=; Domain=${domain}; Path=/; Max-Age=0; SameSite=Lax; Secure`
}

/**
 * Where a buyer-chat page on the apex should move to, or null to stay.
 * Pure, so the routing rule is testable without a browser.
 */
export function appHostTarget(loc: { hostname: string; pathname: string; search: string; hash: string }): string | null {
  if (!APEX_HOSTS.has(loc.hostname.toLowerCase())) return null
  if (!APP_ROUTES.some((r) => loc.pathname === r || loc.pathname.startsWith(`${r}/`))) return null
  return `https://${APP_HOST}${loc.pathname}${loc.search}${loc.hash}`
}

const AUTH_MIGRATED_KEY = 'ra_auth_cookie_domain_v1'

/**
 * Supabase auth cookies written before the shared domain existed are
 * host-only. Re-write each one on `.realtyask.in` once, removing the host-only
 * copy first — two cookies with the same name would leave the client reading
 * whichever the browser lists first, possibly the stale one.
 */
export function migrateAuthCookiesToSharedDomain(): void {
  const domain = currentSharedDomain()
  if (!domain) return
  try {
    if (localStorage.getItem(AUTH_MIGRATED_KEY)) return
    const authCookies = document.cookie
      .split('; ')
      .filter((c) => /^sb-.+-auth-token(\.\d+)?=/.test(c))
    for (const c of authCookies) {
      const name = c.slice(0, c.indexOf('='))
      const value = c.slice(name.length + 1)
      document.cookie = `${name}=; Path=/; Max-Age=0`
      document.cookie = `${name}=${value}; Domain=${domain}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax; Secure`
    }
    localStorage.setItem(AUTH_MIGRATED_KEY, '1')
  } catch {
    // storage blocked: the buyer signs in once more on the app host
  }
}
