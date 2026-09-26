'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Building2, Search, BarChart3, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import AnalyticsNav from '@/components/admin/AnalyticsNav'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import { adminFetch } from '@/lib/adminFetch'
import { MetricCard } from '@/components/admin/ui/MetricCard'
import { Skeleton } from '@/components/ui/skeleton'
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
          <div className="h-28 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
          <div className="h-28 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Total Search Telemetry"
            value={data?.totalQueries?.toLocaleString() || 0}
            subBadge="Logged queries"
            subBadgeVariant="blue"
            icon={Search}
            iconBgClass="bg-blue-50 dark:bg-blue-950/60"
            iconColorClass="text-[#0066cc] dark:text-blue-400"
            tooltip={
              <AdminInfoTooltip
                title="Total Search Telemetry"
                description="Total property search queries executed across all user chats."
                whyItMatters="Measures overall buyer search exploration volume."
              />
            }
          />

          <MetricCard
            title="Active Sectors Queried"
            value={data?.topSectors?.length || 0}
            subBadge="Unique localities"
            subBadgeVariant="emerald"
            icon={Building2}
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/60"
            iconColorClass="text-emerald-600 dark:text-emerald-400"
            tooltip={
              <AdminInfoTooltip
                title="Active Sectors Queried"
                description="Count of distinct sectors buyers have searched for."
                whyItMatters="Shows geographic breadth of buyer interest."
              />
            }
          />
        </div>
      )}

      {/* Detailed Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sectors Horizontal Bar Chart (Zero Label Collision) */}
        <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#0066cc]" />
              Top 10 Searched Sectors (Real DB Data)
              <AdminInfoTooltip
                title="Top 10 Searched Sectors"
                description="Bar chart ranking top sectors in Noida & Greater Noida."
                whyItMatters="Reveals localities with highest real-estate demand."
              />
            </span>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg">
              Locality Rank
            </span>
          </div>

          {loading ? (
            <div className="w-full h-80 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
          ) : data?.topSectors && data.topSectors.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topSectors.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" className="dark:opacity-10" />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#71717a', fontWeight: 500 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="sector"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(s: string) => s.replace(', Noida', '').replace('Noida', '').trim()}
                    tick={{ fontSize: 11, fill: '#71717a', fontWeight: 500 }}
                    width={105}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(0, 102, 204, 0.05)', radius: 6 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload
                        return (
                          <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 text-white px-3.5 py-2.5 rounded-xl shadow-2xl z-50">
                            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                              {d.sector}
                            </p>
                            <p className="text-xs font-semibold text-white">
                              {payload[0].value} <span className="text-zinc-400 font-normal">Searches</span>
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="count" fill="#0066cc" radius={[0, 6, 6, 0]} maxBarSize={22} />
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

        {/* Top Builders Ranking Leaderboard */}
        <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Top Searched Builders
              <AdminInfoTooltip
                title="Top Searched Builders"
                description="Developers buyers explicitly ask about in chats."
                whyItMatters="Identifies developers with strongest buyer brand intent."
              />
            </span>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg">
              Brand Volume
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
              ))}
            </div>
          ) : data?.topBuilders && data.topBuilders.length > 0 ? (
            (() => {
              const maxBuilderCount = Math.max(...data.topBuilders.map((b) => b.count), 1)
              return (
                <div className="space-y-2.5">
                  {data.topBuilders.slice(0, 8).map((builder, idx) => {
                    const rank = idx + 1
                    const sharePct = Math.round((builder.count / maxBuilderCount) * 100)
                    return (
                      <div
                        key={builder.builder}
                        className="p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center border shadow-2xs ${
                                rank === 1
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800'
                                  : rank === 2
                                  ? 'bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600'
                                  : rank === 3
                                  ? 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/80 dark:text-orange-200 dark:border-orange-800'
                                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-800'
                              }`}
                            >
                              {rank}
                            </span>
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {builder.builder}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                            {builder.count} <span className="text-[11px] text-zinc-400 font-normal">searches</span>
                          </span>
                        </div>
                        <div className="w-full h-1 bg-zinc-200/60 dark:bg-zinc-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0066cc] rounded-full transition-all duration-500"
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
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
