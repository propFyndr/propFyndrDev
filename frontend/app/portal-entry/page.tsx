'use client'

/**
 * Where a tenant subdomain lands.
 *
 * `lotus.propfyndr.in/` is rewritten here by middleware. This page does one
 * thing: ask the server who is signed in, and send them to their own console.
 * It deliberately does NOT read the subdomain to decide what to show — the
 * session decides. The subdomain is a door, not a key.
 *
 * Rendered rather than redirected in middleware because the session lives in
 * localStorage behind an Authorization header, which middleware cannot read.
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { adminFetch } from '@/lib/adminFetch'
import { API_BASE } from '@/lib/env'
import { HOME_FOR_ROLE, type PortalRole } from '@/components/portal/PortalShell'

interface Tenant { type: 'builder' | 'partner'; name: string; logo_url: string | null }

export default function PortalEntryPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [message, setMessage] = useState('')
  const [tenant, setTenant] = useState<Tenant | null>(null)

  /**
   * Branding for the subdomain that landed here.
   *
   * `portal_subdomain` had existed on Builder and ChannelPartner since
   * subdomain routing shipped and nothing read it, so `lotus.propfyndr.in`
   * showed a builder a page branded PropFyndr — a white-label that
   * white-labelled nothing.
   *
   * Presentation only, and it must stay that way: the tenant slug is a public
   * string anyone can type. It decides what the page SAYS, never what the
   * session may see. An unknown slug leaves `tenant` null and the plain shell
   * renders, rather than a half-branded one.
   */
  useEffect(() => {
    const slug = params.get('tenant')
    if (!slug) return
    let cancelled = false
    fetch(`${API_BASE}/portal/tenant/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((t: Tenant) => { if (!cancelled) setTenant(t) })
      .catch(() => { /* Unknown tenant: plain shell. */ })
    return () => { cancelled = true }
  }, [params])

  useEffect(() => {
    let cancelled = false
    adminFetch('/portal/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((me: { role: PortalRole }) => {
        if (cancelled) return
        router.replace(HOME_FOR_ROLE[me.role] ?? '/admin/login')
      })
      .catch(() => {
        if (cancelled) return
        // No session, or an expired one. The login page routes by role on the
        // way back, so the tenant lands in the right console after signing in.
        router.replace('/admin/login')
      })

    // If neither branch has navigated after a moment, say something rather
    // than leaving a bare spinner spinning forever.
    const t = setTimeout(() => { if (!cancelled) setMessage('Still working — taking you to sign in.') }, 4000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [router])

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-zinc-950 flex flex-col items-center justify-center gap-5 px-6">
      {tenant ? (
        <div className="flex flex-col items-center gap-3">
          {tenant.logo_url ? (
            // Tenant logos are arbitrary remote URLs, so next/image's optimiser
            // is bypassed rather than adding every builder's host to the config.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt={tenant.name} className="h-12 object-contain" />
          ) : null}
          <p className="text-[15px] font-bold text-zinc-900 dark:text-white">{tenant.name}</p>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500">Partner portal, powered by PropFyndr</p>
        </div>
      ) : (
        <>
          <Image src="/images/icons/logo-wordmark-black.png" alt="PropFyndr" width={110} height={50} className="object-contain block dark:hidden" unoptimized />
          <Image src="/images/icons/logo-wordmark-white.png" alt="PropFyndr" width={110} height={50} className="object-contain hidden dark:block" unoptimized />
        </>
      )}
      <div className="w-7 h-7 border-2 border-zinc-800 dark:border-zinc-200 border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
      {message && <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{message}</p>}
    </div>
  )
}
