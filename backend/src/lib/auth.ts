// backend/src/lib/auth.ts
// Server-side identity verification. We NEVER trust a client-supplied user id.
// A signed-in buyer carries a Better Auth session (lib/betterAuth.ts): the
// httpOnly session cookie on our domain, or the same token as
// `Authorization: Bearer <token>`. We look the session up in our own database
// and derive the user id from it. Guests have no session and are scoped to
// their guestToken. (Supabase Auth was replaced on 5 Nov 2026.)
import type { Request } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './betterAuth'

// Small in-memory cache so a burst of requests does not re-read the session.
const sessionCache = new Map<string, { userId: string; exp: number }>()
const CACHE_TTL_MS = 60_000

/** The credential this request carries, or null for a guest. */
export function sessionKey(req: Pick<Request, 'headers'>): string | null {
  const h = req.headers['authorization']
  const bearer = typeof h === 'string' ? h.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() : undefined
  if (bearer) return `b:${bearer}`
  const cookie = typeof req.headers.cookie === 'string' ? req.headers.cookie : ''
  const m = cookie.match(/(?:^|;\s*)(?:__Secure-)?[\w-]+\.session_token=([^;]+)/)
  return m ? `c:${m[1]}` : null
}

/**
 * Returns a VERIFIED user id, or null if the caller is not an authenticated user.
 * - Valid session → user id (string)
 * - No session    → null (caller is a guest; use guestToken for scoping)
 * - Bad session   → null (treated as unauthenticated)
 */
export async function verifyUser(req: Request): Promise<string | null> {
  const key = sessionKey(req)
  if (!key) return null

  const cached = sessionCache.get(key)
  if (cached && cached.exp > Date.now()) return cached.userId

  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    const userId = result?.user?.id
    if (!userId) return null
    sessionCache.set(key, { userId, exp: Date.now() + CACHE_TTL_MS })
    return userId
  } catch {
    // Invalid/expired sessions are expected; logging each one is noise.
    return null
  }
}
