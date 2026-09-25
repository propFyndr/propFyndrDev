'use client'

/**
 * PropFyndr — live builder announcement ticker.
 *
 * A single rotating headline below the discovery prompt chips. Tapping it asks
 * the advisor about that announcement.
 *
 * What the rail decides is what a buyer is INVITED TO ASK about. It must never
 * influence what the advisor RECOMMENDS — the fallback below reads from
 * `promotionals`, which are paid placements, and `buildNewsContext` on the
 * backend no longer appends a project list for exactly that reason.
 *
 * Rotation is paused by any interaction that means "I am reading this" — hover,
 * touch, or keyboard focus. Without the touch and focus cases the rail advanced
 * underneath the user between reading a headline and acting on it, and the
 * question that got sent named a different announcement.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { API_BASE } from '@/lib/env'

export interface BuilderNewsItem {
  id: string
  title: string
  description?: string | null
  image_url?: string | null
  link_type?: 'builder' | 'project' | 'external_url' | null
  link_target?: string | null
  run_as_promo?: boolean
  created_at: string
  published_at?: string | null
  builder?: {
    id: string
    name: string
    slug: string
  } | null
}

const ROTATE_INTERVAL_MS = 3400

export default function NewsRail() {
  const [items, setItems] = useState<BuilderNewsItem[]>([])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)

  // Honours prefers-reduced-motion. The CSS block in globals.css and the
  // <MotionConfig reducedMotion="user"> in app/layout.tsx already flatten the
  // slide and the pulse, but neither can see a setInterval — an element
  // swapping its own content every 3.4s is motion whatever the transition does.
  const reduceMotion = useReducedMotion()
  const rotating = !paused && !reduceMotion && items.length > 1

  useEffect(() => {
    let cancelled = false

    async function loadNews() {
      try {
        const res = await fetch(`${API_BASE}/news/active`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && data.news && data.news.length > 0) {
            setItems(data.news)
            return
          }
        }

        // Fallback to active promotionals if the news endpoint had 0 items.
        const promoRes = await fetch(`${API_BASE}/promotionals/active?type=news_feature`)
        if (promoRes.ok) {
          const promoData = await promoRes.json()
          if (!cancelled && promoData.promotionals && promoData.promotionals.length > 0) {
            const mapped: BuilderNewsItem[] = promoData.promotionals.map((p: any) => ({
              id: p.id,
              title: p.title,
              description: p.description || p.content,
              image_url: p.image_url,
              link_type: p.link_type,
              link_target: p.link_target,
              created_at: new Date().toISOString(),
              builder: p.builder || null,
            }))
            setItems(mapped)
          }
        }
      } catch {
        // Non-blocking fail-open
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadNews()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!rotating) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [rotating, items.length])

  const handleTrigger = useCallback((newsItem: BuilderNewsItem) => {
    const builderName = newsItem.builder?.name || 'this builder'
    const question = `Tell me more about ${builderName}'s recent update: "${newsItem.title}". What does this mean for property buyers?`

    window.dispatchEvent(
      new CustomEvent('propfyndr:ask-ai', {
        detail: { text: question, autoSend: true },
      })
    )
  }, [])

  if (loading || items.length === 0) return null

  const current = items[index]
  if (!current) return null

  const label = current.builder?.name
    ? `Ask the advisor about ${current.builder.name}: ${current.title}`
    : `Ask the advisor about this update: ${current.title}`

  return (
    <div className="w-full max-w-[800px] flex items-center justify-center mt-2.5 mb-1 px-3 sm:px-4 select-none">
      <button
        type="button"
        onClick={() => handleTrigger(current)}
        // Every "I am reading this" signal pauses, not just the mouse.
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        onTouchCancel={() => setPaused(false)}
        aria-label={label}
        title="Ask the AI advisor about this update"
        className="group relative inline-flex items-center gap-2 sm:gap-2.5 py-1.5 px-3 sm:px-3.5 rounded-full bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:scale-[0.98] transition-all duration-200 cursor-pointer max-w-full w-full sm:w-auto text-left min-h-[38px] sm:min-h-[32px]"
      >
        {/* Live broadcast badge. The pulse is decorative and carries no state,
            so the reduced-motion block in globals.css stopping it loses nothing. */}
        <span
          aria-hidden="true"
          className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
          </span>
          LIVE
        </span>

        {current.builder?.name && (
          <span
            aria-hidden="true"
            className="text-[11.5px] sm:text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 shrink-0 max-w-[90px] sm:max-w-none truncate"
          >
            {current.builder.name}
            <span className="text-zinc-400 dark:text-zinc-500 font-normal ml-1">·</span>
          </span>
        )}

        {/* Announced only when it is NOT auto-advancing. A polite live region
            that fires every 3.4 seconds talks over everything else a screen
            reader user is trying to do; once rotation is paused or reduced, a
            change is something they caused and is worth hearing. */}
        <div
          role="status"
          aria-live={rotating ? 'off' : 'polite'}
          className="h-5 flex items-center overflow-hidden min-w-0 flex-1"
        >
          <AnimatePresence mode="wait">
            <m.span
              key={current.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="text-[11.5px] sm:text-[12.5px] font-medium tracking-tight text-zinc-600 dark:text-zinc-300 group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors truncate block"
            >
              {current.title}
            </m.span>
          </AnimatePresence>
        </div>

        <ArrowSquareOut
          size={13}
          weight="bold"
          aria-hidden="true"
          className="text-zinc-400 dark:text-zinc-500 group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] group-hover:translate-x-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-all duration-150"
        />
      </button>
    </div>
  )
}
