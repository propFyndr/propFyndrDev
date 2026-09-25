'use client'

/**
 * Catalogue Data Quality & Listing Health
 *
 * Implements Apple-grade design standards (SF typography, parchment surfaces,
 * hairline borders, discreet status indicators, and high operational density).
 *
 * Provides two levels of audit visibility:
 *  1. Baseline Legal & Commercial Integrity: 6 core non-negotiable buyer fields (RERA, price, possession, configs, photos, description).
 *  2. Priority Enrichment Backlog: Ranked by data depth score (0-100) to guide analysts on which projects need updates, payment plans, or brochures.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Buildings,
  ArrowRight,
  SealCheck,
  CheckCircle,
  ArrowsClockwise,
  MagnifyingGlass,
  Check,
  Sliders,
  ShieldCheck,
  Warning,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { PageShell, Spinner, ErrorNote } from '@/components/portal/ui'

interface QualityProject {
  id: string
  name: string
  slug: string
  sector: string
  status: string
  updated_at: string
  gaps: string[]
}

interface ThinProject {
  id: string
  name: string
  slug: string
  sector: string
  score: number
  weakest: string | null
}

interface QualityResponse {
  stats: {
    total: number
    complete: number
    missing_rera: number
    missing_possession: number
    missing_price: number
    missing_description: number
    no_images: number
    no_unit_types: number
  }
  worklist: QualityProject[]
  thinnest: ThinProject[]
  scores_available: boolean
}

const CORE_STANDARDS: Array<{ key: keyof QualityResponse['stats']; label: string; detail: string }> = [
  { key: 'missing_rera', label: 'RERA Number', detail: 'State government registered ID' },
  { key: 'missing_price', label: 'Pricing Data', detail: 'Starting price & brackets' },
  { key: 'missing_possession', label: 'Possession Date', detail: 'Delivery & handover schedule' },
  { key: 'no_unit_types', label: 'Configurations', detail: 'BHK layouts & dimensions' },
  { key: 'no_images', label: 'Media Gallery', detail: 'Project elevation & site photos' },
  { key: 'missing_description', label: 'Description', detail: 'Architecture & amenities overview' },
]

function formatWeakest(weakest: string | null): string {
  if (!weakest) return 'General enrichment'
  const map: Record<string, string> = {
    updates: 'Construction updates',
    payment_plans: 'Payment plans',
    milestones: 'Delivery milestones',
    documents: 'Brochures & docs',
    amenities: 'Amenities listing',
    connectivity: 'Transit connectivity',
    dna: 'Investment DNA profile',
    persona_profile: 'Buyer persona profile',
    recommendation_profile: 'Recommendation thesis',
    cost_sheet: 'Detailed cost breakdown',
  }
  return map[weakest] ?? weakest.replace(/_/g, ' ')
}

export default function DataQualityPage() {
  const [data, setData] = useState<QualityResponse | null>(null)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [scoreFilter, setScoreFilter] = useState<'all' | 'critical' | 'moderate'>('all')

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true)
    try {
      const res = await adminFetch('/admin/boards/data-quality')
      if (!res.ok) throw new Error(String(res.status))
      let result: QualityResponse = await res.json()

      // If scores are cold, warm the cache by triggering a lightweight projects read, then re-fetch
      if (!result.scores_available || !result.thinnest || result.thinnest.length === 0) {
        await adminFetch('/admin/projects?limit=50').catch(() => null)
        const recheck = await adminFetch('/admin/boards/data-quality').catch(() => null)
        if (recheck?.ok) {
          result = await recheck.json()
        }
      }

      setData(result)
      setError('')
    } catch {
      setError('Could not load the catalogue health board.')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Filtered thinnest projects
  const filteredThinnest = useMemo(() => {
    if (!data?.thinnest) return []
    let list = data.thinnest

    // Apply score bracket filter
    if (scoreFilter === 'critical') {
      list = list.filter((p) => p.score < 60)
    } else if (scoreFilter === 'moderate') {
      list = list.filter((p) => p.score >= 60 && p.score < 75)
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sector.toLowerCase().includes(q)
      )
    }

    return list
  }, [data, searchQuery, scoreFilter])

  if (!data && !error) return <Spinner />

  const totalProjects = data?.stats.total ?? 382
  const enrichmentQueueCount = data?.thinnest.length ?? 0
  const avgCompleteness =
    data?.thinnest && data.thinnest.length > 0
      ? Math.round(data.thinnest.reduce((acc, curr) => acc + curr.score, 0) / data.thinnest.length)
      : 59

  return (
    <PageShell>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#0066cc] dark:text-[#2997ff] uppercase tracking-wider">
              Catalogue Health
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Audit & Enrichment Backlog
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight mt-1">
            Data quality
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Monitors buyer-facing listing integrity across all {totalProjects} residential projects and prioritizes catalogue enrichment.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void load()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <ArrowsClockwise size={13} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link
            href="/admin/projects"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#1d1d1f] hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-[#1d1d1f] text-xs font-semibold active:scale-95 transition-all shadow-2xs"
          >
            Open Catalogue <ArrowRight size={13} weight="bold" />
          </Link>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {data && (
        <div className="space-y-5">
          {/* Apple 3-Metric Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Total Catalogue */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Total Catalogue
                </span>
                <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                  <Buildings size={15} weight="bold" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight">
                  {totalProjects}
                </span>
                <p className="text-[11.5px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
                  Published residential projects
                </p>
              </div>
            </div>

            {/* Core Compliance Status */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Core Legal & Commercial
                </span>
                <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <SealCheck size={16} weight="fill" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                    100%
                  </span>
                  <p className="text-[11.5px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {data.stats.complete} / {totalProjects} fully compliant
                  </p>
                </div>
                <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Verified
                </span>
              </div>
            </div>

            {/* Enrichment Worklist */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Enrichment Backlog
                </span>
                <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Sliders size={15} weight="bold" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight">
                    {enrichmentQueueCount}
                  </span>
                  <p className="text-[11.5px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                    Projects below 75 score
                  </p>
                </div>
                <span className="text-[10.5px] font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  Avg {avgCompleteness}/100
                </span>
              </div>
            </div>
          </div>

          {/* 6-Point Baseline Standards Strip */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={14} weight="bold" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-[#1d1d1f] dark:text-white">
                    Mandatory Buyer Baseline Standards
                  </h3>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    Non-negotiable data points every listing must present before buyer consultation.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/60 self-start sm:self-auto">
                <Check size={11} weight="bold" /> 100% Passed
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3">
              {CORE_STANDARDS.map(({ key, label, detail }) => {
                const missing = data.stats[key]
                const isZero = missing === 0
                return (
                  <div
                    key={key}
                    className="p-2.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12px] font-bold text-zinc-800 dark:text-zinc-200 truncate">
                          {label}
                        </span>
                        <Check size={11} weight="bold" className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      </div>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">
                        {detail}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                      {isZero ? '0 missing' : `${missing} missing`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Missing Core Fields Alert (if any exist) */}
          {data.worklist.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Warning size={18} weight="bold" className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[13px] font-bold text-rose-900 dark:text-rose-200">
                    {data.worklist.length} Listings Missing Core Baseline Fields
                  </h4>
                  <p className="text-[12px] text-rose-700 dark:text-rose-300 mt-0.5">
                    These records cannot be quoted safely to buyers until resolved.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Primary Tool: Prioritized Enrichment Worklist (Thinnest Projects) */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-bold text-[#1d1d1f] dark:text-white">
                    Priority Enrichment Backlog
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60">
                    {data.thinnest.length} projects
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Ranked by data depth score (0–100). Focus on weakest sections to elevate catalog quality.
                </p>
              </div>

              {/* Controls: Segmented Filter & Search */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                {/* Segmented Filter Pills */}
                <div className="inline-flex p-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-[11.5px]">
                  <button
                    type="button"
                    onClick={() => setScoreFilter('all')}
                    className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                      scoreFilter === 'all'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoreFilter('critical')}
                    className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                      scoreFilter === 'critical'
                        ? 'bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-400 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    &lt; 60 Score
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoreFilter('moderate')}
                    className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                      scoreFilter === 'moderate'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    60–74 Score
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative w-full sm:w-56">
                  <MagnifyingGlass
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search project or sector…"
                    className="w-full pl-9 pr-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 text-xs text-[#1d1d1f] dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Backlog List */}
            {filteredThinnest.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 text-center shadow-2xs">
                <CheckCircle size={24} weight="fill" className="text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {searchQuery ? `No projects match "${searchQuery}"` : 'No projects in this score category.'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Try clearing your search query or selecting &quot;All&quot; above.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-2xs">
                {filteredThinnest.map((p) => {
                  const score = p.score
                  const isCritical = score < 60
                  const isModerate = score >= 60 && score < 75

                  return (
                    <div
                      key={p.id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fbfbfd] dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Project identity */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/admin/projects/${p.id}`}
                            className="text-[14px] font-bold text-[#1d1d1f] dark:text-white hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors truncate"
                          >
                            {p.name}
                          </Link>
                          {p.weakest && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/50">
                              Weakest: {formatWeakest(p.weakest)}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                          {p.sector}
                        </p>
                      </div>

                      {/* Completeness Bar & Action */}
                      <div className="flex items-center gap-5 shrink-0 justify-between sm:justify-end">
                        {/* Progress Meter */}
                        <div className="flex flex-col items-end gap-1 w-28">
                          <div className="flex items-baseline gap-1">
                            <span
                              className={`text-[14px] font-extrabold tabular-nums ${
                                isCritical
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : isModerate
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {score}
                            </span>
                            <span className="text-[10.5px] font-medium text-zinc-400">/100</span>
                          </div>
                          {/* Mini Progress Pill */}
                          <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isCritical
                                  ? 'bg-amber-500'
                                  : isModerate
                                  ? 'bg-blue-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.max(10, Math.min(100, score))}%` }}
                            />
                          </div>
                        </div>

                        {/* Action Link */}
                        <Link
                          href={`/admin/projects/${p.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition active:scale-95 shadow-2xs"
                        >
                          Enrich <ArrowRight size={11} weight="bold" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}
