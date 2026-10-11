'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { arrive, getStoredReferralCode, storeReferralCode } from '@/lib/referral'

/** Admin/portal/builder/partner staff are not referral subjects. */
const SKIP_PREFIXES = ['/admin', '/portal', '/builder', '/partner']

export default function ReferralTracker(): null {
  const pathname = usePathname()

  useEffect(() => {
    if (SKIP_PREFIXES.some((p) => pathname?.startsWith(p))) return
    if (getStoredReferralCode()) return // already has an own code this device; nothing to arrive on again

    const params = new URLSearchParams(window.location.search)
    if (params.get('preview') === '1') return // admin previewing their own link — never arrive()
    const code = params.get('r')

    let cancelled = false
    arrive(code).then((result) => {
      if (cancelled || !result) return
      storeReferralCode(result.ownCode)

      const url = new URL(window.location.href)
      url.searchParams.set('r', result.ownCode)
      window.history.replaceState({}, '', url.toString())

      if (result.greeting) {
        window.dispatchEvent(new CustomEvent('propfyndr:referral-greeting', { detail: result.greeting }))
      }
    })

    return () => {
      cancelled = true
    }
  }, [pathname])

  return null
}
