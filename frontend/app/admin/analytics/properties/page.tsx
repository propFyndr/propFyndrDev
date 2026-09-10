'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Building2, Eye, Bookmark, Share2, MessageSquare, ExternalLink, HelpCircle, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import AnalyticsNav from '@/components/admin/AnalyticsNav'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
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

  const displayProperties = useMemo(() => {
    if (filterMode === 'active') {
      return properties.filter(p => {
        const total = (p.total ?? 0) || (p.views + p.saves + p.comparisons + p.shares + p.whatsappInquiries)
        return total > 0
      })
    }
    return properties
  }, [properties, filterMode])

  return (
    <div className="space-y-6 pb-16 font-sans select-none max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-4">
          <Link href="/admin/analytics" className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Property Engagement
            </h1>
            <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Views, saves, comparisons, and WhatsApp lead interactions per project
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
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <AnalyticsNav />

      {/* Explainer Banner */}
      <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 flex items-start gap-3 text-xs shadow-2xs">
        <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-extrabold text-blue-900 dark:text-blue-100">
            What is Property Engagement Analytics?
          </h4>
          <p className="text-blue-800 dark:text-blue-200 font-medium leading-relaxed">
            This dashboard tracks real-time buyer actions across all listed properties on PropFyndr: <strong>Views</strong> (project page visits), <strong>Saves</strong> (bookmarked by users), <strong>Comparisons</strong> (side-by-side analysis), <strong>Shares</strong>, and <strong>WhatsApp Inquiries</strong>. Properties are sorted by total engagement level.
          </p>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
            Total Views
            <AdminInfoTooltip
              title="Total Property Views"
              description="Number of times buyers clicked into detailed project cards."
            />
          </span>
          <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white block mt-2">{totals.views}</span>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
            Saved Properties
            <AdminInfoTooltip
              title="Saved Properties"
              description="Times properties were bookmarked by buyers."
            />
          </span>
          <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white block mt-2">{totals.saves}</span>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
            Comparisons
            <AdminInfoTooltip
              title="Property Comparisons"
              description="Times properties were added to side-by-side comparison matrix."
            />
          </span>
          <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white block mt-2">{totals.comparisons}</span>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
            WhatsApp Inquiries
            <AdminInfoTooltip
              title="WhatsApp Inquiries"
              description="Direct lead callback or site visit inquiries sent via WhatsApp."
            />
          </span>
          <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white block mt-2">{totals.whatsapp}</span>
        </div>
      </div>

      {/* Engagement Table Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-2xs">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight uppercase inline-flex items-center">
              Top Performing Properties (Sorted by Total Telemetry)
              <AdminInfoTooltip
                title="Top Performing Properties"
                description="Listings ranked by total buyer engagement (views, saves, leads)."
              />
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              Ranking properties based on buyer interaction volume
            </p>
          </div>

          {/* Segmented Filter Mode */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shrink-0">
            <button
              onClick={() => setFilterMode('active')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                filterMode === 'active'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Active Engaged Only ({properties.filter(p => (p.total || 0) > 0).length})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              All Projects ({properties.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : displayProperties.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Project Name</th>
                  <th className="px-6 py-4 text-right">Views</th>
                  <th className="px-6 py-4 text-right">Saves</th>
                  <th className="px-6 py-4 text-right">Comparisons</th>
                  <th className="px-6 py-4 text-right">Shares</th>
                  <th className="px-6 py-4 text-right">WhatsApp</th>
                  <th className="px-6 py-4 text-right">Total Interactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                {displayProperties.map((p) => {
                  const total = p.total ?? (p.views + p.saves + p.comparisons + p.shares + p.whatsappInquiries)
                  const hasActivity = total > 0

                  return (
                    <tr key={p.projectId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-zinc-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                          <span>{p.projectName}</span>
                          {p.sector && (
                            <span className="text-[10px] text-zinc-400 font-normal">({p.sector})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-600 dark:text-zinc-300">{p.views}</td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-600 dark:text-zinc-300">{p.saves}</td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-600 dark:text-zinc-300">{p.comparisons}</td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-600 dark:text-zinc-300">{p.shares}</td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-600 dark:text-zinc-300">{p.whatsappInquiries}</td>
                      <td className="px-6 py-4 text-right font-mono font-extrabold">
                        <span className={hasActivity ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800' : 'text-zinc-400'}>
                          {total}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-zinc-400 italic">
            No active property interactions recorded yet. Switch filter to &quot;All Projects&quot; to inspect all catalog entries.
          </div>
        )}
      </div>
    </div>
  )
}
