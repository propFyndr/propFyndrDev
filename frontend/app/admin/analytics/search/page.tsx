'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Building2, Search, BarChart3, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import AnalyticsNav from '@/components/admin/AnalyticsNav'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { adminFetch } from '@/lib/adminFetch'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts'

interface DashboardStats {
  totalQueries: number
  topSectors: Array<{ sector: string; count: number }>
  topBuilders: Array<{ builder: string; count: number }>
}

export default function SearchAnalytics() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const isFetchingRef = useRef(false)

  const loadData = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (isManual) setIsRefreshing(true)

    try {
      const res = await adminFetch('/admin/analytics/summary')
      const summary = await res.json()
      setData(summary)
      setLastRefreshedAt(new Date())
    } catch (err) {
      console.error('Search analytics load failed:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => { 
    loadData() 
  }, [loadData])

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
              Search Analytics
            </h1>
            <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Sector trends, locality demand, and top searched developers
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
            title="Refresh search analytics"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <AnalyticsNav />

      {/* Stats Summary Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Searches */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
                Total Search Telemetry
                <AdminInfoTooltip
                  title="Total Search Telemetry"
                  description="Total property search queries executed across all user chats."
                  whyItMatters="Measures overall buyer search exploration volume."
                />
              </span>
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <Search className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                {data?.totalQueries || 0}
              </span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Logged queries
              </span>
            </div>
          </div>

          {/* Unique Sectors */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
                Active Sectors Queried
                <AdminInfoTooltip
                  title="Active Sectors Queried"
                  description="Count of distinct sectors buyers have searched for."
                  whyItMatters="Shows geographic breadth of buyer interest."
                />
              </span>
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                {data?.topSectors?.length || 0}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Unique localities
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sectors Bar Chart */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Top 10 Searched Sectors (Real DB Data)
              <AdminInfoTooltip
                title="Top 10 Searched Sectors"
                description="Bar chart ranking top sectors in Noida & Greater Noida."
                whyItMatters="Reveals localities with highest real-estate demand."
              />
            </span>
          </div>

          {loading ? (
            <Skeleton className="w-full h-80 rounded-xl" />
          ) : data?.topSectors && data.topSectors.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topSectors.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" opacity={0.5} />
                  <XAxis dataKey="sector" tick={{ fontSize: 11, fill: '#71717a' }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center text-center p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
              <Building2 className="w-8 h-8 text-zinc-400 mb-2 opacity-50" />
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No Sector Searches Logged</p>
            </div>
          )}
        </div>

        {/* Top Builders Ranking List */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-500" />
              Top Searched Builders
              <AdminInfoTooltip
                title="Top Searched Builders"
                description="Developers buyers explicitly ask about in chats."
                whyItMatters="Identifies developers with strongest buyer brand intent."
              />
            </span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Developer Rank
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : data?.topBuilders && data.topBuilders.length > 0 ? (
            <div className="space-y-2.5">
              {data.topBuilders.slice(0, 10).map((builder, idx) => (
                <div key={builder.builder} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-extrabold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">{builder.builder}</span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">
                    {builder.count} searches
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-zinc-400 italic">No builder queries recorded yet</div>
          )}
        </div>
      </div>

      {/* All Sectors Ledger Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
        <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight uppercase inline-flex items-center">
          Detailed Sector Query Ledger
          <AdminInfoTooltip
            title="Sector Query Ledger"
            description="Complete list of all searched sectors and their exact query counts."
          />
        </h3>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : data?.topSectors && data.topSectors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase">
                  <th className="py-3 px-4">Sector Locality</th>
                  <th className="text-right py-3 px-4">Total Search Queries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                {data.topSectors.map((item) => (
                  <tr key={item.sector} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">{item.sector}</td>
                    <td className="text-right py-3 px-4 font-mono font-bold text-zinc-600 dark:text-zinc-300">{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 text-center py-8">No search telemetry recorded yet</p>
        )}
      </div>
    </div>
  )
}
