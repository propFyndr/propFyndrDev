'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTableRowSkeleton } from '@/components/skeletons'
import UniversalLoader from '@/components/ui/universal-loader'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, CheckCircle2, Clock, Zap, Trash2, Building2, ChevronRight, CornerDownLeft,
  X, ArrowUpDown, ArrowUp, ArrowDown, MapPin, Layers, Filter, RefreshCw, ChevronDown, Check,
  Download, Upload, AlertTriangle, AlertCircle, FileSpreadsheet, FileText, Copy, CheckCheck, FileJson, Sliders,
  CheckSquare, Square, SlidersHorizontal, ArrowRight, ShieldAlert, Cpu
} from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect from '@/components/admin/CustomSelect'

interface UnitType { bhk: number; price_min_cr: number | null; price_max_cr: number | null; super_area_sqft?: number | null; carpet_area_sqft?: number | null }

interface Project {
  id: string
  slug: string
  name: string
  sector: string
  city: string
  status: string
  hero_image_url: string | null
  rera_number: string | null
  description?: string | null
  address?: string | null
  possession_label?: string | null
  builder: { name: string }
  unit_types: UnitType[]
  amenities?: { id: string }[]
  connectivity?: { id: string }[]
  images?: { url: string; type: string }[]
  completenessScore?: number
  tabScores?: Record<string, number>
}

export interface FilterToken {
  id: string
  type: 'builder' | 'sector' | 'name'
  value: string
  label: string
}

type SortField = 'name' | 'builder' | 'status' | 'price' | 'health'
type SortOrder = 'asc' | 'desc'

export type ProjectTabKey = 'core' | 'specifications' | 'pricing' | 'location' | 'intelligence' | 'updates' | 'partners'

const PROPERTY_TABS_CONFIG: Array<{ id: ProjectTabKey; label: string; description: string }> = [
  { id: 'core', label: 'Core Info', description: 'Name, Builder, UP RERA No., Tagline, Overview' },
  { id: 'specifications', label: 'Specifications', description: 'BHK Units, Carpet Area, Super Area, Bathrooms' },
  { id: 'pricing', label: 'Pricing & Cost Sheet', description: 'Price Range, Base Rate, EDC/IDC, Parking, Payment Plans' },
  { id: 'location', label: 'Location & Connectivity', description: 'Address, GPS Coordinates, Metro, Highway Distance' },
  { id: 'intelligence', label: 'Intelligence & Analysis', description: 'Sector Stage, 5-Yr CAGR, Livability, Why Buy/Avoid' },
  { id: 'updates', label: 'Updates & Timeline', description: 'Launch Date, Possession Date, Construction Stage, RERA Expiry' },
  { id: 'partners', label: 'Channel Partners', description: 'Direct Sales Office, Broker Commission Schedule' },
]

function computeProjectCompleteness(data: any): {
  overallHealth: number
  tabScores: Record<string, number>
  tabAudits: Record<string, { completed: string[]; missing: string[] }>
  allMissing: { tab: string; item: string }[]
  allCompleted: { tab: string; item: string }[]
} {
  const documents = data?.documents || []
  const images = data?.images || []
  const galleryImages = images.filter((i: any) => i.type !== 'hero')

  // 1. Core Info
  const coreCompleted: string[] = []
  const coreMissing: string[] = []
  if (data?.name) coreCompleted.push('Project Name')
  else coreMissing.push('Project Name')
  if (data?.status) coreCompleted.push('Project Status')
  else coreMissing.push('Project Status')
  if (data?.possession_date) coreCompleted.push('Possession Date')
  else coreMissing.push('Possession Date')
  if (data?.rera_number) coreCompleted.push('RERA Number')
  else coreMissing.push('RERA Number')
  if (data?.description && data.description.trim().length >= 10) coreCompleted.push('Project Description')
  else coreMissing.push('Project Description')
  if ((data?.unit_types?.length || 0) >= 1) coreCompleted.push(`Unit Configurations (${data.unit_types.length} types)`)
  else coreMissing.push('Unit Configurations')
  if ((data?.amenities?.length || 0) >= 3) coreCompleted.push(`Amenities (${data.amenities.length} added)`)
  else coreMissing.push(`Amenities (need 3+, currently ${data?.amenities?.length || 0})`)

  // 2. Specifications
  const specsCompleted: string[] = []
  const specsMissing: string[] = []
  if ((data?.spec_items?.length || 0) >= 1) specsCompleted.push(`Specifications (${data.spec_items.length} items configured)`)
  else specsMissing.push('Construction Specifications')
  if (data?.spec_items?.some((s: any) => s.category === 'structure')) specsCompleted.push('Structure & Safety Specs')
  else specsMissing.push('Structure & Safety Specs')
  if (data?.spec_items?.some((s: any) => s.category === 'flooring')) specsCompleted.push('Flooring & Finishes Specs')
  else specsMissing.push('Flooring Specs')
  if (data?.spec_items?.some((s: any) => s.category === 'kitchen')) specsCompleted.push('Kitchen & Countertop Specs')
  else specsMissing.push('Kitchen Specs')
  if (data?.spec_items?.some((s: any) => s.category === 'bathrooms')) specsCompleted.push('Sanitary & CP Fittings Specs')
  else specsMissing.push('Sanitary Specs')
  if (data?.spec_items?.some((s: any) => s.is_highlight)) specsCompleted.push('Highlighted Buyer Card Specs')
  else specsMissing.push('Highlighted Buyer Card Specs')

  // 3. Pricing & Location
  const pricingCompleted: string[] = []
  const pricingMissing: string[] = []
  if (data?.unit_types?.some((u: any) => u.price_min_cr != null)) pricingCompleted.push('Priced Unit Configurations')
  else pricingMissing.push('Priced Unit Configurations')
  if (data?.cost_sheet?.base_price_per_sqft) pricingCompleted.push('Cost Sheet Base Price')
  else pricingMissing.push('Cost Sheet Base Price')
  if ((data?.payment_plans?.length || 0) >= 2) pricingCompleted.push(`Payment Plans (${data.payment_plans.length} active)`)
  else pricingMissing.push(`Payment Plans (need 2+, currently ${data?.payment_plans?.length || 0})`)
  if ((data?.connectivity?.length || 0) >= 3) pricingCompleted.push(`Connectivity Points (${data.connectivity.length} mapped)`)
  else pricingMissing.push(`Connectivity Points (need 3+, currently ${data?.connectivity?.length || 0})`)
  if ((data?.price_history?.length || 0) >= 1) pricingCompleted.push('Quarterly Price History')
  else pricingMissing.push('Price History Snapshots')

  // 4. Media
  const mediaCompleted: string[] = []
  const mediaMissing: string[] = []
  const hasHero = !!data?.hero_image_url || images.some((i: any) => i.type === 'hero')
  if (hasHero) mediaCompleted.push('Hero Image')
  else mediaMissing.push('Hero Image')
  if (galleryImages.length >= 3) mediaCompleted.push(`Gallery Photos (${galleryImages.length} uploaded)`)
  else mediaMissing.push(`Gallery Photos (need 3+, currently ${galleryImages.length})`)
  if (documents?.some((d: any) => d.doc_type === 'brochure') || data?.brochure_url) mediaCompleted.push('Official Project Brochure')
  else mediaMissing.push('Official Project Brochure document')

  // 5. Intelligence
  const intelCompleted: string[] = []
  const intelMissing: string[] = []
  if (data?.decision_profile?.decision_thesis) intelCompleted.push('Decision Thesis')
  else intelMissing.push('Decision Thesis')
  if (data?.decision_profile?.best_for) intelCompleted.push('Target Buyer Profile')
  else intelMissing.push('Target Buyer Profile')
  if ((data?.decision_profile?.why_buy?.length || 0) >= 1) intelCompleted.push('Why Buy Highlights')
  else intelMissing.push('Why Buy Highlights')
  if ((data?.decision_profile?.why_avoid?.length || 0) >= 1) intelCompleted.push('Why Avoid Risk Points')
  else intelMissing.push('Why Avoid Risk Points')
  if (data?.persona_profile?.primary_persona) intelCompleted.push('Primary Buyer Persona')
  else intelMissing.push('Primary Buyer Persona')
  if (data?.persona_profile?.income_range) intelCompleted.push('Persona Income Range')
  else intelMissing.push('Persona Income Range')
  if (data?.recommendation_profile?.tier) intelCompleted.push(`Recommendation Tier (${data.recommendation_profile.tier})`)
  else intelMissing.push('Recommendation Tier')
  if (data?.dna || data?.project_dna) intelCompleted.push('Project DNA Scores')
  else intelMissing.push('Project DNA Scores')
  if ((data?.competitors?.length || 0) >= 1) intelCompleted.push('Competitor Analysis')
  else intelMissing.push('Competitor Analysis')

  // 6. Updates & Timeline
  const updatesCompleted: string[] = []
  const updatesMissing: string[] = []
  if ((data?.construction_milestones?.length || 0) >= 4) updatesCompleted.push(`Construction Milestones (${data.construction_milestones.length} stages)`)
  else updatesMissing.push(`Construction Milestones (need 4+, currently ${data?.construction_milestones?.length || 0})`)
  const isReady = data?.status === 'ready_to_move'
  const hasUpdates = isReady
    ? (data?.lifecycle_updates?.length || 0) >= 1
    : (data?.construction_updates?.length || 0) >= 1
  if (hasUpdates) updatesCompleted.push(isReady ? 'RWA & Handover Feed' : 'Construction Progress Feed')
  else updatesMissing.push(isReady ? 'RWA & Handover Feed' : 'Construction Progress Feed')

  // 7. Channel Partners
  const partnersCompleted: string[] = []
  const partnersMissing: string[] = []
  if ((data?.channel_partners?.length || 0) >= 1) partnersCompleted.push(`Channel Partners (${data.channel_partners.length} linked)`)
  else partnersMissing.push('Linked Channel Partners')

  const scoreOf = (c: string[], m: string[]) => {
    const t = c.length + m.length
    return t === 0 ? 100 : Math.round((c.length / t) * 100)
  }

  const tabScores: Record<string, number> = {
    core: scoreOf(coreCompleted, coreMissing),
    specs: scoreOf(specsCompleted, specsMissing),
    pricing: scoreOf(pricingCompleted, pricingMissing),
    media: scoreOf(mediaCompleted, mediaMissing),
    intelligence: scoreOf(intelCompleted, intelMissing),
    updates: scoreOf(updatesCompleted, updatesMissing),
    partners: scoreOf(partnersCompleted, partnersMissing),
  }

  const overallHealth = Math.round(
    (tabScores.core * 0.15) +
    (tabScores.specs * 0.15) +
    (tabScores.pricing * 0.20) +
    (tabScores.media * 0.15) +
    (tabScores.intelligence * 0.15) +
    (tabScores.updates * 0.10) +
    (tabScores.partners * 0.10)
  )

  const allMissing = [
    ...coreMissing.map(item => ({ tab: 'Core', item })),
    ...specsMissing.map(item => ({ tab: 'Specs', item })),
    ...pricingMissing.map(item => ({ tab: 'Pricing', item })),
    ...mediaMissing.map(item => ({ tab: 'Media', item })),
    ...intelMissing.map(item => ({ tab: 'Intelligence', item })),
    ...updatesMissing.map(item => ({ tab: 'Updates', item })),
    ...partnersMissing.map(item => ({ tab: 'Partners', item })),
  ]

  const allCompleted = [
    ...coreCompleted.map(item => ({ tab: 'Core', item })),
    ...specsCompleted.map(item => ({ tab: 'Specs', item })),
    ...pricingCompleted.map(item => ({ tab: 'Pricing', item })),
    ...mediaCompleted.map(item => ({ tab: 'Media', item })),
    ...intelCompleted.map(item => ({ tab: 'Intelligence', item })),
    ...updatesCompleted.map(item => ({ tab: 'Updates', item })),
    ...partnersCompleted.map(item => ({ tab: 'Partners', item })),
  ]

  return {
    overallHealth,
    tabScores,
    tabAudits: {
      core: { completed: coreCompleted, missing: coreMissing },
      specs: { completed: specsCompleted, missing: specsMissing },
      pricing: { completed: pricingCompleted, missing: pricingMissing },
      media: { completed: mediaCompleted, missing: mediaMissing },
      intelligence: { completed: intelCompleted, missing: intelMissing },
      updates: { completed: updatesCompleted, missing: updatesMissing },
      partners: { completed: partnersCompleted, missing: partnersMissing },
    },
    allMissing,
    allCompleted,
  }
}

function getNonMediaScore(p: Project): number {
  return computeProjectCompleteness(p).overallHealth
}

function ProjectThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
        <Building2 size={14} className="text-zinc-400" />
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-lg overflow-hidden relative border border-zinc-200 dark:border-zinc-700 flex-shrink-0 shadow-2xs">
      <Image src={src} alt={alt} fill sizes="32px" className="object-cover" onError={() => setError(true)} />
    </div>
  )
}

function quickHealth(p: Project) {
  const res = computeProjectCompleteness(p)
  return {
    score: res.overallHealth,
    missing: res.allMissing.map(m => `[${m.tab}] ${m.item}`),
    completed: res.allCompleted.map(c => `[${c.tab}] ${c.item}`),
    tabScores: res.tabScores,
  }
}

function getMissingFieldsForSelectedTabs(p: Project, tabs: Set<ProjectTabKey>): string[] {
  const missing: string[] = []
  const unitTypes = p.unit_types || []

  if (tabs.has('core')) {
    if (!p.rera_number) missing.push('UP RERA Number')
    if (!p.builder?.name) missing.push('Builder / Developer Name')
    if (!p.description || p.description.length < 20) missing.push('Project Overview / Tagline')
  }
  if (tabs.has('specifications')) {
    if (unitTypes.length === 0) missing.push('BHK Unit Configurations & Floor Plans')
    else if (!unitTypes.some(u => u.super_area_sqft)) missing.push('Super Area & Carpet Area (sq.ft)')
  }
  if (tabs.has('pricing')) {
    if (!unitTypes.some(u => u.price_min_cr != null)) missing.push('Price Range & Base Rate per sq.ft')
  }
  if (tabs.has('location')) {
    if (!p.address) missing.push('Exact Plot Address & GPS Coordinates')
    if (!p.connectivity || p.connectivity.length < 2) missing.push('Nearest Metro & Expressway Connectivity')
  }
  if (tabs.has('intelligence')) {
    if (!p.amenities || p.amenities.length < 3) missing.push('Project Amenities & Lifestyle Highlights')
  }
  if (tabs.has('updates')) {
    if (p.status !== 'ready_to_move' && !p.possession_label) missing.push('Possession Timeline & Construction Milestone')
  }

  return Array.from(new Set(missing))
}

function priceMinVal(units: UnitType[] = []): number {
  const safeUnits = units || []
  const mins = safeUnits.map((u) => u.price_min_cr).filter((v): v is number => v !== null)
  return mins.length ? Math.min(...mins) : 0
}

const STATUS_MAP: Record<string, { label: string; chip: string; icon: typeof CheckCircle2 }> = {
  ready_to_move: { label: 'Ready to Move', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60', icon: CheckCircle2 },
  under_construction: { label: 'Under Construction', chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60', icon: Clock },
  new_launch: { label: 'New Launch', chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60', icon: Zap },
}

function priceRange(units: UnitType[] = []): string {
  const safeUnits = units || []
  const mins = safeUnits.map((u) => u.price_min_cr).filter((v): v is number => v !== null)
  const maxs = safeUnits.map((u) => u.price_max_cr).filter((v): v is number => v !== null)
  if (!mins.length) return '—'
  const lo = Math.min(...mins)
  const hi = maxs.length ? Math.max(...maxs) : null
  return hi ? `₹${lo}–${hi} Cr` : `₹${lo}+ Cr`
}

function HealthBadgeWithTooltip({ project }: { project: Project }) {
  const [isHovered, setIsHovered] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const badgeRef = useRef<HTMLDivElement>(null)
  const comp = computeProjectCompleteness(project)
  const score = comp.overallHealth

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleMouseEnter = () => {
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect()
      const CARD_WIDTH = 340
      const CARD_HEIGHT = 350

      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      // If there is enough room below (>= 350px) or more room below than above, position below; otherwise above
      let top: number
      if (spaceBelow >= CARD_HEIGHT || spaceBelow >= spaceAbove) {
        top = rect.bottom + 8
      } else {
        top = rect.top - CARD_HEIGHT - 8
      }

      // Safety clamp: ensure the card is always completely visible on screen
      top = Math.max(16, Math.min(window.innerHeight - CARD_HEIGHT - 16, top))

      // Align right edge with badge right edge, clamped with 16px margins
      let left = rect.right - CARD_WIDTH
      left = Math.max(16, Math.min(window.innerWidth - CARD_WIDTH - 16, left))

      setCoords({ top, left })
    }
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  return (
    <div
      ref={badgeRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded-full border transition-all select-none cursor-help ${score >= 90
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60'
          : score >= 70
            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60'
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60'
        }`}>
        {score}%
      </span>

      {/* Global Body Portal Tooltip — Immune to table overflow, z-index clipping & parent stacking contexts */}
      {mounted && isHovered && coords && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: '340px',
            zIndex: 999999,
          }}
          className="p-4 bg-slate-900 text-slate-100 text-xs rounded-2xl shadow-2xl border border-slate-700/90 animate-in fade-in zoom-in-95 duration-150 pointer-events-none text-left font-normal"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5">
            <span className="font-black text-white text-[12.5px] truncate max-w-[190px]">{project.name}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black tracking-wide ${score >= 90
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : score >= 70
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
              {score}% Health
            </span>
          </div>

          {/* 7 Tab Mini Scores Grid */}
          <div className="grid grid-cols-4 gap-1.5 pb-2.5 mb-2.5 border-b border-slate-800 text-[9.5px]">
            {Object.entries(comp.tabScores).map(([tab, sc]) => (
              <div key={tab} className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60">
                <span className="text-slate-400 capitalize truncate max-w-[34px] font-semibold">{tab}</span>
                <span className={`font-mono font-black ${sc >= 90 ? 'text-emerald-400' : sc >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {sc}%
                </span>
              </div>
            ))}
          </div>

          {/* Missing / Incomplete Items */}
          {comp.allMissing.length > 0 ? (
            <div>
              <p className="text-[10px] uppercase font-black text-rose-400 tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <AlertCircle size={12} className="shrink-0" /> Incomplete Fields:
                </span>
                <span className="text-[9.5px] font-mono font-bold bg-rose-950/80 text-rose-300 px-1.5 py-0.2 rounded border border-rose-800/60">
                  {comp.allMissing.length} pending
                </span>
              </p>
              <ul className="space-y-1.5 pl-0.5 max-h-48 overflow-y-auto pr-1">
                {comp.allMissing.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-200 text-[11px] leading-snug">
                    <span className="text-rose-400 font-bold shrink-0 mt-0.5">•</span>
                    <span>
                      <strong className="text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded text-[10px] mr-1.5">
                        {item.tab}
                      </strong>
                      {item.item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11.5px] py-1.5">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>All 7 project tabs are 100% complete and verified!</span>
            </div>
          )}

          {comp.allCompleted.length > 0 && comp.allMissing.length > 0 && (
            <div className="pt-2.5 mt-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>{comp.allCompleted.length} of {comp.allCompleted.length + comp.allMissing.length} fields verified</span>
              <span className="text-emerald-400 font-bold">✓ Verified</span>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

function PartiallyFilledMyntraDropdown({
  isActive,
  threshold,
  count,
  countsByThreshold,
  onSelect,
}: {
  isActive: boolean
  threshold: number
  count: number
  countsByThreshold: Record<number, number>
  onSelect: (threshold: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 180)
  }

  const PRESETS = [
    { value: 100, label: 'All Incomplete Projects', sub: '< 100%' },
    { value: 95, label: 'Projects under 95% Health', sub: '< 95%' },
    { value: 90, label: 'Projects under 90% Health', sub: '< 90%' },
    { value: 85, label: 'Projects under 85% Health', sub: '< 85%' },
    { value: 80, label: 'Projects under 80% Health', sub: '< 80%' },
    { value: 70, label: 'Projects under 70% Health', sub: '< 70%' },
    { value: 60, label: 'Projects under 60% Health', sub: '< 60%' },
    { value: 50, label: 'Critical Health Only', sub: '< 50%' },
  ]

  const displayLabel = isActive
    ? (threshold < 100 ? `Health < ${threshold}%` : 'Partially Filled')
    : 'Partially Filled'

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          onSelect(threshold)
          setIsOpen(prev => !prev)
        }}
        className={`flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs active:scale-[0.98] ${isActive
            ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 ring-2 ring-amber-500/10'
            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white'
          }`}
      >
        <span className="flex items-center gap-1.5">
          {isActive && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
          <span>{displayLabel}</span>
        </span>
        <span className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-lg ${isActive
            ? 'bg-amber-200/90 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}>
          {count}
        </span>
        <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''}`} />
      </button>

      {/* Expandable Popover Card */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[360px] bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
          
          {/* Header */}
          <div className="px-4 py-3 bg-zinc-50/80 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Health Threshold Filter</span>
            </div>
            <span className="text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60">
              &lt; {threshold}% Active
            </span>
          </div>

          {/* Presets List */}
          <div className="py-1.5 max-h-72 overflow-y-auto divide-y divide-zinc-100/60 dark:divide-zinc-800/40">
            {PRESETS.map((p) => {
              const isSelected = isActive && threshold === p.value
              const matchCount = countsByThreshold[p.value] ?? count
              const isZero = matchCount === 0

              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    onSelect(p.value)
                    setIsOpen(false)
                  }}
                  className={`w-full px-4 py-2.5 text-left text-xs transition-all flex items-center justify-between group cursor-pointer ${isSelected
                      ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-950 dark:text-amber-100 font-bold border-l-4 border-amber-500 pl-3'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white font-medium pl-4'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected
                        ? 'border-amber-500 bg-amber-500 dark:border-amber-400 dark:bg-amber-400'
                        : 'border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-400'
                      }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-900" />}
                    </div>
                    <span className="truncate whitespace-nowrap">{p.label}</span>
                  </div>

                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md shrink-0 transition-colors whitespace-nowrap ${isSelected
                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                      : isZero
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                        : 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-600 dark:text-zinc-300 font-semibold group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700'
                    }`}>
                    {matchCount} {matchCount === 1 ? 'project' : 'projects'}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Bottom Interactive Range Slider Box */}
          <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-b from-zinc-50/90 to-zinc-100/50 dark:from-zinc-900 dark:to-zinc-800/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">Custom Slider:</span>
              <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60">
                &lt; {threshold}% ({count} projects)
              </span>
            </div>

            <input
              type="range"
              min="50"
              max="100"
              step="1"
              value={threshold}
              onChange={(e) => onSelect(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg transition-all"
            />

            {/* Slider Scale Endpoints */}
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 px-0.5">
              <span>50%</span>
              <span>60%</span>
              <span>70%</span>
              <span>80%</span>
              <span>90%</span>
              <span>100%</span>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

export default function AdminProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [query, setQuery] = useState('')
  const [activeTokens, setActiveTokens] = useState<FilterToken[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready_to_move' | 'under_construction' | 'new_launch' | 'partially_filled'>('all')
  const [partialThreshold, setPartialThreshold] = useState<number>(100)
  const [showThresholdSlider, setShowThresholdSlider] = useState(false)
  const [healthFilter, setHealthFilter] = useState<'all' | 'under_60' | 'under_80' | 'under_90' | 'critical' | 'good' | 'excellent'>('all')
  const [priceFilter, setPriceFilter] = useState<'all' | 'under_1cr' | '1_2cr' | '2_4cr' | 'above_4cr'>('all')

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Bulk Import Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkCsvText, setBulkCsvText] = useState('')
  const [bulkParsedRows, setBulkParsedRows] = useState<any[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [bulkImportResult, setBulkImportResult] = useState<{ updated: number; skipped: number; errors: any[] } | null>(null)

  // AI Data Enrichment Modal State
  const [isAgentExportOpen, setIsAgentExportOpen] = useState(false)
  const [healthThreshold, setHealthThreshold] = useState<number>(80)
  const [exportScope, setExportScope] = useState<'threshold' | 'selected'>('threshold')
  const [selectedTabs, setSelectedTabs] = useState<Set<ProjectTabKey>>(
    new Set(['core', 'specifications', 'pricing', 'location', 'intelligence', 'updates', 'partners'])
  )
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Autocomplete Popover
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  // ── Session Storage Persistence ──────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('propfyndr_admin_projects_filters')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.query !== undefined) setQuery(parsed.query)
        if (parsed.activeTokens) setActiveTokens(parsed.activeTokens)
        if (parsed.statusFilter) setStatusFilter(parsed.statusFilter)
        if (parsed.partialThreshold !== undefined) setPartialThreshold(parsed.partialThreshold)
        if (parsed.healthFilter) setHealthFilter(parsed.healthFilter)
        if (parsed.priceFilter) setPriceFilter(parsed.priceFilter)
        if (parsed.sortField) setSortField(parsed.sortField)
        if (parsed.sortOrder) setSortOrder(parsed.sortOrder)
      }
    } catch { }
  }, [])

  useEffect(() => {
    try {
      const stateToSave = { query, activeTokens, statusFilter, partialThreshold, healthFilter, priceFilter, sortField, sortOrder }
      sessionStorage.setItem('propfyndr_admin_projects_filters', JSON.stringify(stateToSave))
    } catch { }
  }, [query, activeTokens, statusFilter, partialThreshold, healthFilter, priceFilter, sortField, sortOrder])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/admin/projects?limit=1000')
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Autocomplete Suggestions (Builders, Sectors)
  const suggestions = useMemo(() => {
    if (!query || query.trim().length < 2) return []
    const q = query.toLowerCase().trim()
    const out: { type: 'builder' | 'sector' | 'name'; value: string; label: string; count?: number }[] = []

    const builderCounts = new Map<string, number>()
    const sectorCounts = new Map<string, number>()

    for (const p of projects) {
      if (p.builder?.name?.toLowerCase().includes(q)) {
        builderCounts.set(p.builder.name, (builderCounts.get(p.builder.name) || 0) + 1)
      }
      if (p.sector?.toLowerCase().includes(q)) {
        sectorCounts.set(p.sector, (sectorCounts.get(p.sector) || 0) + 1)
      }
    }

    builderCounts.forEach((count, name) => {
      out.push({ type: 'builder', value: name, label: `Builder: ${name}`, count })
    })

    sectorCounts.forEach((count, sector) => {
      out.push({ type: 'sector', value: sector, label: `Sector: ${sector}`, count })
    })

    return out.slice(0, 8)
  }, [query, projects])

  const addFilterToken = (token: { type: 'builder' | 'sector' | 'name'; value: string; label: string }) => {
    if (!activeTokens.some(t => t.type === token.type && t.value.toLowerCase() === token.value.toLowerCase())) {
      setActiveTokens(prev => [...prev, { id: `${token.type}_${Date.now()}`, ...token }])
    }
    setQuery('')
    setIsPopoverOpen(false)
  }

  const removeFilterToken = (id: string) => {
    setActiveTokens(prev => prev.filter(t => t.id !== id))
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // ── Combined Filtering and Sorting ───────────────────────────────────────
  const sortedAndFiltered = useMemo(() => {
    return projects
      .filter((p) => {
        // Status filter
        if (statusFilter === 'partially_filled') {
          if (getNonMediaScore(p) >= partialThreshold) return false
        } else if (statusFilter !== 'all' && p.status !== statusFilter) {
          return false
        }

        // Health filter
        const health = getNonMediaScore(p)
        if (healthFilter === 'under_60' && health >= 60) return false
        if (healthFilter === 'under_80' && health >= 80) return false
        if (healthFilter === 'under_90' && health >= 90) return false
        if (healthFilter === 'critical' && health >= 70) return false
        if (healthFilter === 'good' && (health < 70 || health >= 90)) return false
        if (healthFilter === 'excellent' && health < 90) return false

        // Price filter
        const minP = priceMinVal(p.unit_types)
        if (priceFilter === 'under_1cr' && (minP === 0 || minP >= 1.0)) return false
        if (priceFilter === '1_2cr' && (minP < 1.0 || minP >= 2.0)) return false
        if (priceFilter === '2_4cr' && (minP < 2.0 || minP >= 4.0)) return false
        if (priceFilter === 'above_4cr' && minP < 4.0) return false

        // Active tokens filter
        for (const token of activeTokens) {
          if (token.type === 'builder' && p.builder?.name?.toLowerCase() !== token.value.toLowerCase()) return false
          if (token.type === 'sector' && p.sector?.toLowerCase() !== token.value.toLowerCase()) return false
          if (token.type === 'name' && !p.name.toLowerCase().includes(token.value.toLowerCase())) return false
        }

        // Plaintext query filter
        if (query.trim()) {
          const q = query.toLowerCase().trim()
          const matchName = p.name.toLowerCase().includes(q)
          const matchBuilder = p.builder?.name?.toLowerCase().includes(q)
          const matchSector = p.sector?.toLowerCase().includes(q)
          if (!matchName && !matchBuilder && !matchSector) return false
        }

        return true
      })
      .sort((a, b) => {
        let diff = 0
        if (sortField === 'name') diff = a.name.localeCompare(b.name)
        else if (sortField === 'builder') diff = (a.builder?.name || '').localeCompare(b.builder?.name || '')
        else if (sortField === 'status') diff = a.status.localeCompare(b.status)
        else if (sortField === 'price') diff = priceMinVal(a.unit_types) - priceMinVal(b.unit_types)
        else if (sortField === 'health') diff = getNonMediaScore(a) - getNonMediaScore(b)
        return sortOrder === 'asc' ? diff : -diff
      })
  }, [projects, statusFilter, partialThreshold, healthFilter, priceFilter, activeTokens, query, sortField, sortOrder])

  // Multi-Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === sortedAndFiltered.length && sortedAndFiltered.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedAndFiltered.map(p => p.id)))
    }
  }

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllDeficient = (threshold: number) => {
    const ids = projects.filter(p => getNonMediaScore(p) < threshold).map(p => p.id)
    setSelectedIds(new Set(ids))
    toast.success(`Selected ${ids.length} projects under ${threshold}% health`)
  }

  const toggleTabFilter = (tabId: ProjectTabKey) => {
    setSelectedTabs(prev => {
      const next = new Set(prev)
      if (next.has(tabId)) {
        if (next.size > 1) next.delete(tabId)
        else toast.error('At least one tab must remain selected')
      } else {
        next.add(tabId)
      }
      return next
    })
  }

  const counts = useMemo(() => {
    return {
      all: projects.length,
      ready: projects.filter(p => p.status === 'ready_to_move').length,
      under: projects.filter(p => p.status === 'under_construction').length,
      new: projects.filter(p => p.status === 'new_launch').length,
      partially: projects.filter(p => getNonMediaScore(p) < partialThreshold).length,
    }
  }, [projects, partialThreshold])

  const countsByThreshold = useMemo(() => {
    const result: Record<number, number> = {}
    const thresholds = [100, 95, 90, 85, 80, 70, 60, 50]
    for (const t of thresholds) {
      result[t] = projects.filter(p => getNonMediaScore(p) < t).length
    }
    return result
  }, [projects])

  // ── AI Agent Enrichment Target Project Computation ───────────────────────
  const targetAgentProjects = useMemo(() => {
    let pool = projects
    if (exportScope === 'selected' && selectedIds.size > 0) {
      pool = projects.filter(p => selectedIds.has(p.id))
    } else {
      pool = projects.filter(p => getNonMediaScore(p) < healthThreshold)
    }

    return pool
      .map((p) => {
        const score = getNonMediaScore(p)
        const missing = getMissingFieldsForSelectedTabs(p, selectedTabs)
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          builder: p.builder?.name || 'Unknown Developer',
          sector: p.sector || 'Noida',
          city: p.city || 'Noida',
          status: p.status,
          priceRange: priceRange(p.unit_types),
          score,
          missingFields: missing.length > 0 ? missing : ['Specification & Detail Verification'],
        }
      })
      .sort((a, b) => a.score - b.score)
  }, [projects, healthThreshold, exportScope, selectedIds, selectedTabs])

  const generateAgentPromptText = useCallback(() => {
    const projectList = targetAgentProjects.map((p) => ({
      projectName: p.name,
      slug: p.slug,
      developer: p.builder,
      sector: p.sector,
      city: p.city,
      status: p.status,
      priceRange: p.priceRange,
      currentHealthScore: `${p.score}%`,
      missingOrIncompleteFields: p.missingFields,
    }))

    const tabNames = Array.from(selectedTabs).map(t => PROPERTY_TABS_CONFIG.find(c => c.id === t)?.label).filter(Boolean).join(', ')

    return `You are an Expert Real Estate Research Agent specializing in verified property intelligence for Noida and Greater Noida (NCR).

We have ${targetAgentProjects.length} property projects in our database requiring verified enrichment for the following property tabs:
[${tabNames}].

Please research and provide verified, RERA-compliant details strictly for the missing/incomplete fields listed for each project:

TARGET PROJECTS FOR ENRICHMENT (${targetAgentProjects.length}):
\`\`\`json
${JSON.stringify(projectList, null, 2)}
\`\`\`

OUTPUT FORMAT REQUIREMENT:
Provide structured JSON with the exact verified data for each project so it can be updated directly into the database.`
  }, [targetAgentProjects, selectedTabs])

  const handleCopyAgentPrompt = () => {
    const text = generateAgentPromptText()
    navigator.clipboard.writeText(text)
    setCopiedPrompt(true)
    toast.success(`Copied enrichment prompt for ${targetAgentProjects.length} projects!`)
    setTimeout(() => setCopiedPrompt(false), 2500)
  }

  const handleDownloadAgentJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetAgentProjects, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `propfyndr-enrichment-${targetAgentProjects.length}-projects.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success(`Downloaded JSON for ${targetAgentProjects.length} projects`)
  }

  const handleDownloadAgentCSV = () => {
    const headers = ['Project Name', 'Slug', 'Developer', 'Sector', 'City', 'Status', 'Health Score %', 'Missing Fields']
    const rows = targetAgentProjects.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.slug}"`,
      `"${p.builder.replace(/"/g, '""')}"`,
      `"${p.sector}"`,
      `"${p.city}"`,
      `"${p.status}"`,
      `${p.score}%`,
      `"${p.missingFields.join('; ').replace(/"/g, '""')}"`,
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `propfyndr-enrichment-${targetAgentProjects.length}-projects.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`Exported ${targetAgentProjects.length} projects to CSV`)
  }

  const handleExportCSV = () => {
    const headers = ['Name', 'Slug', 'Builder', 'Sector', 'Status', 'Pricing', 'Health %']
    const rows = sortedAndFiltered.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.slug}"`,
      `"${(p.builder?.name || '').replace(/"/g, '""')}"`,
      `"${p.sector}"`,
      `"${p.status}"`,
      `"${priceRange(p.unit_types)}"`,
      `${getNonMediaScore(p)}%`,
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `projects-catalog-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`Exported ${sortedAndFiltered.length} projects to CSV`)
  }

  const handleExecuteBulkImport = async () => {
    if (bulkParsedRows.length === 0) return
    setIsImporting(true)
    try {
      const res = await adminFetch('/admin/projects/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: bulkParsedRows }),
      })
      const result = await res.json()
      if (res.ok) {
        setBulkImportResult(result)
        toast.success(`Bulk updated ${result.updated} projects successfully!`)
        load()
      } else {
        toast.error(result.error || 'Bulk update failed')
      }
    } catch {
      toast.error('Network error during bulk update')
    } finally {
      setIsImporting(false)
    }
  }

  const clearAllFilters = () => {
    setQuery('')
    setActiveTokens([])
    setStatusFilter('all')
    setHealthFilter('all')
    setPriceFilter('all')
  }

  const isFilteringActive = activeTokens.length > 0 || statusFilter !== 'all' || healthFilter !== 'all' || priceFilter !== 'all' || query.trim() !== ''

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 p-4 md:p-8">

      {/* ── Sub-Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Projects Catalog</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 rounded-full">
              {sortedAndFiltered.length} of {projects.length} Listed
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Manage properties, completeness scores, pricing details, and RERA compliance.
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl shadow-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all cursor-pointer active:scale-[0.98]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-500' : 'text-zinc-500'} />
            <span>Reload</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl shadow-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all cursor-pointer active:scale-[0.98]"
            title="Export filtered project list as CSV"
          >
            <Download size={14} className="text-zinc-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setExportScope(selectedIds.size > 0 ? 'selected' : 'threshold')
              setIsAgentExportOpen(true)
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl shadow-xs hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 transition-all cursor-pointer active:scale-[0.98]"
            title="Export incomplete projects & missing tab fields for data enrichment"
          >
            <SlidersHorizontal size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span>Export Incomplete Data {selectedIds.size > 0 ? `(${selectedIds.size} Selected)` : ''}</span>
          </button>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 rounded-xl shadow-xs hover:bg-blue-100/80 transition-all cursor-pointer active:scale-[0.98]"
            title="Bulk upload spreadsheet to update prices, possession, and statuses"
          >
            <Upload size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Bulk Update</span>
          </button>

          <Link
            href="/admin/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-all cursor-pointer active:scale-[0.98]"
          >
            <Plus size={14} />
            <span>New Project</span>
          </Link>
        </div>
      </div>

      {/* ── Tokenized Intelligent Search Bar ───────────────────────────────── */}
      <div className="relative" ref={popoverRef}>
        <div className="group flex items-center flex-wrap gap-2 px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
          <Search size={16} className="text-zinc-400 group-focus-within:text-blue-500 transition-colors shrink-0 ml-1" />

          {/* Active Token Chips */}
          {activeTokens.map(t => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 animate-in fade-in zoom-in duration-150"
            >
              {t.type === 'builder' && <Building2 size={12} className="text-blue-500" />}
              {t.type === 'sector' && <MapPin size={12} className="text-blue-500" />}
              <span>{t.label}</span>
              <button
                type="button"
                onClick={() => removeFilterToken(t.id)}
                className="p-0.5 rounded-md hover:bg-blue-200/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 transition-colors cursor-pointer"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsPopoverOpen(true)
            }}
            onFocus={() => setIsPopoverOpen(true)}
            placeholder={activeTokens.length === 0 ? "Type builder name, sector (e.g. Mahagun, Sector 75), or project title..." : "Add more filters..."}
            className="flex-1 bg-transparent border-none outline-none text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 min-w-[200px]"
          />

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded">/ shortcut</span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Autocomplete Suggestions Popover */}
        {isPopoverOpen && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in duration-150">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Quick Filters</div>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => addFilterToken(s)}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                  {s.type === 'builder' && <Building2 size={13} className="text-zinc-400 group-hover:text-blue-500" />}
                  {s.type === 'sector' && <MapPin size={13} className="text-zinc-400 group-hover:text-blue-500" />}
                  <span>{s.label}</span>
                </div>
                {s.count && (
                  <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                    {s.count} properties
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Segmented Micro-Filter Bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-zinc-100/80 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60">

        {/* Status Segmented Buttons */}
        <div className="flex items-center gap-1 overflow-visible max-w-full pb-1 sm:pb-0 flex-wrap sm:flex-nowrap">
          {[
            { id: 'all', label: 'All Statuses', count: counts.all },
            { id: 'ready_to_move', label: 'Ready to Move', count: counts.ready },
            { id: 'under_construction', label: 'Under Construction', count: counts.under },
            { id: 'new_launch', label: 'New Launch', count: counts.new },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id as any)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${statusFilter === tab.id
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded-md ${statusFilter === tab.id
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                  : 'bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-400'
                }`}>
                {tab.count}
              </span>
            </button>
          ))}

          {/* Myntra-Style Partially Filled Expandable Dropdown */}
          <PartiallyFilledMyntraDropdown
            isActive={statusFilter === 'partially_filled'}
            threshold={partialThreshold}
            count={counts.partially}
            countsByThreshold={countsByThreshold}
            onSelect={(val) => {
              setPartialThreshold(val)
              setStatusFilter('partially_filled')
            }}
          />
        </div>

        {/* Health & Price Custom Dropdowns */}
        <div className="flex items-center gap-2">
          {/* Health Filter */}
          <CustomSelect
            value={healthFilter}
            onChange={(val) => setHealthFilter(val)}
            options={[
              { value: 'all', label: 'Health: All' },
              { value: 'under_60', label: 'Target < 60% Health', icon: <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" /> },
              { value: 'under_80', label: 'Target < 80% Health', icon: <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> },
              { value: 'under_90', label: 'Target < 90% Health', icon: <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /> },
              { value: 'excellent', label: 'Complete (90–100%)', icon: <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> },
            ]}
          />

          {/* Price Range Filter */}
          <CustomSelect
            value={priceFilter}
            onChange={(val) => setPriceFilter(val)}
            options={[
              { value: 'all', label: 'Pricing: All' },
              { value: 'under_1cr', label: '< ₹1.0 Cr' },
              { value: '1_2cr', label: '₹1.0–2.0 Cr' },
              { value: '2_4cr', label: '₹2.0–4.0 Cr' },
              { value: 'above_4cr', label: '> ₹4.0 Cr' },
            ]}
          />

          {/* Reset Filters */}
          {isFilteringActive && (
            <button
              onClick={clearAllFilters}
              className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <X size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

      </div>

      {/* ── Table & Responsive Card Container ───────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden">

        {/* Table Header with Interactive Column Sorting & Master Checkbox (Desktop only) */}
        <div className="hidden md:flex items-center px-6 py-3 bg-zinc-50/80 dark:bg-zinc-800/50 border-b border-zinc-200/80 dark:border-zinc-800/80 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider select-none">

          {/* Select All Checkbox */}
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="mr-3 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            title="Select all visible projects"
          >
            {selectedIds.size > 0 && selectedIds.size === sortedAndFiltered.length ? (
              <CheckSquare size={16} className="text-blue-600 dark:text-blue-400" />
            ) : selectedIds.size > 0 ? (
              <div className="w-4 h-4 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-black leading-none">
                -
              </div>
            ) : (
              <Square size={16} />
            )}
          </button>

          <div className="w-8 mr-4" /> {/* Thumbnail space */}

          <button
            onClick={() => toggleSort('name')}
            className="flex-1 flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer text-left"
          >
            <span>Property & Developer</span>
            {sortField === 'name' ? (
              sortOrder === 'asc' ? <ArrowUp size={12} className="text-blue-500" /> : <ArrowDown size={12} className="text-blue-500" />
            ) : (
              <ArrowUpDown size={12} className="opacity-40" />
            )}
          </button>

          <button
            onClick={() => toggleSort('status')}
            className="w-[140px] flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Status</span>
            {sortField === 'status' ? (
              sortOrder === 'asc' ? <ArrowUp size={12} className="text-blue-500" /> : <ArrowDown size={12} className="text-blue-500" />
            ) : (
              <ArrowUpDown size={12} className="opacity-40" />
            )}
          </button>

          <button
            onClick={() => toggleSort('price')}
            className="w-[120px] flex items-center justify-end gap-1.5 pr-6 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Pricing</span>
            {sortField === 'price' ? (
              sortOrder === 'asc' ? <ArrowUp size={12} className="text-blue-500" /> : <ArrowDown size={12} className="text-blue-500" />
            ) : (
              <ArrowUpDown size={12} className="opacity-40" />
            )}
          </button>

          <button
            onClick={() => toggleSort('health')}
            className="w-[90px] flex items-center justify-end gap-1.5 pr-6 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Health</span>
            {sortField === 'health' ? (
              sortOrder === 'asc' ? <ArrowUp size={12} className="text-blue-500" /> : <ArrowDown size={12} className="text-blue-500" />
            ) : (
              <ArrowUpDown size={12} className="opacity-40" />
            )}
          </button>

          <div className="w-[60px]" /> {/* Actions */}
        </div>

        {/* Master Select Bar on Mobile */}
        <div className="flex md:hidden items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2 cursor-pointer"
          >
            {selectedIds.size > 0 && selectedIds.size === sortedAndFiltered.length ? (
              <CheckSquare size={16} className="text-blue-600" />
            ) : (
              <Square size={16} />
            )}
            <span>Select All ({sortedAndFiltered.length})</span>
          </button>
          <span>{selectedIds.size} selected</span>
        </div>

        {/* Table / Mobile Cards Body */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <AdminTableRowSkeleton key={i} />
            ))
          ) : sortedAndFiltered.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mb-3">
                <Building2 size={24} />
              </div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No properties found</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">No properties match your current search and filter combination.</p>
              {isFilteringActive && (
                <button
                  onClick={clearAllFilters}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            sortedAndFiltered.map((project) => {
              const statusCfg = STATUS_MAP[project.status] || STATUS_MAP.ready_to_move
              const StatusIcon = statusCfg.icon
              const isSelected = selectedIds.has(project.id)

              return (
                <div key={project.id}>
                  {/* Desktop Tabular Row */}
                  <div
                    onClick={() => router.push(`/admin/projects/${project.id}`)}
                    className={`hidden md:flex items-center px-6 py-3.5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                  >
                    {/* Row Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelectRow(project.id, e)}
                      className="mr-3 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare size={16} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>

                    {/* Thumbnail */}
                    <div className="mr-4">
                      <ProjectThumbnail src={project.hero_image_url} alt={project.name} />
                    </div>

                    {/* Name, Developer & Sector */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {project.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5 truncate">
                        <span>{project.builder?.name || 'Unknown Developer'}</span>
                        <span>•</span>
                        <span>{project.sector}, {project.city}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="w-[140px] flex items-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border ${statusCfg.chip}`}>
                        <StatusIcon size={12} />
                        <span>{statusCfg.label}</span>
                      </span>
                    </div>

                    {/* Pricing Range */}
                    <div className="w-[120px] flex items-center justify-end pr-6 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {priceRange(project.unit_types)}
                    </div>

                    {/* Health Score with Hover Tooltip */}
                    <div className="w-[90px] flex items-center justify-end pr-6">
                      <HealthBadgeWithTooltip project={project} />
                    </div>

                    {/* Row Action Arrow */}
                    <div className="w-[60px] flex items-center justify-end">
                      <ChevronRight size={15} className="text-zinc-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Mobile & Tablet Card Layout */}
                  <div
                    onClick={() => router.push(`/admin/projects/${project.id}`)}
                    className={`flex md:hidden flex-col p-4 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer space-y-3 ${isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectRow(project.id, e)}
                          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 cursor-pointer shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-blue-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <ProjectThumbnail src={project.hero_image_url} alt={project.name} />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{project.name}</h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {project.builder?.name || 'Unknown'} • {project.sector}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-zinc-400 shrink-0 mt-1" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10.5px] font-semibold rounded-md border ${statusCfg.chip}`}>
                        <StatusIcon size={11} />
                        <span>{statusCfg.label}</span>
                      </span>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          {priceRange(project.unit_types)}
                        </span>
                        <HealthBadgeWithTooltip project={project} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Sticky Multi-Select Action Bar ─────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-5 py-3 rounded-2xl shadow-2xl border border-zinc-800 dark:border-zinc-200 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{selectedIds.size} Projects Selected</span>
          </div>

          <div className="h-4 w-px bg-zinc-700 dark:bg-zinc-300" />

          <button
            type="button"
            onClick={() => {
              setExportScope('selected')
              setIsAgentExportOpen(true)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <SlidersHorizontal size={13} />
            <span>Export Incomplete Data</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectAllDeficient(80)}
            className="text-xs font-semibold text-zinc-400 hover:text-white dark:hover:text-zinc-900 transition-colors"
          >
            Select All &lt;80%
          </button>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="p-1 text-zinc-400 hover:text-rose-400 transition-colors"
            title="Deselect all"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Catalog Data Enrichment & Export Modal (Refined & Spacious) ───── */}
      {isAgentExportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsAgentExportOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                    Catalog Data Enrichment & Export
                  </h3>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Select target projects and data categories to extract missing fields for research & bulk update
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAgentExportOpen(false)}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">

              {/* Target Scope Selection & Quick Threshold Chips */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Target Scope:</span>
                    <span className="text-[11px] text-zinc-400">Choose which projects to analyze</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <button
                      type="button"
                      onClick={() => setExportScope('threshold')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${exportScope === 'threshold'
                          ? 'bg-indigo-600 text-white shadow-xs font-bold'
                          : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
                        }`}
                    >
                      By Health Threshold
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportScope('selected')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${exportScope === 'selected'
                          ? 'bg-indigo-600 text-white shadow-xs font-bold'
                          : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
                        }`}
                    >
                      Selected ({selectedIds.size})
                    </button>
                  </div>
                </div>

                {exportScope === 'threshold' && (
                  <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                    <span className="text-[11px] font-bold text-zinc-500">Quick Thresholds:</span>
                    {[
                      { label: '< 60% (Critical)', val: 60 },
                      { label: '< 80% (Standard)', val: 80 },
                      { label: '< 90% (Refine)', val: 90 },
                      { label: '< 100% (All Incomplete)', val: 100 },
                    ].map((t) => (
                      <button
                        key={t.val}
                        type="button"
                        onClick={() => setHealthThreshold(t.val)}
                        className={`px-3 py-1 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${healthThreshold === t.val
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700 font-bold'
                            : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-indigo-200'
                          }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Granular Property Tab Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Select Data Categories to Inspect:
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Missing fields will be checked and exported only for the selected categories
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-md">
                    Media / Images Excluded
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {PROPERTY_TABS_CONFIG.map((tab) => {
                    const isChecked = selectedTabs.has(tab.id)
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => toggleTabFilter(tab.id)}
                        className={`p-3 text-left rounded-2xl border transition-all cursor-pointer ${isChecked
                            ? 'bg-indigo-50/70 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800/80 text-zinc-900 dark:text-white shadow-2xs'
                            : 'bg-zinc-50/50 dark:bg-zinc-800/30 border-zinc-200/60 dark:border-zinc-800 text-zinc-400 opacity-60'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold ${isChecked ? 'text-indigo-900 dark:text-indigo-200' : 'text-zinc-500'}`}>
                            {tab.label}
                          </span>
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${isChecked ? 'bg-indigo-600 text-white' : 'border border-zinc-300 dark:border-zinc-600'
                            }`}>
                            {isChecked && <Check size={11} strokeWidth={3} />}
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                          {tab.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Target Projects Preview List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Target Projects ({targetAgentProjects.length} Records)
                  </span>
                  <span className="text-[11px] text-zinc-400">Sorted by lowest health first</span>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900">
                  {targetAgentProjects.length > 0 ? (
                    targetAgentProjects.map((p) => (
                      <div key={p.id} className="p-3.5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{p.name}</span>
                            <span className="text-[11px] text-zinc-400 font-medium">• {p.builder} • {p.sector}</span>
                          </div>
                          <span className="px-2 py-0.5 text-xs font-mono font-black rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                            {p.score}%
                          </span>
                        </div>

                        {/* Missing Fields Pills */}
                        <div className="flex items-center flex-wrap gap-1.5">
                          {p.missingFields.map((f, i) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
                              ✕ {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center text-xs text-zinc-400">
                      No projects match the current threshold and selection!
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/80 shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadAgentJSON}
                  disabled={targetAgentProjects.length === 0}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Download structured JSON"
                >
                  <FileJson size={14} className="text-zinc-500" />
                  <span>Download JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAgentCSV}
                  disabled={targetAgentProjects.length === 0}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Download spreadsheet CSV"
                >
                  <FileSpreadsheet size={14} className="text-zinc-500" />
                  <span>Download CSV</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsAgentExportOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  disabled={targetAgentProjects.length === 0}
                  onClick={handleCopyAgentPrompt}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                >
                  {copiedPrompt ? (
                    <>
                      <CheckCheck size={14} className="text-white" />
                      <span>Copied Prompt!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Enrichment Prompt ({targetAgentProjects.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Bulk Update Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Upload size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Bulk Update Projects</h3>
                  <p className="text-[11px] text-zinc-500">Paste CSV or JSON with slug, price, possession, or status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600"
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              value={bulkCsvText}
              onChange={(e) => {
                setBulkCsvText(e.target.value)
                try {
                  const lines = e.target.value.trim().split('\n')
                  const parsed = lines.map(line => {
                    const parts = line.split(',').map(s => s.trim())
                    return { slug: parts[0], price_min_cr: parts[1] ? parseFloat(parts[1]) : undefined, status: parts[2] }
                  }).filter(p => p.slug)
                  setBulkParsedRows(parsed)
                } catch { }
              }}
              placeholder="slug,price_min_cr,status&#10;ace-aspire-techzone-4,0.92,ready_to_move&#10;cleo-county-sector-121,1.65,ready_to_move"
              className="w-full h-40 p-3 font-mono text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkParsedRows.length === 0 || isImporting}
                onClick={handleExecuteBulkImport}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
              >
                <Upload size={13} />
                <span>Apply {bulkParsedRows.length} Updates</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
