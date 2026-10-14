'use client'

import { useEffect, useState } from 'react'
import { X, Cookie, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'

export default function CookiesBanner() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const cookieConsent = localStorage.getItem('cookies-consent')
    if (!cookieConsent) {
      const timer = setTimeout(() => setShowBanner(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookies-consent', 'accepted')
    localStorage.setItem('cookies-consent-date', new Date().toISOString())
    setShowBanner(false)
  }

  const handleReject = () => {
    localStorage.setItem('cookies-consent', 'rejected')
    localStorage.setItem('cookies-consent-date', new Date().toISOString())
    setShowBanner(false)
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <m.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 pointer-events-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-[#0c0d14]/90 dark:bg-[#0c0d14]/95 backdrop-blur-2xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.2)] p-4 sm:p-5 text-white ring-1 ring-black/40">
            {/* Ambient subtle glow background */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              {/* Header section with Icon & Close */}
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
                    <Cookie size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white tracking-tight leading-none">Cookie Preferences</h3>
                    <p className="text-[10px] font-medium text-blue-400/90 mt-0.5 flex items-center gap-1">
                      <ShieldCheck size={11} /> 100% Privacy Compliant
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowBanner(false)}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95"
                  aria-label="Close cookies banner"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Message */}
              <p className="text-xs text-zinc-300/90 leading-relaxed mb-4 font-normal">
                We use essential cookies to analyze site performance and personalize your property discovery journey. Learn more in our{' '}
                <Link href="/privacy" prefetch={false} className="text-blue-400 underline underline-offset-2 hover:text-blue-300 font-medium transition-colors">
                  Privacy Policy
                </Link>.
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAccept}
                  className="flex-1 py-2 px-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all duration-200 active:scale-95 cursor-pointer text-center whitespace-nowrap"
                >
                  Accept All
                </button>

                <button
                  onClick={handleReject}
                  className="py-2 px-3.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 text-xs font-semibold rounded-xl transition-all duration-200 active:scale-95 cursor-pointer text-center whitespace-nowrap"
                >
                  Decline
                </button>

                <Link
                  href="/privacy"
                  prefetch={false}
                  className="py-2 px-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/10 text-xs font-medium rounded-xl transition-all duration-200 cursor-pointer text-center whitespace-nowrap"
                >
                  Manage
                </Link>
              </div>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
