'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  ShieldCheck, SealCheck,
  Subway, AirplaneTakeoff, Path,
  Leaf, Baby, Heart,
  BookmarkSimple,
  CaretLeft, CaretRight,
  Car, GraduationCap, ShoppingBag, Bank, BookOpen,
  Barbell, Star, Buildings, Phone, PhoneCall, ShareNetwork, Robot, ChatCenteredText,
  Coins, MapPinLine, ChartLineUp, Scales, WarningCircle, PencilSimple,
} from '@phosphor-icons/react'
import type { ProjectCard as ProjectCardType, AmenitySummary, ConnSummary } from '@/types/project'
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

const AMENITY_ICONS: Record<AmenitySummary['category'], React.ElementType> = {
  sports:    Barbell,
  lifestyle: Star,
  wellness:  Leaf,
  kids:      Baby,
  security:  SealCheck,
  parking:   Car,
}

const CONN_ICONS: Record<ConnSummary['type'], React.ElementType> = {
  metro:      Subway,
  airport:    AirplaneTakeoff,
  road:       Path,
  expressway: Path,

  school:     GraduationCap,
  hospital:   Heart,
  mall:       ShoppingBag,
  landmark:   Bank,
  university: BookOpen,
}

export default function ProjectCard({ project, userId, sessionId, index = 0, isSelectable = false, isSelected = false, onToggleSelect, onDetailOpen, onToast, onAskAI, onSetSiteVisit, onCall, onShare, quickActions }: Props) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  // Per-card, not lifted: one card expanding its configurations says nothing
  // about the others, and the panel closes when the card unmounts.
  const [showAllConfigs, setShowAllConfigs] = useState(false)
  const configSlotRef = useRef<HTMLDivElement>(null)
  const [expandedUnits, setExpandedUnits] = useState(false)
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

  const isTopPick = index === 0
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
  if (project.concerns && project.concerns.length > 0) {
    askPrompts.push({ icon: WarningCircle, label: 'Any concerns?', text: `What are the concerns or red flags with ${project.name}?`, type: 'concerns' })
  }

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

        onToast?.('Property saved! ✓')
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
    const text = `${project.name} · ${project.sector} — ${sanitizePriceLabel(project.price_range_label)}. Reviewed with RealtyPal AI:`
    try {
      if (navigator.share) {
        await navigator.share({ title: project.name, text, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
        onToast?.('Link copied ✓')
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

  return (
    <div
      data-project-id={project.id}
      onClick={handleCardClick}
      // h-full is what makes the grid uniform. Grid items stretch, so the
      // wrapper was already full height, but the card inside sized to its own
      // content — a project with a shorter tagline produced a shorter card and
      // the row looked ragged.
      className={`group relative w-full h-full flex flex-col rounded-[20px] md:rounded-[16px] overflow-hidden bg-white dark:bg-[#111] transition-all duration-200 ease-out cursor-pointer select-none ${
        isSelected
          ? 'ring-2 ring-blue-600 dark:ring-blue-500 shadow-[0_8px_30px_rgba(37,99,235,0.3)] scale-[1.015] border-blue-500 z-20 bg-blue-50/10 dark:bg-blue-950/10'
          : isSelectable
            ? 'ring-1 ring-blue-400/40 hover:ring-2 hover:ring-blue-400/80 hover:shadow-md'
            : isTopPick
              ? 'ring-1 ring-inset ring-amber-500/50 shadow-[0_4px_20px_rgba(245,158,11,0.15)] hover:shadow-[0_8px_30px_rgba(245,158,11,0.2)]'
              : 'ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
      } md:hover:-translate-y-1 active:scale-[0.98]`}
    >
      {/* ════════════════════════════════════════════════════════════════════════
          1. MOBILE COMPACT BENTO CARD (Swiggy / Airbnb style: 2-3 fit on screen)
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="flex md:hidden flex-row items-stretch p-3 gap-3 w-full min-h-[135px]">
        {/* Left: Info & Details (65% width) */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="space-y-1">
            {/* Top Badges: Status + RERA */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold max-w-[140px] truncate ${
                isRTM 
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' 
                  : isDelayed
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                    : isNew 
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' 
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              }`} title={rawPossession || statusLabel}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRTM ? 'bg-emerald-500' : isDelayed ? 'bg-rose-500' : isNew ? 'bg-blue-500' : 'bg-amber-500'}`} />
                <span className="truncate">{statusLabel}</span>
              </span>

              {project.rera_number && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                  <ShieldCheck size={10} weight="fill" className="text-emerald-600" />
                  RERA
                </span>
              )}
            </div>

            {/* Title & Subtitle */}
            <div className="pt-0.5">
              <h3 className="text-[15px] font-black text-gray-900 dark:text-white tracking-tight leading-snug truncate">
                {project.name}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold truncate mt-0.5">
                {typeof project.builder === 'object' ? project.builder?.name : project.builder} · {project.sector}
              </p>
            </div>

            {/* Price — for the size asked for, when one was */}
            <p className="text-[16px] font-black text-gray-900 dark:text-white tracking-tight leading-none pt-0.5">
              {sanitizePriceLabel(project.price_range_label)}
              {project.price_for_bhk && (
                <span className="ml-1.5 text-[10.5px] font-semibold text-gray-500 dark:text-gray-400 align-middle">
                  {project.price_for_bhk}
                </span>
              )}
            </p>

            {/* BHK & Area summary line */}
            <div className="text-[10.5px] text-gray-500 dark:text-gray-400 font-medium truncate pt-0.5">
              {bhkGroups.length > 0
                ? `${bhkGroups.map(g => `${g.bhk} BHK`).join(', ')}${bhkGroups[0]?.areas[0] ? ` (${bhkGroups[0].areas[0]})` : ''}`
                : 'Spacious Units'}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex items-center gap-2 pt-2 mt-auto">
            {onAskAI ? (
              <div className="relative flex-1" ref={askMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAskMenuOpen((v) => !v)
                  }}
                  className="w-full h-7 px-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all"
                  title="Ask AI about this project"
                >
                  <ChatCenteredText size={13} weight="fill" />
                  Ask AI
                </button>

                <AnimatePresence>
                  {askMenuOpen && (
                    <m.div
                      role="menu"
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-2xl bg-white dark:bg-[#1a1a1a] ring-1 ring-black/10 dark:ring-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)] p-1.5 origin-bottom-left"
                    >
                      {askPrompts.slice(0, 3).map((p) => (
                        <button
                          key={p.type}
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAskMenuOpen(false)
                            track('ask_ai_tapped', { project_slug: project.slug, prompt_type: p.type })
                            trackPropertyEvent(project.id, 'ask_ai', sessionId, userId).catch(() => {})
                            window.dispatchEvent(
                              new CustomEvent('propfyndr:ask-ai', { detail: { text: p.text, autoSend: true } }),
                            )
                            onAskAI(project)
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[12px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <p.icon size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
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
              onClick={(e) => {
                e.stopPropagation()
                track('call_tapped', { project_slug: project.slug, project_name: project.name })
                trackPropertyEvent(project.id, 'call', sessionId, userId).catch(() => {})
                onCall?.(project)
              }}
              className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95 flex-shrink-0"
              title="Request a callback"
            >
              <PhoneCall size={13} weight="bold" />
            </button>

            <button
              type="button"
              onClick={handleShareProject}
              className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 transition-all active:scale-95 flex-shrink-0"
              title="Share project"
            >
              <ShareNetwork size={13} weight="bold" />
            </button>
          </div>

          {quickActions && (
            <div onClick={(e) => e.stopPropagation()} className="pt-1.5">
              {quickActions}
            </div>
          )}
        </div>

        {/* Right: Dish / Property Thumbnail (35% width) */}
        <div className="w-[110px] sm:w-[125px] rounded-2xl overflow-hidden relative bg-gray-100 dark:bg-gray-800 flex-shrink-0 self-stretch shadow-inner">
          {isSelectable && (
            <div className="absolute top-1.5 left-1.5 z-30">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all shadow-md ${
                  isSelected ? 'bg-blue-600 text-white font-extrabold ring-2 ring-white scale-105' : 'bg-black/60 text-white border border-white/40'
                }`}
                aria-label={isSelected ? 'Deselect property' : 'Select property'}
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
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-[#1a1a1a]">
              <Buildings size={28} weight="duotone" className="text-gray-400" />
            </div>
          )}

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={handleSave}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-all z-10"
            title={saved ? 'Unsave' : 'Save'}
          >
            {saved ? <BookmarkSimple size={12} weight="fill" /> : <BookmarkSimple size={12} weight="bold" />}
          </button>

          {/* Distance Tag / Images count */}
          {project.distance_km && project.distance_km > 0 ? (
            <div className="absolute bottom-1.5 left-1.5 z-10">
              <span className="px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-md text-white text-[8.5px] font-bold">
                {project.distance_km.toFixed(1)} km
              </span>
            </div>
          ) : hasMultiple ? (
            <div className="absolute bottom-1.5 right-1.5 z-10">
              <span className="px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-md text-white text-[8.5px] font-bold">
                {imgIdx + 1}/{workingImages.length}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          2. DESKTOP FULL BENTO CARD (Vertical Rich Layout)
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col w-full h-full">
        {/* ── Hero image ── */}
        <div className="relative h-[220px] overflow-hidden bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          {workingImages.length > 0 && !allFailed ? (
            <>
              {workingImages.map((src, i) => (
                <Image
                  key={`${src}-${i}`}
                  src={resolveImgUrl(src) || '/placeholder.png'}
                  alt={project.name}
                  fill
                  priority={index < 3 && i === 0}
                  onError={() => { if (src) markImageFailed(src) }}
                  className={`object-cover transition-all duration-500 ${
                    i === imgIdx ? 'opacity-100 scale-100' : 'opacity-0 scale-105 absolute inset-0'
                  }`}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                />
              ))}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#f5f5f5] dark:bg-[#111]">
              <Buildings size={44} weight="duotone" className="text-gray-300 dark:text-gray-700" />
            </div>
          )}

          {/* Carousel controls */}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={prevImg}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-full flex items-center justify-center text-gray-900 dark:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
                aria-label="Previous image"
              >
                <CaretLeft size={14} weight="bold" />
              </button>
              <button
                type="button"
                onClick={nextImg}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-full flex items-center justify-center text-gray-900 dark:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
                aria-label="Next image"
              >
                <CaretRight size={14} weight="bold" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 px-2 py-1 bg-black/40 rounded-full">
                {workingImages.map((_, i) => (
                  <button
                    key={`dot-${i}`}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    className={`rounded-full transition-all ${i === imgIdx ? 'w-3 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'}`}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Status tag overlaid on image top-left */}
          <div className="absolute top-3 left-3 z-10">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border shadow-sm max-w-[170px] ${
              isRTM 
                ? 'bg-black/50 border-emerald-500/40 text-white' 
                : isDelayed 
                  ? 'bg-black/50 border-rose-500/50 text-white' 
                  : 'bg-black/45 border-white/15 text-white'
            }`} title={rawPossession || statusLabel}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isRTM 
                  ? 'bg-emerald-400' 
                  : isDelayed 
                    ? 'bg-rose-400' 
                    : isNew 
                      ? 'bg-blue-400' 
                      : 'bg-amber-400'
              }`} />
              <span className="text-[10px] font-semibold tracking-wide truncate">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer backdrop-blur-md ${
                  isSelected
                    ? 'bg-blue-600 text-white ring-2 ring-white/60 scale-105 shadow-blue-500/40'
                    : 'bg-black/60 text-white hover:bg-black/80 border border-white/30 hover:scale-105'
                }`}
                aria-label={isSelected ? 'Deselect property' : 'Select property'}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-transform ${isSelected ? 'bg-white text-blue-600 font-extrabold scale-110' : 'border border-white/70'}`} aria-hidden="true">
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
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${
                  saved ? 'bg-black/40 backdrop-blur-md text-white' : 'bg-black/40 backdrop-blur-md text-white hover:bg-black/60 hover:scale-105'
                }`}
                title={saved ? 'Unsave' : 'Save property'}
              >
                {saved ? <BookmarkSimple size={15} weight="fill" className="text-amber-400" /> : <BookmarkSimple size={15} weight="bold" />}
              </button>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="px-5 pt-4 pb-5 flex-1 flex flex-col justify-between bg-white dark:bg-[#111]">
          <div>
            {/* Name row + RERA + Distance */}
            <div className="flex items-start justify-between gap-2 mb-1 min-h-[26px]">
              <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100 tracking-tight leading-snug truncate" title={project.name}>
                {project.name}
              </h3>
              <div className="flex-shrink-0 flex gap-1 items-center">
                {project.distance_km && project.distance_km > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 text-[10px] font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    <MapPinLine size={10} weight="fill" />
                    {project.distance_km.toFixed(1)} km
                  </span>
                )}
                {project.rera_number && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 tracking-wide uppercase">
                    <ShieldCheck size={12} weight="fill" className="text-emerald-500" />
                    RERA
                  </span>
                )}
              </div>
            </div>

            {/* Builder & Location Subtitle */}
            <div className="flex items-center gap-1.5 text-[12.5px] text-gray-600 dark:text-gray-300 mb-3 min-h-[20px]">
              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                {typeof project.builder === 'object' ? project.builder?.name : project.builder}
              </span>
              <span className="opacity-40 shrink-0">·</span>
              <span className="truncate opacity-80 shrink-0">{project.sector}</span>
            </div>

            {/* Price — big hero number, for the size asked for when one was */}
            <div className="mb-3.5 min-h-[28px] flex items-baseline gap-1.5 flex-wrap">
              <p className="text-[22px] sm:text-[24px] font-bold text-gray-900 dark:text-gray-50 tracking-tight leading-none">
                {sanitizePriceLabel(project.price_range_label)}
              </p>
              {project.price_for_bhk && (
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 leading-none">
                  {project.price_for_bhk}
                </span>
              )}
            </div>
            {/* The buyer asked for a size this project does not build. Saying so
                on the card is the difference between a near-miss they can judge
                and a result that looks like a match until they open it. */}
            {project.missing_bhk && project.missing_bhk.length > 0 && (
              <p className="-mt-2.5 mb-3 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                No {project.missing_bhk.join('/')} BHK in this project
              </p>
            )}

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
              className="relative min-h-[76px] max-h-[76px] flex flex-col justify-center gap-1 mb-4"
            >
              {bhkGroups.slice(0, 2).map(g => (
                <div key={g.bhk} className="flex items-center text-[12.5px] group">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 shrink-0">{g.bhk} BHK</span>
                  <div className="flex-1 mx-2 border-b border-dotted border-gray-300 dark:border-gray-700/60" />
                  <span className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium text-right truncate shrink-0 max-w-[140px]">
                    {g.areas.slice(0, 2).join(', ')}
                  </span>
                </div>
              ))}
              {bhkGroups.length === 1 && (
                <div className="flex items-center text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                  <span className="truncate">All units verified with active RERA floor plans</span>
                </div>
              )}
              {bhkGroups.length > 2 && (
                <button
                  type="button"
                  onClick={e => {
                    // The card itself opens the detail panel on click.
                    e.stopPropagation()
                    setShowAllConfigs(v => !v)
                  }}
                  aria-expanded={showAllConfigs}
                  className="self-start text-[10.5px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer truncate"
                >
                  {showAllConfigs ? 'Show fewer' : `+${bhkGroups.length - 2} more configurations available`}
                </button>
              )}

              {/* Expanded in place, inside the card's own footprint.
                  Growing the card would have pushed this row of the grid taller
                  than its neighbours, which is the thing the fixed slot exists
                  to prevent — so the full list overlays the slot instead and
                  scrolls if it needs to. The grid never reflows. */}
              {showAllConfigs && bhkGroups.length > 2 && (
                <div
                  className="absolute inset-x-0 -top-1 z-20 max-h-[128px] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-[#161616] shadow-lg p-2.5"
                  onClick={e => e.stopPropagation()}
                >
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    All configurations
                  </p>
                  {bhkGroups.map(g => (
                    <div key={g.bhk} className="flex items-center text-[12px] py-0.5">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 shrink-0">{g.bhk} BHK</span>
                      <div className="flex-1 mx-2 border-b border-dotted border-gray-300 dark:border-gray-700/60" />
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium text-right shrink-0">
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
              <div className="relative flex-1" ref={askMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAskMenuOpen((v) => !v)
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-[13px] font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:from-blue-700 hover:to-blue-600 hover:shadow-[0_6px_16px_rgba(37,99,235,0.4)] active:scale-95 transition-all duration-200"
                  title="Ask AI about this project"
                  aria-haspopup="menu"
                  aria-expanded={askMenuOpen}
                >
                  <ChatCenteredText size={16} weight="fill" />
                  Ask AI
                </button>

                <AnimatePresence>
                  {askMenuOpen && (
                    <m.div
                      role="menu"
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute bottom-full left-0 mb-3 z-50 w-64 rounded-2xl bg-white dark:bg-[#1a1a1a] ring-1 ring-black/10 dark:ring-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.2)] p-2 origin-bottom-left"
                    >
                      {askPrompts.map((p) => (
                        <button
                          key={p.type}
                          role="menuitem"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAskMenuOpen(false)
                            track('ask_ai_tapped', { project_slug: project.slug, prompt_type: p.type })
                            trackPropertyEvent(project.id, 'ask_ai', sessionId, userId).catch(() => {})
                            window.dispatchEvent(
                              new CustomEvent('propfyndr:ask-ai', { detail: { text: p.text, autoSend: true } }),
                            )
                            onAskAI(project)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <p.icon size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate">{p.label}</span>
                        </button>
                      ))}

                      <button
                        role="menuitem"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAskMenuOpen(false)
                          track('ask_ai_tapped', { project_slug: project.slug, prompt_type: 'freeform' })
                          window.dispatchEvent(
                            new CustomEvent('propfyndr:ask-ai', { detail: { text: `Tell me more about ${project.name}`, autoSend: false } }),
                          )
                          onAskAI(project)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-xl text-left text-[13px] font-medium text-gray-500 dark:text-gray-400 border-t border-black/5 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                      >
                        <PencilSimple size={16} className="shrink-0" />
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
                onClick={(e) => {
                  e.stopPropagation()
                  track('call_tapped', { project_slug: project.slug, project_name: project.name })
                  trackPropertyEvent(project.id, 'call', sessionId, userId).catch(() => {})
                  onCall?.(project)
                }}
                className="w-9 h-9 rounded-full bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-white flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all duration-200 active:scale-95 group shadow-2xs"
                title="Request a callback"
              >
                <PhoneCall size={15} weight="bold" className="text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
              </button>
              <button
                type="button"
                onClick={handleShareProject}
                className="w-10 h-10 rounded-full bg-transparent text-gray-700 dark:text-gray-300 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active:scale-95"
                title="Share project"
              >
                <ShareNetwork size={16} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>
          {quickActions && (
            <div onClick={(e) => e.stopPropagation()} className="pt-2">
              {quickActions}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
