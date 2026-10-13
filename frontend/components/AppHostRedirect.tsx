'use client'

import { useEffect } from 'react'
import { getOrCreateGuestToken } from '@/lib/guestToken'
import { getStoredReferralCode, storeReferralCode } from '@/lib/referral'
import { appHostTarget, migrateAuthCookiesToSharedDomain } from '@/lib/sharedIdentity'

/**
 * realtyask.in/discover and /saved belong on app.realtyask.in. Before moving,
 * copy this browser's guest token, referral code and login into the
 * `.realtyask.in` cookies the app host reads, so the buyer arrives as the same
 * person with the same chats — a server-side redirect would land them as a
 * stranger. See lib/sharedIdentity.ts.
 */
export default function AppHostRedirect(): null {
  useEffect(() => {
    const target = appHostTarget(window.location)
    if (!target) return
    getOrCreateGuestToken()
    const code = getStoredReferralCode()
    if (code) storeReferralCode(code)
    migrateAuthCookiesToSharedDomain()
    window.location.replace(target)
  }, [])

  return null
}
