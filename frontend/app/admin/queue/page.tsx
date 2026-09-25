'use client'

/**
 * The salesperson's day — Apple-inspired executive queue.
 *
 * Ordered by lead score and urgency rather than arrival.
 * Provides instant clarity: who to call first, who is going cold,
 * one-click call logging with instantaneous Undo capability,
 * and centered intelligent briefs.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  PhoneCall,
  Fire,
  Clock,
  Warning,
  ArrowRight,
  ArrowCounterClockwise,
  MagnifyingGlass,
  Check,
  CheckCircle,
  X,
  Sparkle,
  Buildings,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import { adminFetch } from '@/lib/adminFetch'
import LeadBriefPanel from '@/components/portal/LeadBriefPanel'
import { PageShell, Spinner, ErrorNote } from '@/components/portal/ui'

interface QueueLead {
  id: string
  name: string
  phone: string
  project_name: string | null
  project_slug: string | null
  status: string
  lead_tier: string | null
  lead_score: number | null
  intent_tier: string | null
  ai_summary: string | null
  budget_min_cr: number | null
  budget_max_cr: number | null
  created_at: string
  assigned_partner_id: string | null
}

interface QueueResponse {
  stats: {
    today: number
    hot: number
    warm: number
    cold: number
    stale: number
    unassigned: number
    median_response_minutes: number | null
    contacted_sample: number
  }
  stale_after_ms: number
  queue: QueueLead[]
}

type FilterTab = 'all' | 'needs_call' | 'called' | 'priority' | 'going_cold'

const TIER_BADGE_STYLE: Record<string, string> = {
  HOT: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  WARM: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  COLD: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
}

function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / (60 * 24))}d`
}

function budgetLabel(l: QueueLead): string | null {
  if (l.budget_min_cr == null && l.budget_max_cr == null) return null
  if (l.budget_min_cr != null && l.budget_max_cr != null) return `₹${l.budget_min_cr}–${l.budget_max_cr} Cr`
  return `₹${l.budget_min_cr ?? l.budget_max_cr} Cr`
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function SalesQueuePage() {
  const [data, setData] = useState<QueueResponse | null>(null)
  const [error, setError] = useState('')
  const [briefFor, setBriefFor] = useState<QueueLead | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [undoToast, setUndoToast] = useState<{ lead: QueueLead; timer: ReturnType<typeof setTimeout> } | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true)
    try {
      const res = await adminFetch('/admin/boards/queue')
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
      setError('')
    } catch {
      setError('Could not load your queue.')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Clear toast timeout on unmount
  useEffect(() => {
    return () => {
      if (undoToast?.timer) clearTimeout(undoToast.timer)
    }
  }, [undoToast])

  /** Update lead status with instant optimistic update & undo handling */
  async function updateStatus(lead: QueueLead, targetStatus: 'contacted' | 'new') {
    setSavingId(lead.id)

    // Clear any previous undo toast
    if (undoToast?.timer) clearTimeout(undoToast.timer)

    // Optimistically update local state
    setData((prev) => {
      if (!prev) return prev
      const isCallAction = targetStatus === 'contacted'
      const wasNew = lead.status === 'new'
      return {
        ...prev,
        stats: {
          ...prev.stats,
          stale: isCallAction && wasNew ? Math.max(0, prev.stats.stale - 1) : prev.stats.stale,
        },
        queue: prev.queue.map((item) =>
          item.id === lead.id ? { ...item, status: targetStatus } : item
        ),
      }
    })

    try {
      const res = await adminFetch(`/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      })
      if (!res.ok) throw new Error()

      if (targetStatus === 'contacted') {
        const timer = setTimeout(() => {
          setUndoToast(null)
        }, 6000)
        setUndoToast({ lead, timer })
      } else {
        setUndoToast(null)
      }
    } catch {
      setError('Could not update that lead.')
      await load(true)
    } finally {
      setSavingId(null)
    }
  }

  const staleAfter = data?.stale_after_ms ?? 48 * 60 * 60 * 1000

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    if (!data) return []
    return data.queue.filter((lead) => {
      const age = Date.now() - new Date(lead.created_at).getTime()
      const goingCold = lead.status === 'new' && age > staleAfter

      // Tab matching
      if (activeTab === 'needs_call' && lead.status !== 'new') return false
      if (activeTab === 'called' && lead.status !== 'contacted') return false
      if (activeTab === 'priority' && lead.lead_tier !== 'HOT' && lead.lead_tier !== 'WARM') return false
      if (activeTab === 'going_cold' && !goingCold) return false

      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = lead.name.toLowerCase().includes(q)
        const matchPhone = lead.phone.includes(q)
        const matchProject = lead.project_name?.toLowerCase().includes(q)
        const matchSummary = lead.ai_summary?.toLowerCase().includes(q)
        if (!matchName && !matchPhone && !matchProject && !matchSummary) return false
      }

      return true
    })
  }, [data, activeTab, searchQuery, staleAfter])

  // Tab counts
  const tabCounts = useMemo(() => {
    if (!data) return { all: 0, needs_call: 0, called: 0, priority: 0, going_cold: 0 }
    let needs_call = 0
    let called = 0
    let priority = 0
    let going_cold = 0

    data.queue.forEach((l) => {
      const age = Date.now() - new Date(l.created_at).getTime()
      const isCold = l.status === 'new' && age > staleAfter
      if (l.status === 'new') needs_call++
      if (l.status === 'contacted') called++
      if (l.lead_tier === 'HOT' || l.lead_tier === 'WARM') priority++
      if (isCold) going_cold++
    })

    return {
      all: data.queue.length,
      needs_call,
      called,
      priority,
      going_cold,
    }
  }, [data, staleAfter])

  if (!data && !error) return <Spinner />

  return (
    <PageShell>
      {/* Apple-grade Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#0066cc] dark:text-[#2997ff] uppercase tracking-wider">
              Sales Console
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Live Priority Queue
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight mt-1">
            Your queue
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Open leads ranked by intent and score. Call strongest first; converted and lost leads are safely archived.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void load()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <ArrowsClockwise size={13} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link
            href="/admin/leads"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[#1d1d1f] dark:text-white text-xs font-semibold active:scale-95 transition-all"
          >
            All leads <ArrowRight size={13} weight="bold" />
          </Link>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {/* Metrics Row: Crisp Apple Tiles */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Today */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/70 dark:border-zinc-800/80 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Today
              </span>
              <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center">
                <PhoneCall size={14} weight="bold" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight">
                {data.stats.today}
              </span>
              <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
                New arrivals
              </p>
            </div>
          </div>

          {/* Median Response */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/70 dark:border-zinc-800/80 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Response
              </span>
              <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Clock size={14} weight="bold" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight">
                {data.stats.median_response_minutes === null ? '—' : formatWait(data.stats.median_response_minutes)}
              </span>
              <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5 truncate" title={data.stats.median_response_minutes === null ? 'Needs 5 contacts to measure' : `${data.stats.contacted_sample} leads (30d)`}>
                {data.stats.median_response_minutes === null
                  ? (data.stats.contacted_sample > 0 ? `${data.stats.contacted_sample}/5 sampled` : 'Not measured')
                  : `${data.stats.contacted_sample} sample (30d)`}
              </p>
            </div>
          </div>

          {/* Hot */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/70 dark:border-zinc-800/80 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Hot
              </span>
              <div className="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Fire size={14} weight="fill" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
                {data.stats.hot}
              </span>
              <p className="text-[11px] font-medium text-rose-600/70 dark:text-rose-400/70 mt-0.5">
                Top priority
              </p>
            </div>
          </div>

          {/* Warm */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/70 dark:border-zinc-800/80 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Warm
              </span>
              <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <PhoneCall size={14} weight="bold" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight">
                {data.stats.warm}
              </span>
              <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
                Active buyers
              </p>
            </div>
          </div>

          {/* Going Cold */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/70 dark:border-zinc-800/80 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Going cold
              </span>
              <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Warning size={14} weight="bold" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                {data.stats.stale}
              </span>
              <p className="text-[11px] font-medium text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                &gt; 48h untouched
              </p>
            </div>
          </div>

          {/* Unassigned */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/70 dark:border-zinc-800/80 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Unassigned
              </span>
              <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <PhoneCall size={14} weight="bold" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight">
                {data.stats.unassigned}
              </span>
              <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
                Floor pool
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Queue Toolbar: Search & Segmented Filter Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Apple Segmented Pills */}
        <div className="inline-flex p-1 bg-zinc-100/80 dark:bg-zinc-800/60 rounded-full border border-zinc-200/60 dark:border-zinc-700/60 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-zinc-900 text-[#1d1d1f] dark:text-white shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            All ({tabCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('needs_call')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'needs_call'
                ? 'bg-white dark:bg-zinc-900 text-[#1d1d1f] dark:text-white shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Needs call ({tabCounts.needs_call})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('called')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'called'
                ? 'bg-white dark:bg-zinc-900 text-[#1d1d1f] dark:text-white shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Called ({tabCounts.called})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('priority')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'priority'
                ? 'bg-white dark:bg-zinc-900 text-[#1d1d1f] dark:text-white shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Hot & Warm ({tabCounts.priority})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('going_cold')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'going_cold'
                ? 'bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-400 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Going cold ({tabCounts.going_cold})
          </button>
        </div>

        {/* Search Input (Apple Pill) */}
        <div className="relative min-w-[240px] sm:w-72">
          <MagnifyingGlass
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, project..."
            className="w-full pl-9 pr-8 py-1.5 rounded-full bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs text-[#1d1d1f] dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] dark:focus:border-[#2997ff] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
            >
              <X size={12} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {data && filteredQueue.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center px-4 rounded-3xl bg-white dark:bg-[#18181b] border border-zinc-200/70 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
            <CheckCircle size={24} weight="fill" />
          </div>
          <h3 className="text-base font-bold text-[#1d1d1f] dark:text-white tracking-tight">
            {searchQuery || activeTab !== 'all' ? 'No matching leads found' : 'Your queue is clear'}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
            {searchQuery || activeTab !== 'all'
              ? 'Try adjusting your search query or switching active tab filter.'
              : 'Every open lead has been called or resolved. New requests will appear automatically.'}
          </p>
          {(searchQuery || activeTab !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setActiveTab('all')
              }}
              className="mt-4 px-4 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Queue Leads List */}
      {data && filteredQueue.length > 0 && (
        <div className="rounded-3xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-2xs">
          {filteredQueue.map((l) => {
            const age = Date.now() - new Date(l.created_at).getTime()
            const goingCold = l.status === 'new' && age > staleAfter
            const budget = budgetLabel(l)
            const isContacted = l.status === 'contacted'
            const initials = getInitials(l.name)
            const isHot = l.lead_tier === 'HOT'
            const isWarm = l.lead_tier === 'WARM'
            const timeAgo = formatDistanceToNow(new Date(l.created_at), { addSuffix: true })

            return (
              <div
                key={l.id}
                onClick={() => setBriefFor(l)}
                className="group px-5 py-4 sm:py-4.5 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-all cursor-pointer relative"
              >
                {/* Left: Lead Identity & Priority Avatar */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 select-none ${
                      isHot
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60'
                        : isWarm
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/60'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60'
                    }`}
                  >
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Top Identity Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-bold text-[#1d1d1f] dark:text-white tracking-tight truncate group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors">
                        {l.name}
                      </span>

                      {/* Tier Pill */}
                      {l.lead_tier && (
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            TIER_BADGE_STYLE[l.lead_tier] ?? TIER_BADGE_STYLE.COLD
                          }`}
                        >
                          {l.lead_tier}
                        </span>
                      )}

                      {/* Going Cold Badge */}
                      {goingCold && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60">
                          <Clock size={11} weight="bold" /> Going cold
                        </span>
                      )}

                      {/* Contact Status Badge */}
                      {isContacted ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                          <Check size={11} weight="bold" /> Called
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Needs call
                        </span>
                      )}

                      {/* Lead Score */}
                      {l.lead_score != null && (
                        <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                          Score {l.lead_score}
                        </span>
                      )}
                    </div>

                    {/* Metadata Sub-line */}
                    <div className="flex items-center gap-2 flex-wrap text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-1">
                      <a
                        href={`tel:${l.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-semibold text-zinc-800 dark:text-zinc-200 hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors"
                      >
                        <PhoneCall size={12} weight="bold" />
                        {l.phone}
                      </a>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
                        <Buildings size={12} weight="bold" className="text-zinc-400" />
                        {l.project_name ?? 'General enquiry'}
                      </span>
                      {budget && (
                        <>
                          <span>·</span>
                          <span className="font-medium text-zinc-600 dark:text-zinc-300">{budget}</span>
                        </>
                      )}
                      {l.intent_tier && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{l.intent_tier.replace(/-/g, ' ')}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="text-zinc-400 dark:text-zinc-500">{timeAgo}</span>
                    </div>

                    {/* AI Summary Quote (Clean, Quiet Apple-style) */}
                    {l.ai_summary && (
                      <p className="text-[12px] text-zinc-600 dark:text-zinc-300 mt-1.5 line-clamp-1 italic">
                        “{l.ai_summary}”
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions Cluster */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2.5 shrink-0 self-end lg:self-center pt-2 lg:pt-0"
                >
                  {/* Brief Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => setBriefFor(l)}
                    className="px-3.5 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-600 active:scale-95 transition-all cursor-pointer"
                  >
                    Brief
                  </button>

                  {/* Call Action or Undo */}
                  {l.status === 'new' ? (
                    <button
                      type="button"
                      disabled={savingId === l.id}
                      onClick={() => void updateStatus(l, 'contacted')}
                      className="px-4 py-1.5 rounded-full bg-[#1d1d1f] hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-2xs active:scale-95 transition-all disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {savingId === l.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check size={12} weight="bold" />
                      )}
                      Mark called
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={savingId === l.id}
                      onClick={() => void updateStatus(l, 'new')}
                      title="Undo call status and return to queue"
                      className="px-3.5 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {savingId === l.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-zinc-600 dark:border-zinc-300 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ArrowCounterClockwise size={12} weight="bold" />
                      )}
                      Undo
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom Link to Full Leads Directory */}
      <div className="pt-2">
        <Link
          href="/admin/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0066cc] dark:text-[#2997ff] hover:underline"
        >
          All leads, including converted and lost <ArrowRight size={13} weight="bold" />
        </Link>
      </div>

      {/* Floating Undo Toast */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#1d1d1f] text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xl border border-white/10 dark:border-black/10">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle size={16} weight="fill" className="text-emerald-400 dark:text-emerald-600 shrink-0" />
              <p className="text-xs font-medium truncate">
                Marked <b>{undoToast.lead.name}</b> called
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void updateStatus(undoToast.lead, 'new')}
                className="text-xs font-bold text-[#2997ff] dark:text-[#0066cc] hover:underline cursor-pointer px-1 py-0.5"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setUndoToast(null)}
                aria-label="Dismiss"
                className="p-1 text-zinc-400 hover:text-white dark:hover:text-zinc-900 cursor-pointer"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Modal: Lead Intelligence Brief */}
      {briefFor && (
        <LeadBriefPanel
          endpoint={`/admin/leads/${briefFor.id}/brief`}
          leadName={briefFor.name}
          onClose={() => setBriefFor(null)}
        />
      )}
    </PageShell>
  )
}

