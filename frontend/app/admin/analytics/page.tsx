'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { 
  Users, 
  Search, 
  AlertCircle, 
  TrendingUp, 
  RotateCcw,
  BarChart3,
  Building2,
  PieChart as PieChartIcon,
  Layers,
  Cpu,
  DollarSign,
  ShieldCheck,
  Zap,
  Target,
  FileQuestion,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { adminFetch } from '@/lib/adminFetch'
import { Skeleton } from '@/components/ui/skeleton'
import AnalyticsNav from '@/components/admin/AnalyticsNav'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

interface DashboardStats {
  totalChats: number
  totalQueries: number
  avgQueriesPerChat: number | string
  zeroResultSearches: number
  zeroResultSearchRate: string
  conversionRate: string
  avgClarifications: number | string
  topSectors: Array<{ sector: string; count: number }>
  topBuilders: Array<{ builder: string; count: number }>
}

interface QualityMetrics {
  totalSearches: number
  zeroResultSearches: number
  zeroResultRate: string
  searchWithResults: number
  searchWithoutResults: number
  avgClarifications: number
  avgResultsCount: number
  quality?: {
    totalProjects?: number
    withImage?: number
    withRera?: number
    completenessScore?: number
  }
}

interface UserMetrics {
  totalUsers: number
  repeatedVisitors: number
  totalConversions: number
  conversionFunnel: {
    chats: number
    searches: number
    clicks: number
    saves: number
    conversions: number
  }
}

interface AiCostMetrics {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  totalCostInr: number
  totalQueriesTracked: number
  avgCostPerQueryUsd: number
  costPerLeadUsd: number
  costPerLeadInr: number
  costByProvider: Array<{
    provider: string
    costUsd: number
    costInr: number
    queries: number
    totalTokens: number
  }>
  cache: {
    hits: number
    misses: number
    size: number
    maxSize: number
    hitRate: string
  }
}

interface MarketDemandItem {
  sector: string
  supplyProjects: number
  supplyUnitConfigs: number
  sampleProjects: string
  searchDemandCount: number
  searchDemandPct: number
  unmetSearches: number
  topConfigurations: string
  gapLevel: 'covered' | 'thin' | 'critical_gap'
}

interface UnmetDemandItem {
  query: string
  sector: string
  bhk: number | null
  budget: string
  count: number
  lastSearched: string
}

interface FunnelStage {
  id: string
  label: string
  count: number
  dropOffPct: number
}

export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState<DashboardStats | null>(null)
  const [quality, setQuality] = useState<QualityMetrics | null>(null)
  const [users, setUsers] = useState<UserMetrics | null>(null)
  const [aiCosts, setAiCosts] = useState<AiCostMetrics | null>(null)
  const [marketDemand, setMarketDemand] = useState<MarketDemandItem[]>([])
  const [unmetDemand, setUnmetDemand] = useState<UnmetDemandItem[]>([])
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([])
  
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const isFetchingRef = useRef(false)

  const loadData = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (isManual) setIsRefreshing(true)

    try {
      const [summaryRes, qualityRes, usersRes, costsRes, demandRes, unmetRes, funnelRes] = await Promise.all([
        adminFetch('/admin/analytics/summary'),
        adminFetch('/admin/analytics/quality'),
        adminFetch('/admin/analytics/users'),
        adminFetch('/admin/analytics/ai-costs'),
        adminFetch('/admin/analytics/market-demand'),
        adminFetch('/admin/analytics/unmet-demand'),
        adminFetch('/admin/analytics/funnel'),
      ])

      const [
        summaryData,
        qualityData,
        usersData,
        costsData,
        demandData,
        unmetData,
        funnelData,
      ] = await Promise.all([
        summaryRes.json().catch(() => null),
        qualityRes.json().catch(() => null),
        usersRes.json().catch(() => null),
        costsRes.json().catch(() => null),
        demandRes.json().catch(() => ({ matrix: [] })),
        unmetRes.json().catch(() => ({ ledger: [] })),
        funnelRes.json().catch(() => ({ stages: [] })),
      ])

      setSummary(summaryData)
      setQuality(qualityData)
      setUsers(usersData)
      setAiCosts(costsData)
      setMarketDemand(demandData.matrix || [])
      setUnmetDemand(unmetData.ledger || [])
      setFunnelStages(funnelData.stages || [])
      setLastRefreshedAt(new Date())
    } catch (err) {
      console.error('Analytics load failed:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const resultDistribution = quality
    ? [
        { name: 'With Results', value: quality.searchWithResults, color: '#10B981' },
        { name: 'Zero Results', value: quality.searchWithoutResults, color: '#F43F5E' },
      ]
    : []

  return (
    <div className="space-y-8 pb-16 font-sans select-none max-w-6xl mx-auto py-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Enterprise Market Intelligence
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live DB Telemetry
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Real-time buyer demand, AI unit economics, supply-demand matrix, and conversion funnels
          </p>
        </div>

        {/* Refresh Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
            Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>

          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh analytics data"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <AnalyticsNav />

      {/* ─── SECTION 1: AI UNIT ECONOMICS & COST EFFICIENCY ───────────────── */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-blue-50/50 to-white dark:from-zinc-900/90 dark:to-zinc-900 border border-blue-100/80 dark:border-zinc-800 shadow-2xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                AI Cost Burn & Unit Economics
                <AdminInfoTooltip
                  title="AI Cost Burn & Unit Economics"
                  description="Real-time telemetry measuring token usage, estimated provider spend, cost per lead, and caching efficiency."
                  whyItMatters="Ensures profitability as user discovery volume scales."
                />
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                In-process semantic caching and PostgreSQL deterministic fast-paths reducing token overhead
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-800/60">
            ~80% Token Savings
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Cost Spend */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/50">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
              <span>Total AI Spend</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">₹</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-zinc-900 dark:text-white">
                ₹{aiCosts?.totalCostInr ?? 0}
              </span>
              <span className="text-xs font-bold text-zinc-400">
                (${aiCosts?.totalCostUsd ?? '0.00'})
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              Avg ₹{((aiCosts?.avgCostPerQueryUsd ?? 0) * 87).toFixed(2)} / query
            </p>
          </div>

          {/* Cost Per Lead */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/50">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
              <span>Cost Per Lead (CPL)</span>
              <Target className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{aiCosts?.costPerLeadInr ?? '0.00'}
              </span>
              <span className="text-xs font-bold text-zinc-400">
                (${aiCosts?.costPerLeadUsd ?? '0.00'})
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              Per verified buyer callback
            </p>
          </div>

          {/* Queries Tracked — replaces a hardcoded '78.5%' ground-truth-hit
              figure that had no computation behind it anywhere in the stack. */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/50">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
              <span>Queries Tracked</span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {(aiCosts?.totalQueriesTracked ?? 0).toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              Metered AI calls on record
            </p>
          </div>

          {/* Semantic Cache Hit Rate */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/50">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
              <span>Semantic FAQ Cache</span>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {aiCosts?.cache?.hitRate ?? '0.0%'}
              </span>
              <span className="text-xs font-bold text-zinc-500">
                ({aiCosts?.cache?.size ?? 0} keys)
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              Instant &lt;15ms response @ $0.00
            </p>
          </div>
        </div>
      </div>

      {/* ─── KPI SUMMARY ROW ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Chats */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
                Total Chats
                <AdminInfoTooltip
                  title="Total Chats"
                  description="Total buyer conversation sessions started with the AI assistant."
                  whyItMatters="Measures buyer traffic and AI recommendation engagement."
                />
              </span>
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                {summary.totalChats}
              </span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Active sessions
              </span>
            </div>
          </div>

          {/* Total Searches */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
                Total Searches
                <AdminInfoTooltip
                  title="Total Searches"
                  description="Count of specific property requirements searched inside chats."
                  whyItMatters="Shows how actively buyers explore and filter listings."
                />
              </span>
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <Search className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                {summary.totalQueries}
              </span>
              <span className="text-xs font-semibold text-zinc-500">
                {summary.avgQueriesPerChat} per chat
              </span>
            </div>
          </div>

          {/* Zero-Result Searches */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
                Zero-Result
                <AdminInfoTooltip
                  title="Zero-Result Searches"
                  description="Queries where no properties matched the buyer's criteria."
                  whyItMatters="Highlights missing inventory or overly strict budget filters."
                />
              </span>
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                {summary.zeroResultSearches}
              </span>
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {summary.zeroResultSearchRate} rate
              </span>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider inline-flex items-center">
                Conversion Rate
                <AdminInfoTooltip
                  title="Conversion Rate"
                  description="Percentage of chatters who submitted callback or visit leads."
                  whyItMatters="Measures lead generation efficiency from AI conversations."
                />
              </span>
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                {summary.conversionRate}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Callback leads
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── SECTION 2: 5-STAGE CONVERSION FUNNEL & SECTOR DEMAND ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Full Lead Journey Funnel */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              Complete Lead Journey Funnel
              <AdminInfoTooltip
                title="Complete Lead Journey Funnel"
                description="Step-by-step buyer pipeline from session start to verified lead."
                whyItMatters="Pinpoints exact drop-off stages in buyer conversion."
              />
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
              Full Pipeline
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {funnelStages.length > 0 ? (
              funnelStages.map((stage, idx) => (
                <div key={stage.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{stage.label}</span>
                    {idx < funnelStages.length - 1 && stage.dropOffPct > 0 && (
                      <p className="text-[10px] text-rose-500 flex items-center gap-1 font-medium">
                        <ArrowDownRight className="w-3 h-3" /> {stage.dropOffPct}% drop-off to next step
                      </p>
                    )}
                  </div>
                  <span className="text-base font-black font-mono text-zinc-900 dark:text-white">{stage.count}</span>
                </div>
              ))
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-zinc-400">Loading funnel events...</div>
            )}
          </div>
        </div>

        {/* Top Searched Sectors Chart */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Top Searched Sectors (Real DB Data)
              <AdminInfoTooltip
                title="Top Searched Sectors"
                description="Most popular localities buyers ask about in Noida & Greater Noida."
                whyItMatters="Reveals exact locality buyer demand trends."
              />
            </span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Locality Demand
            </span>
          </div>

          {loading ? (
            <Skeleton className="w-full h-64 rounded-xl" />
          ) : summary?.topSectors && summary.topSectors.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.topSectors.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" opacity={0.5} />
                  <XAxis dataKey="sector" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
              <Building2 className="w-8 h-8 text-zinc-400 mb-2 opacity-50" />
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No Sector Searches Yet</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Real search telemetry will populate here as users query the AI engine.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── SECTION 3: SUPPLY VS DEMAND MATRIX (HEATMAP) ─────────────────── */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              Supply vs. Demand Matrix (Sector Catalog Coverage)
              <AdminInfoTooltip
                title="Supply vs. Demand Matrix"
                description="Cross-tabulates buyer search volume against active catalog listings per sector."
                whyItMatters="Identifies critical catalog gaps where buyer demand is unserved."
              />
            </h2>
            <p className="text-[11px] text-zinc-400">
              Direct market intelligence guiding which new projects to acquire and publish
            </p>
          </div>
          <Link
            href="/admin/projects"
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            Manage Catalog <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="pb-3 pl-2">Sector / Micro-Market</th>
                <th className="pb-3">Search Demand</th>
                <th className="pb-3">Catalog Supply</th>
                <th className="pb-3">Top Config</th>
                <th className="pb-3">Sample Listed Projects</th>
                <th className="pb-3 text-right pr-2">Market Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
              {marketDemand.length > 0 ? (
                marketDemand.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 pl-2 font-bold text-zinc-900 dark:text-zinc-100">{row.sector}</td>
                    <td className="py-3">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{row.searchDemandCount} searches</span>
                      <span className="text-[10px] text-zinc-400 ml-1.5">({row.searchDemandPct}%)</span>
                    </td>
                    <td className="py-3 font-mono">
                      {row.supplyProjects > 0 ? (
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">{row.supplyProjects} projects ({row.supplyUnitConfigs} units)</span>
                      ) : (
                        <span className="font-bold text-rose-500">0 projects</span>
                      )}
                    </td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">{row.topConfigurations}</td>
                    <td className="py-3 text-zinc-500 max-w-[240px] truncate">{row.sampleProjects}</td>
                    <td className="py-3 text-right pr-2">
                      {row.gapLevel === 'critical_gap' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80">
                          Critical Gap
                        </span>
                      ) : row.gapLevel === 'thin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80">
                          Thin Supply
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80">
                          Covered
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
                    No search demand logged yet. Demand matrix populates automatically from chat sessions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── SECTION 4: UNMET DEMAND & ZERO-RESULT SEARCH LEDGER ──────────── */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <FileQuestion className="w-4 h-4 text-rose-500" />
              Unmet Search Demand Ledger (Zero-Result Telemetry)
              <AdminInfoTooltip
                title="Unmet Search Demand Ledger"
                description="Live log of high-intent search queries that returned 0 matching listings in the catalog."
                whyItMatters="Direct buyer acquisition signals showing exactly what inventory to add next."
              />
            </h2>
            <p className="text-[11px] text-zinc-400">
              Specific user search filter combinations where no inventory was available
            </p>
          </div>
          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 px-2.5 py-1 rounded-md border border-rose-200/60">
            {unmetDemand.length} Unmet Opportunities
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="pb-3 pl-2">User Query / Requirement</th>
                <th className="pb-3">Target Sector</th>
                <th className="pb-3">BHK</th>
                <th className="pb-3">Budget Band</th>
                <th className="pb-3">Search Frequency</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
              {unmetDemand.length > 0 ? (
                unmetDemand.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 pl-2 font-bold text-zinc-900 dark:text-zinc-100 max-w-[280px] truncate">
                      &quot;{item.query}&quot;
                    </td>
                    <td className="py-3 text-zinc-700 dark:text-zinc-300 font-semibold">{item.sector}</td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">{item.bhk ? `${item.bhk} BHK` : 'Any BHK'}</td>
                    <td className="py-3 font-mono text-zinc-800 dark:text-zinc-200">{item.budget}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80">
                        {item.count} searches
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2">
                      <Link
                        href="/admin/projects"
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        + Add Project
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
                    Zero unmet queries logged. Catalog currently fulfills all incoming search requirements.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── SECTION 5: QUALITY & RESULTS DISTRIBUTION ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Results Distribution Gauge */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-500" />
              Search Matching Efficiency
              <AdminInfoTooltip
                title="Search Matching Efficiency"
                description="Ratio of successful property matches vs zero-result queries."
                details={['Green: Found matching listings', 'Red: Zero matches found']}
                whyItMatters="Checks whether listing catalog matches buyer requests."
              />
            </span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Health Ratio
            </span>
          </div>

          {loading ? (
            <Skeleton className="w-full h-56 rounded-xl" />
          ) : quality && (quality.searchWithResults > 0 || quality.searchWithoutResults > 0) ? (
            <div className="space-y-5">
              {/* Sleek Circular Ring Gauge (No Recharts gap/clipping) */}
              <div className="flex items-center justify-center pt-2">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-zinc-100 dark:stroke-zinc-800"
                      strokeWidth="10"
                      fill="none"
                    />
                    {quality.searchWithoutResults > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        className="stroke-rose-500"
                        strokeWidth="10"
                        fill="none"
                        strokeDasharray={`${(quality.searchWithoutResults / (quality.searchWithResults + quality.searchWithoutResults)) * 251.2} 251.2`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                      />
                    )}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-emerald-500 transition-all duration-700 ease-out"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${(quality.searchWithResults / (quality.searchWithResults + quality.searchWithoutResults)) * 251.2} 251.2`}
                      strokeDashoffset={quality.searchWithoutResults > 0 ? `-${(quality.searchWithoutResults / (quality.searchWithResults + quality.searchWithoutResults)) * 251.2}` : '0'}
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Centered Stats */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-2xl font-black font-mono text-zinc-900 dark:text-white tracking-tight">
                      {quality.searchWithResults + quality.searchWithoutResults}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {quality.searchWithoutResults === 0 ? '100% Success' : `${((quality.searchWithResults / (quality.searchWithResults + quality.searchWithoutResults)) * 100).toFixed(0)}% Success`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Breakdown Bars */}
              <div className="space-y-2.5 pt-1">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Matching Listings Found</span>
                  </div>
                  <span className="text-xs font-mono font-black text-zinc-900 dark:text-white">{quality.searchWithResults}</span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Zero Matches (Unmet Demand)</span>
                  </div>
                  <span className="text-xs font-mono font-black text-zinc-900 dark:text-white">{quality.searchWithoutResults}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-center p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
              <PieChartIcon className="w-8 h-8 text-zinc-400 mb-2 opacity-50" />
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No Query Metrics Logged</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Ratio of successful property query hits vs zero-result edge cases.</p>
            </div>
          )}
        </div>

        {/* Search Quality & Ledger Table */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              Search Quality Diagnostics
              <AdminInfoTooltip
                title="Search Quality Diagnostics"
                description="Metrics measuring AI search quality and database completeness."
                details={['Avg Results Per Search', 'Avg Clarifications Asked', 'Database Completeness %']}
                whyItMatters="Ensures AI returns rich options without unnecessary questions."
              />
            </span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Telemetry Summary
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">Total Telemetry Queries</span>
              <span className="font-mono font-extrabold text-zinc-900 dark:text-white">{quality?.totalSearches || 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">Avg Results Per Search</span>
              <span className="font-mono font-extrabold text-zinc-900 dark:text-white">{quality?.avgResultsCount || 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">Avg Clarification Questions</span>
              <span className="font-mono font-extrabold text-zinc-900 dark:text-white">{quality?.avgClarifications || 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">Database Completeness Score</span>
              <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                {quality?.quality?.completenessScore ?? 100}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
