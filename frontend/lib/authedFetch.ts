// frontend/lib/authedFetch.ts
// Client-side helper: attaches the signed-in buyer's session token (Better Auth,
// lib/buyerAuth.ts) as `Authorization: Bearer <token>`, so calls to the
// backend's absolute URL are identified too. We send the TOKEN, never a raw
// user id: the server looks the session up. A guest sends its guest token.
import { getAuthClient } from '@/lib/buyerAuth'

let cachedToken: { value: string | null; exp: number } | null = null

export async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.value
  try {
    const { auth } = await getAuthClient()
    const { data } = await auth.getSession()
    const token = data.session?.access_token || null
    // Short cache so a burst of calls does not re-read the session.
    cachedToken = { value: token, exp: Date.now() + 30_000 }
    return token
  } catch {
    return null
  }
}

/** Forget the cached token (after sign-in or sign-out). */
export function clearAccessTokenCache(): void {
  cachedToken = null
}
// buyerAuth announces sign-in and sign-out; the next call re-reads the session.
if (typeof window !== 'undefined') window.addEventListener('ra-auth-change', clearAccessTokenCache)

import { getGuestToken } from '@/lib/guestToken'

/** Merge an Authorization header (when signed in) and X-Guest-Token into an existing headers object. */
export async function authHeaders(base: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAccessToken()
  const guestToken = getGuestToken()
  const headers: Record<string, string> = { ...base }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (guestToken) {
    headers['X-Guest-Token'] = guestToken
  }
  return headers
}

/** Get admin Authorization header from localStorage token. */
export function adminAuthHeaders(base: Record<string, string> = {}): Record<string, string> {
  if (typeof window === 'undefined') return base
  const token = localStorage.getItem('admin_token')
  return token ? { ...base, Authorization: `Bearer ${token}` } : { ...base }
}
