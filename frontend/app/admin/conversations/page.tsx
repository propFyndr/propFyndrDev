'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect from '@/components/admin/CustomSelect'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import {
  MessageSquare,
  Users,
  AlertTriangle,
  Coins,
  Search,
  RotateCcw,
  Sparkles,
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
} from 'lucide-react'

interface SessionSummary {
  id: string
  identity: { kind: 'user' | 'guest'; id: string | null }
  openingQuestion: string | null
  turns: number
  phase: string
  startedAt: string
  lastActiveAt: string
  durationMs: number
  costUsd: number
  modelCalls: number
  tokens: { in: number; out: number }
  lead: { tier: string | null; at: string } | null
}

interface Turn {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: string
  intent: Record<string, unknown> | null
  chips?: string[]
  cardsShown: Array<{ id: string; name: string; sector: string; price: string | number | null }>
  flaggedCoverageGap: boolean
}

interface Detail {
  session: {
    id: string
    identity: { kind: string; id: string | null }
    summary_location: string | null
    summary_financial: string | null
    summary_timeline: string | null
    chat_phase?: string
  }
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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'leads' | 'gaps' | 'users' | 'guests'>('all')
  const [sortBy, setSortBy] = useState('recent')

  const [serverTotals, setServerTotals] = useState<{ total?: number; totalLeads?: number; totalCostUsd?: number } | null>(null)

  const loadSessions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      // Calls standard admin route, resilient to both /admin/conversations and legacy /admin/beta/conversations
      let res = await adminFetch('/admin/conversations?limit=100')
      if (!res.ok && res.status === 404) {
        res = await adminFetch('/admin/beta/conversations?limit=100')
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

      // Automatically select the first session if none selected yet
      if (!selected && fetchedSessions.length > 0) {
        openSession(fetchedSessions[0].id)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch conversations')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [selected])

  useEffect(() => {
    loadSessions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Filter & Sort Sessions
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        // Search
        const q = searchQuery.toLowerCase().trim()
        const matchesSearch =
          !q ||
          (s.openingQuestion && s.openingQuestion.toLowerCase().includes(q)) ||
          s.id.toLowerCase().includes(q) ||
          (s.identity.id && s.identity.id.toLowerCase().includes(q))

        // Tabs
        let matchesTab = true
        if (activeTab === 'leads') matchesTab = Boolean(s.lead)
        else if (activeTab === 'users') matchesTab = s.identity.kind === 'user'
        else if (activeTab === 'guests') matchesTab = s.identity.kind === 'guest'

        return matchesSearch && matchesTab
      })
      .sort((a, b) => {
        if (sortBy === 'turns') return b.turns - a.turns
        if (sortBy === 'cost') return b.costUsd - a.costUsd
        return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
      })
  }, [sessions, searchQuery, activeTab, sortBy])

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

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans select-none min-w-0">
      
      {/* ── Header Banner ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Conversations Observatory
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live Transcripts
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Inspect live buyer AI discovery dialogues, captured leads, cost metrics, and coverage gaps
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => loadSessions(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/90 dark:border-zinc-800 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh conversations list"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh Feed'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Sessions */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Dialogues
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <MessageSquare size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
            {kpis.total}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Buyer sessions recorded</span>
          </div>
        </div>

        {/* Captured Leads */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Captured Leads
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Users size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
            {kpis.totalLeads}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>High-intent contacts</span>
          </div>
        </div>

        {/* AI Compute Spend */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              AI Compute Cost
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Coins size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
            {kpis.totalCostInr}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>Token consumption</span>
          </div>
        </div>

        {/* Active Today */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Active in 24h
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Zap size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
            {kpis.activeToday}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Recent buyer sessions</span>
          </div>
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
            className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Search & Segmented Filter Bar ────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search buyer query, session token or user ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500 shadow-2xs outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Segmented Filter Pills & Sort Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              All Sessions
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'leads'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Captured Leads
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Registered Users
            </button>
            <button
              onClick={() => setActiveTab('guests')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'guests'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Guests
            </button>
          </div>

          {/* Sort Dropdown */}
          <CustomSelect
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'recent', label: 'Most Recent' },
              { value: 'turns', label: 'Highest Turn Count' },
              { value: 'cost', label: 'Highest AI Cost' },
            ]}
            size="md"
            className="w-44"
          />
        </div>
      </div>

      {/* ── Main Master-Detail Observatory Split ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Master List Column (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs p-4 flex flex-col h-[760px]">
          <div className="flex items-center justify-between pb-3 px-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Conversations ({filteredSessions.length})
            </span>
            <span className="text-[11px] font-medium text-zinc-400">
              Tap to view dialogue
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1">
            {loading && (
              <div className="space-y-3 p-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            )}

            {!loading && filteredSessions.length === 0 && (
              <div className="text-center py-16 px-4 text-zinc-400">
                <MessageSquare size={32} className="mx-auto mb-2 text-zinc-300" />
                <p className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">No conversations found</p>
                <p className="text-xs text-zinc-400 mt-1">Try switching filters or search keywords.</p>
              </div>
            )}

            {!loading &&
              filteredSessions.map((s) => {
                const isSelected = selected === s.id
                return (
                  <div
                    key={s.id}
                    onClick={() => openSession(s.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer relative ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs'
                        : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    {/* Top Row: Opening Question & Time Ago */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                        {s.openingQuestion || (
                          <span className="italic font-normal text-zinc-400">Initial exploratory search</span>
                        )}
                      </h4>
                      <span className="text-[10px] font-medium text-zinc-400 shrink-0 whitespace-nowrap">
                        {formatDistanceToNow(new Date(s.lastActiveAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Middle Row: Badge Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      {s.lead && (
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border text-[9.5px] ${getLeadTierStyle(
                            s.lead.tier
                          )}`}
                        >
                          ★ {s.lead.tier ?? 'LEAD'}
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">
                        {s.turns} turns
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono font-medium">
                        {inr(s.costUsd)}
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-medium">
                        {s.identity.kind === 'user' ? 'Registered User' : 'Guest'}
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Right Transcript Detail Column (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col h-[760px] overflow-hidden">
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
              <Skeleton className="h-28 w-full rounded-2xl" />
              <div className="space-y-4">
                <Skeleton className="h-16 w-3/4 rounded-2xl" />
                <Skeleton className="h-20 w-4/5 ml-auto rounded-2xl" />
                <Skeleton className="h-16 w-2/3 rounded-2xl" />
              </div>
            </div>
          ) : detail ? (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* Top Dossier Card Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Buyer Dossier & Session Details
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyTranscript}
                      className="flex items-center gap-1 px-3 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all shadow-2xs"
                    >
                      {copiedText ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{copiedText ? 'Copied' : 'Copy Dialogue'}</span>
                    </button>
                  </div>
                </div>

                {/* If Lead captured */}
                {detail.lead ? (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-zinc-900 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                          {detail.lead.name}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getLeadTierStyle(detail.lead.lead_tier)}`}>
                          {/* A missing tier means unscored. It must not read as
                              a verification claim — that is a fabricated fact
                              about the lead, and noAssertedVerification fails on it. */}
                          {detail.lead.lead_tier ?? 'UNSCORED'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {detail.lead.phone}
                        </span>
                        {detail.lead.ai_summary && (
                          <span className="text-[11px] text-zinc-500 truncate max-w-xs">
                            • {detail.lead.ai_summary}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/${detail.lead.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all"
                      >
                        <MessageCircle size={13} />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                    <User size={14} className="text-zinc-400" />
                    <span>Anonymous Visitor ({detail.session.identity.kind})</span>
                  </div>
                )}

                {/* Summary Badges: Location, Budget, Timeline */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
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
              </div>

              {/* Chat Transcript Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {detail.turns.map((t) => {
                  const isUser = t.role === 'user'
                  return (
                    <div
                      key={t.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                    >
                      {/* Role and Time stamp */}
                      <div className="flex items-center gap-2 px-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        {isUser ? (
                          <>
                            <span>{new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-zinc-600 dark:text-zinc-300">Buyer</span>
                          </>
                        ) : (
                          <>
                            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <Bot size={12} />
                              PropFyndr AI
                            </span>
                            <span>{new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                        <p className="whitespace-pre-wrap">{t.content}</p>

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
                                    className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700"
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
