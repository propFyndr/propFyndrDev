'use client'

/**
 * PropFyndr Admin — Developer & Builder Registrations Review.
 *
 * Implements Apple Design and Master Design Engineering principles:
 * - Anti-Nesting Rule: Replaces claustrophobic nested grey cards with an executive
 *   dossier layout, structured tab panels, and clean hairline dividers.
 * - Hierarchy & Restraint: High-contrast typography, clear status chips, and
 *   meaningful elevation.
 * - Rich Micro-Interactions: One-click copy with instant feedback, WhatsApp handoff,
 *   subtle spring animations, and tactile action buttons.
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Buildings,
  EnvelopeSimple,
  Phone,
  PhoneCall,
  MapPin,
  Globe,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  Users,
  Briefcase,
  Medal,
  Clock,
  CheckCircle,
  XCircle,
  X,
  ArrowSquareOut,
  WhatsappLogo,
  LinkedinLogo,
  MagnifyingGlass,
  ArrowsClockwise,
  CaretRight,
  SealCheck,
  HardDrives,
  Prohibit,
  WarningCircle,
  Bell
} from '@phosphor-icons/react'
import { AnimatePresence, m } from 'framer-motion'
import { adminFetch } from '@/lib/adminFetch'
import { Skeleton } from '@/components/ui/skeleton'
import CustomSelect from '@/components/admin/CustomSelect'
import { format, formatDistanceToNow } from 'date-fns'
import { PageShell, PageHeader, Card, StatCard } from '@/components/portal/ui'

interface BuilderApplication {
  id: string
  name: string
  email: string
  phone: string
  landline?: string | null
  headquarters: string | null
  status: 'new' | 'reviewing' | 'approved' | 'rejected'
  submitted_at: string
  cin?: string | null
  website?: string | null
  description?: string | null
  logo_url?: string | null
  tagline?: string | null
  completed_projects_count?: string | null
  sqft_delivered?: string | null
  delivery_track?: string | null
  executives?: Array<{ name: string; title: string; experience_years?: number | string; linkedin?: string }>
  legal_entities?: Array<{ name: string; registration_number: string; state?: string }>
  projects?: string[]
  ip_address?: string | null
  user_agent?: string | null
}

type StatusFilter = 'all' | 'new' | 'reviewing' | 'approved' | 'rejected'

const STATUS_CONFIG: Record<
  BuilderApplication['status'],
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  new: {
    label: 'New',
    bg: 'bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/60',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200/80 dark:border-blue-800/80',
    dot: 'bg-blue-500',
  },
  reviewing: {
    label: 'Reviewing',
    bg: 'bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/60',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/80 dark:border-amber-800/80',
    dot: 'bg-amber-500',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/80 dark:border-emerald-800/80',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/60',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200/80 dark:border-rose-800/80',
    dot: 'bg-rose-500',
  },
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || 'BR'
}

function formatPhoneNumber(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, '')
  if (clean.startsWith('+91') && clean.length === 13) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`
  }
  return phone
}

export default function BuilderApplicationsPage() {
  const [applications, setApplications] = useState<BuilderApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())
  const [hasNewApplications, setHasNewApplications] = useState(false)
  const [newCountDifference, setNewCountDifference] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [selectedApp, setSelectedApp] = useState<BuilderApplication | null>(null)
  const [activeModalTab, setActiveModalTab] = useState<'dossier' | 'legal' | 'audit'>('dossier')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
    actionLabel?: string
    onAction?: () => void
  } | null>(null)

  const applicationsCountRef = useRef(0)
  applicationsCountRef.current = applications.length

  const isFetchingRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success', actionLabel?: string, onAction?: () => void) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setToast({ message, type, actionLabel, onAction })
      toastTimerRef.current = setTimeout(() => setToast(null), 4500)
    },
    []
  )

  const copyToClipboard = (text: string, key: string) => {
    try {
      void navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      showToast('Could not copy to clipboard', 'error')
    }
  }

  // Load applications from API
  const loadApplications = useCallback(
    async (isManualRefresh = false) => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true

      if (isManualRefresh) {
        setIsRefreshing(true)
        setHasNewApplications(false)
      }

      try {
        const res = await adminFetch('/builder-applications')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setApplications(data.applications || [])
        setLastRefreshedAt(new Date())
        setHasNewApplications(false)
        setNewCountDifference(0)

        if (isManualRefresh) {
          showToast('Applications list refreshed', 'success')
        }
      } catch {
        showToast('Failed to load builder applications', 'error')
      } finally {
        setLoading(false)
        setIsRefreshing(false)
        isFetchingRef.current = false
      }
    },
    [showToast]
  )

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  // Background polling every 20 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isFetchingRef.current) return
      try {
        const res = await adminFetch('/builder-applications')
        if (!res.ok) return
        const data = await res.json()
        const fetched: BuilderApplication[] = data.applications || []

        const prevCount = applicationsCountRef.current
        if (fetched.length > prevCount && prevCount > 0) {
          const diff = fetched.length - prevCount
          setHasNewApplications(true)
          setNewCountDifference(diff)

          showToast(`${diff} new registration application received`, 'info', 'Refresh Now', () =>
            void loadApplications(true)
          )
        }
      } catch {
        // Silent polling error handling
      }
    }, 20000)

    return () => clearInterval(interval)
  }, [loadApplications, showToast])

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedApp(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Status update handler
  const handleUpdateStatus = async (id: string, newStatus: BuilderApplication['status']) => {
    setUpdatingId(id)
    try {
      const res = await adminFetch(`/builder-applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')

      setApplications((apps) => apps.map((a) => (a.id === id ? { ...a, status: newStatus } : a)))
      if (selectedApp?.id === id) {
        setSelectedApp((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
      showToast(`Application marked as ${STATUS_CONFIG[newStatus].label}`, 'success')
    } catch {
      showToast('Failed to update application status', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  // Filter and search
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        app.name.toLowerCase().includes(query) ||
        app.email.toLowerCase().includes(query) ||
        app.phone.includes(query) ||
        (app.cin && app.cin.toLowerCase().includes(query)) ||
        (app.headquarters && app.headquarters.toLowerCase().includes(query))

      const matchesFilter = filter === 'all' || app.status === filter
      return matchesSearch && matchesFilter
    })
  }, [applications, searchQuery, filter])

  const stats = useMemo(() => {
    const total = applications.length
    const newCount = applications.filter((a) => a.status === 'new').length
    const reviewing = applications.filter((a) => a.status === 'reviewing').length
    const approved = applications.filter((a) => a.status === 'approved').length
    const rejected = applications.filter((a) => a.status === 'rejected').length
    return { total, newCount, reviewing, approved, rejected }
  }, [applications])

  return (
    <PageShell>
      {/* Page Header */}
      <PageHeader
        title="Builder Registrations"
        subtitle="Review developer onboarding applications, verify RERA compliance, and approve access."
        action={
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
              Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
            </span>
            <button
              onClick={() => void loadApplications(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
              title="Refresh applications list"
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

      {/* New Application Notification Banner */}
      <AnimatePresence>
        {hasNewApplications && (
          <m.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="p-4 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-4 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Bell size={16} weight="fill" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-100">
                  New Builder Application Received
                </h4>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                  {newCountDifference} new onboarding request is waiting for verification.
                </p>
              </div>
            </div>

            <button
              onClick={() => void loadApplications(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer shrink-0 inline-flex items-center gap-1.5 active:scale-[0.98]"
            >
              <ArrowsClockwise size={13} weight="bold" className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh Now</span>
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Requests"
          value={stats.total}
          icon={<Buildings size={17} weight="bold" />}
          loading={loading}
          hint={
            stats.newCount > 0 ? (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {stats.newCount} pending
              </span>
            ) : undefined
          }
        />
        <StatCard
          label="Under Review"
          value={stats.reviewing}
          icon={<Clock size={17} weight="bold" />}
          loading={loading}
          hint={<span className="text-xs font-semibold text-amber-600 dark:text-amber-400">In verification</span>}
        />
        <StatCard
          label="Approved Builders"
          value={stats.approved}
          icon={<SealCheck size={17} weight="bold" />}
          loading={loading}
          tone="good"
          hint={<span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active partners</span>}
        />
        <StatCard
          label="Declined"
          value={stats.rejected}
          icon={<XCircle size={17} weight="bold" />}
          loading={loading}
          hint={<span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Unverified</span>}
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="w-full flex-1 flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-2xs focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all">
          <MagnifyingGlass size={16} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Search builder name, email, CIN, headquarters…"
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

        {/* Segmented Filter Control */}
        <div className="flex items-center p-1 bg-zinc-100/90 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shrink-0 overflow-x-auto w-full sm:w-auto">
          {(
            [
              { id: 'all', label: 'All', count: stats.total },
              { id: 'new', label: 'New', count: stats.newCount },
              { id: 'reviewing', label: 'Reviewing', count: stats.reviewing },
              { id: 'approved', label: 'Approved', count: stats.approved },
              { id: 'rejected', label: 'Declined', count: stats.rejected },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as StatusFilter)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filter === tab.id
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filter === tab.id
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    : 'bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Data Table */}
      {loading ? (
        <Card className="overflow-hidden">
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-4 w-36 flex-1" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            ))}
          </div>
        </Card>
      ) : filteredApplications.length === 0 ? (
        <Card className="py-16 text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mx-auto mb-3">
            <Buildings size={24} />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">No registrations found</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No requests match "${searchQuery}". Clear your search query to see all applications.`
              : 'There are currently no onboarding requests in this category.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Company Info</th>
                  <th className="px-5 py-3.5">Contact</th>
                  <th className="px-5 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                {filteredApplications.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => {
                      setSelectedApp(app)
                      setActiveModalTab('dossier')
                    }}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                  >
                    {/* Company Info */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs shrink-0 overflow-hidden">
                          {app.logo_url && (app.logo_url.startsWith('data:') || app.logo_url.startsWith('http')) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={app.logo_url}
                              alt={app.name}
                              className="w-full h-full object-contain bg-white p-1"
                            />
                          ) : (
                            getInitials(app.name)
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 dark:text-white truncate group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors text-[13px]">
                            {app.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-zinc-400 flex items-center gap-1 truncate">
                              <MapPin size={11} className="text-zinc-400 shrink-0" />
                              <span>{app.headquarters || 'No HQ specified'}</span>
                            </span>
                            {app.cin && (
                              <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-200/60 dark:border-zinc-700/60">
                                CIN: {app.cin}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[220px]">
                          {app.email}
                        </p>
                        <p className="font-mono text-[11px] text-zinc-500 font-semibold">
                          {formatPhoneNumber(app.phone)}
                        </p>
                      </div>
                    </td>

                    {/* Submitted Date */}
                    <td className="px-5 py-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      <span title={format(new Date(app.submitted_at), 'PPP p')}>
                        {formatDistanceToNow(new Date(app.submitted_at), { addSuffix: true })}
                      </span>
                    </td>

                    {/* Quick Status Dropdown */}
                    <td className="px-5 py-4 w-[150px]" onClick={(e) => e.stopPropagation()}>
                      <CustomSelect
                        value={app.status}
                        onChange={(val) => handleUpdateStatus(app.id, val as BuilderApplication['status'])}
                        options={[
                          { value: 'new', label: 'New', dotColor: 'bg-blue-500' },
                          { value: 'reviewing', label: 'Reviewing', dotColor: 'bg-amber-500' },
                          { value: 'approved', label: 'Approved', dotColor: 'bg-emerald-500' },
                          { value: 'rejected', label: 'Declined', dotColor: 'bg-rose-500' },
                        ]}
                        size="sm"
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedApp(app)
                          setActiveModalTab('dossier')
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
                      >
                        <span>Review</span>
                        <CaretRight size={12} weight="bold" className="text-zinc-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* COMPREHENSIVE EXECUTIVE REVIEW MODAL */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
              onClick={() => setSelectedApp(null)}
            />

            {/* Modal Window Card */}
            <m.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 my-auto flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Header */}
              <div className="p-5 sm:p-6 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  {/* Monogram / Logo */}
                  <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-lg flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700 shadow-2xs shrink-0 overflow-hidden">
                    {selectedApp.logo_url &&
                    (selectedApp.logo_url.startsWith('data:') || selectedApp.logo_url.startsWith('http')) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedApp.logo_url}
                        alt={selectedApp.name}
                        className="w-full h-full object-contain bg-white rounded-xl p-1"
                      />
                    ) : (
                      getInitials(selectedApp.name)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight truncate">
                        {selectedApp.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/80">
                        <ShieldCheck size={13} weight="fill" /> RERA Standard
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                      {/* Status Chip */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_CONFIG[selectedApp.status].bg} ${STATUS_CONFIG[selectedApp.status].text} ${STATUS_CONFIG[selectedApp.status].border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedApp.status].dot}`} />
                        <span>{STATUS_CONFIG[selectedApp.status].label}</span>
                      </span>

                      {selectedApp.headquarters && (
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium inline-flex items-center gap-1">
                          <MapPin size={13} className="text-zinc-400" />
                          <span>{selectedApp.headquarters}</span>
                        </span>
                      )}

                      {selectedApp.cin && (
                        <div className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                          <span className="font-mono text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                            CIN: {selectedApp.cin}
                          </span>
                          <button
                            onClick={() => copyToClipboard(selectedApp.cin!, 'cin')}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                            title="Copy CIN"
                          >
                            {copiedKey === 'cin' ? (
                              <Check size={11} weight="bold" className="text-emerald-500" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      )}

                      <span className="text-zinc-400 dark:text-zinc-500 inline-flex items-center gap-1">
                        <Clock size={12} />
                        Submitted {format(new Date(selectedApp.submitted_at), 'PPP')}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedApp(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                  title="Close modal"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              {/* Modal Tabs Bar */}
              <div className="flex items-center px-6 border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 gap-6 text-xs font-bold">
                <button
                  onClick={() => setActiveModalTab('dossier')}
                  className={`py-3.5 border-b-2 transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    activeModalTab === 'dossier'
                      ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                      : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <Briefcase size={14} weight="bold" />
                  <span>Dossier & Track Record</span>
                </button>

                <button
                  onClick={() => setActiveModalTab('legal')}
                  className={`py-3.5 border-b-2 transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    activeModalTab === 'legal'
                      ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                      : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <Users size={14} weight="bold" />
                  <span>
                    Leadership & Legal (
                    {(selectedApp.executives?.length || 0) + (selectedApp.legal_entities?.length || 0)})
                  </span>
                </button>

                <button
                  onClick={() => setActiveModalTab('audit')}
                  className={`py-3.5 border-b-2 transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    activeModalTab === 'audit'
                      ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                      : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <HardDrives size={14} weight="bold" />
                  <span>Audit & Technical Logs</span>
                </button>
              </div>

              {/* Modal Scrollable Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {activeModalTab === 'dossier' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Contact Channels Grid */}
                    <div>
                      <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                        Direct Contact Channels
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Official Email */}
                        <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                              <EnvelopeSimple size={16} weight="bold" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Official Email
                              </span>
                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                                {selectedApp.email}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => copyToClipboard(selectedApp.email, 'email')}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            title="Copy email"
                          >
                            {copiedKey === 'email' ? (
                              <Check size={13} weight="bold" className="text-emerald-500" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>

                        {/* Mobile Phone + WhatsApp */}
                        <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <Phone size={16} weight="bold" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Mobile Phone
                              </span>
                              <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                                {formatPhoneNumber(selectedApp.phone)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyToClipboard(selectedApp.phone, 'phone')}
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
                              href={`https://wa.me/91${selectedApp.phone.replace(/[^\d]/g, '').slice(-10)}?text=${encodeURIComponent(
                                `Hi ${selectedApp.name}, following up regarding your builder registration application on PropFyndr.`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-md transition-colors"
                              title="Message on WhatsApp"
                            >
                              <WhatsappLogo size={16} weight="fill" />
                            </a>
                          </div>
                        </div>

                        {/* Landline */}
                        <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                              <PhoneCall size={16} weight="bold" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Landline
                              </span>
                              <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 truncate block">
                                {selectedApp.landline || 'Not provided'}
                              </span>
                            </div>
                          </div>
                          {selectedApp.landline && (
                            <button
                              onClick={() => copyToClipboard(selectedApp.landline!, 'landline')}
                              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                              title="Copy landline"
                            >
                              {copiedKey === 'landline' ? (
                                <Check size={13} weight="bold" className="text-emerald-500" />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Website */}
                        <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                              <Globe size={16} weight="bold" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Corporate Website
                              </span>
                              {selectedApp.website ? (
                                <a
                                  href={
                                    selectedApp.website.startsWith('http')
                                      ? selectedApp.website
                                      : `https://${selectedApp.website}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-bold text-zinc-900 dark:text-white hover:underline truncate block"
                                >
                                  {selectedApp.website.replace(/^https?:\/\//, '')}
                                </a>
                              ) : (
                                <span className="text-xs text-zinc-400 italic">Not provided</span>
                              )}
                            </div>
                          </div>
                          {selectedApp.website && (
                            <a
                              href={
                                selectedApp.website.startsWith('http')
                                  ? selectedApp.website
                                  : `https://${selectedApp.website}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              title="Open website"
                            >
                              <ArrowSquareOut size={14} weight="bold" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Scale & Track Record */}
                    <div>
                      <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                        Track Record & Development Scale
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Completed Projects
                          </span>
                          <span className="text-lg font-black text-zinc-900 dark:text-white mt-1 block">
                            {selectedApp.completed_projects_count || 'Not specified'}
                          </span>
                        </div>
                        <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Sq.Ft Delivered
                          </span>
                          <span className="text-lg font-black text-zinc-900 dark:text-white mt-1 block">
                            {selectedApp.sqft_delivered || 'Not specified'}
                          </span>
                        </div>
                      </div>

                      {/* Notable Projects */}
                      <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Notable Flagship Projects
                        </span>
                        {selectedApp.projects && selectedApp.projects.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedApp.projects.map((p, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 font-bold text-zinc-800 dark:text-zinc-200 text-xs shadow-2xs"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-400 italic">No notable projects listed in application.</p>
                        )}
                      </div>

                      {/* Delivery Summary */}
                      {selectedApp.delivery_track && (
                        <div className="mt-3 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                            Delivery Performance Summary
                          </span>
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                            {selectedApp.delivery_track}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Company Bio */}
                    <div>
                      <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                        Company Bio & Corporate Narrative
                      </h4>
                      <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
                        {selectedApp.tagline && (
                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                              Corporate Tagline
                            </span>
                            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 italic">
                              &ldquo;{selectedApp.tagline}&rdquo;
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                            Overview
                          </span>
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                            {selectedApp.description || 'No detailed company description provided during onboarding.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeModalTab === 'legal' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Legal Entities & RERA */}
                    <div>
                      <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                        Registered Legal Entities & RERA Registration
                      </h4>
                      {selectedApp.legal_entities && selectedApp.legal_entities.length > 0 ? (
                        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-2xs">
                          {selectedApp.legal_entities.map((e, idx) => (
                            <div key={idx} className="p-4 flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0">
                                <span className="font-bold text-zinc-900 dark:text-white block text-[13px]">
                                  {e.name}
                                </span>
                                {e.state && (
                                  <span className="text-[11px] text-zinc-400 block mt-0.5">State: {e.state}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
                                  {e.registration_number || 'N/A'}
                                </span>
                                {e.registration_number && (
                                  <button
                                    onClick={() => copyToClipboard(e.registration_number, `rera-${idx}`)}
                                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                    title="Copy RERA"
                                  >
                                    {copiedKey === `rera-${idx}` ? (
                                      <Check size={13} weight="bold" className="text-emerald-500" />
                                    ) : (
                                      <Copy size={13} />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                          No distinct legal entities submitted.
                        </p>
                      )}
                    </div>

                    {/* Executive Leadership Team */}
                    <div>
                      <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                        Executive Leadership & Key Management
                      </h4>
                      {selectedApp.executives && selectedApp.executives.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedApp.executives.map((exec, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
                                  {getInitials(exec.name)}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="font-bold text-zinc-900 dark:text-white text-xs truncate">
                                    {exec.name}
                                  </h5>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                    {exec.title || 'Director / Board Member'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {exec.experience_years && (
                                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                    {exec.experience_years} yrs
                                  </span>
                                )}
                                {exec.linkedin && (
                                  <a
                                    href={
                                      exec.linkedin.startsWith('http')
                                        ? exec.linkedin
                                        : `https://${exec.linkedin}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
                                    title="View LinkedIn Profile"
                                  >
                                    <LinkedinLogo size={16} weight="fill" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                          No executive members listed.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeModalTab === 'audit' && (
                  <div className="space-y-4 animate-fadeIn text-xs">
                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Technical Audit Trail
                    </h4>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-2xs">
                      <div className="p-4 flex items-center justify-between">
                        <span className="text-zinc-500 font-medium">Application UUID</span>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {selectedApp.id}
                          </code>
                          <button
                            onClick={() => copyToClipboard(selectedApp.id, 'app-id')}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                          >
                            {copiedKey === 'app-id' ? (
                              <Check size={13} weight="bold" className="text-emerald-500" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-4 flex items-center justify-between">
                        <span className="text-zinc-500 font-medium">Origin IP Address</span>
                        <code className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {selectedApp.ip_address || '127.0.0.1'}
                        </code>
                      </div>

                      <div className="p-4 flex items-center justify-between">
                        <span className="text-zinc-500 font-medium">Exact Submission Timestamp</span>
                        <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 font-medium">
                          {format(new Date(selectedApp.submitted_at), 'PPP p')}
                        </span>
                      </div>

                      {selectedApp.user_agent && (
                        <div className="p-4 space-y-1">
                          <span className="text-zinc-500 font-medium block">User Agent</span>
                          <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 break-all">
                            {selectedApp.user_agent}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer: Executive Approval Console */}
              <div className="p-4 sm:p-5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Status:
                  </span>
                  <div className="flex items-center gap-1.5 p-1 bg-zinc-200/60 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    {(['new', 'reviewing', 'approved', 'rejected'] as const).map((st) => {
                      const isActive = selectedApp.status === st
                      return (
                        <button
                          key={st}
                          disabled={updatingId === selectedApp.id}
                          onClick={() => void handleUpdateStatus(selectedApp.id, st)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                            isActive
                              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          {st === 'rejected' ? 'Declined' : st}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 justify-end">
                  {selectedApp.status !== 'rejected' && (
                    <button
                      disabled={updatingId === selectedApp.id}
                      onClick={() => void handleUpdateStatus(selectedApp.id, 'rejected')}
                      className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer shadow-2xs"
                    >
                      <Prohibit size={14} weight="bold" />
                      <span>Decline</span>
                    </button>
                  )}

                  {selectedApp.status !== 'approved' && (
                    <button
                      disabled={updatingId === selectedApp.id}
                      onClick={() => void handleUpdateStatus(selectedApp.id, 'approved')}
                      className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold text-xs shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <SealCheck size={16} weight="fill" className="text-emerald-400 dark:text-emerald-600" />
                      <span>Approve & Onboard Builder</span>
                    </button>
                  )}
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
            toast.type === 'error' ? 'bg-rose-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-zinc-900 dark:bg-white dark:text-zinc-900'
          }`}
        >
          {toast.type === 'error' ? (
            <WarningCircle size={16} weight="fill" />
          ) : toast.type === 'info' ? (
            <Bell size={16} weight="fill" />
          ) : (
            <CheckCircle size={16} weight="fill" className="text-emerald-400" />
          )}
          <span>{toast.message}</span>

          {toast.actionLabel && toast.onAction && (
            <button
              onClick={() => {
                toast.onAction?.()
                setToast(null)
              }}
              className="ml-2 px-2.5 py-1 bg-white text-blue-700 dark:bg-zinc-900 dark:text-white rounded-lg text-[11px] font-extrabold hover:opacity-90 transition-opacity shadow-2xs cursor-pointer"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </PageShell>
  )
}
