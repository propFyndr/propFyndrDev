'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect from '@/components/admin/CustomSelect'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/portal/ui'
import { formatDistanceToNow } from 'date-fns'
import {
  MessageSquare,
  Users,
  AlertTriangle,
  Coins,
  Search,
  RotateCcw,
  Phone,
  User,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Building2,
  Calendar,
  Wallet,
  MapPin,
  Bot,
  Zap,
  Tag,
  Share2,
  Layers,
  X,
  MessageCircle,
  Compass,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Flame,
  Clock,
  Briefcase,
  Home,
  CheckSquare,
} from 'lucide-react'

export interface UserDossier {
  name: string | null
  phone: string | null
  isRegistered: boolean
  leadTier: string | null
  leadScore: number | null
  aiSummary: string | null
  preferredSector?: string | null
  bhkPreference?: number | null
  budgetMin?: number | null
  budgetMax?: number | null
  memory?: {
    contact_phone: string | null
    bhk_preference: number | null
    budget_min_cr: number | null
    budget_max_cr: number | null
    sector_preference: string | null
    purpose: string | null
    saved_slugs?: string[]
    viewed_slugs?: string[]
  } | null
  otherSessions?: Array<{
    id: string
    turns: number
    phase: string
    lastActiveAt: string
  }>
}

export interface SessionSummary {
  id: string
  identity: { kind: 'user' | 'guest'; id: string | null }
  user?: UserDossier
  openingQuestion: string | null
  latestQuery?: { content: string; at: string } | null
  queryTime?: string
  turns: number
  phase: string
  startedAt: string
  lastActiveAt: string
  durationMs: number
  costUsd: number
  modelCalls: number
  tokens: { in: number; out: number }
  lead: { tier: string | null; at: string; name?: string; phone?: string } | null
  focusProject?: { id: string; name: string; slug: string; sector: string } | null
  summaryLocation?: string | null
}

export interface Turn {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: string
  intent: Record<string, unknown> | null
  chips?: string[]
  cardsShown: Array<{ id: string; name: string; sector: string; price: string | number | null }>
  flaggedCoverageGap: boolean
}

export interface Detail {
  session: {
    id: string
    identity: { kind: string; id: string | null }
    summary_location: string | null
    summary_financial: string | null
    summary_timeline: string | null
    chat_phase?: string
    focusProject?: { id: string; name: string; slug: string; sector: string } | null
  }
  userDossier?: UserDossier
  turns: Turn[]
  lead: {
    name: string
    phone: string
    lead_tier: string | null
    lead_score?: number | null
    ai_summary: string | null
    created_at?: string
  } | null
  cost: { totalUsd: number; calls: Array<{ model: string; endpoint: string; usd: number }> }
}

export interface TopProjectEntity {
  id: string
  name: string
  slug: string
  sector: string
  count: number
}

export interface TopSectorEntity {
  sector: string
  count: number
}

export interface TopQueryItem {
  query: string
  count: number
}

export interface IntelligenceData {
  topProjects: TopProjectEntity[]
  topSectors: TopSectorEntity[]
  topQueries: TopQueryItem[]
  userMetrics: {
    totalEngagedSessions: number
    capturedLeads: number
    leadConversionRate: number
  }
}

const inr = (usd: number) => `₹${(usd * 88).toFixed(2)}`

export default function ConversationsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState(false)
  const [copiedDossierToken, setCopiedDossierToken] = useState<string | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedSector, setSelectedSector] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'all' | 'leads' | 'users' | 'guests'>('all')
  const [sortBy, setSortBy] = useState('recent')

  // Top Entities & Intelligence
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null)
  const [intelligenceLoading, setIntelligenceLoading] = useState(false)
  const [showIntelligence, setShowIntelligence] = useState(true)

  const [serverTotals, setServerTotals] = useState<{ total?: number; totalLeads?: number; totalCostUsd?: number } | null>(null)
  const [tabCounts, setTabCounts] = useState<{ all?: number; leads?: number; users?: number; guests?: number }>({})

  // Dynamic live clock ticker (updates every 15s so relative times never freeze)
  const [currentTime, setCurrentTime] = useState<number>(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  // Precise dynamic query timestamp formatter
  const formatQueryTime = (iso: string | undefined | null) => {
    if (!iso) return { time: '', relative: 'Recently', exact: '' }
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return { time: '', relative: 'Recently', exact: '' }

      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      const diffSec = Math.max(0, Math.floor((currentTime - d.getTime()) / 1000))

      let relative = ''
      if (diffSec < 45) {
        relative = 'just now'
      } else if (diffSec < 3600) {
        const mins = Math.floor(diffSec / 60)
        relative = `${mins}m ago`
      } else if (diffSec < 86400) {
        const hrs = Math.floor(diffSec / 3600)
        relative = `${hrs}h ago`
      } else {
        const days = Math.floor(diffSec / 86400)
        relative = `${days}d ago`
      }

      return {
        time: timeStr,
        relative,
        exact: `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })} (${relative})`,
      }
    } catch {
      return { time: '', relative: 'Recently', exact: '' }
    }
  }

  // Fetch Entity Intelligence (Top Projects, Sectors & Queries)
  const loadIntelligence = useCallback(async () => {
    try {
      setIntelligenceLoading(true)
      const res = await adminFetch('/admin/conversations/intelligence')
      if (res.ok) {
        const data = await res.json()
        setIntelligence(data)
      }
    } catch (e) {
      console.error('Failed to load intelligence:', e)
    } finally {
      setIntelligenceLoading(false)
    }
  }, [])

  // Fetch Conversations with query params
  const loadSessions = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setIsRefreshing(true)
      setError(null)

      try {
        const params = new URLSearchParams({ limit: '100' })
        if (searchQuery.trim()) params.set('q', searchQuery.trim())
        if (selectedProject) params.set('project', selectedProject)
        if (selectedSector) params.set('sector', selectedSector)
        if (activeTab !== 'all') params.set('tab', activeTab)
        if (sortBy) params.set('sort', sortBy)

        let res = await adminFetch(`/admin/conversations?${params.toString()}`)
        if (!res.ok && res.status === 404) {
          res = await adminFetch(`/admin/beta/conversations?${params.toString()}`)
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to load conversations`)
        }
        const data = await res.json()
        const fetchedSessions: SessionSummary[] = data.sessions ?? []
        setSessions(fetchedSessions)

        if (data.total !== undefined) {
          setServerTotals({
            total: data.total,
            totalLeads: data.totalLeads,
            totalCostUsd: data.totalCostUsd,
          })
        }

        if (data.tabCounts) {
          setTabCounts(data.tabCounts)
        }

        // Keep current selected session or select first one
        if (fetchedSessions.length > 0) {
          const matchExisting = fetchedSessions.find((s) => s.id === selected)
          if (!selected || !matchExisting) {
            openSession(fetchedSessions[0].id)
          }
        } else {
          setSelected(null)
          setDetail(null)
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to fetch conversations')
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [searchQuery, selectedProject, selectedSector, activeTab, sortBy, selected],
  )

  useEffect(() => {
    loadSessions()
    loadIntelligence()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when filters change (with slight debounce on search query)
  useEffect(() => {
    const handler = setTimeout(() => {
      loadSessions(true)
    }, 280)
    return () => clearTimeout(handler)
  }, [searchQuery, selectedProject, selectedSector, activeTab, sortBy]) // eslint-disable-line react-hooks/exhaustive-deps

  const openSession = useCallback(async (id: string) => {
    setSelected(id)
    setDetailLoading(true)
    try {
      let res = await adminFetch(`/admin/conversations/${id}`)
      if (!res.ok && res.status === 404) {
        res = await adminFetch(`/admin/beta/conversations/${id}`)
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Could not load conversation detail`)
      }
      const d = await res.json()
      setDetail(d)
    } catch (e: any) {
      console.error(e)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // KPI Metrics Calculation — using real DB platform totals when provided
  const kpis = useMemo(() => {
    const total = serverTotals?.total ?? sessions.length
    const totalLeads = serverTotals?.totalLeads ?? sessions.filter((s) => Boolean(s.lead)).length
    const totalCostUsd = serverTotals?.totalCostUsd ?? sessions.reduce((acc, s) => acc + (s.costUsd || 0), 0)
    const activeToday = sessions.filter((s) => {
      const diffHours = (Date.now() - new Date(s.lastActiveAt).getTime()) / (1000 * 60 * 60)
      return diffHours <= 24
    }).length

    return {
      total,
      totalLeads,
      totalCostInr: inr(totalCostUsd),
      activeToday,
    }
  }, [sessions, serverTotals])

  const copyTranscript = () => {
    if (!detail) return
    const text = detail.turns
      .map((t) => `[${t.role.toUpperCase()} - ${new Date(t.at).toLocaleTimeString()}]:\n${t.content}\n`)
      .join('\n---\n\n')
    navigator.clipboard.writeText(text)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  const getLeadTierStyle = (tier: string | null) => {
    switch (tier?.toLowerCase()) {
      case 'hot':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
      case 'warm':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
      case 'cold':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
    }
  }

  // Active filter helper flags
  const hasActiveFilters = Boolean(searchQuery || selectedProject || selectedSector || activeTab !== 'all')

  const clearAllFilters = () => {
    setSearchQuery('')
    setSelectedProject('')
    setSelectedSector('')
    setActiveTab('all')
  }

  // Highlight helper for transcript search hits
  const highlightQuery = (text: string) => {
    const term = (searchQuery || selectedProject || selectedSector).trim()
    if (!term || term.length < 2) return text

    try {
      const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
      return parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 dark:bg-amber-800/80 text-zinc-900 dark:text-white px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        ),
      )
    } catch {
      return text
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7 font-sans select-none min-w-0">
      {/* ── Header Banner ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1 border-b border-zinc-200/80 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Conversations Observatory
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live Transcripts
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Inspect live buyer AI discovery dialogues, connected user dossiers, and search entity tracking across PropFyndr.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowIntelligence((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              showIntelligence
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80'
                : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Compass size={14} className={showIntelligence ? 'text-blue-600' : 'text-zinc-500'} />
            <span>Entity Intelligence</span>
            {showIntelligence ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <button
            type="button"
            onClick={() => {
              loadSessions(true)
              loadIntelligence()
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/90 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh conversations list"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh Feed'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Dialogues"
          value={kpis.total}
          icon={<MessageSquare size={16} />}
          hint="Buyer sessions recorded"
          loading={loading}
        />
        <StatCard
          label="Captured Leads"
          value={kpis.totalLeads}
          tone="good"
          icon={<Users size={16} />}
          hint="High-intent contacts"
          loading={loading}
        />
        <StatCard
          label="AI Compute Cost"
          value={kpis.totalCostInr}
          icon={<Coins size={16} />}
          hint="Token consumption"
          loading={loading}
        />
        <StatCard
          label="Active in 24h"
          value={kpis.activeToday}
          tone="hot"
          icon={<Zap size={16} />}
          hint="Recent buyer sessions"
          loading={loading}
        />
      </div>

      {/* ── Top Queries & Entity Intelligence Control Center ──────────── */}
      {showIntelligence && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Compass size={18} className="text-blue-600" />
              <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Top Queries & Entity Intelligence
              </h2>
              <span className="text-[11px] font-medium text-zinc-400">
                Tap any project, sector, or frequent query to instantly filter dialogues
              </span>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <X size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Bento Card 1: Top Mentioned Projects */}
            <div className="bg-zinc-50/80 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 flex flex-col h-[270px] min-w-0 shadow-2xs">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 shrink-0">
                    <Building2 size={13} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">Top Mentioned Projects</h3>
                    <p className="text-[10px] text-zinc-400 font-medium">Ranked by buyer frequency</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 shrink-0">
                  {intelligence?.topProjects.length ?? 0} tracked
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-200/40 dark:[&::-webkit-scrollbar-track]:bg-zinc-800/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-500">
                {intelligenceLoading ? (
                  <div className="space-y-2 p-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full rounded-xl" />
                    ))}
                  </div>
                ) : !intelligence?.topProjects.length ? (
                  <p className="text-xs text-zinc-400 italic p-4 text-center">No project mentions recorded yet.</p>
                ) : (
                  intelligence.topProjects.map((p) => {
                    const isSelected = selectedProject.toLowerCase() === p.name.toLowerCase()
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProject(isSelected ? '' : p.name)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                            : 'bg-white dark:bg-zinc-900/90 hover:bg-purple-50/60 dark:hover:bg-purple-950/30 text-zinc-800 dark:text-zinc-200 border-zinc-200/70 dark:border-zinc-800'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="truncate">{p.name}</span>
                          {p.sector && (
                            <span
                              className={`text-[9.5px] px-1.5 py-0.2 rounded truncate max-w-[85px] hidden sm:inline ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                              }`}
                            >
                              {p.sector}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 ml-2 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          }`}
                        >
                          {p.count}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Bento Card 2: Top Corridors & Sectors */}
            <div className="bg-zinc-50/80 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 flex flex-col h-[270px] min-w-0 shadow-2xs">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 shrink-0">
                    <MapPin size={13} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">Top Corridors & Sectors</h3>
                    <p className="text-[10px] text-zinc-400 font-medium">Buyer location intent</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                  {intelligence?.topSectors.length ?? 0} active
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-200/40 dark:[&::-webkit-scrollbar-track]:bg-zinc-800/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-500">
                {intelligenceLoading ? (
                  <div className="space-y-2 p-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full rounded-xl" />
                    ))}
                  </div>
                ) : !intelligence?.topSectors.length ? (
                  <p className="text-xs text-zinc-400 italic p-4 text-center">No sector mentions recorded yet.</p>
                ) : (
                  intelligence.topSectors.map((s) => {
                    const isSelected = selectedSector.toLowerCase() === s.sector.toLowerCase()
                    return (
                      <button
                        key={s.sector}
                        type="button"
                        onClick={() => setSelectedSector(isSelected ? '' : s.sector)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white dark:bg-zinc-900/90 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 text-zinc-800 dark:text-zinc-200 border-zinc-200/70 dark:border-zinc-800'
                        }`}
                      >
                        <span className="truncate">{s.sector}</span>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 ml-2 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {s.count}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Bento Card 3: Frequent Buyer Inquiries */}
            <div className="bg-zinc-50/80 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 flex flex-col h-[270px] min-w-0 shadow-2xs">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 shrink-0">
                    <MessageCircle size={13} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">Frequent Inquiries</h3>
                    <p className="text-[10px] text-zinc-400 font-medium">Top recurring buyer queries</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
                  {intelligence?.topQueries.length ?? 0} queries
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-200/40 dark:[&::-webkit-scrollbar-track]:bg-zinc-800/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-500">
                {intelligenceLoading ? (
                  <div className="space-y-2 p-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full rounded-xl" />
                    ))}
                  </div>
                ) : !intelligence?.topQueries.length ? (
                  <p className="text-xs text-zinc-400 italic p-4 text-center">No repeated queries recorded.</p>
                ) : (
                  intelligence.topQueries.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSearchQuery(q.query)}
                      className="w-full text-left p-2 rounded-xl bg-white dark:bg-zinc-900/90 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 border border-zinc-200/70 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                    >
                      <span className="truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        &ldquo;{q.query}&rdquo;
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-md shrink-0">
                        {q.count}x
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Filter Bar (When Filtering by Entity) ───────────────── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200/70 dark:border-blue-900/50 text-xs font-semibold text-blue-950 dark:text-blue-200 shadow-2xs">
          <span className="text-zinc-500 dark:text-zinc-400 font-bold">Active Filters:</span>
          {selectedProject && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-2xs">
              <span>Project: {selectedProject}</span>
              <button
                type="button"
                onClick={() => setSelectedProject('')}
                className="hover:opacity-75 cursor-pointer ml-1"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {selectedSector && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-2xs">
              <span>Sector: {selectedSector}</span>
              <button
                type="button"
                onClick={() => setSelectedSector('')}
                className="hover:opacity-75 cursor-pointer ml-1"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 font-bold text-xs shadow-2xs">
              <span>Search: &quot;{searchQuery}&quot;</span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="hover:opacity-75 cursor-pointer ml-1"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {activeTab !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-2xs">
              <span>Audience: {activeTab.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="hover:opacity-75 cursor-pointer ml-1"
              >
                <X size={12} />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-auto text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* ── Search & Segmented Filter Bar ────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search query text, user name, phone, project, or session ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Dropdown Filters for Project & Sector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Dropdown */}
          <CustomSelect
            value={selectedProject}
            onChange={(val) => setSelectedProject(val)}
            options={[
              { value: '', label: 'All Projects' },
              ...(intelligence?.topProjects.map((p) => ({
                value: p.name,
                label: `${p.name} (${p.count})`,
              })) || []),
            ]}
            size="sm"
            className="w-44"
          />

          {/* Sector Dropdown */}
          <CustomSelect
            value={selectedSector}
            onChange={(val) => setSelectedSector(val)}
            options={[
              { value: '', label: 'All Sectors' },
              ...(intelligence?.topSectors.map((s) => ({
                value: s.sector,
                label: `${s.sector} (${s.count})`,
              })) || []),
            ]}
            size="sm"
            className="w-40"
          />

          {/* Audience Filter Pills */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              All {tabCounts.all !== undefined ? `(${tabCounts.all.toLocaleString()})` : ''}
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Captured Leads {tabCounts.leads !== undefined ? `(${tabCounts.leads.toLocaleString()})` : ''}
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Registered Users {tabCounts.users !== undefined ? `(${tabCounts.users.toLocaleString()})` : ''}
            </button>
            <button
              onClick={() => setActiveTab('guests')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'guests'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Guests {tabCounts.guests !== undefined ? `(${tabCounts.guests.toLocaleString()})` : ''}
            </button>
          </div>

          {/* Sort Dropdown */}
          <CustomSelect
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'recent', label: 'Most Recent' },
              { value: 'turns', label: 'Highest Turns' },
              { value: 'cost', label: 'Highest AI Cost' },
            ]}
            size="sm"
            className="w-36"
          />
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>Could not load conversations: {error}</span>
          </div>
          <button
            onClick={() => loadSessions(false)}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Main Master-Detail Observatory Split ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Master List Column (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs p-4 flex flex-col h-[780px]">
          <div className="flex items-center justify-between pb-3 px-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Conversations ({sessions.length})
              </span>
              {(selectedProject || selectedSector || searchQuery) && (
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold text-[10px]">
                  Filtered
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-zinc-400">Tap to inspect dialogue</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-zinc-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-800/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-500">
            {loading && (
              <div className="space-y-3 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <div className="text-center py-20 px-4 text-zinc-400">
                <MessageSquare size={36} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                <p className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">No conversations match criteria</p>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                  Try clearing active project or sector filters, or searching for broader terms.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-4 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            )}

            {!loading &&
              sessions.map((s) => {
                const isSelected = selected === s.id
                const connectedUser = s.user
                const lead = s.lead
                const timeInfo = formatQueryTime(s.queryTime || s.lastActiveAt)

                return (
                  <div
                    key={s.id}
                    onClick={() => openSession(s.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer relative ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/40 shadow-xs'
                        : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    {/* Top Row: User Identity Connection Badge & Dynamic Time */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {lead ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border text-[9px] shrink-0 ${getLeadTierStyle(
                                lead.tier,
                              )}`}
                            >
                              ★ {lead.tier ?? 'LEAD'}
                            </span>
                            <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                              {lead.name || 'Captured Contact'}
                            </span>
                            {lead.phone && (
                              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0 hidden sm:inline">
                                · {lead.phone}
                              </span>
                            )}
                          </div>
                        ) : connectedUser?.isRegistered ? (
                          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                            <User size={13} className="text-blue-500 shrink-0" />
                            <span className="text-xs font-bold truncate">Registered User</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <User size={13} className="shrink-0" />
                            <span className="text-[11px] font-medium truncate">Guest Visitor</span>
                          </div>
                        )}
                      </div>

                      {/* Precise Wall-Clock & Dynamic Relative Time */}
                      <div className="flex items-center gap-1.5 shrink-0 text-right">
                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                          {timeInfo.time}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-600">·</span>
                        <span
                          title={timeInfo.exact}
                          className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap bg-zinc-100/90 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded"
                        >
                          {timeInfo.relative}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Query & Multi-turn context */}
                    <div className="space-y-1 mb-2.5">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                        {s.latestQuery?.content ? (
                          highlightQuery(s.latestQuery.content)
                        ) : s.openingQuestion ? (
                          highlightQuery(s.openingQuestion)
                        ) : (
                          <span className="italic font-normal text-zinc-400">Initial exploratory search</span>
                        )}
                      </h4>

                      {s.turns > 1 && s.latestQuery && s.openingQuestion && s.latestQuery.content !== s.openingQuestion && (
                        <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 truncate flex items-center gap-1">
                          <span className="font-semibold text-zinc-500 dark:text-zinc-400">Started:</span>
                          <span className="truncate italic">&quot;{s.openingQuestion}&quot;</span>
                        </p>
                      )}
                    </div>

                    {/* Entity Tracking Pills (Project & Sector) */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      {s.focusProject && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/70 font-semibold text-[10px] truncate max-w-[150px]">
                          🏢 {s.focusProject.name}
                        </span>
                      )}

                      {s.summaryLocation && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70 font-semibold text-[10px] truncate max-w-[140px]">
                          📍 {s.summaryLocation}
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold text-[10px]">
                        {s.turns} turns
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono font-medium text-[10px] ml-auto">
                        {inr(s.costUsd)}
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Right Transcript Detail Column (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col h-[780px] overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-center text-blue-600 mb-4">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-1">Select a Conversation</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Choose any session on the left to read the full buyer transcript, inspect buyer intelligence dossier, and view recommended project cards.
              </p>
            </div>
          ) : detailLoading ? (
            <div className="p-8 space-y-6">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <div className="space-y-4">
                <Skeleton className="h-16 w-3/4 rounded-2xl" />
                <Skeleton className="h-20 w-4/5 ml-auto rounded-2xl" />
                <Skeleton className="h-16 w-2/3 rounded-2xl" />
              </div>
            </div>
          ) : detail ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Top Dossier Card Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-3.5 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
                      Buyer Dossier & Session Details
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyTranscript}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      {copiedText ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{copiedText ? 'Copied' : 'Copy Dialogue'}</span>
                    </button>
                  </div>
                </div>

                {/* Connected User Profile Banner */}
                {detail.lead ? (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50/90 to-teal-50/80 dark:from-emerald-950/50 dark:to-zinc-900 border border-emerald-200/90 dark:border-emerald-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                          {detail.lead.name}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getLeadTierStyle(
                            detail.lead.lead_tier,
                          )}`}
                        >
                          {detail.lead.lead_tier ?? 'UNSCORED'}
                        </span>
                        {detail.lead.lead_score && (
                          <span className="text-[10px] font-mono text-zinc-500">
                            Score: {detail.lead.lead_score}/100
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {detail.lead.phone}
                        </span>
                        {detail.lead.ai_summary && (
                          <span className="text-[11px] text-zinc-600 dark:text-zinc-400 max-w-md line-clamp-1">
                            • {detail.lead.ai_summary}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`https://wa.me/${detail.lead.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                      >
                        <MessageCircle size={13} />
                        <span>WhatsApp Lead</span>
                      </a>
                    </div>
                  </div>
                ) : detail.userDossier?.isRegistered ? (
                  <div className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-blue-500" />
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">Registered User Profile</p>
                        <p className="text-[10px] font-mono text-zinc-400">ID: {detail.session.identity.id}</p>
                      </div>
                    </div>
                    {detail.userDossier.phone && (
                      <a
                        href={`tel:${detail.userDossier.phone}`}
                        className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400"
                      >
                        {detail.userDossier.phone}
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 flex items-center gap-2 p-2 rounded-xl bg-zinc-100/50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
                    <User size={14} className="text-zinc-400" />
                    <span>Anonymous Visitor ({detail.session.identity.kind})</span>
                    <span className="font-mono text-[10px] text-zinc-400">Token: {detail.session.identity.id?.slice(0, 16)}…</span>
                  </div>
                )}

                {/* User Requirements Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {detail.session.focusProject && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200/70 dark:border-purple-800/70 text-purple-700 dark:text-purple-300 font-bold text-[11px]">
                      <Building2 size={12} />
                      <span>{detail.session.focusProject.name}</span>
                    </div>
                  )}

                  {detail.session.summary_location && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                      <MapPin size={12} />
                      <span>{detail.session.summary_location}</span>
                    </div>
                  )}

                  {detail.session.summary_financial && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                      <Wallet size={12} />
                      <span>{detail.session.summary_financial}</span>
                    </div>
                  )}

                  {detail.session.summary_timeline && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-100 dark:border-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold text-[11px]">
                      <Calendar size={12} />
                      <span>{detail.session.summary_timeline}</span>
                    </div>
                  )}

                  <div className="ml-auto text-[11px] font-mono text-zinc-400">
                    Cost: {inr(detail.cost.totalUsd)} ({detail.cost.calls.length} calls)
                  </div>
                </div>

                {/* Multi-Session User History Links (if user has past dialogues) */}
                {detail.userDossier?.otherSessions && detail.userDossier.otherSessions.length > 0 && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto text-xs">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">
                      User Past Chats ({detail.userDossier.otherSessions.length}):
                    </span>
                    {detail.userDossier.otherSessions.map((past) => (
                      <button
                        key={past.id}
                        type="button"
                        onClick={() => openSession(past.id)}
                        className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 transition-colors shrink-0 cursor-pointer border border-zinc-200/60 dark:border-zinc-700/60"
                      >
                        {formatDistanceToNow(new Date(past.lastActiveAt), { addSuffix: true })} ({past.turns}t)
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Transcript Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-800/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-500">
                {detail.turns.map((t) => {
                  const isUser = t.role === 'user'
                  return (
                    <div key={t.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}>
                      {/* Role and Time stamp */}
                      <div className="flex items-center gap-2 px-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        {isUser ? (
                          <>
                            <span
                              className="font-mono text-zinc-500 dark:text-zinc-400"
                              title={new Date(t.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })}
                            >
                              {new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                            </span>
                            <span className="text-zinc-700 dark:text-zinc-300 font-bold">Buyer</span>
                          </>
                        ) : (
                          <>
                            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 font-bold">
                              <Bot size={13} />
                              PropFyndr AI
                            </span>
                            <span
                              className="font-mono text-zinc-500 dark:text-zinc-400"
                              title={new Date(t.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })}
                            >
                              {new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                            </span>
                          </>
                        )}
                        {t.flaggedCoverageGap && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold dark:bg-rose-950/60 dark:text-rose-300 text-[9.5px]">
                            Coverage Gap Flagged
                          </span>
                        )}
                      </div>

                      {/* Chat Message Bubble */}
                      <div
                        className={`max-w-[88%] p-4 rounded-3xl text-[13.5px] leading-relaxed shadow-xs ${
                          isUser
                            ? 'bg-zinc-900 text-white dark:bg-blue-600 dark:text-white rounded-tr-xs'
                            : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/60 rounded-tl-xs'
                        }`}
                      >
                        {(() => {
                          const dossierTokenMatch = t.content.match(/\/dossier\/([a-zA-Z0-9]+)/)
                          const dossierToken = dossierTokenMatch ? dossierTokenMatch[1] : null

                          if (isUser) {
                            return <p className="whitespace-pre-wrap select-text">{highlightQuery(t.content)}</p>
                          }

                          // Clean assistant formatting
                          const lines = t.content.split('\n')
                          return (
                            <div className="space-y-1.5 select-text">
                              {lines.map((line, idx) => {
                                const clean = line.trim()
                                if (!clean) return <div key={idx} className="h-1.5" />

                                if (clean.startsWith('### ')) {
                                  return (
                                    <h4 key={idx} className="text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-2 mb-1 flex items-center gap-1.5">
                                      {clean.replace(/^###\s+/, '')}
                                    </h4>
                                  )
                                }
                                if (clean.startsWith('#### ')) {
                                  return (
                                    <h5 key={idx} className="text-[11px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mt-2 mb-0.5">
                                      {clean.replace(/^####\s+/, '')}
                                    </h5>
                                  )
                                }

                                if (clean.includes('/dossier/') && clean.includes('](')) {
                                  // Skip raw markdown link line because the rich dossier card is rendered below
                                  return null
                                }

                                const isBullet = clean.startsWith('- ') || clean.startsWith('* ')
                                const textWithoutBullet = isBullet ? clean.replace(/^[-*]\s+/, '') : clean

                                // Parse bold segments
                                const parts = textWithoutBullet.split(/(\*\*[^*]+\*\*)/g)
                                const renderedParts = parts.map((part, pIdx) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return (
                                      <strong key={pIdx} className="font-bold text-zinc-950 dark:text-white">
                                        {part.slice(2, -2)}
                                      </strong>
                                    )
                                  }
                                  return part
                                })

                                if (isBullet) {
                                  return (
                                    <div key={idx} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300 pl-1">
                                      <span className="text-blue-500 font-bold shrink-0 mt-0.5">&bull;</span>
                                      <span className="leading-relaxed">{renderedParts}</span>
                                    </div>
                                  )
                                }

                                return (
                                  <p key={idx} className="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                                    {renderedParts}
                                  </p>
                                )
                              })}

                              {/* Interactive Admin Dossier Action Box */}
                              {dossierToken && (
                                <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/70 dark:from-zinc-900 dark:to-blue-950/40 border border-blue-200/90 dark:border-blue-900/60 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                      📄
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                        <span>Family Deal Dossier Generated</span>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">LIVE</span>
                                      </div>
                                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                        /dossier/{dossierToken}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <a
                                      href={`/dossier/${dossierToken}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                    >
                                      <span>View Dossier</span>
                                      <ExternalLink size={12} />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (typeof window !== 'undefined') {
                                          navigator.clipboard.writeText(`${window.location.origin}/dossier/${dossierToken}`)
                                          setCopiedDossierToken(dossierToken)
                                          setTimeout(() => setCopiedDossierToken(null), 2000)
                                        }
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                    >
                                      {copiedDossierToken === dossierToken ? (
                                        <>
                                          <Check size={12} className="text-emerald-500" />
                                          <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={12} />
                                          <span>Copy Link</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}

                        {/* If assistant presented interactive property cards */}
                        {t.cardsShown.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-700 space-y-2">
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                              <Building2 size={12} className="text-blue-500" />
                              <span>Projects Presented ({t.cardsShown.length})</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {t.cardsShown.map((c) => (
                                <div
                                  key={c.id}
                                  className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 flex items-center justify-between gap-2 shadow-2xs"
                                >
                                  <div className="min-w-0">
                                    <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                      {c.name}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 truncate">
                                      {c.sector} · {c.price ?? 'Price on request'}
                                    </div>
                                  </div>
                                  <a
                                    href={`/admin/projects/${c.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                                    title="View project in editor"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* If chips are attached */}
                        {t.chips && t.chips.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {t.chips.map((chip, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-lg bg-zinc-200/60 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
