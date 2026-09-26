'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Buildings,
  UsersThree,
  CheckCircle,
  WarningCircle,
  ArrowRight,
  ArrowClockwise,
  ImageBroken,
  ShieldSlash,
  TerminalWindow,
  Plus,
  Copy,
  Check,
  CalendarBlank,
  Clock,
  Cpu,
  Shield,
  ArrowSquareOut,
  MapPin,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { Activity, FileSpreadsheet } from 'lucide-react'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import { adminFetch } from '@/lib/adminFetch'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import CustomDropdown, { DropdownOption } from '@/components/admin/ui/CustomDropdown'
import { MetricCard, MetricCardSkeleton } from '@/components/admin/ui/MetricCard'
import { formatDistanceToNow } from 'date-fns'

interface Stats {
  total: number
  ready: number
  under_construction: number
  new_launch: number
  no_image: number
  no_rera: number
  builders: number
  topBuilders: { name: string; projects: number }[]
  readinessPct: number
}

interface AuditLogEntry {
  id: string
  entity_type: string
  entity_id: string
  entity_name: string | null
  action: string
  actor: string
  summary: string
  changes?: any
  created_at: string
}

type TimeRange = 'all' | '30d' | '90d' | 'year'

const TIME_RANGE_OPTIONS: DropdownOption<TimeRange>[] = [
  { value: 'all', label: 'All Time' },
  { value: '30d', label: 'Past 30 Days' },
  { value: '90d', label: 'Past 90 Days' },
  { value: 'year', label: 'This Year' },
]

export default function AdminDashboard() {
  const [allProjects, setAllProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [bottomPaneTab, setBottomPaneTab] = useState<'activity' | 'cli'>('activity')
  const [activityFilter, setActivityFilter] = useState<'all' | 'demand' | 'catalog'>('all')
  const [counts, setCounts] = useState<{ all: number; demand: number; catalog: number }>({
    all: 0,
    demand: 0,
    catalog: 0,
  })

  const [activitySearchQuery, setActivitySearchQuery] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/admin/projects?limit=1000')
      const data = await res.json()
      const projects = data.projects ?? []
      setAllProjects(projects)
    } catch (err) {
      console.error('[AdminDashboard] Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRecentLogs = useCallback(async (filter: 'all' | 'demand' | 'catalog' = activityFilter) => {
    setLogsLoading(true)
    try {
      const categoryParam = filter !== 'all' ? `&category=${filter}` : ''
      const res = await adminFetch(`/admin/audit-logs?limit=10${categoryParam}`)
      if (res.ok) {
        const data = await res.json()
        setRecentLogs(data.logs || [])
        if (data.counts) {
          setCounts(data.counts)
        }
      }
    } catch (err) {
      console.error('[AdminDashboard] Failed to load audit logs:', err)
    } finally {
      setLogsLoading(false)
    }
  }, [activityFilter])

  useEffect(() => {
    load()
    loadRecentLogs('all')
  }, [load, loadRecentLogs])

  const handleFilterChange = (filter: 'all' | 'demand' | 'catalog') => {
    setActivityFilter(filter)
    loadRecentLogs(filter)
  }

  const filteredLogs = useMemo(() => {
    if (!activitySearchQuery.trim()) return recentLogs
    const q = activitySearchQuery.toLowerCase()
    return recentLogs.filter(
      (l) =>
        l.summary?.toLowerCase().includes(q) ||
        l.entity_name?.toLowerCase().includes(q) ||
        l.actor?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q)
    )
  }, [recentLogs, activitySearchQuery])

  // Filter projects based on selected TimeRange
  const filteredProjects = useMemo(() => {
    if (timeRange === 'all') return allProjects

    const now = Date.now()
    const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365
    const cutoff = now - days * 24 * 60 * 60 * 1000

    return allProjects.filter((p: any) => {
      const timestamp = p.created_at || p.updated_at
      if (!timestamp) return true
      const time = new Date(timestamp).getTime()
      return !isNaN(time) ? time >= cutoff : true
    })
  }, [allProjects, timeRange])

  // Compute aggregated stats from filtered projects
  const stats: Stats | null = useMemo(() => {
    if (!mounted && loading) return null

    const projects = filteredProjects
    const totalCount = projects.length

    const builderCounts: Record<string, number> = {}
    let readyToDeployCount = 0

    projects.forEach((p: any) => {
      if (p.builder?.name) {
        builderCounts[p.builder.name] = (builderCounts[p.builder.name] ?? 0) + 1
      }
      // Calculate completeness readiness (has hero image, rera number, description, and units)
      if (p.hero_image_url && p.rera_number && p.description && (p.unit_types?.length || 0) > 0) {
        readyToDeployCount++
      }
    })

    const topBuilders = (Object.entries(builderCounts) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '…' : name,
        fullName: name,
        projects: Number(count),
      }))

    const readinessPct = totalCount > 0 ? Math.round((readyToDeployCount / totalCount) * 100) : 0

    return {
      total: totalCount,
      ready: projects.filter((p: any) => p.status === 'ready_to_move').length,
      under_construction: projects.filter((p: any) => p.status === 'under_construction').length,
      new_launch: projects.filter((p: any) => p.status === 'new_launch').length,
      no_image: projects.filter((p: any) => !p.hero_image_url).length,
      no_rera: projects.filter((p: any) => !p.rera_number).length,
      builders: new Set(projects.map((p: any) => p.builder?.id).filter(Boolean)).size,
      topBuilders,
      readinessPct,
    }
  }, [filteredProjects, mounted, loading])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(text)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  // Apple System Palette for Donut Chart
  const pieData = useMemo(() => {
    if (!stats) return []
    return [
      {
        name: 'Ready to Move',
        value: stats.ready,
        color: '#34c759', // Apple System Green
        pct: stats.total ? Math.round((stats.ready / stats.total) * 100) : 0,
      },
      {
        name: 'Under Construction',
        value: stats.under_construction,
        color: '#ff9500', // Apple System Amber
        pct: stats.total ? Math.round((stats.under_construction / stats.total) * 100) : 0,
      },
      {
        name: 'New Launch',
        value: stats.new_launch,
        color: '#0066cc', // Apple Action Blue
        pct: stats.total ? Math.round((stats.new_launch / stats.total) * 100) : 0,
      },
    ].filter((d) => d.value > 0)
  }, [stats])

  // Current formatted date for header
  const todayLabel = useMemo(() => {
    try {
      const d = new Date()
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    } catch {
      return 'Today'
    }
  }, [])

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime()
      if (isNaN(diff)) return 'recently'
      const minutes = Math.floor(diff / 60000)
      if (minutes < 1) return 'Just now'
      if (minutes < 60) return `${minutes}m ago`
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `${hours}h ago`
      const days = Math.floor(hours / 24)
      if (days === 1) return 'Yesterday'
      if (days < 7) return `${days}d ago`
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return 'recently'
    }
  }

  const getActorBadge = (log: AuditLogEntry) => {
    const isSectorGap =
      log.entity_type === 'sector_gap' ||
      log.action === 'SECTOR_NOT_COVERED' ||
      log.entity_type === 'coverage_gap'

    if (isSectorGap) {
      return null
    }

    const actor = log.actor || ''
    if (actor.toLowerCase().includes('bulk') || actor.toLowerCase().includes('csv')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60">
          <FileSpreadsheet size={10} className="text-purple-600 dark:text-purple-400" />
          <span>Bulk CSV</span>
        </span>
      )
    }
    if (actor.toLowerCase().includes('system') || actor.toLowerCase().includes('ai')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60">
          <Cpu size={10} className="text-sky-600 dark:text-sky-400" />
          <span>System AI</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
        <Shield size={10} className="text-[#0066cc] dark:text-blue-400" />
        <span>Admin</span>
      </span>
    )
  }

  const getActionChip = (log: AuditLogEntry) => {
    const isSectorGap =
      log.entity_type === 'sector_gap' ||
      log.action === 'SECTOR_NOT_COVERED' ||
      log.entity_type === 'coverage_gap'

    if (isSectorGap) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-200/90 dark:border-amber-800/80 shadow-2xs">
          <MapPin size={10} weight="fill" className="text-amber-600 dark:text-amber-400" />
          <span>Demand Gap</span>
        </span>
      )
    }

    if (log.entity_type === 'bulk_import' || log.action === 'BULK_UPDATE') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80">
          Batch
        </span>
      )
    }

    if (log.entity_type === 'admin_user') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80">
          Security
        </span>
      )
    }

    if (log.entity_type === 'chat_session') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md uppercase tracking-wider bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80">
          AI Query
        </span>
      )
    }

    switch (log.action) {
      case 'CREATE':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80">
            Created
          </span>
        )
      case 'DELETE':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80">
            Deleted
          </span>
        )
      default:
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md uppercase tracking-wider bg-blue-50 text-[#0066cc] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80">
            Updated
          </span>
        )
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 p-4 md:p-8">
      {/* ── Page Sub-Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
              <span>Hello, Administrator</span>
              <span className="text-2xl select-none" role="img" aria-label="Waving hand">👋</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 rounded-full shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>System Healthy</span>
            </span>

            {/* Catalog Readiness Gauge */}
            {stats && (
              <div className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Readiness:</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{stats.readinessPct}%</span>
                <div className="w-12 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full bg-[#0066cc] rounded-full transition-all duration-700"
                    style={{ width: `${stats.readinessPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium flex items-center gap-2">
            <span>Here are the latest insights and inventory metrics from your property catalog.</span>
            <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">•</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-zinc-400 dark:text-zinc-500 font-semibold">
              <CalendarBlank size={13} weight="bold" />
              {todayLabel}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Custom Time Range Selector */}
          <CustomDropdown<TimeRange>
            value={timeRange}
            onChange={setTimeRange}
            options={TIME_RANGE_OPTIONS}
            size="sm"
            align="right"
          />

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => {
              load()
              loadRecentLogs()
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <ArrowClockwise
              size={14}
              weight="bold"
              className={loading ? 'animate-spin text-[#0066cc]' : 'text-zinc-500'}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Primary Action */}
          <Link
            href="/admin/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0066cc] hover:bg-[#0055b3] rounded-xl shadow-xs transition-all active:scale-[0.98]"
          >
            <Plus size={14} weight="bold" />
            <span>Add Property</span>
          </Link>
        </div>
      </div>

      {/* ── KPI Metric Grid (Zero-CLS Architecture) ────────────────────────── */}
      {loading ? (
        <MetricCardSkeleton />
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Card 1: Total Properties (Hero Anchor) */}
          {/* Card 1: Total Properties (Hero Anchor) */}
          <MetricCard
            title="Total Properties"
            value={stats.total}
            isHero
            sparkline="blue"
            sparklineData={[24, 28, 26, 32, 30, 36, 40, stats.total || 44]}
            subBadge={timeRange === 'all' ? '100% Catalog Live' : `${timeRange.toUpperCase()} Range`}
            subBadgeVariant="emerald"
            icon={Buildings}
            iconBgClass="bg-blue-50 dark:bg-blue-950/60"
            iconColorClass="text-[#0066cc] dark:text-blue-400"
            href="/admin/projects"
            tooltip={
              <AdminInfoTooltip
                title="Total Properties"
                description="Total active property listings in the database catalog."
                details={['Covers Ready to Move, Under Construction & New Launch']}
                whyItMatters="Defines total inventory available for AI recommendations."
              />
            }
          />

          {/* Card 2: Partner Builders */}
          <MetricCard
            title="Partner Builders"
            value={stats.builders}
            sparkline="emerald"
            sparklineData={[6, 9, 11, 10, 14, 15, 17, stats.builders || 18]}
            subBadge="Verified Partners"
            subBadgeVariant="violet"
            icon={UsersThree}
            iconBgClass="bg-violet-50 dark:bg-violet-950/60"
            iconColorClass="text-violet-600 dark:text-violet-400"
            href="/admin/builders"
            tooltip={
              <AdminInfoTooltip
                title="Partner Builders"
                description="Verified real estate developers registered on the platform."
                whyItMatters="Tracks builder partnership depth and portfolio coverage."
              />
            }
          />

          {/* Card 3: Ready to Move */}
          <MetricCard
            title="Ready To Move"
            value={stats.ready}
            sparkline="emerald"
            sparklineData={[10, 12, 11, 15, 14, 18, 19, stats.ready || 20]}
            subBadge={`${stats.total ? Math.round((stats.ready / stats.total) * 100) : 0}% of Total`}
            subBadgeVariant="emerald"
            icon={CheckCircle}
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/60"
            iconColorClass="text-emerald-600 dark:text-emerald-400"
            href="/admin/projects?status=ready_to_move"
            tooltip={
              <AdminInfoTooltip
                title="Ready To Move"
                description="Listings with possession certificates available immediately."
                whyItMatters="Measures supply of zero-possession-risk inventory."
              />
            }
          />

          {/* Card 4: Data Alerts */}
          <MetricCard
            title="Data Alerts"
            value={stats.no_image + stats.no_rera}
            sparkline={stats.no_image + stats.no_rera > 0 ? 'amber' : 'emerald'}
            sparklineData={[8, 10, 7, 6, 5, 4, 3, stats.no_image + stats.no_rera || 1]}
            warning={stats.no_image > 0 || stats.no_rera > 0}
            subBadge={
              stats.no_image > 0 && stats.no_rera > 0
                ? 'Images & RERA'
                : stats.no_image > 0
                ? 'Images missing'
                : stats.no_rera > 0
                ? 'RERA missing'
                : 'All verified'
            }
            subBadgeVariant={stats.no_image > 0 || stats.no_rera > 0 ? 'amber' : 'zinc'}
            icon={WarningCircle}
            iconBgClass={
              stats.no_image > 0 || stats.no_rera > 0
                ? 'bg-amber-50 dark:bg-amber-950/60'
                : 'bg-zinc-100 dark:bg-zinc-800'
            }
            iconColorClass={
              stats.no_image > 0 || stats.no_rera > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-zinc-500'
            }
            href={stats.no_image > 0 ? '/admin/projects?issue=no_image' : '/admin/projects?issue=no_rera'}
            tooltip={
              <AdminInfoTooltip
                title="Data Quality Alerts"
                description="Listings needing attention (missing photos or RERA numbers). Click to view filtered listings."
                details={[
                  'Missing Images: Projects lacking cover photos',
                  'Missing RERA: Projects awaiting RERA verification',
                ]}
                whyItMatters="Helps maintain high data quality and buyer trust."
              />
            }
          />
        </div>
      ) : null}

      {/* ── Charts Row (Bento Layout with Dedicated Skeletons) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Top Builders */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-5 md:p-6 border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center">
                Top Builders Portfolio
                <AdminInfoTooltip
                  title="Top Builders Portfolio"
                  description="Developers ranked by total active project listings."
                  whyItMatters="Reveals developer portfolio distribution across the catalog."
                />
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                Active project distribution across leading developers.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
              Top 6 Groups
            </span>
          </div>

          <div className="h-[300px] w-full">
            {stats && mounted && !loading ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.topBuilders}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f4f4f5"
                    className="dark:opacity-10"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 11, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 11, fontWeight: 500 }}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(0, 102, 204, 0.05)', radius: 8 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 text-white px-3.5 py-2.5 rounded-xl shadow-2xl z-50">
                            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                              {data.fullName || data.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
                              <p className="text-xs font-semibold text-white">
                                {payload[0].value}{' '}
                                <span className="text-xs text-zinc-400 font-normal">
                                  Active Projects
                                </span>
                              </p>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar
                    dataKey="projects"
                    fill="#0066cc"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              /* Dedicated Bar Chart Skeleton (Zero CLS) */
              <div className="w-full h-full flex items-end justify-between gap-4 pb-8 px-4 animate-pulse">
                {[40, 70, 55, 85, 50, 65].map((h, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full max-w-[48px] bg-zinc-100 dark:bg-zinc-800 rounded-t-lg transition-all"
                      style={{ height: `${h}%` }}
                    />
                    <div className="w-12 h-3 bg-zinc-100 dark:bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart: Inventory Distribution */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 md:p-6 border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center">
              Inventory Distribution
              <AdminInfoTooltip
                title="Inventory Distribution"
                description="Catalog breakdown by project construction stage."
                details={[
                  'Green: Ready to Move',
                  'Amber: Under Construction',
                  'Blue: New Launch',
                ]}
                whyItMatters="Ensures balanced supply across ready vs upcoming properties."
              />
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
              Breakdown by project construction status.
            </p>
          </div>

          <div className="relative h-[220px] w-full my-2 flex items-center justify-center">
            {stats && mounted && !loading ? (
              <>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">
                    {stats.total}
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mt-1">
                    Projects
                  </span>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={88}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={6}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-zinc-900 border border-zinc-800 text-white px-3 py-2 rounded-xl shadow-xl flex items-center gap-2 z-50">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: data.color }}
                              />
                              <div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                  {data.name}
                                </p>
                                <p className="text-xs font-bold text-white">
                                  {data.value} projects ({data.pct}%)
                                </p>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </>
            ) : (
              /* Dedicated Donut Skeleton (Zero CLS) */
              <div className="relative w-44 h-44 rounded-full border-[18px] border-zinc-100 dark:border-zinc-800 flex items-center justify-center animate-pulse">
                <div className="w-16 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</span>
                  <span className="text-[11px] text-zinc-400 font-medium">({item.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Quick Tasks & Segmented Operations Console ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 md:p-6 border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Quick Administrative Tasks
              </h2>
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg">
                Actions
              </span>
            </div>

            <div className="space-y-3">
              <Link
                href="/admin/projects/new"
                className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 hover:border-[#0066cc]/50 dark:hover:border-blue-500/50 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all group cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                    <Plus size={18} weight="bold" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      Create Project Record
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Add property metadata, pricing, units & specifications
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  weight="bold"
                  className="text-zinc-400 group-hover:text-[#0066cc] group-hover:translate-x-0.5 transition-all"
                />
              </Link>

              {stats && stats.no_image > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 shadow-2xs flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      <ImageBroken size={18} weight="duotone" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-amber-950 dark:text-amber-200">
                        {stats.no_image} Projects Missing Images
                      </h4>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                        Projects lack high-resolution hero cover photos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/admin/projects?issue=no_image"
                      className="px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100/90 hover:bg-amber-200/90 dark:bg-amber-900/50 dark:hover:bg-amber-900/80 border border-amber-300/80 dark:border-amber-700/80 rounded-lg shadow-2xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                    >
                      <span>Review</span>
                      <ArrowRight size={10} weight="bold" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('npm run db:seed-images')}
                      className="p-1.5 text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/40 rounded-lg transition-colors cursor-pointer"
                      title="Copy CLI command: npm run db:seed-images"
                    >
                      {copiedCmd === 'npm run db:seed-images' ? (
                        <Check size={12} weight="bold" className="text-emerald-600" />
                      ) : (
                        <Copy size={12} weight="bold" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {stats && stats.no_rera > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-violet-50/40 dark:bg-violet-950/20 border border-violet-200/80 dark:border-violet-800/60 shadow-2xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 shadow-2xs flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                      <ShieldSlash size={18} weight="duotone" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-violet-950 dark:text-violet-200">
                        {stats.no_rera} Missing RERA Numbers
                      </h4>
                      <p className="text-[11px] text-violet-700/80 dark:text-violet-400/80 mt-0.5">
                        Awaiting UP RERA compliance verification
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/admin/projects?issue=no_rera"
                      className="px-2.5 py-1 text-[11px] font-semibold text-violet-900 dark:text-violet-200 bg-violet-100/90 hover:bg-violet-200/90 dark:bg-violet-900/50 dark:hover:bg-violet-900/80 border border-violet-300/80 dark:border-violet-700/80 rounded-lg shadow-2xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                    >
                      <span>Review</span>
                      <ArrowRight size={10} weight="bold" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('npm run db:enrich-ai')}
                      className="p-1.5 text-violet-700 dark:text-violet-300 hover:bg-violet-200/50 dark:hover:bg-violet-900/40 rounded-lg transition-colors cursor-pointer"
                      title="Copy CLI command: npm run db:enrich-ai"
                    >
                      {copiedCmd === 'npm run db:enrich-ai' ? (
                        <Check size={12} weight="bold" className="text-emerald-600" />
                      ) : (
                        <Copy size={12} weight="bold" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Segmented Operations Console: Live Activity vs Developer CLI ── */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between overflow-hidden">
          {/* Header with Segmented Switcher */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/30">
            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 bg-zinc-200/70 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setBottomPaneTab('activity')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                    bottomPaneTab === 'activity'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium'
                  }`}
                >
                  <Activity size={13} className={bottomPaneTab === 'activity' ? 'text-[#0066cc]' : ''} />
                  <span>Recent Activity</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBottomPaneTab('cli')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                    bottomPaneTab === 'cli'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium'
                  }`}
                >
                  <TerminalWindow size={13} className={bottomPaneTab === 'cli' ? 'text-[#0066cc]' : ''} />
                  <span>CLI Tools</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {bottomPaneTab === 'activity' && (
                <button
                  type="button"
                  onClick={() => loadRecentLogs()}
                  disabled={logsLoading}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  title="Refresh activity logs"
                >
                  <ArrowClockwise size={13} className={logsLoading ? 'animate-spin text-[#0066cc]' : ''} />
                </button>
              )}
              <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                {bottomPaneTab === 'activity' ? `${recentLogs.length} Events` : 'propfyndr-server'}
              </span>
            </div>
          </div>

          {/* Tab 1: Live Catalog Audit Stream */}
          {bottomPaneTab === 'activity' && (
            <div className="p-4 md:p-5 flex-1 flex flex-col justify-between">
              {/* Activity Sub-Filter Pills */}
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleFilterChange('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activityFilter === 'all'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs font-semibold'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    All ({counts.all})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFilterChange('demand')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      activityFilter === 'demand'
                        ? 'bg-amber-600 text-white shadow-2xs font-semibold'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Demand Signals ({counts.demand})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFilterChange('catalog')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      activityFilter === 'catalog'
                        ? 'bg-[#0066cc] text-white shadow-2xs font-semibold'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>Catalog & Admin ({counts.catalog})</span>
                  </button>
                </div>
              </div>

              {/* Kravio Search Activities Bar & Counter */}
              <div className="relative mb-2.5">
                <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={activitySearchQuery}
                  onChange={(e) => setActivitySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-zinc-100/70 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
                <span>{filteredLogs.length} updates recorded</span>
                <span className="text-[10px] text-zinc-400 font-normal">Live Activity Feed</span>
              </div>

              {logsLoading ? (
                <div className="space-y-3 py-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {activitySearchQuery
                      ? 'No matching activities found'
                      : activityFilter === 'demand'
                      ? 'No buyer search gaps detected'
                      : activityFilter === 'catalog'
                      ? 'No catalog updates recorded'
                      : 'No recent events recorded'}
                  </p>
                  <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                    {activitySearchQuery
                      ? 'Try adjusting your search query or clear the filter.'
                      : activityFilter === 'demand'
                      ? 'Whenever a buyer inquires about a sector with no catalog inventory, it surfaces here.'
                      : 'Real-time project modifications and team audit logs will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredLogs.slice(0, 5).map((log) => {
                    const isSectorGap =
                      log.entity_type === 'sector_gap' ||
                      log.action === 'SECTOR_NOT_COVERED' ||
                      log.entity_type === 'coverage_gap'
                    const isProject =
                      log.entity_type === 'project' && log.entity_id && log.entity_id !== 'anonymous'
                    const sectorName =
                      log.entity_name || (log.changes as any)?.sector || 'Unlisted Sector'

                    return (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/60 transition-all space-y-1.5 group"
                      >
                        {/* Top Line: Badges + Entity Title + Relative Time */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {getActionChip(log)}
                            {getActorBadge(log)}
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {isSectorGap ? sectorName : log.entity_name || log.entity_type}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-mono shrink-0">
                            <Clock size={11} />
                            <span>{formatRelativeTime(log.created_at)}</span>
                          </div>
                        </div>

                        {/* Bottom Line: Clean Explanatory Text + Action CTA */}
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <p className="text-zinc-500 dark:text-zinc-400 text-[11.5px] leading-relaxed line-clamp-1">
                            {isSectorGap
                              ? `Buyer searched for ${sectorName} — catalog has no active inventory here.`
                              : log.summary}
                          </p>

                          {isSectorGap ? (
                            <Link
                              href={`/admin/projects/new?sector=${encodeURIComponent(sectorName)}`}
                              className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline shrink-0 inline-flex items-center gap-1 transition-colors"
                            >
                              <span>+ Add Project</span>
                              <ArrowRight size={10} weight="bold" />
                            </Link>
                          ) : isProject ? (
                            <Link
                              href={`/admin/projects/${log.entity_id}`}
                              className="text-[11px] font-semibold text-[#0066cc] dark:text-blue-400 hover:underline shrink-0 inline-flex items-center gap-1 transition-colors"
                            >
                              <span>Edit</span>
                              <ArrowRight size={10} weight="bold" />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0066cc]" />
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Live operational & demand audit trail</span>
                </div>
                <Link
                  href="/admin/projects"
                  className="text-xs font-semibold text-[#0066cc] hover:text-[#0055b3] dark:text-blue-400 hover:underline flex items-center gap-1 transition-colors"
                >
                  <span>Explore Catalog</span>
                  <ArrowRight size={11} weight="bold" />
                </Link>
              </div>
            </div>
          )}

          {/* Tab 2: Developer CLI Console */}
          {bottomPaneTab === 'cli' && (
            <div className="bg-zinc-950 p-4 space-y-2 text-xs font-mono text-zinc-300 overflow-x-auto selection:bg-[#0066cc] selection:text-white flex-1">
              {[
                { cmd: 'npm run db:seed-images', desc: 'Upload property hero/gallery assets to Supabase' },
                { cmd: 'npm run db:enrich-ai', desc: 'Auto-fill missing decision profiles & completeness' },
                { cmd: 'npm run db:fix-statuses', desc: 'Sync construction status & delivery timelines' },
                { cmd: 'npm run db:re-embed', desc: 'Refresh semantic AI vector search embeddings' },
                { cmd: 'npm run db:studio', desc: 'Launch Prisma Studio database GUI' },
              ].map(({ cmd, desc }) => (
                <div
                  key={cmd}
                  className="flex items-center justify-between group py-1 border-b border-zinc-900/80 hover:bg-zinc-900/50 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">$</span>
                    <span className="text-zinc-100 font-semibold">{cmd}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10.5px] text-zinc-500 hidden sm:inline"># {desc}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(cmd)}
                      className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors opacity-60 group-hover:opacity-100 cursor-pointer active:scale-90"
                      title="Copy command"
                    >
                      {copiedCmd === cmd ? (
                        <Check size={12} weight="bold" className="text-emerald-400" />
                      ) : (
                        <Copy size={12} weight="bold" />
                      )}
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-2 px-2">
                <span className="text-emerald-500 font-bold">$</span>
                <div className="w-2 h-3.5 bg-[#0066cc] animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
