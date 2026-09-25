'use client'

/**
 * PropFyndr Admin — Lead Intelligence & Pipeline.
 *
 * Implements Apple Design and Master Design Engineering principles:
 * - Anti-Nesting & Clarity: Elevated buyer dossier, clean typography, and
 *   structured metadata.
 * - Interactive Control: Instant status transitions, WhatsApp handoffs,
 *   one-click copy, and seamless integration with the AI conversation brief.
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Phone,
  PhoneCall,
  WhatsappLogo,
  Buildings,
  Handshake,
  SealCheck,
  Fire,
  Flame,
  Snowflake,
  MagnifyingGlass,
  ArrowsClockwise,
  X,
  Copy,
  Check,
  CaretRight,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  ArrowSquareOut
} from '@phosphor-icons/react'
import { format, formatDistanceToNow } from 'date-fns'
import { AnimatePresence, m } from 'framer-motion'
import { adminFetch } from '@/lib/adminFetch'
import { LeadDossierPanel } from '@/components/admin/LeadDossierPanel'
import { Skeleton } from '@/components/ui/skeleton'
import CustomSelect, { type SelectOption } from '@/components/admin/CustomSelect'
import LeadBriefPanel from '@/components/portal/LeadBriefPanel'
import { PageShell, PageHeader, Card, StatCard } from '@/components/portal/ui'

interface Lead {
  id: string
  name: string
  phone: string
  project_name: string | null
  project_slug: string | null
  user_id?: string | null
  guest_token?: string | null
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
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

type StatusType = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
type TierType = 'all' | 'HOT' | 'WARM' | 'COLD'

const STATUS_CONFIG: Record<
  StatusType,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  new: {
    label: 'New',
    bg: 'bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/60',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200/80 dark:border-blue-800/80',
    dot: 'bg-blue-500',
  },
  contacted: {
    label: 'Contacted',
    bg: 'bg-purple-50/80 dark:bg-purple-950/40 hover:bg-purple-100/80 dark:hover:bg-purple-900/60',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200/80 dark:border-purple-800/80',
    dot: 'bg-purple-500',
  },
  qualified: {
    label: 'Qualified',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/80 dark:border-emerald-800/80',
    dot: 'bg-emerald-500',
  },
  converted: {
    label: 'Converted',
    bg: 'bg-teal-50/80 dark:bg-teal-950/40 hover:bg-teal-100/80 dark:hover:bg-teal-900/60',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200/80 dark:border-teal-800/80',
    dot: 'bg-teal-500',
  },
  lost: {
    label: 'Lost',
    bg: 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700',
    text: 'text-zinc-600 dark:text-zinc-400',
    border: 'border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
  },
}

const TIER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Tiers' },
  { value: 'HOT', label: 'Hot Leads', dotColor: 'bg-rose-500' },
  { value: 'WARM', label: 'Warm Leads', dotColor: 'bg-amber-500' },
  { value: 'COLD', label: 'Cold Leads', dotColor: 'bg-sky-500' },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || 'BL'
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, '')
  if (clean.startsWith('+91') && clean.length === 13) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`
  }
  return phone
}

function renderTierBadge(tier: string | null, score: number | null) {
  if (tier === 'HOT') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80">
        <Fire size={13} weight="fill" className="text-rose-500" />
        <span>HOT · {score ?? 0}</span>
      </span>
    )
  }
  if (tier === 'WARM') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
        <Flame size={13} weight="fill" className="text-amber-500" />
        <span>WARM · {score ?? 0}</span>
      </span>
    )
  }
  if (tier === 'COLD') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80">
        <Snowflake size={13} weight="fill" className="text-sky-500" />
        <span>COLD · {score ?? 0}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
      Unscored
    </span>
  )
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
  const [briefFor, setBriefFor] = useState<Lead | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  const isFetchingRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const copyToClipboard = (text: string, key: string) => {
    try {
      void navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      showToast('Could not copy to clipboard', 'error')
    }
  }

  const fetchLeads = useCallback(
    async (isManualRefresh = false) => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true

      if (isManualRefresh) setIsRefreshing(true)

      try {
        const res = await adminFetch(`/admin/leads?status=${statusFilter}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setLeads(data.leads || [])
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
    },
    [statusFilter, showToast]
  )

  useEffect(() => {
    void fetchLeads()
  }, [fetchLeads])

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedLead(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const updateLeadStatus = async (id: string, newStatus: StatusType) => {
    try {
      const res = await adminFetch(`/admin/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')

      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)))
      if (selectedLead?.id === id) {
        setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
      showToast(`Lead updated to ${STATUS_CONFIG[newStatus].label}`, 'success')
    } catch {
      showToast('Could not update lead status', 'error')
    }
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        lead.name.toLowerCase().includes(query) ||
        lead.phone.includes(query) ||
        (lead.project_name && lead.project_name.toLowerCase().includes(query)) ||
        (lead.assigned_partner?.name && lead.assigned_partner.name.toLowerCase().includes(query))

      const matchesTier = tierFilter === 'all' || lead.lead_tier === tierFilter
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter

      return matchesSearch && matchesTier && matchesStatus
    })
  }, [leads, searchQuery, tierFilter, statusFilter])

  const stats = useMemo(() => {
    const total = leads.length
    const uncontacted = leads.filter((l) => l.status === 'new').length
    const hotCount = leads.filter((l) => l.lead_tier === 'HOT').length
    const warmCount = leads.filter((l) => l.lead_tier === 'WARM').length
    const qualifiedCount = leads.filter((l) => l.status === 'qualified' || l.status === 'converted').length

    const scoredLeads = leads.filter((l) => l.lead_score !== null)
    const avgScore =
      scoredLeads.length > 0
        ? Math.round(scoredLeads.reduce((acc, curr) => acc + (curr.lead_score ?? 0), 0) / scoredLeads.length)
        : 0

    const hotPercentage = total > 0 ? Math.round((hotCount / total) * 100) : 0

    return { total, uncontacted, hotCount, warmCount, qualifiedCount, avgScore, hotPercentage }
  }, [leads])

  return (
    <PageShell>
      {/* Page Header */}
      <PageHeader
        title="Lead Intelligence & Pipeline"
        subtitle="Real-time buyer inquiries, AI qualification scores, and automated CRM webhooks."
        action={
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
              Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
            </span>
            <button
              onClick={() => void fetchLeads(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
              title="Refresh lead pipeline"
            >
              <ArrowsClockwise
                size={14}
                weight="bold"
                className={isRefreshing ? 'animate-spin text-zinc-900 dark:text-white' : 'text-zinc-500'}
              />
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        }
      />

      {/* KPI StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Inquiries"
          value={stats.total}
          icon={<Users size={17} weight="bold" />}
          loading={loading}
          hint={
            stats.uncontacted > 0 ? (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {stats.uncontacted} uncontacted
              </span>
            ) : undefined
          }
        />
        <StatCard
          label="Hot Leads"
          value={stats.hotCount}
          icon={<Fire size={17} weight="bold" />}
          loading={loading}
          tone={stats.hotCount > 0 ? 'hot' : 'neutral'}
          hint={<span>{stats.hotPercentage}% of total</span>}
        />
        <StatCard
          label="Qualified Leads"
          value={stats.qualifiedCount}
          icon={<SealCheck size={17} weight="bold" />}
          loading={loading}
          tone="good"
          hint={<span>{stats.warmCount} warm in pipeline</span>}
        />
        <StatCard
          label="Avg Qualification"
          value={`${stats.avgScore}/100`}
          icon={<Target size={17} weight="bold" />}
          loading={loading}
          hint={<span>AI Intent Score</span>}
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="w-full flex-1 flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-2xs focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all">
          <MagnifyingGlass size={16} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Search buyer name, phone, project, partner…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[13px] font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tier Selector Dropdown */}
        <div className="w-full sm:w-44 shrink-0">
          <CustomSelect
            value={tierFilter}
            onChange={(v) => setTierFilter(v as TierType)}
            options={TIER_OPTIONS}
            size="md"
          />
        </div>

        {/* Segmented Pipeline Stage Tabs */}
        <div className="flex items-center p-1 bg-zinc-100/90 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shrink-0 overflow-x-auto w-full sm:w-auto">
          {(
            [
              { id: 'all', label: 'All Leads' },
              { id: 'new', label: 'New' },
              { id: 'contacted', label: 'Contacted' },
              { id: 'qualified', label: 'Qualified' },
              { id: 'converted', label: 'Converted' },
              { id: 'lost', label: 'Lost' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as 'all' | StatusType)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap capitalize ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Leads Table */}
      {loading ? (
        <Card className="overflow-hidden">
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            ))}
          </div>
        </Card>
      ) : filteredLeads.length === 0 ? (
        <Card className="py-16 text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mx-auto mb-3">
            <PhoneCall size={24} />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">No inquiries found</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No inquiries match "${searchQuery}". Clear your search query to see all records.`
              : 'There are no buyer inquiries matching the active status and tier filters.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Buyer Lead</th>
                  <th className="px-5 py-3.5">Target Project & Routing</th>
                  <th className="px-5 py-3.5">Qualification Tier</th>
                  <th className="px-5 py-3.5">Inquiry Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                  >
                    {/* Buyer Identity */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs shrink-0">
                          {getInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 dark:text-white truncate group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors text-[13px]">
                            {lead.name}
                          </p>
                          <p className="font-mono text-[11px] text-zinc-400 mt-0.5">
                            {formatPhone(lead.phone)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Target Project & Assigned Partner */}
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-medium">
                          <Buildings size={14} className="text-zinc-400 shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {lead.project_name || 'General Platform Inquiry'}
                          </span>
                        </div>
                        {lead.assigned_partner && (
                          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                            <Handshake size={12} className="text-zinc-400 shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {lead.assigned_partner.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Qualification Tier */}
                    <td className="px-5 py-4">
                      {renderTierBadge(lead.lead_tier, lead.lead_score)}
                    </td>

                    {/* Inquiry Date */}
                    <td className="px-5 py-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      <span title={format(new Date(lead.created_at), 'PPP p')}>
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </span>
                    </td>

                    {/* Status Dropdown */}
                    <td className="px-5 py-4 w-[150px]" onClick={(e) => e.stopPropagation()}>
                      <CustomSelect
                        value={lead.status}
                        onChange={(val) => void updateLeadStatus(lead.id, val as StatusType)}
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

                    {/* Actions */}
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`https://wa.me/91${lead.phone.replace(/[^\d]/g, '').slice(-10)}?text=${encodeURIComponent(
                            `Hi ${lead.name}, following up regarding your property inquiry on PropFyndr.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-2xs"
                          title="Open WhatsApp chat"
                        >
                          <WhatsappLogo size={14} weight="fill" />
                        </a>
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold transition-all shadow-2xs cursor-pointer text-xs active:scale-[0.98]"
                        >
                          <span>Dossier</span>
                          <CaretRight size={11} weight="bold" className="text-zinc-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ELEVATED LEAD DOSSIER REVIEW DIALOG */}
      <AnimatePresence>
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
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
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 my-auto flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-13 h-13 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-base flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700 shadow-2xs shrink-0">
                    {getInitials(selectedLead.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight truncate">
                      {selectedLead.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                      {renderTierBadge(selectedLead.lead_tier, selectedLead.lead_score)}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_CONFIG[selectedLead.status].bg} ${STATUS_CONFIG[selectedLead.status].text} ${STATUS_CONFIG[selectedLead.status].border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedLead.status].dot}`} />
                        <span>{STATUS_CONFIG[selectedLead.status].label}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setBriefFor(selectedLead)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                  >
                    <span>Full conversation brief</span>
                    <ArrowSquareOut size={13} weight="bold" />
                  </button>
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                    title="Close"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Contact Channels Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Phone + WhatsApp */}
                  <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Phone size={16} weight="bold" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Phone Number
                        </span>
                        <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white truncate block">
                          {formatPhone(selectedLead.phone)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(selectedLead.phone, 'phone')}
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                        title="Copy phone"
                      >
                        {copiedKey === 'phone' ? (
                          <Check size={13} weight="bold" className="text-emerald-500" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                      <a
                        href={`https://wa.me/91${selectedLead.phone.replace(/[^\d]/g, '').slice(-10)}?text=${encodeURIComponent(
                          `Hi ${selectedLead.name}, reaching out regarding your inquiry on PropFyndr.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-md transition-colors"
                        title="Open WhatsApp"
                      >
                        <WhatsappLogo size={16} weight="fill" />
                      </a>
                    </div>
                  </div>

                  {/* Target Project & Partner */}
                  <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Buildings size={16} weight="bold" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Target Project
                        </span>
                        <span className="text-xs font-bold text-zinc-900 dark:text-white truncate block">
                          {selectedLead.project_name || 'General Platform Inquiry'}
                        </span>
                      </div>
                    </div>

                    {selectedLead.assigned_partner && (
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shrink-0">
                        {selectedLead.assigned_partner.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Summary Banner */}
                {selectedLead.ai_summary && (
                  <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Executive AI Lead Summary
                    </span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                      {selectedLead.ai_summary}
                    </p>
                  </div>
                )}

                {/* Rich Buyer Dossier Panel */}
                <LeadDossierPanel leadId={selectedLead.id} />
              </div>

              {/* Modal Footer: Pipeline Status Control */}
              <div className="p-4 sm:p-5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Pipeline Stage:
                  </span>
                  <div className="flex items-center gap-1.5 p-1 bg-zinc-200/60 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    {(['new', 'contacted', 'qualified', 'converted', 'lost'] as const).map((st) => {
                      const isActive = selectedLead.status === st
                      return (
                        <button
                          key={st}
                          onClick={() => void updateLeadStatus(selectedLead.id, st)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                            isActive
                              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="text-[11px] text-zinc-400">
                    Logged {format(new Date(selectedLead.created_at), 'PPP')}
                  </span>
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="py-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold text-xs shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-2xl text-white text-xs font-bold shadow-2xl transition-all flex items-center gap-3 z-50 animate-fadeIn ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-zinc-900 dark:bg-white dark:text-zinc-900'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle size={16} weight="fill" />
          ) : (
            <CheckCircle size={16} weight="fill" className="text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Full Conversation Brief Modal */}
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
