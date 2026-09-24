'use client'
import {
  Building2, CheckCircle2, LineChart, BedDouble,
  MapPin, Award, CalendarDays, FileText, IndianRupee, X, ShieldCheck, Users, HardHat
} from 'lucide-react'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {  AnimatePresence, m  } from 'framer-motion'
import Image from 'next/image'
import type { ProjectCard as ProjectCardType, ProjectDetail } from '@/types/project'
import { sanitizePriceLabel } from '@/lib/format'
import { buildWhatsAppUrl, trackWhatsAppHandoff } from '@/lib/whatsapp'
import { track, trackPropertyEvent } from '@/lib/analytics'
import { getAqi, type AqiResult } from '@/lib/waqi'
import { usePreferredImages } from '@/lib/hooks'
import { useProjectDetailData, useProjectMediaDetection } from '@/lib/hooks/useProjectDetail'
import type { ProjectDocumentPublic } from '@/lib/hooks/useProjectDetail'
import { handleReraClick, handleEscapeKey, imageTypeRank } from '@/lib/projectDetailHandlers'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import SiteVisitScheduler from '@/components/SiteVisitScheduler'
import FloorPlanViewer from '@/components/FloorPlanViewer'
import PriceInclusions from '@/components/property-detail/PriceInclusions'
import OverviewTab from '@/components/property-detail/OverviewTab'
import {
  IntelligenceTabSkeleton,
  ResidencesSkeletonFull,
  PricingTabSkeleton,
  LocationTabSkeleton,
  BuilderTabSkeleton,
} from '@/components/skeletons'
import dynamic from 'next/dynamic'

// Only one tab is ever mounted. Loading all of them eagerly put ~100 kB of
// tab-only JS in the /property/[slug] entry chunk for markup the visitor may
// never open. OverviewTab stays static — it is the default tab and must paint
// without a second round-trip.
const IntelligenceTab = dynamic(() => import('@/components/property-detail/IntelligenceTab'), {
  ssr: false,
  loading: () => <IntelligenceTabSkeleton />
})
const ResidencesTab = dynamic(() => import('@/components/property-detail/ResidencesTab'), {
  ssr: false,
  loading: () => <ResidencesSkeletonFull />
})
const ProjectPricingTab = dynamic(() => import('@/components/property-detail/ProjectPricingTab'), {
  ssr: false,
  loading: () => <PricingTabSkeleton />
})
const LocationTab = dynamic(() => import('@/components/property-detail/LocationTab'), {
  ssr: false,
  loading: () => <LocationTabSkeleton />
})
const BuilderTab = dynamic(() => import('@/components/property-detail/BuilderTab'), {
  ssr: false,
  loading: () => <BuilderTabSkeleton />
})
const PartnersTab = dynamic(() => import('@/components/property-detail/PartnersTab'), {
  ssr: false,
})
import { resolveImgUrl } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'



interface Props {
  project: ProjectCardType | null
  onClose: () => void
  inline?: boolean
  initialDetail?: ProjectDetail
  userId?: string | null

}

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const SECTION_TABS = ['Overview', 'Analysis', 'Floor Plans', 'Pricing', 'Location', 'Builder'] as const
type Tab = typeof SECTION_TABS[number]

const tierLabel: Record<string, string> = { STRONG_BUY: 'Strong Buy', BUY: 'Buy', HOLD: 'Hold', WATCH: 'Watch', AVOID: 'Avoid' }

/** Stable ids so each tab can point at the panel it controls. */
const PANEL_ID = 'project-detail-panel-content'
const tabId = (tab: Tab): string => `project-detail-tab-${tab.toLowerCase().replace(/\s+/g, '-')}`

/**
 * Arrow keys move between tabs; Home and End jump to the ends.
 *
 * Exported for the test — the behaviour is a small state machine over an
 * ordered list, and it is easier to prove here than through six rendered
 * buttons. Returns the tab that should become active, or null for a key we do
 * not handle.
 */
export function nextTabForKey(key: string, current: Tab): Tab | null {
  const i = SECTION_TABS.indexOf(current)
  switch (key) {
    // Wraps deliberately: at the last tab, Right returns to the first rather
    // than dead-ending, which is what the tablist pattern specifies.
    case 'ArrowRight':
    case 'ArrowDown':
      return SECTION_TABS[(i + 1) % SECTION_TABS.length]
    case 'ArrowLeft':
    case 'ArrowUp':
      return SECTION_TABS[(i - 1 + SECTION_TABS.length) % SECTION_TABS.length]
    case 'Home':
      return SECTION_TABS[0]
    case 'End':
      return SECTION_TABS[SECTION_TABS.length - 1]
    default:
      return null
  }
}

export default function ProjectDetailPanel({ project, onClose, inline, initialDetail, userId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useProjectMediaDetection()
  const [activeTab, setActiveTab]     = useState<Tab>(() => {
    const tab = searchParams.get('tab')
    return (SECTION_TABS.includes(tab as Tab) ? tab : 'Overview') as Tab
  })
  /**
   * Arrow-key navigation for both tab bars. Focus follows the selection, which
   * is what makes a roving tabindex usable: the newly active tab is the one
   * stop in the set, so it has to actually receive focus.
   */
  const onTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabForKey(e.key, activeTab)
    if (!next) return
    e.preventDefault()
    // Captured now: currentTarget is cleared once the handler returns.
    const list = e.currentTarget
    setActiveTab(next)
    // Focus after React has swapped which button is the tab stop.
    requestAnimationFrame(() => {
      list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
    })
  }, [activeTab])

  // Tab stays inside the panel, Escape closes it, focus returns to the card
  // that opened it. Inline renders are part of the page, not a dialog, so they
  // must not trap anything.
  const isDialog = !inline && !!project
  const desktopDialogRef = useDialogA11y<HTMLDivElement>(isDialog && !isMobile, onClose)
  const mobileDialogRef = useDialogA11y<HTMLDivElement>(isDialog && isMobile, onClose)

  const { detail, documents, loading, paymentPlan, costSheet } = useProjectDetailData(project, initialDetail || null, 'Overview', userId, activeTab)
  const [showVisitScheduler, setShowVisitScheduler] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => setIsScrolled(e.currentTarget.scrollTop > 200)
  const [showFloorPlan, setShowFloorPlan] = useState<{ plans: Array<{ id: string; url: string; caption?: string | null }> } | null>(null)
  const [aqi, setAqi]                 = useState<AqiResult | null>(null)
  const [marketVisible, setMarketVisible] = useState(false)
  const [reraCopied, setReraCopied]   = useState(false)
  const [showBuilderPopover, setShowBuilderPopover] = useState(false)
  const [showReraPopover, setShowReraPopover]       = useState(false)

  const onReraClick = (reraNo: string, reraUrl?: string | null) => {
    handleReraClick(reraNo, reraUrl, () => setReraCopied(true), () => setReraCopied(false))
  }
  const marketRef                     = useRef<HTMLDivElement>(null)
  const scrollContainerRef            = useRef<HTMLDivElement>(null)
  const scrollContainerMobileRef      = useRef<HTMLDivElement>(null)
  const { imgIdx, markImageFailed, activeUrl, setImgIdx } = usePreferredImages(project, detail?.images)

  useEffect(() => {
    if (scrollContainerRef.current && typeof scrollContainerRef.current.scrollTo === 'function') {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'auto' })
    }
    if (scrollContainerMobileRef.current && typeof scrollContainerMobileRef.current.scrollTo === 'function') {
      scrollContainerMobileRef.current.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [activeTab])

  // Warm the lazy tab chunks once the browser is idle, so the first paint stays
  // light but switching tabs never shows a loading skeleton on a warm connection.
  useEffect(() => {
    if (!project) return
    const warm = () => {
      void import('@/components/property-detail/ResidencesTab')
      void import('@/components/property-detail/ProjectPricingTab')
      void import('@/components/property-detail/LocationTab')
      void import('@/components/property-detail/BuilderTab')
      void import('@/components/property-detail/IntelligenceTab')
      void import('@/components/property-detail/PartnersTab')
    }
    if (typeof window === 'undefined') return
    const idle = typeof window.requestIdleCallback === 'function'
    const handle: number = idle
      ? window.requestIdleCallback(warm, { timeout: 2500 })
      : window.setTimeout(warm, 1200)
    return () => {
      if (idle) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
    }
  }, [project])

  useEffect(() => {
    // Only mirror the tab into the URL while a project is actually open. The
    // panel mounts with project={null} on /discover, and this effect ran anyway
    // — so simply loading the chat rewrote the address to /discover?tab=Overview,
    // a query string describing a panel that was not on screen. It then became
    // part of any link the buyer copied.
    if (!project) return

    const currentTab = searchParams.get('tab')
    if (currentTab !== activeTab) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', activeTab)
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState({}, '', newUrl)
    }
  }, [activeTab, searchParams, project])

  useEffect(() => {
    const el = marketRef.current
    if (!el || marketVisible) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setMarketVisible(true); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [activeTab, loading, marketVisible])

  useEffect(() => {
    if (!project) {
      setAqi(null)
      setMarketVisible(false)
      return
    }
    setActiveTab('Overview')
    setAqi(null)
    setMarketVisible(false)
  }, [project])

  const fetchAqi = useCallback(() => {
    if (!project) return
    const city = (project.city || 'noida').toLowerCase()
    getAqi(project.lat, project.lng, city).then(setAqi).catch((err) => {
      console.error('Failed to fetch AQI:', err instanceof Error ? err.message : String(err))
    })
  }, [project])

  useEffect(() => {
    fetchAqi()
  }, [fetchAqi])

  useEffect(() => {
    if (!project) return
    trackPropertyEvent(project.id, 'view', undefined, userId).catch(() => {})
  }, [project, userId])

  useEffect(() => {
    if (!project) return
    trackPropertyEvent(project.id, 'tab_opened', undefined, userId, undefined, { tab: activeTab }).catch(() => {})
  }, [activeTab, project, userId])


  useEffect(() => {
    if (inline || !project) return
    const handler = handleEscapeKey(onClose)
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [inline, onClose, project])

  const isOpen = !!project

  const onSiteVisitClick = useCallback(() => {
    if (project) trackPropertyEvent(project.id, 'site_visit', undefined, userId).catch(() => {})
    setShowVisitScheduler(true)
  }, [project, userId])

  const allImages = [...(detail?.images ?? project?.images ?? [])].sort((a, b) => imageTypeRank(a.type) - imageTypeRank(b.type))
  const floorPlanImages = allImages.filter(i => i.type === 'floor_plan')
  const currentImg = activeUrl ? resolveImgUrl(activeUrl) : null

  const d = detail ?? project

  const isRTM = d?.status === 'ready_to_move'
  const isNew = d?.status === 'new_launch'

  const bhkLabel = [...new Set((d?.unit_types ?? []).map((u) => `${u.bhk}BHK`))].join(' · ')

  const tier          = detail?.recommendation_profile?.tier ?? null
  const persona       = detail?.persona_profile?.primary_persona ?? null
  const decisionThesis = detail?.decision_profile?.decision_thesis ?? null
  const whyBuy        = detail?.decision_profile?.why_buy ?? []
  const whyAvoid      = detail?.decision_profile?.why_avoid ?? []
  const timelineAdvice     = detail?.recommendation_profile?.timeline_advice ?? null
  const negotiationLeverage = detail?.recommendation_profile?.negotiation_leverage ?? []
  const walkAwayConditions  = detail?.recommendation_profile?.walk_away_conditions ?? []
  const competitors   = detail?.competitors ?? []

  // ── Tier + persona Notion-style callout (shared mobile/desktop) ─────────────────────
  const intelligenceChips = (tier || persona) && (
    <div className="flex items-start gap-md bg-surface-2 border border-border rounded-lg p-lg">
      <Award size={16} className="text-primary mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs font-bold text-text-primary mb-md">Investment Thesis</p>
        <p className="text-sm text-text-secondary leading-relaxed">
          {tier && <span>Rated as <strong className="text-text-primary">{tierLabel[tier] ?? tier}</strong>. </span>}
          {persona && <span>Ideal for {persona.charAt(0) + persona.slice(1).toLowerCase()}.</span>}
        </p>
      </div>
    </div>
  )

  // ── Shared tab body ───────────────────────────────────────────────────────
  // Single tab-switch transition reused by all three render paths below
  // (inline, desktop modal, mobile sheet) instead of each defining its own.
  const tabBody = (
    <AnimatePresence mode="wait">
      <m.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
      {activeTab === 'Overview' && (
        <OverviewTab
          project={project}
          detail={detail}
          d={d}
          loading={loading}
          documents={documents}
          whyBuy={whyBuy}
          floorPlanImages={floorPlanImages}
          onViewFloorPlans={(plans) => setShowFloorPlan({ plans })}
          onGoToLocation={() => setActiveTab('Location')}
          onGoToDocuments={() => setActiveTab('Builder')}
          onGoToPricing={() => setActiveTab('Pricing')}
          onGoToFloorPlans={() => setActiveTab('Floor Plans')}
        />
      )}

      {activeTab === 'Analysis' && (
        <IntelligenceTab
          project={project}
          detail={detail}
          d={d}
          loading={loading}
          timelineAdvice={timelineAdvice}
          negotiationLeverage={negotiationLeverage}
          walkAwayConditions={walkAwayConditions}
          marketVisible={marketVisible}
          marketRef={marketRef}
          onGoToPricing={() => setActiveTab('Pricing')}
          onGoToOverview={() => setActiveTab('Overview')}
        />
      )}

      {activeTab === 'Floor Plans' && (
        <div className="space-y-8 pb-12">
          <ResidencesTab
            unitTypes={d?.unit_types ?? []}
            floorPlanImages={floorPlanImages}
            loading={loading}
            detail={detail}
            projectStatus={d?.status}
            paymentPlan={paymentPlan}
            costSheet={costSheet}
            onViewFloorPlans={(plans) => setShowFloorPlan({ plans })}
            onGoToCosts={() => setActiveTab('Pricing')}
            onGoToOverview={() => setActiveTab('Overview')}
          />
        </div>
      )}

      {activeTab === 'Pricing' && (
        <div className="space-y-8 pb-12 pt-8">
          <ProjectPricingTab
            unitTypes={d?.unit_types ?? []}
            detail={{
              ...detail,
              payment_plan: paymentPlan.data || detail?.payment_plan || (detail?.payment_plans?.[0]) || null,
              payment_plans: detail?.payment_plans || (paymentPlan.data ? [paymentPlan.data] : []),
              cost_sheet: costSheet.data || detail?.cost_sheet || null
            } as ProjectDetail}
            loading={loading}
            onGoToCosts={() => onSiteVisitClick()}
          />
        </div>
      )}

      {activeTab === 'Location' && (
        <LocationTab
          project={project}
          detail={detail}
          d={d}
          projectAddress={`${d?.address ?? d?.name}, ${d?.sector}, ${d?.city}, India`}
          loading={loading}
        />
      )}

      {activeTab === 'Builder' && (
        <div className="space-y-8 pb-12">
          <BuilderTab
            builder={detail?.builder_detail || (typeof d?.builder === 'object' ? (d.builder as any) : null)}
            project={d as any}
            documents={documents}
            loading={loading && !detail}
          />
        </div>
      )}
      </m.div>
    </AnimatePresence>
  )

  // ── CTA footer ─────────────────────────────────────────────────────────────
  const ctaFooter = (
    <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white space-y-2">
      <button
        onClick={() => onSiteVisitClick()}
        className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl text-[14px] transition-colors flex items-center justify-center gap-2"
      >
        <CalendarDays size={16} />
        Book Site Visit
      </button>
      {(() => {
        const waUrl = d ? buildWhatsAppUrl(d as any, 'panel') : null
        return waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackWhatsAppHandoff(d as any, 'panel')
              trackPropertyEvent((d as any)?.id, 'whatsapp_inquiry', undefined, userId).catch(() => {})
            }}
            className="w-full border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800 py-3 rounded-2xl text-[13px] transition-colors flex items-center justify-center gap-2"
          >
            <WhatsAppIcon size={14} />
            Ask on WhatsApp
          </a>
        ) : null
      })()}
    </div>
  )

  // ── Unified Sticky Header (Vercel Style) & Tab Strip ──────────────────────────────────
  const tabIcons: Record<Tab, React.ReactNode> = {
    Overview: <Building2 size={15} />,
    Analysis: <LineChart size={15} />,
    'Floor Plans': <BedDouble size={15} />,
    Pricing: <IndianRupee size={15} />,
    Location: <MapPin size={15} />,
    Builder: <FileText size={15} />
  }

  const stickyHeader = (
    <div className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/10 shadow-xs transition-all duration-300">
      <div className="flex items-center justify-between px-3 md:px-6 h-[58px] max-w-7xl mx-auto gap-2">
        <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
          <div className="flex items-center gap-2 max-w-[120px] sm:max-w-[160px] md:max-w-[200px]">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isRTM ? 'bg-emerald-500' : isNew ? 'bg-blue-500' : 'bg-amber-500'}`} />
            <span className="font-extrabold text-gray-900 dark:text-gray-100 text-[13.5px] truncate leading-tight">{d?.name}</span>
          </div>

          {d?.rera_number && (
            <div className="relative group hidden md:inline-block">
              <button
                onClick={() => onReraClick(d.rera_number!, d.rera_url)}
                title="Click to copy RERA No & Verify"
                aria-label={`RERA Number ${d.rera_number}. Click to copy and verify`}
                className="p-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-full text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              >
                <ShieldCheck size={15} className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block z-50 w-56 bg-gray-900 text-white p-2.5 rounded-xl shadow-xl text-[11px] space-y-1 pointer-events-none transition-all">
                <p className="font-bold text-blue-400 flex items-center gap-1">
                  ✓ RERA No: {d.rera_number}
                </p>
                <p className="text-gray-300 text-[10px]">
                  {reraCopied ? 'Copied to clipboard!' : 'Click to copy RERA ID & verify'}
                </p>
              </div>
            </div>
          )}
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0 hidden md:block" />
        </div>

        {/* A real tablist. These were six plain buttons: a screen reader
            announced "Overview, button" with no hint that they were a set of
            six or which one was showing, and a keyboard had to Tab through
            every one to reach the last. */}
        <div
          role="tablist"
          aria-label="Project sections"
          onKeyDown={onTabKeyDown}
          className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0 justify-start sm:justify-center px-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {SECTION_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                id={tabId(tab)}
                role="tab"
                aria-selected={isActive}
                aria-controls={PANEL_ID}
                // Roving tabindex: one stop for the whole set, arrows move
                // within it. This is what the pattern expects, and it is the
                // difference between one Tab press and six.
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 flex items-center gap-1.5 text-[12.5px] sm:text-[13px] font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-xs dark:bg-white dark:text-gray-900 font-extrabold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 font-medium'
                }`}
              >
                {tabIcons[tab]}
                <span>{tab}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2.5 flex-shrink-0 ml-1">
          <p className="text-[12px] font-bold text-gray-900 dark:text-white hidden xl:block whitespace-nowrap">{sanitizePriceLabel(d?.price_range_label || (d?.price_min_cr ? `₹${d.price_min_cr} Cr+` : ''))}</p>
          <button onClick={() => onSiteVisitClick()} className="px-3.5 py-1.5 bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-100 hover:scale-105 active:scale-95 text-white dark:text-gray-900 font-bold rounded-full text-[12px] transition-all whitespace-nowrap shadow-2xs cursor-pointer">
            Book Site Visit
          </button>
        </div>
      </div>
    </div>
  )

  const mobileTabIcons: Record<Tab, React.ReactNode> = {
    Overview: <Building2 size={17} />,
    Analysis: <LineChart size={17} />,
    'Floor Plans': <BedDouble size={17} />,
    Pricing: <IndianRupee size={17} />,
    Location: <MapPin size={17} />,
    Builder: <HardHat size={17} />
  }

  const mobileTabLabels: Record<Tab, string> = {
    Overview: 'Overview',
    Analysis: 'Analysis',
    'Floor Plans': 'Floor Plans',
    Pricing: 'Pricing',
    Location: 'Location',
    Builder: 'Builder'
  }

  const mobileTabBar = (
    <div className="sticky top-0 z-30 w-full bg-white/95 dark:bg-[#120f0d]/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 shadow-xs flex-shrink-0">
      <div
        role="tablist"
        aria-label="Project sections"
        onKeyDown={onTabKeyDown}
        className="flex items-center justify-around px-0.5 py-1"
      >
        {SECTION_TABS.map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              id={`${tabId(tab)}-mobile`}
              role="tab"
              aria-selected={isActive}
              aria-controls={PANEL_ID}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                setActiveTab(tab)
                if (scrollContainerMobileRef.current) {
                  scrollContainerMobileRef.current.scrollTo({ top: 0, behavior: 'smooth' })
                }
              }}
              className={`flex flex-col items-center gap-1 py-1.5 px-1 relative transition-all cursor-pointer flex-1 min-w-[48px] ${
                isActive ? 'text-blue-600 dark:text-blue-400 font-extrabold' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {mobileTabIcons[tab]}
              <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {mobileTabLabels[tab]}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  const mobileCtaFooter = (
    <div className="sticky bottom-0 z-40 w-full bg-white/95 dark:bg-[#120f0d]/95 backdrop-blur-md border-t border-gray-200/80 dark:border-gray-800/80 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex-shrink-0">
      <button
        onClick={() => onSiteVisitClick()}
        className="w-full bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.98]"
      >
        <CalendarDays size={16} />
        Book Site Visit
      </button>
    </div>
  )

  const renderHero = () => {
    const unitTypes = d?.unit_types ?? []
    const validPricesMin = unitTypes.map((u: any) => u.price_min_cr).filter(Boolean) as number[]
    const validPricesMax = unitTypes.map((u: any) => u.price_max_cr).filter(Boolean) as number[]
    const minCalculated = validPricesMin.length > 0 ? Math.min(...validPricesMin) : d?.price_min_cr
    const maxCalculated = validPricesMax.length > 0 ? Math.max(...validPricesMax) : (d as any)?.price_max_cr

    let displayPrice = 'Price on Request'
    if (d?.price_range_label && !/price on request|price on demand/i.test(d.price_range_label)) {
      displayPrice = sanitizePriceLabel(d.price_range_label)
    } else if (minCalculated != null) {
      if (maxCalculated != null && maxCalculated > minCalculated) {
        displayPrice = sanitizePriceLabel(`₹${minCalculated}–${maxCalculated} Cr`)
      } else {
        displayPrice = sanitizePriceLabel(`₹${minCalculated} Cr Onwards`)
      }
    }

    const displayPossession = d?.possession_label
    const displayScore = detail?.recommendation_score?.total || (d as any)?.recommendation_score?.total
    const builderName = typeof d?.builder === 'object' ? (d.builder as any)?.name : d?.builder

    return (
      <div className="relative w-full bg-white dark:bg-[#120f0d] border-b border-gray-100 dark:border-gray-800/40 overflow-hidden flex-shrink-0">
        {!inline && (
          <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-black/40 hover:bg-black/60 border border-white/20 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-md z-20">
            <X size={20} />
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 md:p-8 items-center">
          
          {/* Left Hero Details */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              
              {/* Status Pill & RERA Badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-block bg-[#FEF3C7] dark:bg-[#2c2211] text-[#D97706] dark:text-[#fbbf24] text-[10px] md:text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded">
                  {d?.status === 'ready_to_move' ? 'Ready to Move' : d?.status === 'new_launch' ? 'New Launch' : 'Under Construction'}
                </span>

                {/* RERA Badge with Hover Number & Click to Copy / Verify */}
                {d?.rera_number && (
                  <div className="relative inline-block">
                    <button
                      onClick={() => onReraClick(d.rera_number!, d.rera_url)}
                      onMouseEnter={() => setShowReraPopover(true)}
                      onMouseLeave={() => setShowReraPopover(false)}
                      className="flex items-center gap-1.5 bg-[#E8F5E9] dark:bg-[#1b2f20] hover:bg-[#C8E6C9] dark:hover:bg-[#2a452f] text-[#2E7D32] dark:text-[#a5d6a7] text-[11px] font-bold px-3 py-1 rounded-full border border-[#C8E6C9] dark:border-[#2e7d32]/40 transition-all cursor-pointer shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      <span>{reraCopied ? 'Copied!' : 'RERA Registered'}</span>
                    </button>

                    {/* RERA Hover Popover */}
                    {showReraPopover && (
                      <div className="absolute top-full left-0 mt-2 z-30 w-64 bg-gray-900 text-white p-3 rounded-xl shadow-xl text-[11px] space-y-1">
                        <p className="font-bold text-emerald-400 flex items-center gap-1">
                          ✓ RERA No: {d.rera_number}
                        </p>
                        <p className="text-gray-300 text-[10px]">Click to copy RERA ID and verify official registration details.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Title & Tagline */}
              <div className="space-y-1">
                <h1 className="text-[36px] md:text-[48px] font-black font-sans tracking-tighter leading-none text-gray-900 dark:text-white">
                  {d?.name}
                </h1>
                {d?.tagline && (
                  <p className="text-[16px] md:text-[18px] text-gray-500 dark:text-gray-400 font-medium tracking-tight">
                    {d.tagline}
                  </p>
                )}
              </div>

              {/* Builder & Location Subtitle with Builder Hover Popover */}
              <div className="flex items-center gap-4 text-sm font-semibold text-gray-600 dark:text-gray-400 relative">
                {builderName && (
                  <div
                    className="relative inline-block cursor-pointer"
                    onMouseEnter={() => setShowBuilderPopover(true)}
                    onMouseLeave={() => setShowBuilderPopover(false)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Builder: ${builderName}. Hover for more information`}
                  >
                    <span className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      <Building2 size={15} className="text-gray-400" />
                      by <strong className="text-gray-900 dark:text-white underline decoration-dashed decoration-gray-300 underline-offset-4">{builderName}</strong>
                    </span>

                    {/* Builder Info Hover Popover */}
                    {showBuilderPopover && (
                      <div className="absolute top-full left-0 mt-2 z-30 w-80 bg-white dark:bg-[#181614] text-gray-900 dark:text-gray-100 p-4 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 text-[12px] space-y-2.5">
                        <p className="font-black text-[14px] text-gray-900 dark:text-white">Built by {builderName}</p>
                        <p className="text-[11.5px] text-gray-600 dark:text-gray-300 leading-relaxed">
                          {detail?.builder_detail?.company_overview || 'Company information not available'}
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-700 dark:text-gray-300">
                          {detail?.builder_detail?.founded_year && <div>• {new Date().getFullYear() - detail.builder_detail.founded_year}+ Yrs Experience</div>}
                          {detail?.builder_detail?.delivered_units && <div>• {detail.builder_detail.delivered_units.toLocaleString('en-IN')}+ Units</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700" />
                <span className="flex items-center gap-1">
                  <MapPin size={15} className="text-gray-400" />
                  {d?.sector}, {d?.city}
                </span>
              </div>
            </div>

            {/* Stats Bento Cards (Towers, Floors, Land Area, Open Space) */}
            <div className="grid grid-cols-4 gap-2 md:gap-3 pt-6 border-t border-gray-100 dark:border-gray-800/40">
              {[
                { value: d?.total_towers ? `${d.total_towers}` : null, label: 'Towers' },
                { value: (d as any)?.floors ? `${(d as any).floors}` : null, label: 'Floors' },
                { value: d?.land_area_acres ? `${d.land_area_acres} Ac` : null, label: 'Land Area' },
                { value: (d as any)?.open_space_pct ? `${(d as any).open_space_pct}%` : null, label: 'Open Space' }
              ].filter(stat => stat.value).map((stat, i) => (
                <div key={i} className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[16px] p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:-translate-y-0.5">
                  <p className="text-[20px] md:text-[24px] font-black tracking-tight text-gray-900 dark:text-white leading-none">
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.1em] mt-2">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Hero Image Card */}
          <div
            onClick={() => {
              if (project) trackPropertyEvent(project.id, 'floorplan_viewed', undefined, userId).catch(() => {})
              setShowFloorPlan({ plans: allImages.length > 0 ? allImages : floorPlanImages })
            }}
            className="lg:col-span-5 relative rounded-3xl overflow-hidden h-[260px] lg:h-[280px] shadow-md group cursor-pointer"
          >
            <Image 
              src={currentImg || "/placeholder.png"} 
              alt={d?.name || "Project Image"} 
              fill 
              priority 
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              onError={() => {
                if (currentImg) markImageFailed(currentImg)
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
            {allImages.length > 0 && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm transition-colors z-10">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {allImages.length} Photos
              </div>
            )}
          </div>

        </div>

        {/* Bottom Price, Possession & AI Score Overlay Card */}
        <div className="mx-6 md:mx-8 mb-6 md:mb-8 bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[20px] p-5 md:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] grid grid-cols-1 md:grid-cols-12 gap-4 items-center divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-white/10">
          
          {/* Price Range */}
          <div className="md:col-span-5 pb-4 md:pb-0 md:pr-4 flex flex-col justify-between overflow-hidden min-w-0">
            <p className="text-[20px] sm:text-[24px] md:text-[26px] xl:text-[28px] font-black tracking-tighter text-gray-900 dark:text-white leading-tight break-words">
              {displayPrice}
            </p>
            {/* This line read "ALL INCLUSIVE" unconditionally, regardless of the
                project's own price_includes_plc / _club / _taxes flags — so the
                page asserted a claim the database frequently contradicted. It now
                states what is actually recorded, and says nothing when we hold
                none of the three. */}
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.1em] mt-1.5">
              {unitTypes.length > 0 && `STARTS ₹${Math.min(...unitTypes.map(u => u.super_area_sqft && u.price_min_cr ? Math.round((u.price_min_cr * 10000000) / u.super_area_sqft) : Infinity).filter(v => v !== Infinity))}/SQFT`}
            </p>
            <PriceInclusions project={(detail ?? d ?? {}) as ProjectDetail} className="mt-1" />
          </div>

          {/* Highlighted Possession Badge */}
          <div className="md:col-span-3 py-3.5 md:py-0 md:px-3 flex items-center gap-2.5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-3 rounded-2xl min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 flex items-center justify-center flex-shrink-0">
              <CalendarDays size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[9.5px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider leading-none">Possession</p>
              <p className="text-[12.5px] font-extrabold text-gray-900 dark:text-white mt-1 leading-snug truncate">{displayPossession ?? 'Not announced'}</p>
            </div>
          </div>

          {/* Configurations */}
          <div className="md:col-span-2 py-3.5 md:py-0 md:px-3 flex items-center gap-2.5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-3 rounded-2xl min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 flex items-center justify-center flex-shrink-0">
              <BedDouble size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[9.5px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider leading-none">Configurations</p>
              <p className="text-[12.5px] font-extrabold text-gray-900 dark:text-white mt-1 leading-snug truncate">
                {unitTypes.length > 0 ? [...new Set(unitTypes.map(u => u.bhk))].sort((a,b)=>a-b).join(' • ') + ' BHK' : '3 • 4 BHK'}
              </p>
            </div>
          </div>

          {/* Book Site Visit CTA */}
          <div className="md:col-span-2 py-4 md:py-0 md:pl-3 flex items-center justify-end">
            <button
              onClick={() => onSiteVisitClick()}
              className="w-full py-3 px-3 bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-100 text-white dark:text-gray-900 font-extrabold rounded-2xl text-[12px] transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <CalendarDays size={14} />
              Book Site Visit
            </button>
          </div>

        </div>
      </div>
    )
  }

  const renderMobileHero = () => {
    const unitTypes = d?.unit_types ?? []
    const validPricesMin = unitTypes.map((u: any) => u.price_min_cr).filter(Boolean) as number[]
    const validPricesMax = unitTypes.map((u: any) => u.price_max_cr).filter(Boolean) as number[]
    const minCalculated = validPricesMin.length > 0 ? Math.min(...validPricesMin) : d?.price_min_cr
    const maxCalculated = validPricesMax.length > 0 ? Math.max(...validPricesMax) : (d as any)?.price_max_cr

    let displayPrice = 'Price on Request'
    if (d?.price_range_label && !/price on request|price on demand/i.test(d.price_range_label)) {
      displayPrice = sanitizePriceLabel(d.price_range_label)
    } else if (minCalculated != null) {
      if (maxCalculated != null && maxCalculated > minCalculated) {
        displayPrice = sanitizePriceLabel(`₹${minCalculated}–${maxCalculated} Cr`)
      } else {
        displayPrice = sanitizePriceLabel(`₹${minCalculated} Cr Onwards`)
      }
    }

    const displayPossession = d?.possession_label ?? null
    const displayScore = detail?.recommendation_score?.total ?? (d as any)?.recommendation_score?.total ?? null
    const builderName = typeof d?.builder === 'object' ? (d.builder as any)?.name : (d?.builder ?? null)

    const rates = unitTypes.map((u: any) => u.super_area_sqft && u.price_min_cr ? Math.round((u.price_min_cr * 10000000) / u.super_area_sqft) : null).filter(Boolean) as number[]
    const minRate = rates.length > 0 ? Math.min(...rates) : null
    const perSqftRate = minRate ? minRate.toLocaleString('en-IN') : null

    return (
      <div className="relative w-full overflow-hidden flex-shrink-0" style={{ height: 'min(44vh, 320px)' }}>
        {currentImg ? (
          <Image 
            src={currentImg} 
            alt={d?.name ?? ''} 
            fill 
            priority 
            className="object-cover" 
            sizes="100vw" 
            onError={() => markImageFailed(currentImg)} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <Building2 size={48} className="text-slate-600" />
          </div>
        )}
        {/* Dark vertical gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/25" />

        {/* Top-left: Dedicated Close Button with zero collision */}
        <button
          onClick={onClose}
          aria-label="Close project details"
          className="absolute top-3.5 left-3.5 z-30 w-9 h-9 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <X size={17} />
        </button>

        {/* Top-left Status Pill */}
        <div className="absolute top-3.5 left-14 z-20">
          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md backdrop-blur-xs
            ${isRTM ? 'bg-emerald-500/90 text-white' : isNew ? 'bg-blue-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>
            {isRTM ? 'Ready to Move' : isNew ? 'New Launch' : 'Under Construction'}
          </span>
        </div>

        {/* Top-right: AI Score Badge (Clean, isolated) */}
        {displayScore && (
          <div className="absolute top-3.5 right-3.5 z-20 bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 px-3 text-right flex flex-col items-center justify-center shadow-lg">
            <p className="text-[8.5px] text-gray-300 font-bold tracking-wider flex items-center gap-0.5 justify-end">⚡ AI SCORE</p>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="text-xl font-black text-white leading-none">{displayScore}</span>
              <span className="text-[9.5px] text-gray-400 font-bold">/100</span>
            </div>
            {tier && (
              <span className="text-[8.5px] font-extrabold text-emerald-400 mt-1 uppercase tracking-wider">
                🛡️ {tierLabel[tier] ?? tier}
              </span>
            )}
          </div>
        )}

        {/* Middle: Title, Builder, and Location */}
        <div className="absolute bottom-[86px] left-3.5 right-3.5 z-10 space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-md truncate">
            {d?.name}
          </h2>
          {builderName && (
            <p className="text-[12.5px] font-semibold text-gray-200 drop-shadow-sm flex items-center gap-1 cursor-pointer truncate">
              by <span className="underline decoration-dashed decoration-gray-400 underline-offset-4 font-extrabold text-white truncate">{builderName}</span>
            </p>
          )}
          <p className="text-[11px] text-gray-300 font-medium drop-shadow-sm flex items-center gap-1 truncate">
            <MapPin size={11} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{d?.sector}, {d?.city}</span>
          </p>
        </div>

        {/* Bottom Translucent Price & Possession Overlay Dock */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 bg-black/50 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex items-center justify-between shadow-xl">
          <div className="min-w-0 pr-2">
            <p className="text-base sm:text-lg font-black text-white leading-tight truncate">{displayPrice}</p>
            {perSqftRate && <p className="text-[9.5px] text-gray-300 font-semibold mt-0.5 truncate">Starts ₹{perSqftRate}/sqft</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider leading-none">Possession</p>
            <p className="text-[11.5px] font-extrabold text-white mt-1 leading-none">{displayPossession ?? 'Not announced'}</p>
          </div>
        </div>

        {/* Photos badge */}
        {allImages.length > 0 && (
          <span className="absolute bottom-[94px] right-3.5 text-[9px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full z-10 backdrop-blur-xs flex items-center gap-1">
            📷 {allImages.length}
          </span>
        )}
      </div>
    )
  }


  // ── Inline mode (property page) ─────────────────────────────────────────────
  if (inline) {
    return (
      <m.div
        className="project-detail-wrapper"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="bg-white dark:bg-[#120f0d] rounded-3xl overflow-hidden flex flex-col">
          {isMobile ? renderMobileHero() : renderHero()}

          {/* Tab strip — unified header */}
          {isMobile ? mobileTabBar : stickyHeader}
          <div className="flex-1 overflow-y-auto">{tabBody}</div>
          {isMobile ? mobileCtaFooter : ctaFooter}
        </div>

        <AnimatePresence mode="wait">
          {showVisitScheduler && project && (
            <SiteVisitScheduler projectId={project.id} projectSlug={project.slug} projectName={project.name} onClose={() => setShowVisitScheduler(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {showFloorPlan && (
            <FloorPlanViewer floorPlans={showFloorPlan.plans} title={`${project?.name} — Floor Plans`} onClose={() => setShowFloorPlan(null)} />
          )}
        </AnimatePresence>
      </m.div>
    )
  }

  // ── Shared: image badges used in mobile bottom sheet ──────────────────────
  const imageBadges = (
    <>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors z-20"
      >
        <X size={15} />
      </button>
    </>
  )

  const imageCarouselDots = allImages.length > 1 && (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
      {allImages.map((_, i) => (
        <button key={i} onClick={() => setImgIdx(i)}
          className={`h-1.5 rounded-full transition-all ${i === imgIdx ? 'bg-white w-4' : 'bg-white/40 w-1.5'}`} />
      ))}
    </div>
  )

  // ── Modal ──────────────────────────────────────────────────────────────────
  return (
    <div className="project-detail-wrapper">
      <AnimatePresence mode="wait">
        {isOpen && !isMobile && (
          <>
            {/* Backdrop & Centering Wrapper for Desktop */}
            <m.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/70 hidden md:flex items-center justify-center p-4 md:p-8"
              onClick={onClose}
            >
              {/* ── Desktop dialog ── */}
              <m.div
                key="dialog-desktop"
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="relative flex flex-col w-[95vw] max-w-[1200px] h-[90vh] max-h-[900px]
                           rounded-3xl bg-gray-50 dark:bg-slate-800 overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.4)]"
                role="dialog"
                aria-modal="true"
                aria-label={`${project?.name ?? 'Project'} details`}
                ref={desktopDialogRef}
                onClick={(e) => e.stopPropagation()}
              >
              {/* Scrollable Content */}
              <div
                ref={scrollContainerRef}
                id={PANEL_ID}
                role="tabpanel"
                aria-labelledby={tabId(activeTab)}
                tabIndex={0}
                className="flex-1 overflow-y-auto w-full relative pb-24 hide-scrollbar"
                onScroll={handleScroll}
              >
                {/* Hero Section */}
                {renderHero()}

                {/* Sticky Header / Tabs */}
                {stickyHeader}

                {/* Main Content Area */}
                <div className="p-8 md:p-10 max-w-[1200px] mx-auto">
                  <div className="bg-white dark:bg-[#111] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden min-h-[400px]">
                     {tabBody}
                  </div>
                </div>
              </div>

              {/* Floating Footer CTA (Pill Dock) */}
              <div className="absolute bottom-8 inset-x-0 z-50 hidden md:flex justify-center pointer-events-none">
                <div className="flex gap-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-200/50 dark:border-white/10 pointer-events-auto">
                  <button onClick={() => onSiteVisitClick()} className="px-8 py-3 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white font-semibold rounded-full text-[14px] transition-all flex items-center gap-2 shadow-sm">
                    <CalendarDays size={16} />
                    Book Site Visit
                  </button>
                  {(() => {
                    const waUrl = d ? buildWhatsAppUrl(d as any, 'panel') : null
                    return waUrl ? (
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => trackWhatsAppHandoff(d as any, 'panel')}
                        className="px-6 py-3 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-semibold rounded-full text-[14px] transition-all flex items-center gap-2">
                        <WhatsAppIcon size={16} />
                        Ask on WhatsApp
                      </a>
                    ) : null
                  })()}
                </div>
              </div>
            </m.div>
            {/* End Backdrop & Centering Wrapper for Desktop */}
            </m.div>
          </>
        )}
      </AnimatePresence>

       {/* Mobile bottom sheet gets its own AnimatePresence with full clickable backdrop */}
      <AnimatePresence mode="wait">
        {isOpen && isMobile && (
          <div
            key="backdrop-mobile"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
            onClick={onClose}
          >
            <m.div
              key="dialog-mobile"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative flex flex-col w-full h-[92dvh] max-h-[92dvh]
                         bg-white dark:bg-[#120f0d] rounded-t-[24px] overflow-hidden
                         shadow-[0_-8px_40px_rgba(0,0,0,0.25)]"
              role="dialog"
              aria-modal="true"
              aria-label={`${project?.name ?? 'Project'} details`}
              ref={mobileDialogRef}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Subtle top grab handle */}
              <div className="w-full flex justify-center pt-2 pb-1 bg-transparent absolute top-0 inset-x-0 z-40 pointer-events-none">
                <div className="w-10 h-1 rounded-full bg-white/60 shadow-xs" />
              </div>

              {/* Scrollable container containing Hero, sticky mobile Tab Bar, and Tab Content */}
              <div
                ref={scrollContainerMobileRef}
                id={PANEL_ID}
                role="tabpanel"
                aria-labelledby={`${tabId(activeTab)}-mobile`}
                tabIndex={0}
                className="flex-1 overflow-y-auto overscroll-contain relative pb-20 dark:bg-[#0a0a0a]"
              >
                {/* Full-height luxury Mobile Hero */}
                {renderMobileHero()}

                {/* Mobile Tab Strip (sticky top-0 inside this scroll container) */}
                {mobileTabBar}

                {/* Tab content body */}
                <div className="p-3 sm:p-4">
                  {tabBody}
                </div>
              </div>

              {/* Mobile Sticky CTA Dock */}
              {mobileCtaFooter}
            </m.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showVisitScheduler && project && (
          <SiteVisitScheduler
            projectId={project.id}
            projectSlug={project.slug}
            projectName={project.name}
            onClose={() => setShowVisitScheduler(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showFloorPlan && (
          <FloorPlanViewer
            floorPlans={showFloorPlan.plans}
            title={`${project?.name} — Floor Plans`}
            onClose={() => setShowFloorPlan(null)}
          />
        )}
      </AnimatePresence>
    </div>

  )
}
