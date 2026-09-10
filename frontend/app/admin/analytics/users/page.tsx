'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Users, Layers } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import AnalyticsNav from '@/components/admin/AnalyticsNav'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { adminFetch } from '@/lib/adminFetch'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts'

interface ActiveUserSession {
  id: string
  userLabel: string
  title: string
  messageCount: number
  queriesCount: number
  phase: string
  lastActive: string
}

interface UserMetrics {
  totalUsers: number
  repeatedVisitors: number
  totalConversions: number
  avgSessionDuration: number
  avgQueriesPerUser: number
  conversionFunnel: {
    chats: number
    searches: number
    clicks: number
    saves: number
    conversions: number
  }
  mostActiveSectors: Array<{ sector: string; searches: number }>
  users?: ActiveUserSession[]
}

export default function UsersAnalytics() {
  const [data, setData] = useState<UserMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const isFetchingRef = useRef(false)

  const loadData = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (isManual) setIsRefreshing(true)

    try {
      const res = await adminFetch('/admin/analytics/users')
      const users = await res.json()
      setData(users)
      setLastRefreshedAt(new Date())
    } catch (err) {
      console.error('Users analytics load failed:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => { 
    loadData() 
  }, [loadData])

  const funnelData = data?.conversionFunnel
    ? [
        { name: 'Chats', value: data.conversionFunnel.chats },
        { name: 'Searches', value: data.conversionFunnel.searches },
        { name: 'Clicks', value: data.conversionFunnel.clicks },
        { name: 'Saves', value: data.conversionFunnel.saves },
        { name: 'Conversions', value: data.conversionFunnel.conversions },
      ]
    : []

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
              User Behavior Analytics
            </h1>
            <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Active sessions, discovery funnel, and retention metrics
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
            title="Refresh user behavior analytics"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <AnalyticsNav />

      {/* KPI Row */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
              Total Users
              <AdminInfoTooltip
                title="Total Users"
                description="Unique visitors who started chat discovery sessions."
              />
            </span>
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white block mt-2">{data.totalUsers}</span>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
              Repeat Visitors
              <AdminInfoTooltip
                title="Repeat Visitors"
                description="Visitors who returned for 2 or more chat sessions."
              />
            </span>
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white block mt-2">{data.repeatedVisitors}</span>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
              Avg Searches/User
              <AdminInfoTooltip
                title="Avg Searches/User"
                description="Average property queries run per visitor session."
              />
            </span>
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white block mt-2">{(data.avgQueriesPerUser || 0).toFixed(1)}</span>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
              Total Conversions
              <AdminInfoTooltip
                title="Total Conversions"
                description="Total lead callback or site visit requests generated."
              />
            </span>
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white block mt-2">{data.totalConversions}</span>
          </div>
        </div>
      ) : null}

      {/* Funnel & Sectors Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              Conversion Funnel Stage Counts
              <AdminInfoTooltip
                title="Conversion Funnel Stage Counts"
                description="User drop-off tracking from chat start to lead submission."
              />
            </span>
          </div>

          {loading ? (
            <Skeleton className="w-full h-64 rounded-xl" />
          ) : funnelData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No Funnel Events Recorded</p>
            </div>
          )}
        </div>

        {/* Most Active Sectors */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              Most Active User Sectors
              <AdminInfoTooltip
                title="Most Active User Sectors"
                description="Sectors receiving highest recurring search interest."
              />
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : data?.mostActiveSectors && data.mostActiveSectors.length > 0 ? (
            <div className="space-y-2.5">
              {data.mostActiveSectors.map((item) => (
                <div key={item.sector} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">{item.sector}</span>
                  <span className="text-xs font-mono font-extrabold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">
                    {item.searches} searches
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 text-center py-12">No sector searches yet</p>
          )}
        </div>
      </div>

      {/* Active User Sessions Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
        <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight uppercase inline-flex items-center">
          Live User Chat Sessions (Real Database Sessions)
          <AdminInfoTooltip
            title="Live User Chat Sessions"
            description="Active database chat sessions, buyer topics, and message counts."
          />
        </h3>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : data?.users && data.users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase">
                  <th className="py-3 px-4">User Token</th>
                  <th className="py-3 px-4">Discovery Topic</th>
                  <th className="py-3 px-4 text-center">Messages</th>
                  <th className="py-3 px-4 text-center">Queries</th>
                  <th className="py-3 px-4 text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                {data.users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">{u.userLabel}</td>
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">{u.title}</td>
                    <td className="py-3 px-4 text-center font-mono text-zinc-600 dark:text-zinc-300">{u.messageCount}</td>
                    <td className="py-3 px-4 text-center font-mono text-zinc-600 dark:text-zinc-300">{u.queriesCount}</td>
                    <td className="py-3 px-4 text-right text-zinc-400">
                      {(() => {
                        const lastActive = new Date(u.lastActive)
                        return isNaN(lastActive.getTime()) ? '—' : formatDistanceToNow(lastActive, { addSuffix: true })
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 text-center py-8">No user chat sessions logged yet</p>
        )}
      </div>
    </div>
  )
}
