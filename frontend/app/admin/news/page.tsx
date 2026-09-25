'use client'

/**
 * PropFyndr Admin — News & Announcements Management.
 *
 * Implements Apple Design and Master Design Engineering principles:
 * - Anti-Nesting & Visual Elegance: Clean telemetry, high-contrast badges,
 *   and structured metadata.
 * - Resolved Destination Links: Smart resolution for builder profiles, project
 *   pages, and external sources without DNS failures.
 * - Full Lifecycle Governance: Archive, Restore, and Permanent Delete with
 *   sleek native dialogs (no browser confirm).
 * - Executive Modal Studio: Live announcement card preview, builder & project pickers,
 *   curated photo presets, and promotion toggles.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Newspaper,
  Megaphone,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  PencilSimple,
  Trash,
  Archive,
  ArrowsClockwise,
  ArrowSquareOut,
  Buildings,
  Folder,
  Eye,
  DownloadSimple,
  MagnifyingGlass,
  Warning,
  FileText,
  Check,
  Globe,
  Image as ImageIcon,
  Tag,
  CalendarBlank,
  ShieldCheck,
  X
} from '@phosphor-icons/react'
import { format, formatDistanceToNow } from 'date-fns'
import { AnimatePresence, m } from 'framer-motion'
import { adminFetch } from '@/lib/adminFetch'
import { Skeleton } from '@/components/ui/skeleton'
import { PageShell, PageHeader, StatCard } from '@/components/portal/ui'
import CustomSelect, { type SelectOption } from '@/components/admin/CustomSelect'

export type NewsLinkType = 'builder' | 'project' | 'external_url'

export interface BuilderNewsItem {
  id: string
  builder_id: string
  title: string
  description: string
  image_url?: string | null
  link_type?: NewsLinkType | null
  link_target?: string | null
  status: 'draft' | 'pending_approval' | 'published' | 'archived' | 'rejected'
  approval_notes?: string | null
  run_as_promo: boolean
  archived_at?: string | null
  created_at: string
  published_at?: string | null
  builder?: { id: string; name: string; slug: string } | null
}

interface BuilderOption {
  id: string
  name: string
  slug: string
  projects?: Array<{ id: string; name: string; slug: string }>
}

type FilterTab = 'all' | 'published' | 'pending_approval' | 'promos' | 'draft' | 'archived'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  published: {
    label: 'Published',
    bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500 shadow-2xs shadow-emerald-500/50',
  },
  pending_approval: {
    label: 'Under Review',
    bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500 shadow-2xs shadow-amber-500/50',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/20',
    dot: 'bg-rose-500 shadow-2xs shadow-rose-500/50',
  },
  draft: {
    label: 'Draft',
    bg: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-400',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
    text: 'text-zinc-500 dark:text-zinc-400',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-400',
  },
}

// Curated high-res architectural presets for builder announcements
const PHOTO_PRESETS = [
  {
    name: 'Construction Site',
    url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18615f3?auto=format&fit=crop&w=1200&q=80',
    emoji: '🏗️',
  },
  {
    name: 'Luxury High-Rise',
    url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    emoji: '🏙️',
  },
  {
    name: 'Key Handover & Possession',
    url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
    emoji: '🔑',
  },
  {
    name: 'Clubhouse & Landscape',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    emoji: '🌿',
  },
]

export default function BuilderNewsPage() {
  const [news, setNews] = useState<BuilderNewsItem[]>([])
  const [builders, setBuilders] = useState<BuilderOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const [filter, setFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<BuilderNewsItem | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    action: 'archive' | 'delete' | 'restore'
    item: BuilderNewsItem | null
  }>({
    isOpen: false,
    action: 'archive',
    item: null,
  })
  const [actionInProgress, setActionInProgress] = useState(false)

  const isFetchingRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // Fetch builders catalog for selector and project association
  const fetchBuilders = useCallback(async () => {
    try {
      const res = await adminFetch('/admin/builders?limit=100')
      if (res.ok) {
        const data = await res.json()
        setBuilders(data.builders || [])
      }
    } catch {
      // Non-blocking fallback
    }
  }, [])

  // Fetch news feed with support for archived filter
  const fetchNews = useCallback(async (isManualRefresh = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (isManualRefresh) setIsRefreshing(true)

    try {
      const queryParam = filter === 'archived' ? '?status=archived' : '?include_archived=true'
      const res = await adminFetch(`/admin/news${queryParam}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setNews(data.news || [])
      setLastRefreshedAt(new Date())

      if (isManualRefresh) {
        showToast('News & updates refreshed', 'success')
      }
    } catch {
      showToast('Failed to load news posts', 'error')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [filter, showToast])

  useEffect(() => {
    fetchNews()
    fetchBuilders()
  }, [fetchNews, fetchBuilders])

  // ESC dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false)
        setEditingItem(null)
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Action Handlers
  const handleExecuteConfirm = async () => {
    if (!confirmDialog.item) return
    setActionInProgress(true)
    const { action, item } = confirmDialog

    try {
      if (action === 'archive') {
        const res = await adminFetch(`/admin/news/${item.id}`, { method: 'DELETE' })
        if (res.ok) {
          showToast('Post archived successfully', 'success')
          fetchNews()
        } else {
          showToast('Failed to archive post', 'error')
        }
      } else if (action === 'restore') {
        const res = await adminFetch(`/admin/news/${item.id}/restore`, { method: 'POST' })
        if (res.ok) {
          showToast('Post restored to active catalog', 'success')
          fetchNews()
        } else {
          showToast('Failed to restore post', 'error')
        }
      } else if (action === 'delete') {
        const res = await adminFetch(`/admin/news/${item.id}?permanent=true`, { method: 'DELETE' })
        if (res.ok) {
          showToast('Post permanently deleted', 'success')
          setNews(prev => prev.filter(n => n.id !== item.id))
        } else {
          showToast('Failed to permanently delete post', 'error')
        }
      }
    } catch {
      showToast('Operation failed', 'error')
    } finally {
      setActionInProgress(false)
      setConfirmDialog({ isOpen: false, action: 'archive', item: null })
    }
  }

  // Filtered dataset
  const filteredNews = useMemo(() => {
    return news.filter(item => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.builder?.name && item.builder.name.toLowerCase().includes(query))

      let matchesFilter = true
      const isArchived = Boolean(item.archived_at) || item.status === 'archived'

      if (filter === 'archived') {
        matchesFilter = isArchived
      } else {
        // Hide archived posts unless explicitly on archived tab
        if (isArchived) return false

        if (filter === 'published') matchesFilter = item.status === 'published'
        else if (filter === 'pending_approval') matchesFilter = item.status === 'pending_approval'
        else if (filter === 'promos') matchesFilter = item.run_as_promo
        else if (filter === 'draft') matchesFilter = item.status === 'draft'
      }

      return matchesSearch && matchesFilter
    })
  }, [news, searchQuery, filter])

  // Calculated Stats
  const stats = useMemo(() => {
    const active = news.filter(n => !n.archived_at && n.status !== 'archived')
    const total = active.length
    const published = active.filter(n => n.status === 'published').length
    const pending = active.filter(n => n.status === 'pending_approval').length
    const promos = active.filter(n => n.run_as_promo).length
    const archived = news.filter(n => Boolean(n.archived_at) || n.status === 'archived').length
    return { total, published, pending, promos, archived }
  }, [news])

  const handleExportNewsCSV = () => {
    const headers = ['ID', 'Title', 'Status', 'Builder', 'Is Promo', 'Link Type', 'Link Target', 'Created At']
    const rows = filteredNews.map(n => [
      `"${n.id}"`,
      `"${(n.title || '').replace(/"/g, '""')}"`,
      `"${n.status}"`,
      `"${(n.builder?.name || '').replace(/"/g, '""')}"`,
      n.run_as_promo ? 'Yes' : 'No',
      `"${n.link_type || 'builder'}"`,
      `"${(n.link_target || '').replace(/"/g, '""')}"`,
      `"${n.created_at}"`,
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `propfyndr_news_${filter}_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <PageShell>
      <div className="space-y-6 pb-20 font-sans select-none max-w-[1400px] mx-auto min-w-0">
        {/* Apple-grade Page Header */}
        <PageHeader
          title="News & Updates"
          subtitle="Manage developer press releases, construction milestones, and promotional announcements."
          action={
            <div className="flex items-center flex-wrap gap-2.5">
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block mr-1">
                Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
              </span>

              <button
                onClick={() => fetchNews(true)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                <ArrowsClockwise
                  size={14}
                  className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'}
                />
                <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
              </button>

              <button
                onClick={handleExportNewsCSV}
                className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
              >
                <DownloadSimple size={14} className="text-zinc-500" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => {
                  setEditingItem(null)
                  setShowModal(true)
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100 transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
              >
                <Plus size={15} weight="bold" />
                <span>New Announcement</span>
              </button>
            </div>
          }
        />

        {/* Executive KPI Metric Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <StatCard
            label="Total Active"
            value={stats.total}
            icon={<Newspaper className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            loading={loading}
            hint={<span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{stats.pending} under review</span>}
          />
          <StatCard
            label="Published"
            value={stats.published}
            icon={<CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            loading={loading}
            hint={<span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Live across portal</span>}
          />
          <StatCard
            label="Under Review"
            value={stats.pending}
            icon={<Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
            loading={loading}
            hint={<span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Awaiting editorial check</span>}
          />
          <StatCard
            label="Promotions"
            value={stats.promos}
            icon={<Megaphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
            loading={loading}
            hint={<span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Featured spotlight</span>}
          />
          <div
            onClick={() => setFilter('archived')}
            className="cursor-pointer transition-all hover:scale-[1.01]"
          >
            <StatCard
              label="Archived"
              value={stats.archived}
              icon={<Archive className="w-4 h-4 text-zinc-500" />}
              loading={loading}
              hint={<span className="text-xs font-semibold text-zinc-500">Historical records</span>}
            />
          </div>
        </div>

        {/* Toolbar: Search & Segmented Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* Search Input */}
          <div className="group flex-1 w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xs focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:ring-2 focus-within:ring-zinc-200/50 dark:focus-within:ring-zinc-800 transition-all">
            <MagnifyingGlass size={16} className="text-zinc-400 group-focus-within:text-zinc-700 dark:group-focus-within:text-zinc-200 transition-colors" />
            <input
              type="text"
              placeholder="Search announcements by title, excerpt, builder name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Segmented Filter Pills */}
          <div className="flex items-center p-1 bg-zinc-100/90 dark:bg-zinc-900/80 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shrink-0 overflow-x-auto max-w-full">
            {(
              [
                { id: 'all', label: 'All Active' },
                { id: 'published', label: 'Published' },
                { id: 'pending_approval', label: 'Under Review' },
                { id: 'promos', label: 'Promotions' },
                { id: 'draft', label: 'Drafts' },
                { id: 'archived', label: `Archived (${stats.archived})` },
              ] as const
            ).map(tab => {
              const active = filter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as FilterTab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content Feed */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex gap-4"
              >
                <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
                <div className="flex-1 space-y-3 py-1">
                  <Skeleton className="h-6 w-1/3 rounded-lg" />
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-12 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
              <Newspaper size={24} weight="duotone" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {filter === 'archived' ? 'No archived announcements' : 'No announcements found'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto mb-5">
              {filter === 'archived'
                ? 'Archived announcements will appear here. They can be restored anytime.'
                : 'Create your first builder update or announcement to syndicate to buyers.'}
            </p>
            {filter !== 'archived' && (
              <button
                onClick={() => {
                  setEditingItem(null)
                  setShowModal(true)
                }}
                className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs shadow-2xs hover:bg-black dark:hover:bg-zinc-100 cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus size={14} weight="bold" />
                <span>Create Announcement</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNews.map(item => {
              const isArchived = Boolean(item.archived_at) || item.status === 'archived'
              const stCfg = isArchived
                ? STATUS_CONFIG.archived
                : STATUS_CONFIG[item.status] || STATUS_CONFIG.draft
              const resolvedLink = resolveNewsLink(item)

              return (
                <div
                  key={item.id}
                  className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all font-sans"
                >
                  <div className="flex flex-col sm:flex-row gap-5 items-start">
                    {/* Media Thumbnail with Graceful Fallback */}
                    <NewsThumbnail
                      src={item.image_url}
                      alt={item.title}
                    />

                    {/* Content Details */}
                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate tracking-tight">
                              {item.title}
                            </h3>
                            {item.run_as_promo && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[10px] font-bold flex items-center gap-1">
                                <Megaphone size={11} weight="fill" /> Promo Campaign
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 shrink-0 ${stCfg.bg} ${stCfg.text} ${stCfg.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                          <span>{stCfg.label}</span>
                        </span>
                      </div>

                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Resolved Destination & Builder Telemetry */}
                      <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex-wrap">
                        {item.builder?.name && (
                          <Link
                            href={`/admin/builders?search=${encodeURIComponent(item.builder.name)}`}
                            className="flex items-center gap-1 font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-0.5 rounded-md transition-colors"
                          >
                            <Buildings size={12} weight="duotone" className="text-zinc-500" />
                            <span>{item.builder.name}</span>
                          </Link>
                        )}

                        {/* Resolved Safe Destination Link */}
                        <div className="flex items-center gap-1.5">
                          {resolvedLink.isExternal ? (
                            <a
                              href={resolvedLink.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-900/40"
                            >
                              <Globe size={12} />
                              <span>{resolvedLink.label}</span>
                              <ArrowSquareOut size={10} className="opacity-70" />
                            </a>
                          ) : (
                            <Link
                              href={resolvedLink.href}
                              target="_blank"
                              className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-semibold hover:underline bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50"
                            >
                              {resolvedLink.type === 'project' ? (
                                <Folder size={12} className="text-blue-500" />
                              ) : (
                                <Buildings size={12} className="text-emerald-500" />
                              )}
                              <span>{resolvedLink.label}</span>
                              <ArrowSquareOut size={10} className="opacity-70" />
                            </Link>
                          )}
                        </div>

                        <span className="flex items-center gap-1 text-zinc-400">
                          <CalendarBlank size={12} />
                          <span>
                            Posted {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                        </span>
                      </div>

                      {/* Audit Notes Warning Banner */}
                      {item.status === 'rejected' && item.approval_notes && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-xs">
                          <Warning className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <p className="text-rose-900 dark:text-rose-200 font-medium">
                            <strong>Reviewer notes:</strong> {item.approval_notes}
                          </p>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => {
                            setEditingItem(item)
                            setShowModal(true)
                          }}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <PencilSimple size={13} />
                          <span>Edit</span>
                        </button>

                        {isArchived ? (
                          <>
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  isOpen: true,
                                  action: 'restore',
                                  item,
                                })
                              }
                              className="px-3 py-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowsClockwise size={13} />
                              <span>Restore to Live</span>
                            </button>
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  isOpen: true,
                                  action: 'delete',
                                  item,
                                })
                              }
                              className="px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <Trash size={13} />
                              <span>Delete Permanently</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  isOpen: true,
                                  action: 'archive',
                                  item,
                                })
                              }
                              className="px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <Archive size={13} />
                              <span>Archive</span>
                            </button>
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  isOpen: true,
                                  action: 'delete',
                                  item,
                                })
                              }
                              className="px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <Trash size={13} />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Executive Announcement Studio Modal */}
        <AnimatePresence>
          {showModal && (
            <NewsModal
              item={editingItem}
              builders={builders}
              onSave={() => {
                setShowModal(false)
                setEditingItem(null)
                fetchNews(true)
              }}
              onCancel={() => {
                setShowModal(false)
                setEditingItem(null)
              }}
              showToast={showToast}
            />
          )}
        </AnimatePresence>

        {/* Destructive / Action Confirmation Dialog */}
        <AnimatePresence>
          {confirmDialog.isOpen && confirmDialog.item && (
            <ConfirmActionDialog
              isOpen={confirmDialog.isOpen}
              action={confirmDialog.action}
              item={confirmDialog.item}
              loading={actionInProgress}
              onConfirm={handleExecuteConfirm}
              onCancel={() => setConfirmDialog({ isOpen: false, action: 'archive', item: null })}
            />
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 px-4 py-3 rounded-2xl text-white text-xs font-bold shadow-2xl transition-all flex items-center gap-3 z-50 ${
              toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
            }`}
          >
            {toast.type === 'error' ? (
              <Warning size={16} weight="bold" />
            ) : (
              <CheckCircle size={16} weight="bold" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </PageShell>
  )
}

/**
 * Smart thumbnail with graceful fallback gradient & icon
 */
function NewsThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col items-center justify-center text-zinc-400 p-2 text-center shrink-0">
        <Newspaper size={28} weight="duotone" className="text-zinc-400 dark:text-zinc-500 mb-1" />
        <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 line-clamp-1 max-w-full">
          PropFyndr
        </span>
      </div>
    )
  }

  return (
    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800 shrink-0 bg-zinc-100 dark:bg-zinc-800 relative">
      <img
        src={src}
        alt={alt}
        onError={() => setError(true)}
        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
      />
    </div>
  )
}

/**
 * Destination link resolver helper
 */
function resolveNewsLink(item: BuilderNewsItem) {
  const type: NewsLinkType =
    item.link_type ||
    (item.link_target && item.link_target.startsWith('http') ? 'external_url' : 'builder')

  if (type === 'builder') {
    const slug = item.builder?.slug || item.link_target || ''
    return {
      href: slug ? `/builder/${slug}` : '/admin/builders',
      label: item.builder?.name ? `Builder: ${item.builder.name}` : 'Builder Profile',
      isExternal: false,
      type: 'builder' as const,
    }
  }

  if (type === 'project') {
    const target = item.link_target || ''
    return {
      href: `/property/${target}`,
      label: `Project: ${target}`,
      isExternal: false,
      type: 'project' as const,
    }
  }

  // External URL
  const target = item.link_target || ''
  const cleanHref = target.startsWith('http://') || target.startsWith('https://') ? target : `https://${target}`
  let displayDomain = target
  try {
    const parsed = new URL(cleanHref)
    displayDomain = parsed.hostname.replace(/^www\./, '')
  } catch {
    displayDomain = target
  }

  return {
    href: cleanHref,
    label: displayDomain || 'External Article',
    isExternal: true,
    type: 'external_url' as const,
  }
}

/**
 * Announcement Studio Modal (Executive 2-Column Split: Form + Live Portal Card Preview)
 */
function NewsModal({
  item,
  builders,
  onSave,
  onCancel,
  showToast,
}: {
  item: BuilderNewsItem | null
  builders: BuilderOption[]
  onSave: () => void
  onCancel: () => void
  showToast: (message: string, type?: 'success' | 'error') => void
}) {
  const [loading, setLoading] = useState(false)
  const defaultBuilder = builders[0]

  const [formData, setFormData] = useState<{
    builder_id: string
    title: string
    description: string
    link_type: NewsLinkType
    link_target: string
    image_url: string
    status: 'draft' | 'pending_approval' | 'published'
    run_as_promo: boolean
  }>({
    builder_id: item?.builder_id || item?.builder?.id || defaultBuilder?.id || '',
    title: item?.title || '',
    description: item?.description || '',
    link_type: item?.link_type || 'builder',
    link_target: item?.link_target || item?.builder?.slug || defaultBuilder?.slug || '',
    image_url: item?.image_url || '',
    status: (item?.status as any) || 'published',
    run_as_promo: item?.run_as_promo || false,
  })

  // Selected builder object
  const selectedBuilder = useMemo(() => {
    return builders.find(b => b.id === formData.builder_id) || null
  }, [builders, formData.builder_id])

  // When changing builder, if link_type is 'builder', sync link_target to builder slug
  const handleBuilderChange = (newId: string) => {
    const builder = builders.find(b => b.id === newId)
    setFormData(prev => ({
      ...prev,
      builder_id: newId,
      link_target: prev.link_type === 'builder' && builder ? builder.slug : prev.link_target,
    }))
  }

  // When changing link_type
  const handleLinkTypeChange = (newType: NewsLinkType) => {
    let target = formData.link_target
    if (newType === 'builder') {
      target = selectedBuilder ? selectedBuilder.slug : ''
    } else if (newType === 'project') {
      const firstProject = selectedBuilder?.projects?.[0]
      target = firstProject ? firstProject.slug : ''
    }
    setFormData(prev => ({
      ...prev,
      link_type: newType,
      link_target: target,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.builder_id) {
      showToast('Please select a builder for this announcement', 'error')
      return
    }

    if (!formData.title.trim()) {
      showToast('Title is required', 'error')
      return
    }

    setLoading(true)

    try {
      const url = item ? `/admin/news/${item.id}` : '/admin/news'
      const method = item ? 'PATCH' : 'POST'

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        showToast(item ? 'Announcement updated' : 'Announcement published', 'success')
        onSave()
      } else {
        const err = await res.json().catch(() => null)
        showToast(err?.error || 'Failed to save announcement', 'error')
      }
    } catch {
      showToast('Error saving announcement', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs"
        onClick={onCancel}
      />

      <m.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 my-auto max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-xs">
              <Newspaper size={20} weight="duotone" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white tracking-tight">
                  {item ? 'Edit Announcement' : 'New Announcement Post'}
                </h3>
                <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                  Executive Studio
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Syndicate builder milestones and featured promotions directly to buyers
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: 2-Column Responsive Split */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="announcement-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-xs">
            {/* Left Column: Form Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Builder Selector */}
              <div>
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1.5">
                  Associated Builder / Developer *
                </label>
                <div className="relative">
                  <select
                    value={formData.builder_id}
                    onChange={e => handleBuilderChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium focus:border-zinc-400 dark:focus:border-zinc-500 transition-all cursor-pointer"
                    required
                  >
                    <option value="" disabled>
                      Select builder…
                    </option>
                    {builders.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.slug})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Announcement Title *
                  </label>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {formData.title.length}/120
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. ACE Group Achieves Tower C Milestone in Sector 150"
                  value={formData.title}
                  maxLength={120}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium focus:border-zinc-400 dark:focus:border-zinc-500 transition-all"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1.5">
                  Description & Excerpt *
                </label>
                <textarea
                  placeholder="Summary of construction progress, RERA milestone certification, or sales launch details…"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium focus:border-zinc-400 dark:focus:border-zinc-500 transition-all resize-none leading-relaxed"
                  rows={4}
                  required
                />
              </div>

              {/* Link Target Selector (3 options: Builder, Project, External) */}
              <div className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Destination Link Target
                  </span>
                  <span className="text-[11px] text-zinc-400">Where clicking this card navigates</span>
                </div>

                {/* 3-Way Segmented Control */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
                  <button
                    type="button"
                    onClick={() => handleLinkTypeChange('builder')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      formData.link_type === 'builder'
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xs font-bold'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Buildings size={13} />
                    <span>Builder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLinkTypeChange('project')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      formData.link_type === 'project'
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xs font-bold'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Folder size={13} />
                    <span>Project</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLinkTypeChange('external_url')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      formData.link_type === 'external_url'
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xs font-bold'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Globe size={13} />
                    <span>External</span>
                  </button>
                </div>

                {/* Dynamic Destination Input based on Link Type */}
                {formData.link_type === 'builder' && (
                  <div className="pt-1">
                    <p className="text-[11px] text-zinc-500">
                      Directs buyers to the builder profile:{' '}
                      <code className="text-zinc-800 dark:text-zinc-200 bg-zinc-200/80 dark:bg-zinc-700/80 px-1.5 py-0.5 rounded">
                        /builder/{selectedBuilder?.slug || 'profile'}
                      </code>
                    </p>
                  </div>
                )}

                {formData.link_type === 'project' && (
                  <div className="pt-1 space-y-1.5">
                    {selectedBuilder?.projects && selectedBuilder.projects.length > 0 ? (
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                          Select from {selectedBuilder.name} projects:
                        </label>
                        <select
                          value={formData.link_target}
                          onChange={e => setFormData({ ...formData, link_target: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none font-medium"
                        >
                          {selectedBuilder.projects.map(p => (
                            <option key={p.id} value={p.slug}>
                              {p.name} ({p.slug})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                          Target Project Slug:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. nirala-trio-sector-2"
                          value={formData.link_target}
                          onChange={e => setFormData({ ...formData, link_target: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none font-medium"
                        />
                      </div>
                    )}
                  </div>
                )}

                {formData.link_type === 'external_url' && (
                  <div className="pt-1 space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                      External URL (Press Coverage or PDF):
                    </label>
                    <input
                      type="url"
                      placeholder="https://economictimes.indiatimes.com/..."
                      value={formData.link_target}
                      onChange={e => setFormData({ ...formData, link_target: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Cover Image & Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Cover Image URL (Optional)
                  </label>
                  <span className="text-[11px] text-zinc-400">High-res landscape recommended</span>
                </div>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.image_url}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium focus:border-zinc-400 dark:focus:border-zinc-500"
                />

                {/* 1-Click Curated Presets */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Presets:
                  </span>
                  {PHOTO_PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setFormData({ ...formData, image_url: preset.url })}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>{preset.emoji}</span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status & Promo Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1.5">
                    Publication Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="published">Published (Live to Buyers)</option>
                    <option value="draft">Draft (Private)</option>
                    <option value="pending_approval">Pending Editorial Review</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.run_as_promo}
                      onChange={e => setFormData({ ...formData, run_as_promo: e.target.checked })}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                        Featured Promo Banner
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        Pin in discovery search & home feed
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right Column: Live Card Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Live Card Preview
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Real-time Sync
                </span>
              </div>

              {/* Preview Card Shell */}
              <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-sm space-y-3 overflow-hidden">
                {/* Image Preview */}
                <div className="w-full h-36 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 relative">
                  {formData.image_url ? (
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={e => {
                        ;(e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 p-4 text-center">
                      <ImageIcon size={32} weight="duotone" className="mb-1 opacity-50" />
                      <span className="text-[11px] font-medium text-zinc-400">
                        No cover image specified
                      </span>
                    </div>
                  )}

                  {formData.run_as_promo && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-bold shadow-md flex items-center gap-1">
                      <Megaphone size={11} weight="fill" /> Promo
                    </span>
                  )}

                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-zinc-950/70 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider">
                    {formData.status}
                  </span>
                </div>

                {/* Text & Meta */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    <Buildings size={12} weight="duotone" />
                    <span>{selectedBuilder?.name || 'Developer Name'}</span>
                  </div>

                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                    {formData.title || 'Announcement Title Preview…'}
                  </h4>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                    {formData.description || 'Detailed excerpt of the construction or sales milestone will appear here in the preview.'}
                  </p>
                </div>

                {/* Footer preview */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Just now</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    {formData.link_type === 'builder'
                      ? 'View Builder'
                      : formData.link_type === 'project'
                      ? 'Explore Project'
                      : 'Read Article'}
                    <ArrowSquareOut size={12} />
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-normal px-1">
                Announcements are indexed across buyer search agents and featured in property dossiers.
              </p>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 sm:py-4 bg-zinc-50/50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="announcement-form"
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs hover:bg-black dark:hover:bg-zinc-100 shadow-2xs disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
          >
            {loading && <ArrowsClockwise size={13} className="animate-spin" />}
            <span>{loading ? 'Saving…' : item ? 'Update Announcement' : 'Publish Announcement'}</span>
          </button>
        </div>
      </m.div>
    </div>
  )
}

/**
 * Destructive / Lifecycle Confirmation Dialog
 */
function ConfirmActionDialog({
  isOpen,
  action,
  item,
  loading,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  action: 'archive' | 'delete' | 'restore'
  item: BuilderNewsItem
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const isDelete = action === 'delete'
  const isRestore = action === 'restore'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs"
        onClick={onCancel}
      />

      <m.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 font-sans z-10 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isDelete
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : isRestore
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            {isDelete ? (
              <Trash size={22} weight="duotone" />
            ) : isRestore ? (
              <ArrowsClockwise size={22} weight="duotone" />
            ) : (
              <Archive size={22} weight="duotone" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              {isDelete
                ? 'Permanently Delete Announcement?'
                : isRestore
                ? 'Restore Announcement to Live Catalog?'
                : 'Archive Announcement?'}
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {isDelete
                ? 'Irrevocable database purge'
                : isRestore
                ? 'Make announcement public again'
                : 'Soft-archived state'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1 text-xs">
          <span className="font-bold text-zinc-900 dark:text-white line-clamp-1">
            {item.title}
          </span>
          <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
            {isDelete
              ? 'This will completely erase this announcement from the database. It cannot be recovered.'
              : isRestore
              ? 'This will restore the announcement to Published status so buyers can see it again.'
              : 'This will hide the announcement from public feeds. You can restore it anytime from the Archived tab.'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
              isDelete
                ? 'bg-rose-600 hover:bg-rose-700'
                : isRestore
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100'
            }`}
          >
            {loading && <ArrowsClockwise size={13} className="animate-spin" />}
            <span>
              {isDelete
                ? 'Delete Permanently'
                : isRestore
                ? 'Restore Post'
                : 'Archive Post'}
            </span>
          </button>
        </div>
      </m.div>
    </div>
  )
}
