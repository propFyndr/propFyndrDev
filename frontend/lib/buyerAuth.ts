// frontend/lib/buyerAuth.ts
//
// Buyer sign-in against our own backend (Better Auth on Neon, replacing
// Supabase Auth on 5 Nov 2026). Same-origin: the browser calls /api/auth/*,
// which Next rewrites to the backend, so the session lives in an httpOnly
// cookie on our domain and every same-origin /api/v1 call carries it.
// Calls to the backend's absolute URL send the session token as a bearer
// (lib/authedFetch.ts); it is read from get-session, never stored.
//
// The call shape mirrors the Supabase client the pages used (getSession,
// signInWithPassword, signUp, signOut, onAuthStateChange), so the pages'
// logic did not change, only the import.
import { API_BASE } from '@/lib/env'

const AUTH_BASE = API_BASE.replace(/\/v1\/?$/, '/auth')
const CHANGE_EVENT = 'ra-auth-change'

export interface BuyerUser {
  id: string
  email: string
  user_metadata: { full_name?: string }
}
export interface BuyerSession {
  user: BuyerUser
  /** Session token, sent as a bearer to backend calls that are not same-origin (lib/backend-api.ts). */
  access_token: string
}
type AuthError = { message: string; code?: string }

function toUser(u: { id: string; email: string; name?: string | null }): BuyerUser {
  return { id: u.id, email: u.email, user_metadata: { full_name: u.name ?? undefined } }
}

async function call(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

function announce(session: BuyerSession | null): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: session }))
}

/** Better Auth error codes, worded the way the auth page already reads them. */
export function authErrorFrom(status: number, data: any): AuthError {
  const code: string = data?.code ?? ''
  if (code === 'EMAIL_NOT_VERIFIED' || status === 403) return { code, message: 'Email not confirmed' }
  if (code === 'INVALID_EMAIL_OR_PASSWORD' || status === 401) return { code, message: 'Invalid login credentials' }
  if (code.startsWith('USER_ALREADY_EXISTS')) return { code, message: 'User already registered' }
  return { code, message: data?.message || 'Something went wrong. Try again.' }
}

async function getSession(): Promise<{ data: { session: BuyerSession | null } }> {
  try {
    const r = await call('/get-session')
    const u = r.ok ? r.data?.user : null
    return { data: { session: u ? { user: toUser(u), access_token: r.data?.session?.token ?? '' } : null } }
  } catch {
    return { data: { session: null } }
  }
}

const auth = {
  getSession,
  async getUser(): Promise<{ data: { user: BuyerUser | null } }> {
    const { data } = await getSession()
    return { data: { user: data.session?.user ?? null } }
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const r = await call('/sign-in/email', { email, password })
    if (!r.ok || !r.data?.user) return { data: { user: null, session: null }, error: authErrorFrom(r.status, r.data) }
    const session: BuyerSession = { user: toUser(r.data.user), access_token: '' }
    announce(session)
    return { data: { user: session.user, session }, error: null }
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { name?: string } } }) {
    const callbackURL = typeof window !== 'undefined' ? `${window.location.origin}/discover` : undefined
    const r = await call('/sign-up/email', { email, password, name: options?.data?.name || email.split('@')[0], callbackURL })
    if (!r.ok) return { data: { user: null, session: null }, error: authErrorFrom(r.status, r.data) }
    // Email confirmation is required, so sign-up returns no session.
    return { data: { user: r.data?.user ? { ...toUser(r.data.user), identities: [{}] } : null, session: null }, error: null }
  },
  async signOut() {
    await call('/sign-out', {}).catch(() => null)
    announce(null)
    return { error: null }
  },
  onAuthStateChange(cb: (event: 'SIGNED_IN' | 'SIGNED_OUT', session: BuyerSession | null) => void) {
    const handler = (e: Event) => {
      const session = (e as CustomEvent<BuyerSession | null>).detail
      cb(session ? 'SIGNED_IN' : 'SIGNED_OUT', session)
    }
    if (typeof window !== 'undefined') window.addEventListener(CHANGE_EVENT, handler)
    return { data: { subscription: { unsubscribe: () => { if (typeof window !== 'undefined') window.removeEventListener(CHANGE_EVENT, handler) } } } }
  },
}

export type BuyerAuthClient = { auth: typeof auth }

/** Async to keep the old call shape (`getAuthClient().then((c) => c.auth...)`). */
export async function getAuthClient(): Promise<BuyerAuthClient> {
  return { auth }
}
