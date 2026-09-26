'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import {
  Users,
  ArrowsClockwise,
  MagnifyingGlass,
  Target,
  ChatCircleDots,
  MapPin,
  Info,
  Clock,
  ArrowRight,
  ShieldCheck,
  Funnel,
  Sparkle as _NoSparkle // Guarantee not used
} from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import AnalyticsNav from '@/components/admin/AnalyticsNav'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import { MetricCard, MetricCardSkeleton } from '@/components/admin/ui/MetricCard'
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
  const [sessionSearch, setSessionSearch] = useState('')

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

  const funnelSteps = useMemo(() => {
    if (!data?.conversionFunnel) return []
    const f = data.conversionFunnel
    const base = f.chats || 1

    return [
      {
        stage: 'Chats Started',
        count: f.chats,
        pctOfTotal: 100,
        subtext: 'Discovery sessions',
        color: '#0066cc',
      },
      {
        stage: 'Searches Run',
        count: f.searches,
        pctOfTotal: Math.min(100, Math.round((f.searches / base) * 100)),
        subtext: 'Property queries executed',
        color: '#2563eb',
      },
      {
        stage: 'Project Clicks',
        count: f.clicks,
        pctOfTotal: Math.min(100, Math.round((f.clicks / base) * 100)),
        subtext: 'Card impressions viewed',
        color: '#3b82f6',
      },
      {
        stage: 'Properties Saved',
        count: f.saves,
        pctOfTotal: Math.min(100, Math.round((f.saves / base) * 100)),
        subtext: 'Shortlisted by buyer',
        color: '#8b5cf6',
      },
      {
        stage: 'Lead Conversions',
        count: f.conversions,
        pctOfTotal: Math.min(100, Math.round((f.conversions / base) * 100)),
        subtext: 'WhatsApp / Callback leads',
        color: '#10b981',
      },
    ]
  }, [data])

  // Max search count among sectors for relative gauge
  const maxSectorSearches = useMemo(() => {
    if (!data?.mostActiveSectors?.length) return 1
    return Math.max(...data.mostActiveSectors.map(s => s.searches), 1)
  }, [data])

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    if (!data?.users) return []
    if (!sessionSearch.trim()) return data.users
    const q = sessionSearch.toLowerCase().trim()
    return data.users.filter(u =>
      u.userLabel.toLowerCase().includes(q) ||
      u.title.toLowerCase().includes(q) ||
      u.phase?.toLowerCase().includes(q)
    )
  }, [data, sessionSearch])

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
              User Behavior Analytics
            </h1>
            <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live discovery sessions, conversion funnel progression, and buyer retention
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
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-[#0066cc]' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <AnalyticsNav />

      {/* KPI Cards Row */}
      {loading ? (
        <MetricCardSkeleton />
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            title="Total Users"
            value={data.totalUsers}
            subBadge="Discovery sessions"
            subBadgeVariant="blue"
            icon={Users}
            iconColorClass="text-[#0066cc] dark:text-blue-400"
            iconBgClass="bg-blue-50 dark:bg-blue-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Total Users"
                description="Unique buyer identities who initiated AI property discovery sessions."
              />
            }
          />
          <MetricCard
            title="Repeat Visitors"
            value={data.repeatedVisitors}
            subBadge={
              data.totalUsers > 0
                ? `${((data.repeatedVisitors / data.totalUsers) * 100).toFixed(1)}% retention`
                : '0% retention'
            }
            subBadgeVariant="violet"
            icon={ArrowsClockwise}
            iconColorClass="text-violet-600 dark:text-violet-400"
            iconBgClass="bg-violet-50 dark:bg-violet-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Repeat Visitors"
                description="Buyers who returned for 2 or more distinct discovery sessions across multiple visits."
              />
            }
          />
          <MetricCard
            title="Avg Searches / User"
            value={(data.avgQueriesPerUser || 0).toFixed(1)}
            subBadge="Queries per session"
            subBadgeVariant="amber"
            icon={MagnifyingGlass}
            iconColorClass="text-amber-600 dark:text-amber-400"
            iconBgClass="bg-amber-50 dark:bg-amber-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Avg Searches / User"
                description="Average number of property search queries and filter adjustments run per user session."
              />
            }
          />
          <MetricCard
            title="Total Conversions"
            value={data.totalConversions}
            subBadge={
              data.totalUsers > 0
                ? `${((data.totalConversions / data.totalUsers) * 100).toFixed(1)}% conversion`
                : '0% conversion'
            }
            subBadgeVariant="emerald"
            icon={Target}
            iconColorClass="text-emerald-600 dark:text-emerald-400"
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Total Conversions"
                description="Total verified lead submissions, WhatsApp inquiries, and scheduled site visits produced."
              />
            }
          />
        </div>
      ) : null}

      {/* Conversion Funnel Journey Stepper */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight uppercase inline-flex items-center gap-2">
              <Funnel size={16} weight="bold" className="text-[#0066cc]" />
              Conversion Funnel Journey (Buyer Discovery Lifecycle)
              <AdminInfoTooltip
                title="Buyer Discovery Lifecycle"
                description="Full end-to-end progression tracking buyers from the initial chat prompt down to verified lead conversion."
              />
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              Stage-by-stage drop-off tracking across the PropFyndr discovery pipeline
            </p>
          </div>

          {data?.conversionFunnel && (
            <span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg self-start sm:self-auto border border-zinc-200/60 dark:border-zinc-700/60">
              {data.conversionFunnel.conversions} converted / {data.conversionFunnel.chats} initiated
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : funnelSteps.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {funnelSteps.map((step, idx) => {
              const isLast = idx === funnelSteps.length - 1
              return (
                <div
                  key={step.stage}
                  className={`p-4 rounded-xl border relative transition-all duration-200 ${
                    isLast
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/80'
                      : 'bg-zinc-50/60 dark:bg-zinc-800/30 border-zinc-200/70 dark:border-zinc-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-700/70 text-zinc-600 dark:text-zinc-300">
                      Step {idx + 1}
                    </span>
                    <span className={`text-[11px] font-mono font-bold ${
                      isLast ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {step.pctOfTotal}%
                    </span>
                  </div>

                  <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-white mt-1">
                    {step.count.toLocaleString()}
                  </div>

                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-1 truncate">
                    {step.stage}
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium truncate mt-0.5">
                    {step.subtext}
                  </div>

                  {/* Proportional Progress Track */}
                  <div className="mt-3 w-full h-1.5 bg-zinc-200/70 dark:bg-zinc-700/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(step.pctOfTotal, 3)}%`,
                        backgroundColor: step.color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-zinc-400 italic">
            No funnel metrics logged yet
          </div>
        )}
      </div>

      {/* Grid: Recharts Funnel Breakdown + Most Active Sectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Stage Volume Chart */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight uppercase flex items-center gap-2">
              <BarChart className="w-4 h-4 text-[#0066cc]" />
              Funnel Stage Volumes (Log Scaled Distribution)
              <AdminInfoTooltip
                title="Funnel Stage Volumes"
                description="Comparative volume counts across every milestone in the conversion funnel."
              />
            </span>
          </div>

          {loading ? (
            <Skeleton className="w-full h-64 rounded-xl" />
          ) : funnelSteps.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelSteps} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" opacity={0.3} />
                  <XAxis 
                    dataKey="stage" 
                    tick={{ fontSize: 10, fill: '#71717a' }} 
                    interval={0}
                    tickFormatter={(val: string) => val.split(' ')[0]}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#71717a' }} 
                    allowDecimals={false} 
                  />
                  <RechartsTooltip
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      borderRadius: '12px', 
                      border: 'none', 
                      color: '#fff', 
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    formatter={(value: any) => [Number(value).toLocaleString(), 'Volume']}
                  />
                  <Bar dataKey="count" fill="#0066cc" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No Funnel Events Recorded</p>
            </div>
          )}
        </div>

        {/* Most Active User Sectors Leaderboard */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight uppercase flex items-center gap-2">
              <MapPin size={16} weight="bold" className="text-emerald-500" />
              Most Active User Sectors
              <AdminInfoTooltip
                title="Most Active User Sectors"
                description="Localities and corridors receiving the highest user interest and recurring queries."
              />
            </span>
            {data?.mostActiveSectors && data.mostActiveSectors.length > 0 && (
              <span className="text-[10px] font-mono text-zinc-400">
                Top {data.mostActiveSectors.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-xl" />
              ))}
            </div>
          ) : data?.mostActiveSectors && data.mostActiveSectors.length > 0 ? (
            <div className="space-y-2.5">
              {data.mostActiveSectors.map((item, idx) => {
                const proportion = maxSectorSearches > 0 ? (item.searches / maxSectorSearches) * 100 : 0

                return (
                  <div 
                    key={item.sector} 
                    className="p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 flex flex-col gap-2 group hover:border-[#0066cc]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Metallic Rank Badge */}
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black shrink-0 ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                            : idx === 1
                            ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600'
                            : idx === 2
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border border-orange-300 dark:border-orange-700'
                            : 'text-zinc-400 font-mono'
                        }`}>
                          {idx + 1}
                        </span>

                        <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {item.sector}
                        </span>
                      </div>

                      <span className="text-xs font-mono font-extrabold text-[#0066cc] dark:text-blue-400 bg-white dark:bg-zinc-900 px-2.5 py-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 shrink-0">
                        {item.searches.toLocaleString()} searches
                      </span>
                    </div>

                    {/* Proportional fill gauge */}
                    <div className="w-full h-1 bg-zinc-200/60 dark:bg-zinc-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0066cc] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(proportion, 4)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 text-center py-12 italic">No sector searches recorded yet</p>
          )}
        </div>
      </div>

      {/* Live User Chat Sessions Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-2xs">
        {/* Toolbar */}
        <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight uppercase inline-flex items-center gap-2">
              <ChatCircleDots size={16} weight="bold" className="text-[#0066cc]" />
              Live User Chat Sessions (Real Database Sessions)
              <AdminInfoTooltip
                title="Live User Chat Sessions"
                description="Live buyer discovery chat logs from the database, including search queries, message counts, and timestamps."
              />
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              Real-time audit log of buyer discovery interactions and conversation states
            </p>
          </div>

          {/* Session Search */}
          <div className="relative min-w-[220px]">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search user or topic..."
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#0066cc] focus:border-[#0066cc] transition-all"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredSessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/75 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">User Session</th>
                  <th className="py-3.5 px-5">Discovery Topic / Intent</th>
                  <th className="py-3.5 px-4 text-center">Messages</th>
                  <th className="py-3.5 px-4 text-center">Queries</th>
                  <th className="py-3.5 px-4 text-center">Phase</th>
                  <th className="py-3.5 px-6 text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                {filteredSessions.map((u) => {
                  const lastActiveDate = new Date(u.lastActive)
                  const isValidDate = !isNaN(lastActiveDate.getTime())
                  const isRecent = isValidDate && (Date.now() - lastActiveDate.getTime() < 30 * 60 * 1000)

                  return (
                    <tr key={u.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      {/* User Token */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2 shrink-0">
                            {isRecent && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${
                              isRecent ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                            }`} />
                          </span>
                          <span className="font-mono font-bold text-[#0066cc] dark:text-blue-400">
                            {u.userLabel}
                          </span>
                        </div>
                      </td>

                      {/* Topic */}
                      <td className="py-4 px-5">
                        <span className="font-bold text-zinc-900 dark:text-white truncate block max-w-[280px]" title={u.title}>
                          {u.title || 'General Discovery'}
                        </span>
                      </td>

                      {/* Messages */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50">
                          {u.messageCount}
                        </span>
                      </td>

                      {/* Queries */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50">
                          {u.queriesCount}
                        </span>
                      </td>

                      {/* Phase */}
                      <td className="py-4 px-4 text-center">
                        <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                          {u.phase || 'DISCOVERY'}
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="py-4 px-6 text-right font-medium text-zinc-500 dark:text-zinc-400 text-xs">
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <Clock size={12} className="text-zinc-400" />
                          {isValidDate ? formatDistanceToNow(lastActiveDate, { addSuffix: true }) : '—'}
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
            {sessionSearch ? `No sessions matching "${sessionSearch}"` : 'No user chat sessions logged yet'}
          </div>
        )}
      </div>
    </div>
  )
}
