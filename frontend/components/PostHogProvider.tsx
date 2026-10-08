'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { capture, preloadPostHog } from '@/lib/posthogClient'

// posthog-js is loaded lazily (see lib/posthogClient.ts) — it is ~219 KB and
// used to sit in the root layout's chunk, so every route paid for it before
// first paint. The `posthog-js/react` context provider is gone with it: nothing
// in this codebase calls `usePostHog()`, so it was 100% overhead.

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const qs = searchParams.toString()
    const url = window.origin + pathname + (qs ? `?${qs}` : '')
    capture('$pageview', { $current_url: url })

    // Client-side navigation never unloads the page, so posthog-js never sends
    // $pageleave for it. Tab close is not handled here: `capture_pageleave`
    // already sends that one on unload, by beacon.
    return () => {
      capture('$pageleave', { $current_url: url })
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Warm the library once the browser is idle so the first real event does not
  // pay the download latency.
  useEffect(() => {
    if (typeof window === 'undefined') return
    preloadPostHog()
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  )
}
