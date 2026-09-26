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
import { ArrowRight } from '@phosphor-icons/react'
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

const ROTATE_INTERVAL_MS = 6000

export default function NewsRail() {
  const [items, setItems] = useState<BuilderNewsItem[]>([])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)

  // Honours prefers-reduced-motion. The CSS block in globals.css and the
  // <MotionConfig reducedMotion="user"> in app/layout.tsx already flatten the
  // slide and the pulse, but neither can see a setInterval — an element
  // swapping its own content every 6s is motion whatever the transition does.
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
    <div className="w-full flex items-center justify-center mt-2.5 mb-1 select-none">
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
        className="group relative inline-flex items-center gap-2 sm:gap-2.5 py-1.5 px-3 sm:px-3.5 rounded-full bg-transparent hover:bg-surface-3 dark:hover:bg-zinc-800 transition-colors duration-150 cursor-pointer max-w-full w-full sm:w-auto text-left min-h-[38px] sm:min-h-[32px]"
      >
        {/* Plain label, not a pulsing "LIVE" badge — this is a builder's own
            announcement, and dressing it as breaking news oversells it. */}
        <span aria-hidden="true" className="text-xs text-text-muted shrink-0">
          Builder update
        </span>

        {current.builder?.name && (
          <span
            aria-hidden="true"
            className="text-[13px] font-semibold text-text-primary shrink-0 max-w-[90px] sm:max-w-none truncate"
          >
            {current.builder.name}
            <span className="text-text-muted font-normal ml-1">·</span>
          </span>
        )}

        {/* Announced only when it is NOT auto-advancing. A polite live region
            that fires every 6 seconds talks over everything else a screen
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
              className="text-[13px] font-medium text-text-secondary group-hover:text-primary transition-colors truncate block"
            >
              {current.title}
            </m.span>
          </AnimatePresence>
        </div>

        {/* ArrowRight, not an external-link glyph: a tap asks the advisor, it
            never leaves the page. */}
        <ArrowRight
          size={13}
          weight="bold"
          aria-hidden="true"
          className="text-text-muted group-hover:text-primary shrink-0 transition-colors duration-150"
        />
      </button>
    </div>
  )
}
