'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { 
  Phone, 
  Search, 
  Flame, 
  Zap, 
  Snowflake, 
  Building2, 
  UserCheck, 
  Copy, 
  MessageSquare, 
  Filter, 
  BarChart3, 
  ChevronRight, 
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  Bookmark,
  Calendar,
  Wallet,
  ShieldCheck,
  Check,
  RotateCcw,
  ExternalLink,
  Users
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { AnimatePresence, m } from 'framer-motion'
import { adminFetch } from '@/lib/adminFetch'
import { LeadDossierPanel } from '@/components/admin/LeadDossierPanel'
import { Skeleton } from '@/components/ui/skeleton'
import CustomSelect from '@/components/admin/CustomSelect'

interface Lead {
  id: string
  name: string
  phone: string
  project_name: string | null
  project_slug: string | null
  user_id?: string | null
  guest_token?: string | null
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  /** Set when the builder routed this lead to one of their channel partners. */
  assigned_partner?: { id: string; name: string; builder: { id: string; name: string } | null } | null
  lead_tier: 'HOT' | 'WARM' | 'COLD' | null
  lead_score: number | null
  intent_tier: string | null
  loan_pre_approved?: boolean | null
  consent_given?: boolean | null
  projects_saved?: number | null
  projects_viewed?: number | null
  budget_min_cr?: number | null
  budget_max_cr?: number | null
  ai_summary?: string | null
  created_at: string
}

// `converted` is written by the builder and channel-partner consoles when a
// lead closes. It has to be a first-class status here too: STATUS_CONFIG is
// indexed directly at render time, so an unknown status throws rather than
// degrading.
type StatusType = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
type TierType = 'all' | 'HOT' | 'WARM' | 'COLD'

const STATUS_CONFIG: Record<StatusType, { label: string; bg: string; text: string; border: string; dot: string }> = {
  new: {
    label: 'New',
    bg: 'bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/60',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200/80 dark:border-blue-800/80',
    dot: 'bg-blue-500 shadow-2xs shadow-blue-500/50',
  },
  contacted: {
    label: 'Contacted',
    bg: 'bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/60',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/80 dark:border-amber-800/80',
    dot: 'bg-amber-500 shadow-2xs shadow-amber-500/50',
  },
  qualified: {
    label: 'Qualified',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/80 dark:border-emerald-800/80',
    dot: 'bg-emerald-500 shadow-2xs shadow-emerald-500/50',
  },
  converted: {
    label: 'Converted',
    bg: 'bg-teal-50/80 dark:bg-teal-950/40 hover:bg-teal-100/80 dark:hover:bg-teal-900/60',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200/80 dark:border-teal-800/80',
    dot: 'bg-teal-500 shadow-2xs shadow-teal-500/50',
  },
  lost: {
    label: 'Lost',
    bg: 'bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/60',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200/80 dark:border-rose-800/80',
    dot: 'bg-rose-500 shadow-2xs shadow-rose-500/50',
  },
}

export default function BuilderLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const [statusFilter, setStatusFilter] = useState<'all' | StatusType>('all')
  const [tierFilter, setTierFilter] = useState<'all' | 'HOT' | 'WARM' | 'COLD'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  
  const isFetchingRef = useRef(false)

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchLeads = useCallback(async (isManualRefresh = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (isManualRefresh) setIsRefreshing(true)

    const fetchWithRetry = async (attempt = 1): Promise<Lead[]> => {
      try {
        const res = await adminFetch(`/admin/leads?status=${statusFilter}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        return data.leads || []
      } catch (err) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 350))
          return fetchWithRetry(attempt + 1)
        }
        throw err
      }
    }

    try {
      const fetched = await fetchWithRetry()
      setLeads(fetched)
      setLastRefreshedAt(new Date())

      if (isManualRefresh) {
        showToast('Leads pipeline refreshed', 'success')
      }
    } catch {
      showToast('Failed to fetch lead pipeline', 'error')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [statusFilter, showToast])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Global Escape Key Listener to close dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedLead(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const updateLeadStatus = async (leadId: string, newStatus: StatusType) => {
    try {
      const res = await adminFetch(`/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
        if (selectedLead?.id === leadId) {
          setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null)
        }
        showToast(`Lead marked as ${STATUS_CONFIG[newStatus].label}`, 'success')
      } else {
        showToast(`Failed to update lead status`, 'error')
      }
    } catch {
      showToast('Error updating lead status', 'error')
    }
  }

  const copyToClipboard = (text: string, label = 'Phone') => {
    navigator.clipboard.writeText(text)
    showToast(`Copied ${label}`, 'success')
  }

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesTier = tierFilter === 'all' || (lead.lead_tier && lead.lead_tier.toUpperCase() === tierFilter.toUpperCase())
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch = !query || 
        lead.name.toLowerCase().includes(query) ||
        lead.phone.includes(query) ||
        (lead.project_name && lead.project_name.toLowerCase().includes(query)) ||
        (lead.project_slug && lead.project_slug.toLowerCase().includes(query))
      
      return matchesTier && matchesSearch
    })
  }, [leads, tierFilter, searchQuery])

  // Analytics Metrics
  const stats = useMemo(() => {
    const total = leads.length
    const hot = leads.filter(l => l.lead_tier === 'HOT').length
    const warm = leads.filter(l => l.lead_tier === 'WARM').length
    const cold = leads.filter(l => l.lead_tier === 'COLD').length
    const newLeads = leads.filter(l => l.status === 'new').length
    const qualified = leads.filter(l => l.status === 'qualified').length
    const converted = leads.filter(l => l.status === 'converted').length
    const avgScore = total > 0 
      ? Math.round(leads.reduce((acc, curr) => acc + (curr.lead_score || 0), 0) / total) 
      : 0

    return { total, hot, warm, cold, newLeads, qualified, converted, avgScore }
  }, [leads])

  const getTierBadge = (tier: string | null, score: number | null) => {
    switch (tier) {
      case 'HOT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80">
            <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>HOT</span>
            {score !== null && <span className="font-mono text-[11px] opacity-75">· {score}</span>}
          </span>
        )
      case 'WARM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
            <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>WARM</span>
            {score !== null && <span className="font-mono text-[11px] opacity-75">· {score}</span>}
          </span>
        )
      case 'COLD':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80">
            <Snowflake className="w-3.5 h-3.5 text-sky-500" />
            <span>COLD</span>
            {score !== null && <span className="font-mono text-[11px] opacity-75">· {score}</span>}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
            Unscored
          </span>
        )
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  }

  return (
    <div className="space-y-6 pb-16 font-sans select-none max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Lead Intelligence & Pipeline
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Real-time buyer inquiries, qualification scores, and automated CRM webhooks
          </p>
        </div>

        {/* Refresh Action Button & Live Status */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
            Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>

          <button
            onClick={() => fetchLeads(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh lead pipeline"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards — High Taste Zinc Tokens */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inquiries */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Inquiries
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.total}
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {stats.newLeads} uncontacted
            </span>
          </div>
        </div>

        {/* Hot Leads */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Hot Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.hot}
            </span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {stats.total > 0 ? `${Math.round((stats.hot / stats.total) * 100)}% of total` : '0%'}
            </span>
          </div>
        </div>

        {/* Qualified */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Qualified Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.qualified}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {stats.warm} warm
            </span>
          </div>
        </div>

        {/* Avg Score */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Avg Qualification
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : `${stats.avgScore}/100`}
            </span>
            <div className="w-16 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden self-center border border-zinc-200/60 dark:border-zinc-700">
              <div 
                className="h-full bg-zinc-900 dark:bg-white rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(100, stats.avgScore)}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Control Toolbar: Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="group flex-1 w-full flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <Search size={15} className="text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search buyer name, phone, project..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tier Selector & Segmented Filter Pills */}
        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto overflow-x-auto">
          {/* Tier Filter using CustomSelect */}
          <CustomSelect
            value={tierFilter}
            onChange={(v) => setTierFilter(v as TierType)}
            options={[
              { value: 'all', label: 'All Tiers' },
              { value: 'HOT', label: 'HOT Tier', dotColor: 'bg-rose-500' },
              { value: 'WARM', label: 'WARM Tier', dotColor: 'bg-amber-500' },
              { value: 'COLD', label: 'COLD Tier', dotColor: 'bg-blue-400' },
            ]}
            size="sm"
            className="w-[140px] shrink-0"
          />

          {/* Segmented Filter Pills */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shrink-0 overflow-x-auto">
            {(['all', 'new', 'contacted', 'qualified', 'converted', 'lost'] as const).map(st => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st)
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap capitalize ${
                  statusFilter === st
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {st === 'all' ? 'All Leads' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Data Table Card */}
      {loading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-2xs">
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">No leads match your search</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or filters to discover matching inquiries.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Buyer Lead</th>
                  <th className="px-6 py-4">Target Project</th>
                  <th className="px-6 py-4">Qualification Tier</th>
                  <th className="px-6 py-4">Inquiry Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                {filteredLeads.map(lead => {
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                    >
                      {/* Buyer Lead Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                            {getInitials(lead.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {lead.name}
                            </p>
                            <p className="text-[11px] font-mono text-zinc-500 font-semibold mt-0.5">
                              {lead.phone}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Target Project */}
                      <td className="px-6 py-4">
                        {lead.project_name ? (
                          <div className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
                            <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{lead.project_name}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-xs italic">General Inquiry</span>
                        )}
                        {/* Who the builder routed this to, if anyone. */}
                        {lead.assigned_partner && (
                          <div className="mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate max-w-[180px]">
                            → {lead.assigned_partner.name}
                          </div>
                        )}
                      </td>

                      {/* Qualification Tier */}
                      <td className="px-6 py-4">
                        {getTierBadge(lead.lead_tier, lead.lead_score)}
                      </td>

                      {/* Submitted Date */}
                      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        <span title={format(new Date(lead.created_at), 'PPP p')}>
                          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                        </span>
                      </td>

                      {/* Interactive Status Dropdown via CustomSelect */}
                      <td className="px-6 py-4 w-[160px]" onClick={e => e.stopPropagation()}>
                        <CustomSelect
                          value={lead.status}
                          onChange={(val) => updateLeadStatus(lead.id, val as StatusType)}
                          options={[
                            { value: 'new', label: 'New', dotColor: 'bg-blue-500' },
                            { value: 'contacted', label: 'Contacted', dotColor: 'bg-purple-500' },
                            { value: 'qualified', label: 'Qualified', dotColor: 'bg-emerald-500' },
                            { value: 'converted', label: 'Converted', dotColor: 'bg-teal-500' },
                            { value: 'lost', label: 'Lost', dotColor: 'bg-zinc-400' },
                          ]}
                          size="sm"
                        />
                      </td>

                      {/* Actions: Direct WhatsApp & Review Dossier */}
                      <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`https://wa.me/91${lead.phone.replace(/^\+?91/, '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${lead.name}, reaching out from PropFyndr regarding ${lead.project_name || 'your property inquiry'}.`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs"
                            title="Direct WhatsApp chat"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 font-semibold transition-all shadow-2xs cursor-pointer text-xs"
                          >
                            <span>Dossier</span>
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CENTERED LEAD DETAIL REVIEW DIALOG */}
      <AnimatePresence>
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
              onClick={() => setSelectedLead(null)}
            />

            {/* Modal Card */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 my-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-start justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-base flex items-center justify-center shadow-xs shrink-0">
                    {getInitials(selectedLead.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white truncate tracking-tight">
                      {selectedLead.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                      {getTierBadge(selectedLead.lead_tier, selectedLead.lead_score)}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_CONFIG[selectedLead.status].bg} ${STATUS_CONFIG[selectedLead.status].text} ${STATUS_CONFIG[selectedLead.status].border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedLead.status].dot}`} />
                        <span>{STATUS_CONFIG[selectedLead.status].label}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedLead(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4 text-xs">
                {/* Contact & Inquiry Info */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Contact Channels
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">{selectedLead.phone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyToClipboard(selectedLead.phone)} className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`https://wa.me/91${selectedLead.phone.replace(/^\+91/, '')}?text=${encodeURIComponent(`Hi ${selectedLead.name}, reaching out regarding your inquiry on PropFyndr.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:bg-emerald-50 p-1 rounded-md"
                          title="Open WhatsApp"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="font-bold text-zinc-900 dark:text-white truncate">
                          {selectedLead.project_name || 'General Inquiry'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Summary / Intent */}
                {selectedLead.ai_summary && (
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                      AI Lead Intelligence Summary
                    </span>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                      {selectedLead.ai_summary}
                    </p>
                  </div>
                )}

                <LeadDossierPanel leadId={selectedLead.id} />

                {/* Status Switcher Section inside Modal */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                    Update Pipeline Status
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {(['new', 'contacted', 'qualified', 'converted', 'lost'] as const).map(st => {
                      const cfg = STATUS_CONFIG[st]
                      const isActive = selectedLead.status === st
                      return (
                        <button
                          key={st}
                          onClick={() => updateLeadStatus(selectedLead.id, st)}
                          className={`py-2.5 rounded-xl text-xs font-bold capitalize transition-all border flex flex-col items-center gap-1 cursor-pointer ${
                            isActive
                              ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-2 ring-blue-500/20 shadow-2xs`
                              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span>{cfg.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-zinc-500">
                  Inquiry logged {format(new Date(selectedLead.created_at), 'PPP')}
                </span>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="py-2 px-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs shadow-2xs hover:bg-black cursor-pointer"
                >
                  Close
                </button>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Banner */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-2xl text-white text-xs font-bold shadow-2xl transition-all flex items-center gap-3 z-50 ${
          toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
