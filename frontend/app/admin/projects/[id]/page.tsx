'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronRight, Eye, LayoutPanelLeft, AlertCircle, CheckCircle2, Info,
  Images, Cpu, Activity, IndianRupee, Users, ShieldCheck, Layers, History
} from 'lucide-react'
import { adminFetch } from '@/lib/adminFetch'
import ProjectForm from '@/components/admin/ProjectForm'
import UnitsEditor from '@/components/admin/UnitsEditor'
import AmenitiesEditor from '@/components/admin/AmenitiesEditor'
import SpecEditor from '@/components/admin/SpecEditor'
import ConnectivityEditor from '@/components/admin/ConnectivityEditor'
import ImagesEditor from '@/components/admin/ImagesEditor'
import DocumentsEditor from '@/components/admin/DocumentsEditor'
import PaymentPlanEditor from '@/components/admin/PaymentPlanEditor'
import CostSheetEditor from '@/components/admin/CostSheetEditor'
import InvestmentInsightsEditor from '@/components/admin/InvestmentInsightsEditor'
import LocationIntelligenceEditor from '@/components/admin/LocationIntelligenceEditor'
import IntelligenceWorkspace from '@/components/admin/IntelligenceWorkspace'
import ConstructionMilestonesEditor from '@/components/admin/ConstructionMilestonesEditor'
import ProjectUpdatesEditor from '@/components/admin/ProjectUpdatesEditor'
import PriceHistoryEditor from '@/components/admin/PriceHistoryEditor'
import LifecycleUpdatesEditor from '@/components/admin/LifecycleUpdatesEditor'
import ChannelPartnersEditor from '@/components/admin/ChannelPartnersEditor'
import CompletenessBar from '@/components/admin/CompletenessBar'
import ProjectPreview from '@/components/admin/ProjectPreview'
import AuditChangelogTab from '@/components/admin/AuditChangelogTab'
import { useAdminRole, canEditCatalogue } from '@/lib/adminRole'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminProjectEditorSkeleton } from '@/components/skeletons'
import Toast from '@/components/Toast'

type AdminTab = 'core' | 'specs' | 'pricing' | 'media' | 'intelligence' | 'updates' | 'partners' | 'audit'


interface ProjectData {
  [key: string]: any
}

interface ProjectDocument {
  id: string
  name: string
  url: string
  file_size?: number
  created_at?: string
}

interface CompletenessData {
  score: number
  missing: string[]
}


function getTabAuditDetails(
  tabId: AdminTab,
  data: any,
  documents: any[]
): { completed: string[]; missing: string[] } {
  const completed: string[] = []
  const missing: string[] = []

  if (tabId === 'core') {
    if (data?.name) completed.push('Project Name')
    else missing.push('Project Name')

    if (data?.status) completed.push('Project Status')
    else missing.push('Project Status')

    if (data?.possession_date) completed.push('Possession Date')
    else missing.push('Possession Date')

    if (data?.rera_number) completed.push('RERA Number')
    else missing.push('RERA Number')

    if (data?.description) completed.push('Project Description')
    else missing.push('Project Description')

    if ((data?.unit_types?.length || 0) >= 1) completed.push(`Unit Configurations (${data.unit_types.length} types)`)
    else missing.push('Unit Types / Configurations')

    if ((data?.amenities?.length || 0) >= 3) completed.push(`Amenities (${data.amenities.length} added)`)
    else missing.push(`Amenities (need 3+, currently ${data?.amenities?.length || 0})`)

    if (data?.water_source) completed.push('Water Supply Source')
    else missing.push('Water Supply Source')

    if (data?.dg_power_rate_per_unit != null && data?.maintenance_per_sqft_monthly != null) completed.push('DG Power & Maintenance Rates')
    else missing.push('DG Power & Maintenance Rates')

    if (data?.ceiling_height_ft != null && data?.lifts_per_tower != null) completed.push('Ceiling Height & Elevators')
    else missing.push('Ceiling Height & Elevators')

    if (data?.shared_walls_type) completed.push('Privacy & Core Layout')
    else missing.push('Privacy & Core Layout')
  }

  if (tabId === 'specs') {
    if ((data?.spec_items?.length || 0) >= 1) completed.push(`Specifications (${data.spec_items.length} items configured)`)
    else missing.push('Construction Specifications')

    if (data?.spec_items?.some((s: any) => s.category === 'structure')) completed.push('Structure & Safety Specs')
    else missing.push('Structure & Safety Specs')

    if (data?.spec_items?.some((s: any) => s.category === 'flooring')) completed.push('Flooring & Finishes Specs')
    else missing.push('Flooring Specs')

    if (data?.spec_items?.some((s: any) => s.category === 'kitchen')) completed.push('Kitchen & Countertop Specs')
    else missing.push('Kitchen Specs')

    if (data?.spec_items?.some((s: any) => s.category === 'bathrooms')) completed.push('Sanitary & CP Fittings Specs')
    else missing.push('Sanitary Specs')

    if (data?.spec_items?.some((s: any) => s.is_highlight)) completed.push('Highlighted Buyer Card Specs')
    else missing.push('Highlighted Buyer Card Specs')
  }


  if (tabId === 'pricing') {
    if (data?.unit_types?.some((u: any) => u.price_min_cr != null)) completed.push('Priced Unit Configurations')
    else missing.push('Priced Unit Configurations')

    if (data?.cost_sheet?.base_price_per_sqft) completed.push('Cost Sheet Base Price')
    else missing.push('Cost Sheet Base Price')

    if ((data?.payment_plans?.length || 0) >= 2) completed.push(`Payment Plans (${data.payment_plans.length} active)`)
    else missing.push(`Payment Plans (need 2+, currently ${data?.payment_plans?.length || 0})`)

    if ((data?.connectivity?.length || 0) >= 3) completed.push(`Connectivity Points (${data.connectivity.length} mapped)`)
    else missing.push(`Connectivity Points (need 3+, currently ${data?.connectivity?.length || 0})`)

    if ((data?.price_history?.length || 0) >= 1) completed.push('Quarterly Price History')
    else missing.push('Price History Snapshots')
  }

  if (tabId === 'media') {
    if (data?.hero_image_url) completed.push('Hero Image')
    else missing.push('Hero Image')

    const galleryImages = (data?.images || []).filter((i: any) => i.type !== 'hero')
    if (galleryImages.length >= 3) completed.push(`Gallery Photos (${galleryImages.length} uploaded)`)
    else missing.push(`Gallery Photos (need 3+, currently ${galleryImages.length})`)

    if (documents?.some((d: any) => d.doc_type === 'brochure')) completed.push('Official Project Brochure')
    else missing.push('Official Project Brochure document')
  }

  if (tabId === 'intelligence') {
    if (data?.decision_profile?.decision_thesis) completed.push('Decision Thesis')
    else missing.push('Decision Thesis')

    if (data?.decision_profile?.best_for) completed.push('Target Buyer Profile (Best For)')
    else missing.push('Target Buyer Profile (Best For)')

    if ((data?.decision_profile?.why_buy?.length || 0) >= 1) completed.push(`Why Buy Bullets (${data.decision_profile.why_buy.length} added)`)
    else missing.push('Why Buy Highlights')

    if ((data?.decision_profile?.why_avoid?.length || 0) >= 1) completed.push(`Why Avoid Bullets (${data.decision_profile.why_avoid.length} added)`)
    else missing.push('Why Avoid Risk Points')

    if (data?.persona_profile?.primary_persona) completed.push('Primary Buyer Persona')
    else missing.push('Primary Buyer Persona')

    if (data?.persona_profile?.income_range) completed.push('Persona Income Range')
    else missing.push('Persona Income Range')

    if (data?.recommendation_profile?.tier) completed.push(`Recommendation Tier (${data.recommendation_profile.tier})`)
    else missing.push('Recommendation Tier')

    if (data?.dna) completed.push('Project DNA Scores')
    else missing.push('Project DNA Scores')

    if ((data?.competitors?.length || 0) >= 1) completed.push(`Competitor Analysis (${data.competitors.length} linked)`)
    else missing.push('Competitor Analysis')
  }

  if (tabId === 'updates') {
    if ((data?.construction_milestones?.length || 0) >= 4) completed.push(`Construction Milestones (${data.construction_milestones.length} stages)`)
    else missing.push(`Construction Milestones (need 4+, currently ${data?.construction_milestones?.length || 0})`)

    const isReady = data?.status === 'ready_to_move'
    const hasUpdates = isReady
      ? (data?.lifecycle_updates?.length || 0) >= 1
      : (data?.construction_updates?.length || 0) >= 1

    if (hasUpdates) completed.push(isReady ? 'RWA & Society Handover Feed' : 'Construction Progress Feed')
    else missing.push(isReady ? 'RWA & Society Handover Feed' : 'Construction Progress Feed')
  }

  if (tabId === 'partners') {
    if ((data?.channel_partners?.length || 0) >= 1) completed.push(`Channel Partners (${data.channel_partners.length} linked)`)
    else missing.push('Linked Channel Partners')
  }

  return { completed, missing }
}

function SectionAuditSidebar({
  tabId,
  tabLabel,
  pct,
  data,
  documents,
}: {
  tabId: AdminTab
  tabLabel: string
  pct: number
  data: any
  documents: any[]
}) {
  const audit = getTabAuditDetails(tabId, data, documents)
  const isComplete = pct >= 90
  const isMedium = pct >= 60 && pct < 90

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Live Tab Audit</span>
            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{tabLabel}</h4>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-2.5 py-1 rounded-xl border ${
              isComplete ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800' : isMedium ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-rose-500'}`} />
              {pct}% Score
            </span>
          </div>
        </div>

        {/* Incomplete / Missing Fields */}
        {audit.missing.length > 0 ? (
          <div className="mb-5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">
              <AlertCircle size={14} />
              <span>Incomplete Fields ({audit.missing.length})</span>
            </div>
            <ul className="space-y-2 pl-0.5">
              {audit.missing.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-2.5 rounded-xl text-xs text-rose-900 dark:text-rose-200">
                  <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mb-5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>All required fields in {tabLabel} are 100% filled and verified!</span>
          </div>
        )}

        {/* Verified Sub-Sections */}
        {audit.completed.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
              <CheckCircle2 size={14} />
              <span>Verified Sub-Sections ({audit.completed.length})</span>
            </div>
            <ul className="space-y-1.5 pl-0.5 max-h-60 overflow-y-auto">
              {audit.completed.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Standards & Guidelines Card */}
      <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-zinc-900 dark:to-zinc-900/80 rounded-3xl border border-blue-100 dark:border-zinc-800 p-5 shadow-xs">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider mb-2">
          <Info size={14} />
          <span>Data Standard Guidance</span>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {tabId === 'core' && 'Ensure project name, RERA registration number, status, hero image, unit configurations, and at least 3 amenities are configured.'}
          {tabId === 'specs' && 'Configure material specifications, brand tiers, highlights, and unit-specific overrides across architectural categories.'}
          {tabId === 'pricing' && 'Ensure unit price ranges, cost sheet base price, 2+ payment plans with stage milestones, 3+ connectivity nodes, and quarterly price history are filled.'}
          {tabId === 'media' && 'Upload a hero image, at least 3 high-res gallery exterior/interior photos, and official brochure PDF documents.'}
          {tabId === 'intelligence' && 'Fill decision thesis, target buyer (best for), why buy/avoid points, buyer persona income ranges, recommendation tier, DNA scores, and competitors.'}
          {tabId === 'updates' && 'Configure at least 4 construction milestone stages and active construction or RWA lifecycle update feeds.'}
          {tabId === 'partners' && 'Link verified channel partners with agency name, contact number, and commission percentage.'}
        </p>
      </div>
    </div>
  )
}

export default function AdminProjectEditPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>
}) {
  const resolvedParams = typeof (params as any)?.then === 'function' ? use(params as unknown as Promise<{ id: string }>) : (params as { id: string })
  const id = resolvedParams?.id ?? ''
  const [data, setData] = useState<any>(null)
  const mayEditCatalogue = canEditCatalogue(useAdminRole())
  const [documents, setDocuments] = useState<any[]>([])
  const [completeness, setCompleteness] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [adminTab, setAdminTab] = useState<AdminTab>('core')
  const [preview, setPreview] = useState<any>(null)
  const [coreRightView, setCoreRightView] = useState<'audit' | 'preview'>('audit')
  const [showCompleteness, setShowCompleteness] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string } | null>(null)

  const loadProjectData = useCallback(async (showError = true) => {
    try {
      setError(null)
      const [projectRes, docsRes, completenessRes] = await Promise.all([
        adminFetch(`/admin/projects/${id}`),
        adminFetch(`/admin/projects/${id}/documents`),
        adminFetch(`/admin/projects/${id}/completeness`),
      ])

      if (!projectRes.ok) {
        if (showError) {
          setError('Failed to load project')
          setToast({ message: 'Failed to load project data' })
        }
        setData(null)
        return
      }

      const projectData = await projectRes.json()
      const docsData = docsRes.ok ? await docsRes.json() : []
      const compData = completenessRes.ok ? await completenessRes.json() : null

      setData(projectData)
      setDocuments(Array.isArray(docsData) ? docsData : docsData.documents ?? [])
      setCompleteness(compData)

      // Fetch public preview object via API_BASE
      if (projectData.slug) {
        try {
          const pRes = await adminFetch(`/projects/${projectData.slug}`)
          if (pRes.ok) {
            const pData = await pRes.json()
            setPreview(pData)
          }
        } catch {
          // Preview fetch optional
        }
      }
    } catch (err) {
      console.error('[AdminProjectEditPage] Failed to load data:', err)
      if (showError) {
        setError('Failed to load project data')
        setToast({ message: 'Error loading project. Please try again.' })
      }
      setData(null)
    }
  }, [id])

  useEffect(() => {
    (async () => {
      await loadProjectData(true)
      setLoading(false)
    })()
  }, [id, loadProjectData])

  useEffect(() => {
    if (data?.name) {
      document.title = `Admin · Projects · ${data.name} | PropFyndr`
    }
  }, [data?.name])

  // Keyboard shortcuts for tab switching (Alt+1..6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isEditable) return
      if (e.altKey && !e.shiftKey && !e.metaKey) {
        if (e.key === '1') { e.preventDefault(); setAdminTab('core') }
        if (e.key === '2') { e.preventDefault(); setAdminTab('pricing') }
        if (e.key === '3') { e.preventDefault(); setAdminTab('media') }
        if (e.key === '4') { e.preventDefault(); setAdminTab('intelligence') }
        if (e.key === '5') { e.preventDefault(); setAdminTab('updates') }
        if (e.key === '6') { e.preventDefault(); setAdminTab('partners') }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleFormChange = useCallback((formValues: Record<string, any>) => {
    setPreview((prev: any) => {
      if (!prev) return null
      return {
        ...prev,
        ...formValues,
        builder: prev.builder,
        unit_types: prev.unit_types,
      }
    })
  }, [])

  const handleSaved = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadProjectData(false)
      setToast({ message: 'Project updated successfully' })
    } catch {
      setToast({ message: 'Failed to refresh project data' })
    } finally {
      setRefreshing(false)
    }
  }, [loadProjectData])

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto pb-16 space-y-8 mt-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-1/4 rounded-lg" />
          <Skeleton className="h-6 w-1/3 rounded-lg" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-lg shrink-0" />
          ))}
        </div>
        <AdminProjectEditorSkeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-[1400px] mx-auto p-8">
        <Link href="/admin/projects" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
          <ArrowLeft size={18} />
          Back to projects
        </Link>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-6 flex gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-1" size={20} />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">Error loading project</h3>
            <p className="text-red-800 dark:text-red-200 text-sm">{error || 'Project not found'}</p>
            <button
              onClick={() => loadProjectData(true)}
              className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  /**
   * This page is the project EDITOR — eight tabs of write forms plus the
   * changelog. Sales reads the catalogue from the projects list and the public
   * property page; every save here, and the changelog itself, is refused for
   * that role by the server matrix. Offering the editor anyway would mean a
   * screen whose every control produces a permission error, so it is not
   * offered.
   */
  if (!mayEditCatalogue) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link href="/admin/projects" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ArrowLeft size={16} />
          Back to projects
        </Link>
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">{data.name}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2">
            Editing project records is done by an analyst or super admin. You can see
            everything buyers see on the public page, and the full list under Projects.
          </p>
          <Link
            href={`/property/${data.slug}`}
            className="inline-flex items-center gap-2 mt-4 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold"
          >
            Open the buyer-facing page
          </Link>
        </div>
      </div>
    )
  }

  const formData = {
    ...data,
    lat:              data.lat?.toString() ?? '',
    lng:              data.lng?.toString() ?? '',
    total_units:      data.total_units?.toString() ?? '',
    total_towers:     data.total_towers?.toString() ?? '',
    land_area_acres:  data.land_area_acres?.toString() ?? '',
    launch_date:      data.launch_date ? new Date(data.launch_date).toISOString().split('T')[0] : '',
    possession_date:  data.possession_date ? new Date(data.possession_date).toISOString().split('T')[0] : '',
    marketing_claims:   data.marketing_claims ?? [],
    ai_search_keywords: data.ai_search_keywords ?? [],
  }

  const TAB_ITEMS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'core',         label: 'Core Info',            icon: LayoutPanelLeft },
    { id: 'specs',        label: 'Specifications',       icon: Layers },
    { id: 'pricing',      label: 'Pricing & Location',   icon: IndianRupee },
    { id: 'media',        label: 'Media',                icon: Images },
    { id: 'intelligence', label: 'Intelligence',         icon: Cpu },
    { id: 'updates',      label: 'Updates & Timeline',   icon: Activity },
    { id: 'partners',     label: 'Channel Partners',     icon: Users },
    { id: 'audit',        label: 'Changelog',            icon: History },
  ]

  // Pre-compute all tab audits once to avoid O(N) recalculation
  const tabAudits = {
    core: getTabAuditDetails('core', data, documents),
    specs: getTabAuditDetails('specs', data, documents),
    pricing: getTabAuditDetails('pricing', data, documents),
    media: getTabAuditDetails('media', data, documents),
    intelligence: getTabAuditDetails('intelligence', data, documents),
    updates: getTabAuditDetails('updates', data, documents),
    partners: getTabAuditDetails('partners', data, documents),
    audit: { completed: ['Change Tracking Active'], missing: [] },
  } as Record<AdminTab, ReturnType<typeof getTabAuditDetails>>

  const computeTabScore = (audit: ReturnType<typeof getTabAuditDetails>): number => {
    const total = audit.completed.length + audit.missing.length
    if (total === 0) return 100
    return Math.round((audit.completed.length / total) * 100)
  }

  const tabScores: Record<AdminTab, number> = {
    core: computeTabScore(tabAudits.core),
    specs: computeTabScore(tabAudits.specs),
    pricing: computeTabScore(tabAudits.pricing),
    media: computeTabScore(tabAudits.media),
    intelligence: computeTabScore(tabAudits.intelligence),
    updates: computeTabScore(tabAudits.updates),
    partners: computeTabScore(tabAudits.partners),
    audit: 100,
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


  return (
    <div className="w-full overflow-x-hidden">
      {/* ── Sticky Project Sub-Header ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 shadow-xs px-4 md:px-8 py-3 transition-all overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto space-y-3">

          {/* Identity row */}
          <div className="flex items-center justify-between gap-4">

            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin/projects"
                className="w-8 h-8 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700/80 transition-all flex-shrink-0 shadow-2xs flex items-center justify-center group"
                title="Back to Projects"
              >
                <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
              </Link>

              <div className="flex items-center gap-2.5 min-w-0">
                <h1 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight truncate leading-none">
                  {data.name}
                </h1>
                <span className={`px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider rounded-md border shadow-2xs flex-shrink-0 flex items-center gap-1.5 ${
                  data.status === 'ready_to_move'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
                    : data.status === 'under_construction'
                    ? 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
                    : 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    data.status === 'ready_to_move' ? 'bg-emerald-500' : data.status === 'under_construction' ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'
                  }`} />
                  {data.status?.replace('_', ' ')}
                </span>
                <span className={`px-2 py-0.5 text-[9.5px] font-mono font-bold rounded-md border shadow-2xs flex-shrink-0 ${
                  overallHealth >= 90
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
                    : overallHealth >= 70
                    ? 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60'
                    : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60'
                }`}>
                  {overallHealth}% Health
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {adminTab === 'core' && (
                <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl px-3 py-1 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Live Preview Sync</span>
                </div>
              )}
              <a
                href={`/projects/${data.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-xs font-semibold text-white dark:text-zinc-900 transition-all shadow-xs active:scale-[0.98]"
              >
                <Eye size={13} />
                <span>View Public</span>
              </a>
            </div>

          </div>

          {/* Tab rail with polished completion indicators (Smooth swipe on mobile, flex-wrap on desktop) */}
          <div className="p-1.5 bg-zinc-100/90 dark:bg-zinc-800/80 backdrop-blur-xl rounded-2xl border border-zinc-200/80 dark:border-zinc-700/70 shadow-xs">
            <div className="flex items-center md:flex-wrap gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full py-0.5 px-0.5">
              {TAB_ITEMS.map(({ id: tabId, label, icon: Icon }) => {
                const isActive = adminTab === tabId
                const pct = tabScores[tabId] ?? 100
                const isComplete = pct >= 90
                const isMedium = pct >= 60 && pct < 90

                return (
                  <div key={tabId} className="relative shrink-0">
                    <button
                      onClick={() => setAdminTab(tabId)}
                      className={`relative flex items-center gap-2 px-3.5 py-2 text-xs rounded-xl transition-all duration-200 cursor-pointer select-none ${
                        isActive
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs ring-1 ring-zinc-950/5 dark:ring-white/10 font-bold'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-zinc-800/70 font-medium'
                      }`}
                    >
                      <Icon
                        size={14}
                        className={`transition-colors ${
                          isActive
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      />
                      <span>{label}</span>

                      <span
                        className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                          isComplete
                            ? (isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300/80 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/80'
                                : 'bg-emerald-500/10 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40')
                            : isMedium
                            ? (isActive
                                ? 'bg-amber-50 text-amber-700 border-amber-300/80 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700/80'
                                : 'bg-amber-500/10 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40')
                            : (isActive
                                ? 'bg-rose-50 text-rose-700 border-rose-300/80 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-700/80'
                                : 'bg-rose-500/10 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40')
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isComplete ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                        />
                        <span>{pct}%</span>
                      </span>

                      {isActive && (
                        <div className="absolute bottom-0 left-2.5 right-2.5 h-[2px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 dark:bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── Scrollable Content ──────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-6 pb-16">

        {/* Completeness banner — shown on core + media tabs */}
        {adminTab !== 'intelligence' && completeness && showCompleteness && (
          <CompletenessBar result={completeness} onClose={() => setShowCompleteness(false)} />
        )}

        {/* 1. Core Info tab */}
        {adminTab === 'core' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="space-y-6 max-w-2xl w-full">
              <div className="bg-white dark:bg-[#121214] rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 sm:p-6 md:p-8 w-full">
                <ProjectForm
                  initialData={formData}
                  projectId={id}
                  onFormChange={handleFormChange}
                  onSaved={handleSaved}
                />
              </div>
              <UnitsEditor
                unitTypes={data.unit_types ?? []}
                projectId={id}
                onSaved={handleSaved}
              />
              <AmenitiesEditor
                amenities={data.amenities ?? []}
                projectId={id}
                onSaved={handleSaved}
              />
            </div>
            <div className="sticky top-24 space-y-4 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {/* Core Info Right View Switcher */}
              <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs">
                <button
                  type="button"
                  onClick={() => setCoreRightView('audit')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    coreRightView === 'audit'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <ShieldCheck size={13} className={coreRightView === 'audit' ? 'text-emerald-500' : ''} />
                  <span>Tab Audit ({tabScores.core}%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCoreRightView('preview')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    coreRightView === 'preview'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <Eye size={13} className={coreRightView === 'preview' ? 'text-blue-500' : ''} />
                  <span>Buyer Card</span>
                </button>
              </div>

              {coreRightView === 'audit' ? (
                <SectionAuditSidebar
                  tabId="core"
                  tabLabel="Core Info"
                  pct={tabScores.core}
                  data={data}
                  documents={documents}
                />
              ) : (
                preview && (
                  <ProjectPreview
                    project={preview}
                    onRefresh={handleSaved}
                    refreshing={refreshing}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* 2. Specifications tab */}
        {adminTab === 'specs' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="space-y-6">
              <SpecEditor
                projectId={id}
                unitTypes={data.unit_types ?? []}
                initialSpecs={data.spec_items ?? []}
                onSaved={handleSaved}
              />
            </div>
            <div className="sticky top-24 space-y-4 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <SectionAuditSidebar
                tabId="specs"
                tabLabel="Specifications"
                pct={tabScores.specs}
                data={data}
                documents={documents}
              />
            </div>
          </div>
        )}


        {/* 2. Pricing & Location tab */}
        {adminTab === 'pricing' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="space-y-6">
              <PaymentPlanEditor projectId={id} initialData={data.payment_plan} />
              <CostSheetEditor projectId={id} initialData={data.cost_sheet} />
              <PriceHistoryEditor projectId={id} />
              <InvestmentInsightsEditor projectId={id} initialData={data.decision_profile} />
              <ConnectivityEditor
                connectivity={data.connectivity ?? []}
                projectId={id}
                onSaved={handleSaved}
              />
              <LocationIntelligenceEditor projectId={id} initialData={data} />
            </div>
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <SectionAuditSidebar
                tabId="pricing"
                tabLabel="Pricing & Location"
                pct={tabScores.pricing}
                data={data}
                documents={documents}
              />
            </div>
          </div>
        )}

        {/* 3. Media tab */}
        {adminTab === 'media' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="space-y-6">
              <ImagesEditor
                images={data.images ?? []}
                projectId={id}
                slug={data.slug ?? id}
                onSaved={handleSaved}
              />
              <DocumentsEditor
                documents={documents}
                projectId={id}
                slug={data.slug ?? id}
                onSaved={handleSaved}
              />
            </div>
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <SectionAuditSidebar
                tabId="media"
                tabLabel="Media Assets"
                pct={tabScores.media}
                data={data}
                documents={documents}
              />
            </div>
          </div>
        )}

        {/* 4. Intelligence tab */}
        {adminTab === 'intelligence' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
            <div>
              <IntelligenceWorkspace
                projectId={id}
                initialDna={data.dna ?? data.project_dna}
                initialDecision={data.decision_profile}
                initialPersona={data.persona_profile}
                initialRecommendation={data.recommendation_profile}
                initialCompetitors={data.competitors ?? []}
                initialSpecs={data.spec_items ?? []}
                onSaved={handleSaved}
              />
            </div>
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <SectionAuditSidebar
                tabId="intelligence"
                tabLabel="Project Intelligence"
                pct={tabScores.intelligence}
                data={data}
                documents={documents}
              />
            </div>
          </div>
        )}

        {/* 5. Updates & Timeline tab */}
        {adminTab === 'updates' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="space-y-6">
              <ConstructionMilestonesEditor projectId={id} />
              <ProjectUpdatesEditor
                projectId={id}
                projectStatus={data.status}
              />
              {data.status === 'ready_to_move' && (
                <LifecycleUpdatesEditor projectId={id} />
              )}
            </div>
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <SectionAuditSidebar
                tabId="updates"
                tabLabel="Updates & Timeline"
                pct={tabScores.updates}
                data={data}
                documents={documents}
              />
            </div>
          </div>
        )}

        {/* 6. Channel Partners tab */}
        {adminTab === 'partners' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="space-y-6">
              <ChannelPartnersEditor
                projectId={id}
                initialPartners={data.channel_partners ?? []}
                onSaved={handleSaved}
              />
            </div>
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <SectionAuditSidebar
                tabId="partners"
                tabLabel="Channel Partners"
                pct={tabScores.partners}
                data={data}
                documents={documents}
              />
            </div>
          </div>
        )}

        {/* 7. Audit Changelog tab */}
        {adminTab === 'audit' && (
          <div className="max-w-6xl mx-auto">
            <AuditChangelogTab projectId={id} projectName={data.name} />
          </div>
        )}


      </div>

      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}
    </div>
  )
}
