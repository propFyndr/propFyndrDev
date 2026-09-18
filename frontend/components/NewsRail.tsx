'use client'

/**
 * The news rail on the discovery screen.
 *
 * An ad unit whose payload is a conversation rather than a landing page, and
 * that is the entire advantage. A portal banner sends a buyer to a listing page
 * where they bounce; tapping this opens the advisor already knowing which
 * project they tapped, ready to answer the next four questions — price,
 * possession, location, trade-off — from that project's own verified rows.
 *
 * Which is why the tap seeds a QUESTION rather than an answer. The seeded text
 * goes through the same `propfyndr:ask-ai` bus a typed question uses, so the
 * router classifies it identically and there is no second path by which an
 * answer can be produced. The promotional's own marketing copy never becomes
 * the answer; it only decides what gets asked.
 *
 * The constraint that makes this sellable twice: a promoted project is never
 * ranked higher in recommendations. Nothing here touches ordering.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '@/lib/env'
import { getOrCreateGuestToken } from '@/lib/guestToken'

interface Promotional {
  id: string
  title: string
  description: string | null
  content: string
  image_url: string | null
  link_type: string | null
  link_target: string | null
}

/** How long each item holds the rail before the next one rotates in. */
const ROTATE_MS = 7000

function guestHeaders(): Record<string, string> {
  try {
    const token = getOrCreateGuestToken()
    return token ? { 'x-guest-token': token } : {}
  } catch {
    // Private window, blocked storage. An unattributed impression is still
    // worth recording; it is not worth failing the render over.
    return {}
  }
}

/**
 * Analytics that must never break the page a buyer is reading. Fire and forget,
 * errors swallowed on purpose — the endpoint answers 202 for the same reason.
 */
function record(id: string, interaction_type: 'impression' | 'click'): void {
  void fetch(`${API_BASE}/promotionals/${id}/interaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...guestHeaders() },
    body: JSON.stringify({ interaction_type }),
  }).catch(() => {})
}

export default function NewsRail() {
  const [items, setItems] = useState<Promotional[]>([])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  /** Ids already counted this mount, so rotation does not inflate impressions. */
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/promotionals/active?type=news_feature`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { promotionals: Promotional[] }) => {
        if (!cancelled) setItems(data.promotionals ?? [])
      })
      .catch(() => { /* No rail rather than an error message. */ })
    return () => { cancelled = true }
  }, [])

  // One impression per item per mount, counted when it actually becomes visible.
  useEffect(() => {
    const current = items[index]
    if (!current || seen.current.has(current.id)) return
    seen.current.add(current.id)
    record(current.id, 'impression')
  }, [items, index])

  useEffect(() => {
    if (paused || items.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [paused, items.length])

  const open = useCallback(async (promo: Promotional) => {
    record(promo.id, 'click')
    let question = `Tell me more about: ${promo.title}`
    try {
      const res = await fetch(`${API_BASE}/promotionals/${promo.id}/context`)
      if (res.ok) {
        const ctx = await res.json()
        if (ctx?.seed_question) question = ctx.seed_question
      }
    } catch {
      // Fall back to the headline. Better a slightly vaguer question than a
      // tap that does nothing.
    }
    window.dispatchEvent(
      new CustomEvent('propfyndr:ask-ai', { detail: { text: question, autoSend: true } }),
    )
  }, [])

  if (items.length === 0) return null
  const current = items[index]

  return (
    <section
      aria-label="Project news"
      className="w-full max-w-[800px] mb-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <button
        type="button"
        onClick={() => void open(current)}
        className="w-full text-left flex items-center gap-4 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
      >
        {current.image_url ? (
          // Arbitrary remote host per builder; the optimiser is bypassed rather
          // than adding every one of them to next.config.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
        ) : (
          <span className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0" aria-hidden="true" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            News
          </span>
          <span className="block text-[14px] font-bold text-zinc-900 dark:text-white truncate">
            {current.title}
          </span>
          <span className="block text-[12px] text-zinc-500 dark:text-zinc-400 truncate">
            {current.description || current.content}
          </span>
        </span>

        <span className="text-[12px] font-bold text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:block">
          Ask about this
        </span>
      </button>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2" role="tablist" aria-label="News items">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={item.title}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                i === index ? 'w-5 bg-zinc-800 dark:bg-zinc-200' : 'w-1.5 bg-zinc-300 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
