'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Search, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  ExternalLink, 
  ShieldCheck,
  FileText,
  ChevronRight,
  ChevronDown,
  X,
  Copy,
  Check,
  AlertCircle,
  Globe,
  RotateCcw,
  Bell,
  PhoneCall,
  Award,
  Users,
  Linkedin,
  Server
} from 'lucide-react'
import { AnimatePresence, m } from 'framer-motion'
import { adminFetch } from '@/lib/adminFetch'
import { Skeleton } from '@/components/ui/skeleton'
import CustomSelect from '@/components/admin/CustomSelect'
import { format, formatDistanceToNow } from 'date-fns'

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

const STATUS_CONFIG: Record<BuilderApplication['status'], { label: string; bg: string; text: string; border: string; dot: string }> = {
  new: {
    label: 'New',
    bg: 'bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/60',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200/80 dark:border-blue-800/80',
    dot: 'bg-blue-500 shadow-2xs shadow-blue-500/50',
  },
  reviewing: {
    label: 'Reviewing',
    bg: 'bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/60',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/80 dark:border-amber-800/80',
    dot: 'bg-amber-500 shadow-2xs shadow-amber-500/50',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/80 dark:border-emerald-800/80',
    dot: 'bg-emerald-500 shadow-2xs shadow-emerald-500/50',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/60',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200/80 dark:border-rose-800/80',
    dot: 'bg-rose-500 shadow-2xs shadow-rose-500/50',
  },
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; actionLabel?: string; onAction?: () => void } | null>(null)
  
  const applicationsCountRef = useRef(0)
  applicationsCountRef.current = applications.length

  const isFetchingRef = useRef(false)

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', actionLabel?: string, onAction?: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type, actionLabel, onAction })
    toastTimerRef.current = setTimeout(() => setToast(null), 5000)
  }, [])

  // Robust Core Data Loading Function with Lock Guard & 1-Step Auto Retry
  const loadApplications = useCallback(async (isManualRefresh = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (isManualRefresh) {
      setIsRefreshing(true)
      setHasNewApplications(false)
    }

    const fetchWithRetry = async (attempt = 1): Promise<BuilderApplication[]> => {
      try {
        const res = await adminFetch('/builder-applications')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        return data.applications || []
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
      setApplications(fetched)
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
  }, [showToast])

  // Initial Load
  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  // Background Polling Every 15 Seconds with Collision Protection
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

          showToast(
            `${diff} new builder registration application received!`,
            'info',
            'Refresh Now',
            () => loadApplications(true)
          )
        }
      } catch {
        // Silent polling error handling
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [loadApplications, showToast])

  // Global Escape Key Listener to close dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedApp(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleUpdateStatus = async (id: string, newStatus: BuilderApplication['status']) => {
    try {
      const res = await adminFetch(`/builder-applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
      
      setApplications(apps => apps.map(a => a.id === id ? { ...a, status: newStatus } : a))
      if (selectedApp?.id === id) {
        setSelectedApp(prev => prev ? { ...prev, status: newStatus } : null)
      }
      showToast(`Application marked as ${STATUS_CONFIG[newStatus].label}`, 'success')
    } catch {
      showToast('Failed to update application status', 'error')
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showToast(`Copied ${label}`, 'success')
  }

  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch = !query || 
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
    const newCount = applications.filter(a => a.status === 'new').length
    const reviewing = applications.filter(a => a.status === 'reviewing').length
    const approved = applications.filter(a => a.status === 'approved').length
    const rejected = applications.filter(a => a.status === 'rejected').length
    return { total, newCount, reviewing, approved, rejected }
  }, [applications])

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(p => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'B'
  }

  return (
    <div className="space-y-6 pb-16 font-sans select-none max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Builder Registrations
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Developer Onboarding
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Review, verify RERA compliance, and approve developer onboarding requests
          </p>
        </div>

        {/* Refresh Action Button & Live Status */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
            Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>

          <button
            onClick={() => loadApplications(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh applications list"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* New Application Notification Banner */}
      <AnimatePresence>
        {hasNewApplications && (
          <m.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-4 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Bell size={16} className="animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-100">
                  New Builder Application Received!
                </h4>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                  {newCountDifference} new registration request is ready for review.
                </p>
              </div>
            </div>

            <button
              onClick={() => loadApplications(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-[0.98]"
            >
              <RotateCcw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Now'}</span>
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* KPI Metric Cards — Impeccable Zinc Design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registrations */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Requests
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.total}
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {stats.newCount} pending
            </span>
          </div>
        </div>

        {/* Pending Review */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Under Review
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.reviewing}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              In verification
            </span>
          </div>
        </div>

        {/* Approved Builders */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Approved Builders
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.approved}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Active partners
            </span>
          </div>
        </div>

        {/* Rejected Requests */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Declined
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.rejected}
            </span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              Unverified
            </span>
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
            placeholder="Search builder name, email, CIN..."
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

        {/* Segmented Filter Pills */}
        <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shrink-0 overflow-x-auto">
          {(['all', 'new', 'reviewing', 'approved', 'rejected'] as const).map(st => (
            <button
              key={st}
              onClick={() => {
                setFilter(st)
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap capitalize ${
                filter === st
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {st === 'all' ? 'All Registrations' : st}
            </button>
          ))}
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
      ) : filteredApplications.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">No registrations found</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or status filter.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Company Info</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Submitted Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                {filteredApplications.map(app => (
                  <tr
                    key={app.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                  >
                    {/* Company Info */}
                    <td className="px-6 py-4" onClick={() => setSelectedApp(app)}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center shadow-2xs shrink-0 overflow-hidden">
                          {app.logo_url && (app.logo_url.startsWith('data:') || app.logo_url.startsWith('http')) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={app.logo_url} alt={app.name} className="w-full h-full object-contain bg-white p-1" />
                          ) : (
                            getInitials(app.name)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {app.name}
                          </p>
                          <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                            <span>{app.headquarters || 'No HQ specified'}</span>
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">
                          {app.email}
                        </p>
                        <p className="font-mono text-[11px] text-zinc-500 font-semibold">
                          {app.phone}
                        </p>
                      </div>
                    </td>

                    {/* Submitted Date */}
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      <span title={format(new Date(app.submitted_at), 'PPP p')}>
                        {formatDistanceToNow(new Date(app.submitted_at), { addSuffix: true })}
                      </span>
                    </td>

                    {/* Interactive Status Dropdown via CustomSelect */}
                    <td className="px-6 py-4 w-[160px]" onClick={e => e.stopPropagation()}>
                      <CustomSelect
                        value={app.status}
                        onChange={(val) => handleUpdateStatus(app.id, val as BuilderApplication['status'])}
                        options={[
                          { value: 'new', label: 'New', dotColor: 'bg-blue-500' },
                          { value: 'reviewing', label: 'Reviewing', dotColor: 'bg-amber-500' },
                          { value: 'approved', label: 'Approved', dotColor: 'bg-emerald-500' },
                          { value: 'rejected', label: 'Rejected', dotColor: 'bg-rose-500' },
                        ]}
                        size="sm"
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 font-semibold transition-all shadow-2xs cursor-pointer"
                      >
                        <span>Review</span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE CENTERED APPLICATION REVIEW DIALOG */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop: click outside closes dialog */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
              onClick={() => setSelectedApp(null)}
            />

            {/* Modal Dialog Card */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 my-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-start justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Logo / Avatar container */}
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-lg flex items-center justify-center shadow-xs shrink-0 overflow-hidden p-1">
                    {selectedApp.logo_url && (selectedApp.logo_url.startsWith('data:') || selectedApp.logo_url.startsWith('http')) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedApp.logo_url} alt={selectedApp.name} className="w-full h-full object-contain bg-white rounded-xl p-1" />
                    ) : (
                      getInitials(selectedApp.name)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white truncate tracking-tight">
                        {selectedApp.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> RERA Standard
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_CONFIG[selectedApp.status].bg} ${STATUS_CONFIG[selectedApp.status].text} ${STATUS_CONFIG[selectedApp.status].border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedApp.status].dot}`} />
                        <span>{STATUS_CONFIG[selectedApp.status].label}</span>
                      </span>

                      {selectedApp.headquarters && (
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{selectedApp.headquarters}</span>
                        </span>
                      )}

                      {selectedApp.cin && (
                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                          <span className="font-mono text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                            CIN: {selectedApp.cin}
                          </span>
                          <button onClick={() => copyToClipboard(selectedApp.cin!, 'CIN')} className="text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer">
                            <Copy size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedApp(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body: Comprehensive Structured Grid */}
              <div className="p-6 max-h-[68vh] overflow-y-auto space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Left Column: Communication & Legal & Brand */}
                  <div className="space-y-4">
                    {/* Card 1: Primary Contact Channels */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Contact Channels</span>
                        </span>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          Submitted {format(new Date(selectedApp.submitted_at), 'PPP')}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        {/* Official Email */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{selectedApp.email}</span>
                          </div>
                          <button onClick={() => copyToClipboard(selectedApp.email, 'Email')} className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Mobile Phone */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{selectedApp.phone}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => copyToClipboard(selectedApp.phone, 'Phone')} className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={`https://wa.me/91${selectedApp.phone.replace(/^\+91/, '')}?text=${encodeURIComponent(`Hi ${selectedApp.name}, following up regarding your builder registration application on PropFyndr.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:bg-emerald-50 p-1 rounded-md"
                              title="Open WhatsApp Chat"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        {/* Landline */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <PhoneCall className="w-4 h-4 text-purple-500 shrink-0" />
                            <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                              {selectedApp.landline ? selectedApp.landline : 'Landline: Not provided'}
                            </span>
                          </div>
                          {selectedApp.landline && (
                            <button onClick={() => copyToClipboard(selectedApp.landline!, 'Landline')} className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Official Website */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                            {selectedApp.website ? (
                              <a 
                                href={selectedApp.website.startsWith('http') ? selectedApp.website : `https://${selectedApp.website}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                              >
                                {selectedApp.website} <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="font-medium text-zinc-400">Website: Not provided</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Registered Legal Entities & RERA */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Legal Entities & RERA Registration</span>
                      </span>
                      
                      {selectedApp.legal_entities && selectedApp.legal_entities.length > 0 ? (
                        <div className="space-y-2">
                          {selectedApp.legal_entities.map((e, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between text-xs">
                              <div className="min-w-0 pr-2">
                                <span className="font-bold text-zinc-900 dark:text-white block truncate">{e.name}</span>
                                {e.state && <span className="text-[10px] text-zinc-400 block">{e.state}</span>}
                              </div>
                              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] shrink-0">
                                {e.registration_number || 'N/A'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">No legal entities listed.</p>
                      )}
                    </div>

                    {/* Card 3: Brand Identity & Overview */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Company Bio & Overview</span>
                      </span>

                      {selectedApp.tagline && (
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Corporate Tagline</span>
                          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 italic">&ldquo;{selectedApp.tagline}&rdquo;</p>
                        </div>
                      )}

                      <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 space-y-1">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Description</span>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                          {selectedApp.description || 'No detailed company description provided during registration.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Leadership & Track Record & Metadata */}
                  <div className="space-y-4">
                    {/* Card 4: Executive Leadership */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Executive Leadership Team</span>
                      </span>
                      {selectedApp.executives && selectedApp.executives.length > 0 ? (
                        <div className="space-y-2">
                          {selectedApp.executives.map((exec, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center shrink-0">
                                  {getInitials(exec.name)}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="font-bold text-zinc-900 dark:text-white text-xs truncate">{exec.name}</h5>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{exec.title || 'Executive Member'}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {exec.experience_years && (
                                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                    {exec.experience_years} yrs exp.
                                  </span>
                                )}
                                {exec.linkedin && (
                                  <a
                                    href={exec.linkedin.startsWith('http') ? exec.linkedin : `https://${exec.linkedin}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md transition-colors"
                                    title="View LinkedIn Profile"
                                  >
                                    <Linkedin size={14} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">No executive team members listed.</p>
                      )}
                    </div>

                    {/* Card 5: Track Record & Flagship Scale */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Track Record & Scale</span>
                      </span>

                      {/* Metric stats row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Completed</span>
                          <span className="text-xs font-bold text-zinc-900 dark:text-white block mt-0.5">
                            {selectedApp.completed_projects_count || 'Not specified'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Sq.Ft Delivered</span>
                          <span className="text-xs font-bold text-zinc-900 dark:text-white block mt-0.5">
                            {selectedApp.sqft_delivered || 'Not specified'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Notable Flagship Projects
                        </span>
                        {selectedApp.projects && selectedApp.projects.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedApp.projects.map((p, i) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 font-semibold text-zinc-800 dark:text-zinc-200 text-[11px]">
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-400 italic">No notable projects specified.</p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Delivery Performance Summary
                        </span>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                          {selectedApp.delivery_track || 'No delivery record summary provided.'}
                        </p>
                      </div>
                    </div>

                    {/* Card 6: Audit & Submission Metadata */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Security & Audit Metadata</span>
                      </span>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Application ID</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <code className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate">{selectedApp.id}</code>
                            <button onClick={() => copyToClipboard(selectedApp.id, 'Application ID')} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                              <Copy size={11} />
                            </button>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Origin IP Address</span>
                          <code className="font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-300 block mt-0.5">
                            {selectedApp.ip_address || '127.0.0.1'}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Switcher Section inside Modal */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-zinc-50/90 to-zinc-100/40 dark:from-zinc-900/90 dark:to-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider block">
                      Update Registration Status
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selectedApp.status].dot} animate-pulse`} />
                      <span>
                        {selectedApp.status === 'new' && 'Awaiting initial compliance check'}
                        {selectedApp.status === 'reviewing' && 'Under active admin verification'}
                        {selectedApp.status === 'approved' && 'Verified partner active on PropFyndr'}
                        {selectedApp.status === 'rejected' && 'Application declined'}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(['new', 'reviewing', 'approved', 'rejected'] as const).map(st => {
                      const cfg = STATUS_CONFIG[st]
                      const isActive = selectedApp.status === st

                      const Icon = st === 'new' ? Clock 
                        : st === 'reviewing' ? Search 
                        : st === 'approved' ? CheckCircle2 
                        : XCircle

                      return (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(selectedApp.id, st)}
                          className={`py-3 px-3 rounded-2xl text-xs font-extrabold transition-all border flex flex-col items-center justify-center gap-1.5 cursor-pointer relative overflow-hidden group ${
                            isActive
                              ? `bg-white dark:bg-zinc-900 ${cfg.text} ${cfg.border} ring-2 ring-blue-500/20 shadow-md`
                              : 'bg-white/80 dark:bg-zinc-900/80 border-zinc-200/80 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon size={14} className={isActive ? cfg.text : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'} />
                            <span>{cfg.label}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            <span className="text-[10px] font-medium opacity-70 capitalize">
                              {st === 'new' ? 'Pending' : st === 'reviewing' ? 'In Audit' : st === 'approved' ? 'Active' : 'Declined'}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer Decision Actions */}
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                    Registration Decision
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">
                    Currently set to <strong className="capitalize">{STATUS_CONFIG[selectedApp.status].label}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => handleUpdateStatus(selectedApp.id, 'rejected')}
                    className="py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedApp.id, 'approved')}
                    className="py-2.5 px-5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100 font-bold text-xs flex items-center gap-2 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Approve Builder</span>
                  </button>
                </div>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification Banner */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-2xl text-white text-xs font-bold shadow-2xl transition-all flex items-center gap-3 z-50 ${
          toast.type === 'error' 
            ? 'bg-rose-600' 
            : toast.type === 'info'
            ? 'bg-blue-600'
            : 'bg-emerald-600'
        }`}>
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : toast.type === 'info' ? (
            <Bell className="w-4 h-4 animate-bounce" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{toast.message}</span>

          {toast.actionLabel && toast.onAction && (
            <button
              onClick={() => {
                toast.onAction?.()
                setToast(null)
              }}
              className="ml-2 px-2.5 py-1 bg-white text-blue-700 rounded-lg text-[11px] font-extrabold hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
