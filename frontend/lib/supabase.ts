import type { createBrowserClient } from '@supabase/ssr'
import { sharedDomainFor, migrateAuthCookiesToSharedDomain } from './sharedIdentity'

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>

let clientPromise: Promise<SupabaseBrowserClient> | null = null

// The Supabase SDK (auth + postgrest + realtime + storage clients) is a large,
// non-tree-shakeable bundle. This app only ever uses the auth module, so we
// load it lazily on first use instead of statically importing it into every
// route's initial JS — and cache one client for the life of the page so
// concurrent callers share a single GoTrueClient instead of each spinning up
// their own.
export function getSupabaseClient(): Promise<SupabaseBrowserClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/ssr').then(({ createBrowserClient }) => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || ''
      if (!url || !key) {
        console.warn('Supabase URL or Key is missing. Check your environment variables.');
        return {
          auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            getUser: async () => ({ data: { user: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signOut: async () => ({ error: null }),
            signInWithOAuth: async () => ({ data: null, error: new Error('Supabase not configured') }),
            signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
            signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
          }
        } as unknown as SupabaseBrowserClient
      }
      // On realtyask.in hosts the session cookie is shared with the app
      // subdomain, so a login on realtyask.in is still a login on
      // app.realtyask.in. Older host-only cookies are moved across first.
      const domain = sharedDomainFor(window.location.hostname)
      if (!domain) return createBrowserClient(url, key)
      migrateAuthCookiesToSharedDomain()
      return createBrowserClient(url, key, { cookieOptions: { domain, path: '/', sameSite: 'lax', secure: true } })
    })
  }
  return clientPromise
}
