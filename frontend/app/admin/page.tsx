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
} from '@phosphor-icons/react'
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

interface Stats {
  total: number
  ready: number
  under_construction: number
  new_launch: number
  no_image: number
  no_rera: number
  builders: number
  topBuilders: { name: string; projects: number }[]
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

  useEffect(() => {
    load()
  }, [load])

  // Filter projects based on selected TimeRange
  const filteredProjects = useMemo(() => {
    if (timeRange === 'all') return allProjects

    const now = Date.now()
    const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365
    const cutoff = now - days * 24 * 60 * 60 * 1000

    return allProjects.filter((p: any) => {
      const timestamp = p.created_at || p.updated_at
      if (!timestamp) return true // Keep if date is not tracked
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
    projects.forEach((p: any) => {
      if (p.builder?.name) {
        builderCounts[p.builder.name] = (builderCounts[p.builder.name] ?? 0) + 1
      }
    })

    const topBuilders = (Object.entries(builderCounts) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        name: name.length > 14 ? name.substring(0, 14) + '...' : name,
        projects: Number(count),
      }))

    return {
      total: totalCount,
      ready: projects.filter((p: any) => p.status === 'ready_to_move').length,
      under_construction: projects.filter((p: any) => p.status === 'under_construction').length,
      new_launch: projects.filter((p: any) => p.status === 'new_launch').length,
      no_image: projects.filter((p: any) => !p.hero_image_url).length,
      no_rera: projects.filter((p: any) => !p.rera_number).length,
      builders: new Set(projects.map((p: any) => p.builder?.id).filter(Boolean)).size,
      topBuilders,
    }
  }, [filteredProjects, mounted, loading])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(text)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const pieData = useMemo(() => {
    if (!stats) return []
    return [
      {
        name: 'Ready to Move',
        value: stats.ready,
        color: '#10B981',
        pct: stats.total ? Math.round((stats.ready / stats.total) * 100) : 0,
      },
      {
        name: 'Under Construction',
        value: stats.under_construction,
        color: '#F59E0B',
        pct: stats.total ? Math.round((stats.under_construction / stats.total) * 100) : 0,
      },
      {
        name: 'New Launch',
        value: stats.new_launch,
        color: '#3B82F6',
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

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 p-4 md:p-8">
      {/* ── Page Sub-Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              Dashboard Overview
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 rounded-full shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>System Healthy</span>
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium flex items-center gap-2">
            <span>Real-time catalog metrics, inventory health, and database tasks.</span>
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
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <ArrowClockwise
              size={14}
              weight="bold"
              className={loading ? 'animate-spin text-blue-500' : 'text-zinc-500'}
            />
            <span className="hidden sm:inline">Refresh Metrics</span>
          </button>

          {/* Primary Action */}
          <Link
            href="/admin/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-xl shadow-2xs transition-all active:scale-[0.98]"
          >
            <Plus size={15} weight="bold" />
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
          <MetricCard
            title="Total Properties"
            value={stats.total}
            isHero
            subBadge={timeRange === 'all' ? '100% Catalog Live' : `${timeRange.toUpperCase()} Range`}
            subBadgeVariant="emerald"
            icon={Buildings}
            iconBgClass="bg-blue-50 dark:bg-blue-950/60"
            iconColorClass="text-blue-600 dark:text-blue-400"
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
            subBadge={`${stats.total ? Math.round((stats.ready / stats.total) * 100) : 0}% of Total`}
            subBadgeVariant="emerald"
            icon={CheckCircle}
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/60"
            iconColorClass="text-emerald-600 dark:text-emerald-400"
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
            href="/admin/projects"
            tooltip={
              <AdminInfoTooltip
                title="Data Quality Alerts"
                description="Listings needing attention (missing photos or RERA numbers)."
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
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-5 md:p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center">
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
                  <defs>
                    <linearGradient id="builderGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
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
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 11, fontWeight: 600 }}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(59, 130, 246, 0.08)', radius: 8 }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 text-white px-3.5 py-2.5 rounded-xl shadow-2xl z-50">
                            <p className="text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                              {label}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <p className="text-sm font-bold text-white">
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
                    fill="url(#builderGradient)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 md:p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center">
              Inventory Distribution
              <AdminInfoTooltip
                title="Inventory Distribution"
                description="Catalog breakdown by project construction stage."
                details={[
                  'Green: Ready to Move',
                  'Yellow: Under Construction',
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
                  <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">
                    {stats.total}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                    Total Units
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

          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{item.value}</span>
                  <span className="text-[11px] text-zinc-400 font-medium">({item.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Quick Tasks & Developer CLI Console ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 md:p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              Quick Administrative Tasks
            </h2>

            <div className="space-y-3">
              <Link
                href="/admin/projects/new"
                className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 hover:border-blue-400/60 dark:hover:border-blue-500/60 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Plus size={18} weight="bold" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      Create Project Record
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Add property metadata, pricing & images
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={15}
                  weight="bold"
                  className="text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"
                />
              </Link>

              {stats && stats.no_image > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 shadow-2xs flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <ImageBroken size={18} weight="duotone" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200">
                        {stats.no_image} Projects Missing Images
                      </h4>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-mono mt-0.5">
                        npm run db:seed-images
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('npm run db:seed-images')}
                    className="px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 rounded-lg shadow-2xs hover:bg-amber-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    {copiedCmd === 'npm run db:seed-images' ? (
                      <Check size={12} weight="bold" className="text-emerald-600" />
                    ) : (
                      <Copy size={12} weight="bold" />
                    )}
                    <span>{copiedCmd === 'npm run db:seed-images' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}

              {stats && stats.no_rera > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-800/60">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 shadow-2xs flex items-center justify-center text-violet-600 dark:text-violet-400">
                      <ShieldSlash size={18} weight="duotone" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-violet-900 dark:text-violet-200">
                        {stats.no_rera} Missing RERA Registrations
                      </h4>
                      <p className="text-[11px] text-violet-700 dark:text-violet-400 font-mono mt-0.5">
                        npm run db:enrich-ai
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('npm run db:enrich-ai')}
                    className="px-2.5 py-1 text-[11px] font-semibold text-violet-800 dark:text-violet-300 bg-white dark:bg-zinc-800 border border-violet-300 dark:border-violet-700 rounded-lg shadow-2xs hover:bg-violet-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    {copiedCmd === 'npm run db:enrich-ai' ? (
                      <Check size={12} weight="bold" className="text-emerald-600" />
                    ) : (
                      <Copy size={12} weight="bold" />
                    )}
                    <span>{copiedCmd === 'npm run db:enrich-ai' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Server Command Console */}
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col font-mono">
          {/* macOS window titlebar */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/90 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-xs font-semibold text-zinc-400 ml-2 font-sans flex items-center gap-1.5">
                <TerminalWindow size={14} weight="duotone" className="text-zinc-500" />
                <span>bash — propfyndr-server</span>
              </span>
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              CLI Helper
            </span>
          </div>

          <div className="p-4 space-y-2.5 text-xs text-zinc-300 overflow-x-auto selection:bg-blue-600 selection:text-white">
            {[
              {
                cmd: 'npm run db:seed-images',
                desc: 'Upload property hero/gallery assets to Supabase',
              },
              {
                cmd: 'npm run db:enrich-ai',
                desc: 'Auto-fill missing decision profiles & completeness',
              },
              {
                cmd: 'npm run db:fix-statuses',
                desc: 'Sync construction status & delivery timelines',
              },
              {
                cmd: 'npm run db:re-embed',
                desc: 'Refresh semantic AI vector search embeddings',
              },
              {
                cmd: 'npm run db:studio',
                desc: 'Launch Prisma Studio database GUI',
              },
            ].map(({ cmd, desc }) => (
              <div
                key={cmd}
                className="flex items-center justify-between group py-1 border-b border-zinc-900/80 hover:bg-zinc-900/50 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-emerald-500 font-bold">$</span>
                  <span className="text-zinc-100 font-semibold">{cmd}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-500 hidden sm:inline"># {desc}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(cmd)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors opacity-60 group-hover:opacity-100 cursor-pointer active:scale-90"
                    title="Copy command"
                  >
                    {copiedCmd === cmd ? (
                      <Check size={13} weight="bold" className="text-emerald-400" />
                    ) : (
                      <Copy size={13} weight="bold" />
                    )}
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 pt-2 px-2">
              <span className="text-emerald-500 font-bold">$</span>
              <div className="w-2 h-4 bg-blue-500 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
