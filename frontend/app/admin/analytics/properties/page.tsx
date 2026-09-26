'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import {
  Eye,
  BookmarkSimple,
  Scales,
  WhatsappLogo,
  ShareNetwork,
  Buildings,
  ArrowUpRight,
  MagnifyingGlass,
  Info,
  Funnel,
  TrendUp
} from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import AnalyticsNav from '@/components/admin/AnalyticsNav'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import { MetricCard, MetricCardSkeleton } from '@/components/admin/ui/MetricCard'
import { Skeleton } from '@/components/ui/skeleton'
import { adminFetch } from '@/lib/adminFetch'

interface PropertyEngagement {
  projectId: string
  projectName: string
  views: number
  saves: number
  comparisons: number
  shares: number
  whatsappInquiries: number
  total?: number
  slug?: string
  sector?: string
}

export default function PropertiesAnalytics() {
  const [properties, setProperties] = useState<PropertyEngagement[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())
  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active')
  const [searchQuery, setSearchQuery] = useState('')

  const isFetchingRef = useRef(false)

  const loadData = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (isManual) setIsRefreshing(true)

    try {
      const res = await adminFetch('/admin/analytics/properties')
      const data = await res.json()
      setProperties(data.properties || [])
      setLastRefreshedAt(new Date())
    } catch (err) {
      console.error('Properties analytics load failed:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => { 
    loadData() 
  }, [loadData])

  const totals = useMemo(() => {
    return properties.reduce(
      (acc, curr) => ({
        views: acc.views + curr.views,
        saves: acc.saves + curr.saves,
        comparisons: acc.comparisons + curr.comparisons,
        shares: acc.shares + curr.shares,
        whatsapp: acc.whatsapp + curr.whatsappInquiries,
      }),
      { views: 0, saves: 0, comparisons: 0, shares: 0, whatsapp: 0 }
    )
  }, [properties])

  const grandTotal = totals.views + totals.saves + totals.comparisons + totals.shares + totals.whatsapp

  const filteredProperties = useMemo(() => {
    let list = properties
    if (filterMode === 'active') {
      list = list.filter(p => {
        const total = (p.total ?? 0) || (p.views + p.saves + p.comparisons + p.shares + p.whatsappInquiries)
        return total > 0
      })
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(p => 
        p.projectName.toLowerCase().includes(q) ||
        (p.sector && p.sector.toLowerCase().includes(q))
      )
    }
    return list
  }, [properties, filterMode, searchQuery])

  // Find max interactions for proportional relative micro-bars
  const maxInteractions = useMemo(() => {
    let maxVal = 1
    for (const p of properties) {
      const tot = p.total ?? (p.views + p.saves + p.comparisons + p.shares + p.whatsappInquiries)
      if (tot > maxVal) maxVal = tot
    }
    return maxVal
  }, [properties])

  return (
    <div className="space-y-6 pb-16 font-sans select-none max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-4">
          <Link 
            href="/admin/analytics" 
            className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-2xs"
            title="Back to Analytics Overview"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Property Engagement
            </h1>
            <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live buyer interaction telemetry: page views, saves, comparisons, and WhatsApp inquiries
            </p>
          </div>
        </div>

        {/* Refresh Action */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
            Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>

          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh property analytics"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-[#0066cc]' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <AnalyticsNav />

      {/* Subtle Apple-style Context Callout */}
      <div className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-800/60">
            <Info size={18} weight="bold" />
          </div>
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-xs">
              Live Catalog Telemetry
            </h4>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-[11px] leading-relaxed">
              Tracking buyer micro-conversions across listed projects. Sort and inspect interest signals to identify high-performing inventory.
            </p>
          </div>
        </div>

        {grandTotal > 0 && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <TrendUp size={14} weight="bold" className="text-[#0066cc]" />
            <span>Grand Total: <strong className="font-mono text-zinc-900 dark:text-white">{grandTotal.toLocaleString()}</strong> events</span>
          </div>
        )}
      </div>

      {/* Metric Cards Summary */}
      {loading ? (
        <MetricCardSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            title="Total Views"
            value={totals.views}
            subBadge="Project page visits"
            subBadgeVariant="blue"
            icon={Eye}
            iconColorClass="text-[#0066cc] dark:text-blue-400"
            iconBgClass="bg-blue-50 dark:bg-blue-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Total Property Views"
                description="Number of times buyers clicked into detailed project cards across search, chat, and feeds."
              />
            }
          />
          <MetricCard
            title="Saved Properties"
            value={totals.saves}
            subBadge="Buyer bookmarks"
            subBadgeVariant="amber"
            icon={BookmarkSimple}
            iconColorClass="text-amber-600 dark:text-amber-400"
            iconBgClass="bg-amber-50 dark:bg-amber-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Saved Properties"
                description="Number of times buyers bookmarked projects to their private saved properties collection."
              />
            }
          />
          <MetricCard
            title="Comparisons"
            value={totals.comparisons}
            subBadge="Side-by-side analysis"
            subBadgeVariant="violet"
            icon={Scales}
            iconColorClass="text-violet-600 dark:text-violet-400"
            iconBgClass="bg-violet-50 dark:bg-violet-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Property Comparisons"
                description="Number of times properties were added to the side-by-side comparison matrix for specification review."
              />
            }
          />
          <MetricCard
            title="WhatsApp Leads"
            value={totals.whatsapp}
            subBadge="High-intent callbacks"
            subBadgeVariant="emerald"
            icon={WhatsappLogo}
            iconColorClass="text-emerald-600 dark:text-emerald-400"
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/60"
            tooltip={
              <AdminInfoTooltip
                title="WhatsApp Inquiries"
                description="Direct lead callback or site visit inquiries initiated via WhatsApp with full project metadata."
              />
            }
          />
        </div>
      )}

      {/* Engagement Table Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-2xs">
        {/* Table Toolbar */}
        <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight uppercase inline-flex items-center gap-1.5">
              Top Performing Properties
              <AdminInfoTooltip
                title="Top Performing Properties"
                description="Listings ranked by total buyer engagement (views, saves, comparisons, shares, leads). Filter between actively engaged projects and the full catalog."
              />
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              Ranked by aggregate buyer engagement telemetry from the live database
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Quick Search */}
            <div className="relative min-w-[200px]">
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Filter by name or sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#0066cc] focus:border-[#0066cc] transition-all"
              />
            </div>

            {/* Apple HIG Segmented Control */}
            <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
              <button
                onClick={() => setFilterMode('active')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterMode === 'active'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <span>Active Engaged</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  filterMode === 'active' 
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono' 
                    : 'bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500'
                }`}>
                  {properties.filter(p => ((p.total ?? 0) || (p.views + p.saves + p.comparisons + p.shares + p.whatsappInquiries)) > 0).length}
                </span>
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <span>All Projects</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  filterMode === 'all' 
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono' 
                    : 'bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500'
                }`}>
                  {properties.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredProperties.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/75 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5 w-12 text-center">Rank</th>
                  <th className="px-6 py-3.5">Project Details</th>
                  <th className="px-5 py-3.5 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <Eye size={13} className="text-zinc-400" />
                      Views
                    </span>
                  </th>
                  <th className="px-5 py-3.5 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <BookmarkSimple size={13} className="text-amber-500" />
                      Saves
                    </span>
                  </th>
                  <th className="px-5 py-3.5 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <Scales size={13} className="text-violet-500" />
                      Compares
                    </span>
                  </th>
                  <th className="px-5 py-3.5 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <ShareNetwork size={13} className="text-blue-500" />
                      Shares
                    </span>
                  </th>
                  <th className="px-5 py-3.5 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <WhatsappLogo size={13} className="text-emerald-500" />
                      WhatsApp
                    </span>
                  </th>
                  <th className="px-6 py-3.5 text-right min-w-[180px]">Total Interactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                {filteredProperties.map((p, index) => {
                  const total = p.total ?? (p.views + p.saves + p.comparisons + p.shares + p.whatsappInquiries)
                  const hasActivity = total > 0
                  const proportion = maxInteractions > 0 ? (total / maxInteractions) * 100 : 0

                  return (
                    <tr 
                      key={p.projectId} 
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group"
                    >
                      {/* Rank */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-extrabold ${
                          index === 0
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                            : index === 1
                            ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700'
                            : index === 2
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border border-orange-300 dark:border-orange-700'
                            : 'text-zinc-400 font-mono text-[11px]'
                        }`}>
                          {index + 1}
                        </span>
                      </td>

                      {/* Project Details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0 group-hover:border-[#0066cc]/40 transition-colors">
                            <Buildings size={16} weight="duotone" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-zinc-900 dark:text-white text-xs">
                                {p.projectName}
                              </span>
                              {p.slug && (
                                <Link
                                  href={`/property/${p.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-400 hover:text-[#0066cc] dark:hover:text-blue-400 transition-colors"
                                  title="View Public Page"
                                >
                                  <ArrowUpRight size={13} weight="bold" />
                                </Link>
                              )}
                            </div>
                            {p.sector && (
                              <span className="inline-block mt-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50">
                                {p.sector}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Views */}
                      <td className="px-5 py-4 text-right font-mono text-zinc-700 dark:text-zinc-300 text-xs">
                        {p.views > 0 ? p.views.toLocaleString() : <span className="text-zinc-400">—</span>}
                      </td>

                      {/* Saves */}
                      <td className="px-5 py-4 text-right font-mono text-zinc-700 dark:text-zinc-300 text-xs">
                        {p.saves > 0 ? (
                          <span className="text-amber-700 dark:text-amber-300 font-semibold">{p.saves.toLocaleString()}</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Comparisons */}
                      <td className="px-5 py-4 text-right font-mono text-zinc-700 dark:text-zinc-300 text-xs">
                        {p.comparisons > 0 ? (
                          <span className="text-violet-700 dark:text-violet-300 font-semibold">{p.comparisons.toLocaleString()}</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Shares */}
                      <td className="px-5 py-4 text-right font-mono text-zinc-700 dark:text-zinc-300 text-xs">
                        {p.shares > 0 ? (
                          <span className="text-blue-700 dark:text-blue-300 font-semibold">{p.shares.toLocaleString()}</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* WhatsApp */}
                      <td className="px-5 py-4 text-right font-mono text-xs">
                        {p.whatsappInquiries > 0 ? (
                          <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/70 dark:border-emerald-800/60">
                            {p.whatsappInquiries.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Total Interactions & Relative Bar */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`font-mono text-xs font-black ${
                            hasActivity 
                              ? 'text-[#0066cc] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/70 dark:border-blue-800/60' 
                              : 'text-zinc-400 font-normal'
                          }`}>
                            {total.toLocaleString()}
                          </span>
                          {hasActivity && (
                            <div className="w-24 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#0066cc] rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(proportion, 4)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center text-xs text-zinc-400">
            {searchQuery ? (
              <p>No properties matching &ldquo;{searchQuery}&rdquo;. Try another search term.</p>
            ) : (
              <p className="italic">No active property interactions recorded yet. Switch filter to &quot;All Projects&quot; to inspect all catalog entries.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
