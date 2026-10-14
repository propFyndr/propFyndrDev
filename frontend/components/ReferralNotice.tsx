'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

const DISMISS_KEY = 'referral-notice-dismissed'
const SHOW_DELAY_MS = 800
const AUTO_HIDE_MS = 10_000

/**
 * Small, cookie-banner-style disclosure: chats may be reviewed by the
 * RealtyAsk team (not just the person who sent it) to understand how
 * RealtyAsk spreads. Shown once; dismissed on close, on sending the first
 * message, or automatically after 10 seconds — whichever comes first.
 */
export default function ReferralNotice() {
  const [visible, setVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === 'true'
    } catch {
      // localStorage unavailable: show the notice rather than silently skip disclosure
    }
    if (dismissed) return

    const showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(showTimer)
  }, [])

  useEffect(() => {
    if (!visible) return
    hideTimerRef.current = setTimeout(() => dismiss(), AUTO_HIDE_MS)
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      // non-fatal: shows again next session, acceptable
    }
  }

  if (!visible) return null

  return (
    <div
      role="status"
      className="fixed bottom-2 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-max sm:max-w-md z-40 pointer-events-auto"
    >
      <div className="flex items-center gap-2 rounded-xl bg-[#0c0d14]/85 backdrop-blur-xl border border-white/10 shadow-lg px-3.5 py-2.5 text-white">
        <p className="text-[11px] text-zinc-300/90 leading-snug flex-1">
          Chats are stored and may be reviewed by the RealtyAsk team to improve answers.{' '}
          <Link href="/privacy" prefetch={false} className="underline underline-offset-2 text-blue-400 hover:text-blue-300">
            Privacy policy
          </Link>
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
