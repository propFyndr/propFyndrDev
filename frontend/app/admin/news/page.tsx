'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Newspaper, 
  Tag, 
  RotateCcw, 
  Search, 
  X, 
  Building2, 
  ExternalLink, 
  AlertCircle,
  FileText,
  Megaphone,
  Download
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { AnimatePresence, m } from 'framer-motion'
import CustomSelect from '@/components/admin/CustomSelect'
import { adminFetch } from '@/lib/adminFetch'
import { Skeleton } from '@/components/ui/skeleton'

type NewsLinkType = 'project' | 'external_url'

interface BuilderNews {
  id: string
  title: string
  description: string
  image_url?: string | null
  link_type?: NewsLinkType | null
  link_target?: string | null
  status: 'draft' | 'pending_approval' | 'published' | 'archived' | 'rejected'
  approval_notes?: string | null
  run_as_promo: boolean
  created_at: string
  published_at?: string | null
  builder?: { id: string; name: string; slug: string } | null
}

type StatusFilter = 'all' | 'published' | 'pending_approval' | 'promos' | 'draft' | 'partially_filled'


const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  published: {
    label: 'Published',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/80 dark:border-emerald-800/80',
    dot: 'bg-emerald-500 shadow-2xs shadow-emerald-500/50',
  },
  pending_approval: {
    label: 'Pending Approval',
    bg: 'bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/60',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/80 dark:border-amber-800/80',
    dot: 'bg-amber-500 shadow-2xs shadow-amber-500/50',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/60',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200/80 dark:border-rose-800/80',
    dot: 'bg-rose-500 shadow-2xs shadow-rose-500/50',
  },
  draft: {
    label: 'Draft',
    bg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
    text: 'text-zinc-500 dark:text-zinc-400',
    border: 'border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
  },
}

export default function BuilderNewsPage() {
  const [news, setNews] = useState<BuilderNews[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<BuilderNews | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const isFetchingRef = useRef(false)

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const fetchNews = useCallback(async (isManualRefresh = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (isManualRefresh) setIsRefreshing(true)

    const fetchWithRetry = async (attempt = 1): Promise<BuilderNews[]> => {
      try {
        const res = await adminFetch('/admin/news')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        return data.news || []
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
      setNews(fetched)
      setLastRefreshedAt(new Date())

      if (isManualRefresh) {
        showToast('News & updates refreshed', 'success')
      }
    } catch {
      showToast('Failed to fetch news posts', 'error')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [showToast])

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  // Global Escape Key Listener to close dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false)
        setEditingItem(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleDelete = async (id: string) => {
    // NOTE: native confirm() dialog — inconsistent with the AnimatePresence/modal pattern used
    // elsewhere in this file. No reusable confirm-modal component exists nearby; left as-is to avoid scope creep.
    if (!confirm('Archive this news post?')) return

    try {
      const res = await adminFetch(`/admin/news/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setNews(prev => prev.filter(n => n.id !== id))
        showToast('Post archived successfully', 'success')
      } else {
        showToast('Failed to archive post', 'error')
      }
    } catch {
      showToast('Error deleting news post', 'error')
    }
  }

  const filteredNews = useMemo(() => {
    return news.filter(item => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch = !query || 
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.builder?.name && item.builder.name.toLowerCase().includes(query))

      let matchesFilter = true
      if (filter === 'published') matchesFilter = item.status === 'published'
      else if (filter === 'pending_approval') matchesFilter = item.status === 'pending_approval'
      else if (filter === 'promos') matchesFilter = item.run_as_promo
      else if (filter === 'draft') matchesFilter = item.status === 'draft'
      else if (filter === 'partially_filled') matchesFilter = item.status === 'draft' || !item.description || !item.title || !item.builder

      return matchesSearch && matchesFilter
    })
  }, [news, searchQuery, filter])

  const stats = useMemo(() => {
    const total = news.length
    const published = news.filter(n => n.status === 'published').length
    const pending = news.filter(n => n.status === 'pending_approval').length
    const promos = news.filter(n => n.run_as_promo).length
    const partiallyFilled = news.filter(n => n.status === 'draft' || !n.description || !n.title || !n.builder).length
    return { total, published, pending, promos, partiallyFilled }
  }, [news])

  const handleExportNewsCSV = () => {
    const headers = ['ID', 'Title', 'Status', 'Builder', 'Is Promo', 'Link Target', 'Created At']
    const rows = filteredNews.map(n => [
      `"${n.id}"`,
      `"${(n.title || '').replace(/"/g, '""')}"`,
      `"${n.status}"`,
      `"${(n.builder?.name || '').replace(/"/g, '""')}"`,
      n.run_as_promo ? 'Yes' : 'No',
      `"${(n.link_target || '').replace(/"/g, '""')}"`,
      `"${n.created_at}"`
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `propfyndr_news_${filter}_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 pb-16 font-sans select-none max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              News & Updates
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Press & Announcements
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Manage your builder news, market insights, and promotional updates
          </p>
        </div>

        {/* Refresh, Export & Create Post Buttons */}
        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
            Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>

          <button
            onClick={() => fetchNews(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh news feed"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportNewsCSV}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            title="Export filtered news as CSV"
          >
            <Download size={14} className="text-zinc-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingItem(null)
              setShowModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100 transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
          >
            <Plus size={15} />
            <span>New Post</span>
          </button>
        </div>
      </div>


      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Posts */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Posts
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <Newspaper className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.total}
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {stats.pending} pending
            </span>
          </div>
        </div>

        {/* Published Posts */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Published
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.published}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Live updates
            </span>
          </div>
        </div>

        {/* Pending Audit */}
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
              {loading ? <Skeleton className="h-8 w-16" /> : stats.pending}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              In verification
            </span>
          </div>
        </div>

        {/* Promos */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Promotions
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.promos}
            </span>
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
              Featured campaigns
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
            placeholder="Search article titles, description, builder name..."
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
          {(['all', 'published', 'pending_approval', 'promos', 'draft', 'partially_filled'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap capitalize ${
                filter === st
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {st === 'all' ? 'All Posts' : st === 'pending_approval' ? 'Under Review' : st === 'partially_filled' ? '⚠ Partially Filled' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Data Feed Card */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex gap-4">
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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <Newspaper className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">No news posts found</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto mb-5">
            Create your first builder update or announcement to engage buyers.
          </p>
          <button
            onClick={() => {
              setEditingItem(null)
              setShowModal(true)
            }}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs shadow-2xs hover:bg-black cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Create First Article</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNews.map(item => {
            const stCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft
            return (
              <div 
                key={item.id} 
                className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all font-sans"
              >
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  {/* Thumbnail / Initial */}
                  <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200/60 dark:border-zinc-800">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <Newspaper className="w-8 h-8 opacity-40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-extrabold text-zinc-900 dark:text-white truncate tracking-tight">
                            {item.title}
                          </h3>
                          {item.run_as_promo && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold flex items-center gap-1">
                              <Tag size={11} /> Promo
                            </span>
                          )}
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shrink-0 ${stCfg.bg} ${stCfg.text} ${stCfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                        <span>{stCfg.label}</span>
                      </span>
                    </div>

                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Metadata Footer */}
                    <div className="flex items-center gap-4 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex-wrap">
                      {item.builder?.name && (
                        <span className="flex items-center gap-1 font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                          <Building2 size={12} /> {item.builder.name}
                        </span>
                      )}

                      {item.link_target && (
                        <a 
                          href={item.link_target.startsWith('http') ? item.link_target : `https://${item.link_target}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline"
                        >
                          <ExternalLink size={12} /> {item.link_target}
                        </a>
                      )}

                      <span>
                        Posted {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Review Notes Warning Banner */}
                    {item.status === 'rejected' && item.approval_notes && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-xs">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <p className="text-rose-900 dark:text-rose-200 font-medium">
                          <strong>Audit notes:</strong> {item.approval_notes}
                        </p>
                      </div>
                    )}

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => {
                          setEditingItem(item)
                          setShowModal(true)
                        }}
                        className="px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={13} /> Archive
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CENTERED CREATE / EDIT NEWS MODAL */}
      <AnimatePresence>
        {showModal && (
          <NewsModal
            item={editingItem}
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

      {/* Toast Banner */}
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

function NewsModal({
  item,
  onSave,
  onCancel,
  showToast
}: {
  item: BuilderNews | null
  onSave: () => void
  onCancel: () => void
  showToast: (message: string, type?: 'success' | 'error') => void
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<{
    title: string
    description: string
    link_type: NewsLinkType
    link_target: string
    image_url: string
    run_as_promo: boolean
  }>({
    title: item?.title || '',
    description: item?.description || '',
    link_type: item?.link_type || 'project',
    link_target: item?.link_target || '',
    image_url: item?.image_url || '',
    run_as_promo: item?.run_as_promo || false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = item ? `/admin/news/${item.id}` : '/admin/news'
      const method = item ? 'PATCH' : 'POST'

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        onSave()
      } else {
        showToast('Failed to save news post', 'error')
      }
    } catch (err) {
      console.error('Save failed', err)
      showToast('Error saving news post', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
        onClick={onCancel}
      />

      <m.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center shadow-xs">
              <Newspaper size={18} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight">
                {item ? 'Edit Announcement' : 'New Article Post'}
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Publish market updates and promotional news
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans">
          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
              Article Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Prestige Group Announces New Luxury Tower in Sector 150"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
              Description & Excerpt *
            </label>
            <textarea
              placeholder="Provide a detailed summary of this news update..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium focus:border-blue-500 resize-none"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Link Target Type
              </label>
              <CustomSelect
                value={formData.link_type}
                onChange={val => setFormData({ ...formData, link_type: val as NewsLinkType })}
                options={[
                  { value: 'project', label: 'Project Slug' },
                  { value: 'external_url', label: 'External URL' },
                ]}
                size="sm"
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                {formData.link_type === 'project' ? 'Project Slug' : 'External Link'}
              </label>
              <input
                type="text"
                placeholder={formData.link_type === 'project' ? 'e.g. prestige-city' : 'https://...'}
                value={formData.link_target}
                onChange={e => setFormData({ ...formData, link_target: e.target.value })}
                className="w-full px-3.5 py-2 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
              Cover Image URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={formData.image_url}
              onChange={e => setFormData({ ...formData, image_url: e.target.value })}
              className="w-full px-3.5 py-2 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs hover:bg-black dark:hover:bg-zinc-100 shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : item ? 'Update Post' : 'Publish Post'}
            </button>
          </div>
        </form>
      </m.div>
    </div>
  )
}
