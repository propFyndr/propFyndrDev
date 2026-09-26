'use client'

import { useState, useRef, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  ShieldCheck,
  BookmarkSimple,
  CaretLeft, CaretRight,
  Buildings, PhoneCall, ShareNetwork, ChatCenteredText,
  Coins, MapPinLine, ChartLineUp, Scales, WarningCircle, PencilSimple, Warning, Drop,
} from '@phosphor-icons/react'
import type { ProjectCard as ProjectCardType } from '@/types/project'
import { API_BASE } from '@/lib/env'
import { track, trackPropertyEvent } from '@/lib/analytics'
import { authHeaders } from '@/lib/authedFetch'
import { resolveImgUrl } from '@/lib/utils'
import { usePreferredImages } from '@/lib/hooks'
import { sanitizePriceLabel } from '@/lib/format'


interface Props {
  project: ProjectCardType
  userId: string | null
  sessionId?: string | null
  index?: number
  /**
   * Show the "Best fit for your brief" eyebrow. Opt-in, because only a list
   * ranked against the buyer's brief can honestly say its first card is the
   * best fit — a saved list or a comparison cannot.
   */
  isTopPick?: boolean
  isSelectable?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
  onDetailOpen?: (project: ProjectCardType) => void
  onToast?: (message: string) => void
  onAskAI?: (project: ProjectCardType) => void
  onSetSiteVisit?: (project: ProjectCardType) => void
  onCall?: (project: ProjectCardType) => void
  onShare?: (project: ProjectCardType) => void
  quickActions?: React.ReactNode
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'

// scoring.ts appends recommendation-tier words to the reasons. The card shows
// why a project fits the brief, not a buy/avoid verdict, so those are dropped.
const VERDICT_REASONS = new Set(['strong buy', 'recommended'])

function buildReason(project: ProjectCardType): string | null {
  const parts = (project.matchReasons ?? []).filter(r => r && !VERDICT_REASONS.has(r.trim().toLowerCase()))
  const text = parts.length > 0 ? parts.slice(0, 3).join(', ') : (project.matchReason ?? '')
  // "matches your search" is the scorer's empty-handed fallback — it says nothing.
  if (!text.trim() || text.trim().toLowerCase() === 'matches your search') return null
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function ProjectCard({ project, userId, sessionId, index = 0, isTopPick = false, isSelectable = false, isSelected = false, onToggleSelect, onDetailOpen, onToast, onAskAI, onShare, onCall, quickActions }: Props) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  // Per-card, not lifted: one card expanding its configurations says nothing
  // about the others, and the panel closes when the card unmounts.
  const [showAllConfigs, setShowAllConfigs] = useState(false)
  const configSlotRef = useRef<HTMLDivElement>(null)
  const [askMenuOpen, setAskMenuOpen] = useState(false)

  useEffect(() => {
    if (isSelectable && !onToggleSelect) {
      console.warn(`[ProjectCard] isSelectable=true but onToggleSelect callback is missing for project ${project.id}`)
    }
  }, [isSelectable, onToggleSelect, project.id])

  // Hover is a capability, not a screen width: a tablet at 1024px has none, a
  // small laptop at 800px has one. Matching the pointer rather than the
  // viewport is what keeps the configurations panel from opening on a device
  // that can never close it by moving away.
  const [canHover, setCanHover] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setCanHover(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Tap-to-open needs tap-to-dismiss. Capture phase, because a tap landing on
  // another card would otherwise be handled there first and leave this panel
  // open behind it.
  useEffect(() => {
    if (!showAllConfigs || canHover) return
    const onDown = (e: PointerEvent) => {
      if (!configSlotRef.current?.contains(e.target as Node)) setShowAllConfigs(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAllConfigs(false) }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [showAllConfigs, canHover])

  const askMenuRef = useRef<HTMLDivElement>(null)
  const { activeUrl, workingImages, allFailed, hasMultiple, imgIdx, markImageFailed, prevImg, nextImg, setImgIdx } = usePreferredImages(project)

  useEffect(() => {
    if (!askMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (askMenuRef.current && !askMenuRef.current.contains(e.target as Node)) {
        setAskMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [askMenuOpen])

  const isRTM = project.status === 'ready_to_move'
  const isNew = project.status === 'new_launch'
  const isDelayed = project.possession_label ? (project.possession_label.toLowerCase().includes('delayed') || project.possession_label.toLowerCase().includes('disputed')) : false

  // Format and shorten possession / status label for clean UI display without long overflow.
  // Abbreviate the month before ever truncating — a hard slice on "Expected October 2023"
  // eats the year, which is the single most decision-relevant token in the label.
  const rawPossession = (project.possession_label || '').trim()
  const cleanPossession = rawPossession
    .replace(/^possession[:\s-]*/i, '')
    .replace(/under construction\s*\(([^)]+)\)/i, '$1')
    .replace(/under construction/i, 'Under Const.')
    .replace(/\b(January|February|August|September|October|November|December)\b/gi, m => m.slice(0, 3))
    .trim()

  const statusLabel = isRTM
    ? 'Ready to Move'
    : isDelayed
      ? 'Delayed'
      : isNew
        ? 'New Launch'
        : cleanPossession
          ? (cleanPossession.length > 20 ? cleanPossession.slice(0, 18) + '…' : cleanPossession)
          : 'Under Construction'

  const askPrompts: Array<{ icon: React.ElementType; label: string; text: string; type: string }> = [
    { icon: Coins, label: 'Payment plans & offers', text: `What are the payment plans and current offers for ${project.name}?`, type: 'payment' },
    { icon: MapPinLine, label: "What's around it?", text: `What's around ${project.name} in ${project.sector}? Metro, schools, malls, hospitals.`, type: 'vicinity' },
    { icon: ChartLineUp, label: 'Price trend, last 12 months', text: `How has the price of ${project.name} changed over the last 12 months?`, type: 'price_trend' },
    { icon: Scales, label: 'Compare with nearby projects', text: `Compare ${project.name} with similar nearby projects in ${project.sector}.`, type: 'compare' },
  ]
  // First, not last: the mobile menu shows three prompts, and the one about
  // this project's weaknesses is the one a trust-first advisor must not hide.
  if (project.concerns && project.concerns.length > 0) {
    askPrompts.unshift({ icon: WarningCircle, label: 'Any concerns?', text: `What are the concerns or red flags with ${project.name}?`, type: 'concerns' })
  }

  const reason = buildReason(project)
  const tradeoff = project.concerns?.find(c => c && c.trim()) ?? null
  const price = sanitizePriceLabel(project.price_range_label)

  // Ground-truth facts that used to be a row of pills. On mobile they are one
  // quiet line; the drain is a negative, so it keeps the warning colour.
  const metaFacts: Array<{ text: string; warn?: boolean }> = []
  if (project.oc_status === 'FULL_OC') metaFacts.push({ text: 'Full OC' })
  if (project.oc_status === 'PHASED_OC') metaFacts.push({ text: 'Phased OC' })
  if (project.amitabh_kant_clearance) metaFacts.push({ text: 'Registry cleared' })
  if (project.shahdara_drain_impact) metaFacts.push({ text: 'Near Shahdara drain', warn: true })
  else if (project.water_source_type === 'GANGA_JAL') metaFacts.push({ text: 'Ganga Jal supply' })

  const rawUnitTypes = Array.isArray(project.unit_types) ? project.unit_types : []
  const unitsByBhk = rawUnitTypes.reduce((acc, u) => {
    if (!u || u.bhk == null) return acc
    if (!acc[u.bhk]) acc[u.bhk] = []
    const area = u.super_area_sqft || u.carpet_area_sqft
    if (area) acc[u.bhk].push(`${area}sqft`)
    return acc
  }, {} as Record<number, string[]>)

  const bhkGroups = Object.entries(unitsByBhk)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([bhk, areas]) => ({
      bhk: Number(bhk),
      areas: [...new Set(areas)].sort((a, b) => parseInt(a) - parseInt(b))
    }))

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId || saving) return
    setSaving(true)
    const wasSaved = saved
    setSaved(!wasSaved)

    try {
      if (wasSaved) {
        const res = await fetch(`${API_BASE}/saved/${project.id}`, {
          method: 'DELETE',
          headers: await authHeaders(),
        })
        if (!res.ok) throw new Error('Delete failed')
        onToast?.('Removed from saved')
      } else {
        const res = await fetch(`${API_BASE}/saved`, {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ project_id: project.id }),
        })
        if (!res.ok) throw new Error('Save failed')
        track('property_saved', { project_slug: project.slug, project_name: project.name })
        trackPropertyEvent(project.id, 'save', sessionId, userId).catch(() => {})

        onToast?.('Saved')
      }
    } catch (err) {
      console.error('[ProjectCard] save failed:', err)
      setSaved(wasSaved)

      onToast?.('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleShareProject = async (e: React.MouseEvent) => {
    e.stopPropagation()
    track('share_tapped', { project_slug: project.slug, project_name: project.name })
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/property/${project.slug}?ref=share`
    const text = `${project.name} · ${project.sector} — ${price}. Reviewed with PropFyndr AI:`
    try {
      if (navigator.share) {
        await navigator.share({ title: project.name, text, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
        onToast?.('Link copied')
      }
    } catch {
      // user cancelled the native sheet
    }
    onShare?.(project)
  }

  const handleCardClick = () => {
    if (isSelectable) {
      onToggleSelect?.()
      return
    }
    trackPropertyEvent(project.id, 'card_click', sessionId, userId).catch(() => {})
    onDetailOpen?.(project)
  }

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation()
    track('call_tapped', { project_slug: project.slug, project_name: project.name })
    trackPropertyEvent(project.id, 'call', sessionId, userId).catch(() => {})
    onCall?.(project)
  }

  const runPrompt = (e: React.MouseEvent, type: string, text: string, autoSend: boolean) => {
    e.stopPropagation()
    setAskMenuOpen(false)
    track('ask_ai_tapped', { project_slug: project.slug, prompt_type: type })
    if (autoSend) trackPropertyEvent(project.id, 'ask_ai', sessionId, userId).catch(() => {})
    window.dispatchEvent(new CustomEvent('propfyndr:ask-ai', { detail: { text, autoSend } }))
    onAskAI?.(project)
  }

  const builderName = typeof project.builder === 'object' ? project.builder?.name : project.builder
  const statusDot = isRTM ? 'bg-emerald-500' : isDelayed ? 'bg-rose-500' : isNew ? 'bg-primary' : 'bg-amber-500'

  // The name is the card's one real control. Its ::after stretches over the
  // whole card, so the card is clickable without being a clickable div, and
  // every nested control sits above it at z-10.
  const nameButton = (
    <button
      type="button"
      onClick={handleCardClick}
      aria-pressed={isSelectable ? isSelected : undefined}
      className="block w-full truncate text-left focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
      title={project.name}
    >
      {project.name}
    </button>
  )

  const topPickEyebrow = isTopPick && !isSelectable
    ? <p className="text-[11px] font-medium text-primary">Best fit for your brief</p>
    : null

  // Reason and trade-off, at equal weight. Either line is omitted when the
  // data is absent — never filled in.
  const fitBlock = (reason || tradeoff) ? (
    <div className="space-y-1">
      {reason && (
        <p className="text-[13px] leading-snug text-zinc-700 dark:text-zinc-300 line-clamp-2">{reason}</p>
      )}
      {tradeoff && (
        <p className="flex items-start gap-1 text-[13px] leading-snug text-amber-800 dark:text-amber-300">
          <Warning size={13} weight="fill" className="mt-[3px] shrink-0" aria-hidden="true" />
          <span className="line-clamp-2"><span className="sr-only">Trade-off: </span>{tradeoff}</span>
        </p>
      )}
    </div>
  ) : null

  const menuItemCls = 'w-full flex items-center gap-2 px-2.5 py-2 rounded-xs text-left text-[13px] text-zinc-700 dark:text-zinc-200 hover:bg-surface-3 dark:hover:bg-zinc-800 transition-colors ' + FOCUS

  return (
    <div
      data-project-id={project.id}
      // h-full is what makes the grid uniform. Grid items stretch, so the
      // wrapper was already full height, but the card inside sized to its own
      // content — a project with a shorter tagline produced a shorter card and
      // the row looked ragged.
      className={`group relative w-full h-full flex flex-col rounded-2xl overflow-hidden border bg-surface dark:bg-zinc-900 transition-colors duration-150 cursor-pointer select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
        isSelected
          ? 'border-primary ring-2 ring-primary z-20'
          : isSelectable
            ? 'border-primary/40 hover:border-primary'
            : 'border-border hover:border-border-heavy'
      }`}
    >
      {/* ════════════════════════════════════════════════════════════════════════
          1. MOBILE COMPACT CARD
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="flex md:hidden flex-row items-stretch p-3 gap-3 w-full min-h-[135px]">
        {/* Left: Info & Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="space-y-1.5">
            {/* Two pills at most: status and RERA */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium max-w-[140px] truncate ${
                isRTM
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : isDelayed
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                    : 'bg-surface-3 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`} title={rawPossession || statusLabel}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                <span className="truncate">{statusLabel}</span>
              </span>

              {project.rera_number && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                  <ShieldCheck size={11} weight="fill" aria-hidden="true" />
                  RERA
                </span>
              )}
            </div>

            {/* Title & Subtitle */}
            <div>
              {topPickEyebrow}
              <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 leading-snug">
                {nameButton}
              </h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {builderName} · {project.sector}
              </p>
            </div>

            {/* Price — for the size asked for, when one was */}
            <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 leading-none tabular-nums">
              {price}
              {project.price_for_bhk && (
                <span className="ml-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 align-middle">
                  {project.price_for_bhk}
                </span>
              )}
            </p>

            {fitBlock}

            {/* BHK & Area summary line */}
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {bhkGroups.length > 0
                ? `${bhkGroups.map(g => `${g.bhk} BHK`).join(', ')}${bhkGroups[0]?.areas[0] ? ` (${bhkGroups[0].areas[0]})` : ''}`
                : 'Configurations not listed'}
            </div>

            {metaFacts.length > 0 && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {metaFacts.map((f, i) => (
                  <span key={f.text} className={f.warn ? 'text-amber-800 dark:text-amber-300' : undefined}>
                    {i > 0 && ' · '}{f.text}
                  </span>
                ))}
              </p>
            )}
          </div>

          {/* Quick Actions Row */}
          <div className="flex items-center gap-2 pt-2 mt-auto">
            {onAskAI ? (
              <div className="relative z-10 flex-1" ref={askMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAskMenuOpen((v) => !v)
                  }}
                  className={`relative w-full h-7 px-2.5 rounded-xs bg-primary hover:bg-primary-dark text-white text-[12px] font-medium flex items-center justify-center gap-1 transition-colors before:absolute before:-inset-2 before:content-[''] ${FOCUS}`}
                  aria-haspopup="menu"
                  aria-expanded={askMenuOpen}
                >
                  <ChatCenteredText size={13} weight="fill" aria-hidden="true" />
                  Ask AI
                </button>

                <AnimatePresence>
                  {askMenuOpen && (
                    <m.div
                      role="menu"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-sm border border-border bg-surface dark:bg-zinc-900 shadow-md p-1"
                    >
                      {askPrompts.slice(0, 3).map((p) => (
                        <button
                          key={p.type}
                          type="button"
                          role="menuitem"
                          onClick={(e) => runPrompt(e, p.type, p.text, true)}
                          className={menuItemCls}
                        >
                          <p.icon size={14} className="text-primary shrink-0" aria-hidden="true" />
                          <span className="truncate">{p.label}</span>
                        </button>
                      ))}
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <button
              type="button"
              onClick={handleCall}
              className={`relative z-10 w-9 h-9 rounded-xs bg-surface-3 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0 ${FOCUS}`}
              aria-label={`Request a callback for ${project.name}`}
              title="Request a callback"
            >
              <PhoneCall size={14} weight="bold" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={handleShareProject}
              className={`relative z-10 w-9 h-9 rounded-xs bg-surface-3 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0 ${FOCUS}`}
              aria-label={`Share ${project.name}`}
              title="Share project"
            >
              <ShareNetwork size={14} weight="bold" aria-hidden="true" />
            </button>
          </div>

          {quickActions && (
            <div onClick={(e) => e.stopPropagation()} className="relative z-10 pt-1.5">
              {quickActions}
            </div>
          )}
        </div>

        {/* Right: thumbnail */}
        <div className="w-[110px] sm:w-[125px] rounded-sm overflow-hidden relative bg-surface-3 dark:bg-zinc-800 flex-shrink-0 self-stretch">
          {isSelectable && (
            <div className="absolute top-1.5 left-1.5 z-30">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}
                className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[11px] transition-colors before:absolute before:-inset-2 before:content-[''] ${FOCUS} ${
                  isSelected ? 'bg-primary text-white font-semibold ring-2 ring-white' : 'bg-black/60 text-white border border-white/40'
                }`}
                aria-label={isSelected ? `Deselect ${project.name}` : `Select ${project.name}`}
                aria-pressed={isSelected}
              >
                {isSelected ? '✓' : ''}
              </button>
            </div>
          )}

          {activeUrl ? (
            <Image
              src={resolveImgUrl(activeUrl) || activeUrl}
              alt={project.name}
              fill
              priority={index < 3}
              onError={() => { if (activeUrl) markImageFailed(activeUrl) }}
              className="object-cover"
              sizes="130px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Buildings size={28} weight="duotone" className="text-zinc-400" aria-hidden="true" />
            </div>
          )}

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={handleSave}
            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors z-10 before:absolute before:-inset-2 before:content-[''] ${FOCUS}`}
            aria-label={saved ? `Remove ${project.name} from saved` : `Save ${project.name}`}
            aria-pressed={saved}
            title={saved ? 'Unsave' : 'Save'}
          >
            <BookmarkSimple size={12} weight={saved ? 'fill' : 'bold'} aria-hidden="true" />
          </button>

          {/* Distance Tag / Images count */}
          {project.distance_km && project.distance_km > 0 ? (
            <div className="absolute bottom-1.5 left-1.5 z-10">
              <span className="px-1.5 py-0.5 rounded-xs bg-black/50 backdrop-blur-md text-white text-[11px] font-medium tabular-nums">
                {project.distance_km.toFixed(1)} km
              </span>
            </div>
          ) : hasMultiple ? (
            <div className="absolute bottom-1.5 right-1.5 z-10">
              <span className="px-1.5 py-0.5 rounded-xs bg-black/50 backdrop-blur-md text-white text-[11px] font-medium tabular-nums">
                {imgIdx + 1}/{workingImages.length}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          2. DESKTOP CARD (vertical layout)
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col w-full h-full">
        {/* ── Hero image ── */}
        <div className="relative h-[220px] overflow-hidden bg-surface-3 dark:bg-zinc-800 flex-shrink-0">
          {workingImages.length > 0 && !allFailed ? (
            <>
              {/* Only the current image and the next one are mounted: the next
                  is preloaded for the fade, the rest cost nothing until reached. */}
              {workingImages.map((src, i) => {
                const isNext = i === (imgIdx + 1) % workingImages.length
                if (i !== imgIdx && !isNext) return null
                return (
                  <Image
                    key={`${src}-${i}`}
                    src={resolveImgUrl(src) || '/placeholder.png'}
                    alt={i === imgIdx ? project.name : ''}
                    fill
                    priority={index < 3 && i === 0}
                    onError={() => { if (src) markImageFailed(src) }}
                    className={`object-cover transition-opacity duration-300 ${i === imgIdx ? 'opacity-100' : 'opacity-0'}`}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 480px"
                  />
                )
              })}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Buildings size={44} weight="duotone" className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            </div>
          )}

          {/* Carousel controls */}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={prevImg}
                className={`absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-surface dark:bg-zinc-800 border border-border rounded-full flex items-center justify-center text-zinc-900 dark:text-zinc-50 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity z-10 ${FOCUS}`}
                aria-label="Previous image"
              >
                <CaretLeft size={14} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={nextImg}
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-surface dark:bg-zinc-800 border border-border rounded-full flex items-center justify-center text-zinc-900 dark:text-zinc-50 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity z-10 ${FOCUS}`}
                aria-label="Next image"
              >
                <CaretRight size={14} weight="bold" aria-hidden="true" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 px-2 py-1 bg-black/40 rounded-full">
                {workingImages.map((_, i) => (
                  <button
                    key={`dot-${i}`}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setImgIdx(i) }}
                    className={`relative rounded-full transition-all before:absolute before:-inset-2 before:content-[''] ${FOCUS} ${i === imgIdx ? 'w-3 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'}`}
                    aria-label={`Image ${i + 1}`}
                    aria-current={i === imgIdx ? 'true' : undefined}
                  />
                ))}
              </div>
            </>
          )}

          {/* Status tag overlaid on image top-left */}
          <div className="absolute top-3 left-3 z-10">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md bg-black/50 text-white max-w-[170px]" title={rawPossession || statusLabel}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
              <span className="text-[11px] font-medium truncate">
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Save / Select button on top-right */}
          {isSelectable ? (
            <div className="absolute top-3 right-3 z-30">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer backdrop-blur-md ${FOCUS} ${
                  isSelected
                    ? 'bg-primary text-white ring-2 ring-white/60'
                    : 'bg-black/60 text-white hover:bg-black/80 border border-white/30'
                }`}
                aria-label={isSelected ? `Deselect ${project.name}` : `Select ${project.name}`}
                aria-pressed={isSelected}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[11px] ${isSelected ? 'bg-white text-primary font-semibold' : 'border border-white/70'}`} aria-hidden="true">
                  {isSelected ? '✓' : ''}
                </div>
                <span>{isSelected ? 'Selected' : 'Select'}</span>
              </button>
            </div>
          ) : (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
              <button
                type="button"
                onClick={handleSave}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-black/40 backdrop-blur-md text-white hover:bg-black/60 ${FOCUS}`}
                aria-label={saved ? `Remove ${project.name} from saved` : `Save ${project.name}`}
                aria-pressed={saved}
                title={saved ? 'Unsave' : 'Save property'}
              >
                <BookmarkSimple size={15} weight={saved ? 'fill' : 'bold'} className={saved ? 'text-amber-400' : undefined} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="px-5 pt-4 pb-5 flex-1 flex flex-col justify-between">
          <div>
            {topPickEyebrow}
            {/* Name row + RERA + Distance */}
            <div className="flex items-start justify-between gap-2 mb-1 min-h-[24px]">
              <h3 className="min-w-0 text-[17px] font-semibold text-zinc-900 dark:text-zinc-50 leading-snug">
                {nameButton}
              </h3>
              <div className="flex-shrink-0 flex gap-1 items-center">
                {project.distance_km && project.distance_km > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-3 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap tabular-nums">
                    <MapPinLine size={11} weight="fill" aria-hidden="true" />
                    {project.distance_km.toFixed(1)} km
                  </span>
                )}
                {project.rera_number && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck size={12} weight="fill" aria-hidden="true" />
                    RERA
                  </span>
                )}
              </div>
            </div>

            {/* Builder & Location Subtitle */}
            <div className="flex items-center gap-1.5 text-[13px] text-zinc-600 dark:text-zinc-300 mb-2 min-h-[20px]">
              <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {builderName}
              </span>
              <span className="opacity-40 shrink-0">·</span>
              <span className="truncate shrink-0">{project.sector}</span>
            </div>

            {/* Ground-truth facts */}
            {metaFacts.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                {metaFacts.map(f => (
                  <span
                    key={f.text}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium ${
                      f.warn
                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                        : 'bg-surface-3 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {f.warn && <Warning size={11} weight="fill" aria-hidden="true" />}
                    {f.text === 'Ganga Jal supply' && <Drop size={11} weight="fill" aria-hidden="true" />}
                    {f.text}
                  </span>
                ))}
              </div>
            )}

            {/* Price — for the size asked for when one was */}
            <div className="mb-3 min-h-[24px] flex items-baseline gap-1.5 flex-wrap">
              <p className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50 leading-none tabular-nums">
                {price}
              </p>
              {project.price_for_bhk && (
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 leading-none">
                  {project.price_for_bhk}
                </span>
              )}
            </div>
            {/* The buyer asked for a size this project does not build. Saying so
                on the card is the difference between a near-miss they can judge
                and a result that looks like a match until they open it. */}
            {project.missing_bhk && project.missing_bhk.length > 0 && (
              <p className="-mt-2 mb-3 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                No {project.missing_bhk.join('/')} BHK in this project
              </p>
            )}

            {fitBlock && <div className="mb-3 min-h-[76px]">{fitBlock}</div>}

            {/* Configurations — fixed-height slot, sized to its worst case.
                It was capped at 56px with overflow-hidden, which fits two rows
                and nothing else: on any project with three or more
                configurations the "+X more" line rendered and was then clipped
                by the very container meant to keep the cards uniform. The buyer
                could see there were more configurations only if they happened
                to notice a sliver of text.

                76px fits two rows, the gap and the link together, so nothing is
                cut and every card is still exactly the same height. */}
            <div
              ref={configSlotRef}
              // Hover opens it where hover exists, tap opens it where it does
              // not. onMouseEnter never fires on a touch device, so the two
              // never fight; the guard keeps a hybrid laptop from opening the
              // panel under a finger that was only scrolling past.
              onMouseEnter={() => { if (canHover && bhkGroups.length > 2) setShowAllConfigs(true) }}
              onMouseLeave={() => { if (canHover) setShowAllConfigs(false) }}
              className="relative z-10 min-h-[76px] max-h-[76px] flex flex-col justify-center gap-1 mb-4"
            >
              {bhkGroups.length === 0 && (
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Configurations not listed</p>
              )}
              {bhkGroups.slice(0, 2).map(g => (
                <div key={g.bhk} className="flex items-center text-[13px]">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 shrink-0">{g.bhk} BHK</span>
                  <div className="flex-1 mx-2 border-b border-dotted border-zinc-300 dark:border-zinc-700" />
                  <span className="text-[12px] text-zinc-500 dark:text-zinc-400 text-right truncate shrink-0 max-w-[140px] tabular-nums">
                    {g.areas.slice(0, 2).join(', ')}
                  </span>
                </div>
              ))}
              {bhkGroups.length > 2 && (
                <button
                  type="button"
                  onClick={e => {
                    // The card itself opens the detail panel on click.
                    e.stopPropagation()
                    setShowAllConfigs(v => !v)
                  }}
                  aria-expanded={showAllConfigs}
                  className={`self-start text-[11px] font-medium text-primary hover:underline cursor-pointer truncate rounded-xs ${FOCUS}`}
                >
                  {showAllConfigs ? 'Show fewer' : `+${bhkGroups.length - 2} more configurations`}
                </button>
              )}

              {/* Expanded in place, inside the card's own footprint.
                  Growing the card would have pushed this row of the grid taller
                  than its neighbours, which is the thing the fixed slot exists
                  to prevent — so the full list overlays the slot instead and
                  scrolls if it needs to. The grid never reflows. */}
              {showAllConfigs && bhkGroups.length > 2 && (
                <div
                  className="absolute inset-x-0 -top-1 z-20 max-h-[128px] overflow-y-auto overscroll-contain rounded-sm border border-border bg-surface dark:bg-zinc-900 shadow-md p-2.5"
                  onClick={e => e.stopPropagation()}
                >
                  <p className="text-[11px] font-semibold text-zinc-500 mb-1.5">
                    All configurations
                  </p>
                  {bhkGroups.map(g => (
                    <div key={g.bhk} className="flex items-center text-[12px] py-0.5">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 shrink-0">{g.bhk} BHK</span>
                      <div className="flex-1 mx-2 border-b border-dotted border-zinc-300 dark:border-zinc-700" />
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 text-right shrink-0 tabular-nums">
                        {g.areas.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-auto">
          <div className="flex items-center justify-between gap-3 pt-2">
            {onAskAI ? (
              <div className="relative z-10 flex-1" ref={askMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAskMenuOpen((v) => !v)
                  }}
                  className={`w-full flex items-center justify-center gap-2 px-4 h-11 rounded-xs bg-primary hover:bg-primary-dark text-white text-[13px] font-medium transition-colors ${FOCUS}`}
                  aria-haspopup="menu"
                  aria-expanded={askMenuOpen}
                >
                  <ChatCenteredText size={16} weight="fill" aria-hidden="true" />
                  Ask AI
                </button>

                <AnimatePresence>
                  {askMenuOpen && (
                    <m.div
                      role="menu"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute bottom-full left-0 mb-2 z-50 w-64 rounded-sm border border-border bg-surface dark:bg-zinc-900 shadow-md p-1"
                    >
                      {askPrompts.map((p) => (
                        <button
                          key={p.type}
                          role="menuitem"
                          type="button"
                          onClick={(e) => runPrompt(e, p.type, p.text, true)}
                          className={menuItemCls}
                        >
                          <p.icon size={16} className="text-primary shrink-0" aria-hidden="true" />
                          <span className="truncate">{p.label}</span>
                        </button>
                      ))}

                      <button
                        role="menuitem"
                        type="button"
                        onClick={(e) => runPrompt(e, 'freeform', `Tell me more about ${project.name}`, false)}
                        className={`${menuItemCls} mt-1 border-t border-border text-zinc-500 dark:text-zinc-400`}
                      >
                        <PencilSimple size={16} className="shrink-0" aria-hidden="true" />
                        <span>Ask something else…</span>
                      </button>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCall}
                className={`relative z-10 w-10 h-10 rounded-full bg-surface-3 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors ${FOCUS}`}
                aria-label={`Request a callback for ${project.name}`}
                title="Request a callback"
              >
                <PhoneCall size={15} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleShareProject}
                className={`relative z-10 w-10 h-10 rounded-full text-zinc-500 dark:text-zinc-400 flex items-center justify-center hover:bg-surface-3 dark:hover:bg-zinc-800 transition-colors ${FOCUS}`}
                aria-label={`Share ${project.name}`}
                title="Share project"
              >
                <ShareNetwork size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          {quickActions && (
            <div onClick={(e) => e.stopPropagation()} className="relative z-10 pt-2">
              {quickActions}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
