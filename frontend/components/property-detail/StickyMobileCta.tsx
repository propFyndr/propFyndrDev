'use client'

import React from 'react'
import { MessageSquare, PhoneCall } from 'lucide-react'

interface StickyMobileCtaProps {
  projectName: string
  priceRange?: string | null
  onAskAi: () => void
  onBookVisit: () => void
}

export default function StickyMobileCta({
  projectName,
  priceRange,
  onAskAi,
  onBookVisit,
}: StickyMobileCtaProps) {
  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200/90 dark:border-zinc-800/90 px-3 pt-2.5 shadow-[0_-8px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_25px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
      role="region"
      aria-label="Mobile property quick actions"
    >
      <div className="flex items-center gap-2 max-w-md mx-auto">
        {/* Book Visit / Callback Button */}
        <button
          type="button"
          onClick={onBookVisit}
          className="flex-1 h-12 px-3 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-bold border border-zinc-200 dark:border-zinc-700 transition-all active:scale-[0.98] cursor-pointer"
        >
          <PhoneCall className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">Book Visit</span>
        </button>

        {/* Ask AI Advisor Button */}
        <button
          type="button"
          onClick={onAskAi}
          className="flex-1 h-12 px-3 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 text-blue-200 shrink-0" />
          <span className="truncate">Ask AI Advisor</span>
        </button>
      </div>
    </div>
  )
}
