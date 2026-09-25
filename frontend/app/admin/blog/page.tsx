'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  BookOpen,
  RotateCcw,
  Search,
  X,
  AlertCircle,
  FileText,
  Archive,
  ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { AnimatePresence, m } from 'framer-motion'
import CustomSelect from '@/components/admin/CustomSelect'
import TiptapEditor from '@/components/admin/TiptapEditor'
import { adminFetch } from '@/lib/adminFetch'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/portal/ui'

type BlogStatus = 'draft' | 'published' | 'archived'

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  content: string
  cover_image_url?: string | null
  status: BlogStatus
  meta_title?: string | null
  meta_description?: string | null
  author_name?: string | null
  published_at?: string | null
  created_at: string
}

type StatusFilter = 'all' | BlogStatus

const STATUS_CONFIG: Record<BlogStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  published: {
    label: 'Published',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/80 dark:border-emerald-800/80',
    dot: 'bg-emerald-500 shadow-2xs shadow-emerald-500/50',
  },
  draft: {
    label: 'Draft',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-500 dark:text-zinc-400',
    border: 'border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
  },
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<BlogPost | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const isFetchingRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const fetchPosts = useCallback(async (isManualRefresh = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    if (isManualRefresh) setIsRefreshing(true)

    try {
      const res = await adminFetch('/admin/blog')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPosts(data.posts || [])
      setLastRefreshedAt(new Date())
      if (isManualRefresh) showToast('Blog posts refreshed', 'success')
    } catch {
      showToast('Failed to fetch blog posts', 'error')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [showToast])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

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

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this post? It will no longer be visible on /blog.')) return
    try {
      const res = await adminFetch(`/admin/blog/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPosts(prev => prev.map(p => (p.id === id ? { ...p, status: 'archived' } : p)))
        showToast('Post archived', 'success')
      } else {
        showToast('Failed to archive post', 'error')
      }
    } catch {
      showToast('Error archiving post', 'error')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      const res = await adminFetch(`/admin/blog/${id}/restore`, { method: 'POST' })
      if (res.ok) {
        setPosts(prev => prev.map(p => (p.id === id ? { ...p, status: 'published' } : p)))
        showToast('Post restored to published', 'success')
      } else {
        showToast('Failed to restore post', 'error')
      }
    } catch {
      showToast('Error restoring post', 'error')
    }
  }

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('Permanently delete this post? This action CANNOT be undone.')) return
    try {
      const res = await adminFetch(`/admin/blog/${id}?permanent=true`, { method: 'DELETE' })
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== id))
        showToast('Post permanently deleted', 'success')
      } else {
        showToast('Failed to delete post', 'error')
      }
    } catch {
      showToast('Error deleting post', 'error')
    }
  }

  const filteredPosts = useMemo(() => {
    return posts.filter(item => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.slug.toLowerCase().includes(query) ||
        (item.excerpt && item.excerpt.toLowerCase().includes(query))
      const matchesFilter = filter === 'all' || item.status === filter
      return matchesSearch && matchesFilter
    })
  }, [posts, searchQuery, filter])

  const stats = useMemo(() => {
    const total = posts.length
    const published = posts.filter(p => p.status === 'published').length
    const draft = posts.filter(p => p.status === 'draft').length
    const archived = posts.filter(p => p.status === 'archived').length
    return { total, published, draft, archived }
  }, [posts])

  return (
    <div className="space-y-6 pb-16 font-sans select-none max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Blog
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              SEO Content
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Manage articles published live at /blog
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
            Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>

          <button
            onClick={() => fetchPosts(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
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

      {/* Interactive KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => setFilter('all')} className="cursor-pointer transition-transform hover:scale-[1.01]">
          <StatCard
            label="Total Posts"
            value={loading ? '—' : stats.total}
            icon={<BookOpen className="w-4 h-4 text-blue-500" />}
            hint={`${stats.draft} in draft`}
            loading={loading}
          />
        </div>
        <div onClick={() => setFilter('published')} className="cursor-pointer transition-transform hover:scale-[1.01]">
          <StatCard
            label="Published"
            value={loading ? '—' : stats.published}
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            hint="Live on /blog"
            tone="good"
            loading={loading}
          />
        </div>
        <div onClick={() => setFilter('draft')} className="cursor-pointer transition-transform hover:scale-[1.01]">
          <StatCard
            label="Drafts"
            value={loading ? '—' : stats.draft}
            icon={<FileText className="w-4 h-4 text-amber-500" />}
            hint="Not yet live"
            loading={loading}
          />
        </div>
        <div onClick={() => setFilter('archived')} className="cursor-pointer transition-transform hover:scale-[1.01]">
          <StatCard
            label="Archived"
            value={loading ? '—' : stats.archived}
            icon={<Archive className="w-4 h-4 text-zinc-400" />}
            hint="Hidden from index"
            loading={loading}
          />
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="group flex-1 w-full flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <Search size={15} className="text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search title, slug, excerpt..."
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

        <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shrink-0 overflow-x-auto">
          {(['all', 'published', 'draft', 'archived'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap capitalize ${
                filter === st
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {st === 'all' ? 'All Posts' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Data Feed */}
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
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">No blog posts found</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto mb-5">
            Write your first article to start building SEO traffic.
          </p>
          <button
            onClick={() => {
              setEditingItem(null)
              setShowModal(true)
            }}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs shadow-2xs hover:bg-black cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Create First Post</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map(item => {
            const stCfg = STATUS_CONFIG[item.status]
            return (
              <div
                key={item.id}
                className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all font-sans"
              >
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200/60 dark:border-zinc-800">
                    {item.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.cover_image_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500/10 to-indigo-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                        {item.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-zinc-900 dark:text-white truncate tracking-tight">
                          {item.title}
                        </h3>
                        <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">/blog/{item.slug}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shrink-0 ${stCfg.bg} ${stCfg.text} ${stCfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                        <span>{stCfg.label}</span>
                      </span>
                    </div>

                    {item.excerpt && (
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                        {item.excerpt}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex-wrap">
                      {item.author_name && <span className="font-bold text-zinc-700 dark:text-zinc-300">{item.author_name}</span>}
                      <span>
                        {item.status === 'published' && item.published_at
                          ? `Published ${formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}`
                          : `Created ${formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      <button
                        onClick={() => {
                          setEditingItem(item)
                          setShowModal(true)
                        }}
                        className="px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 size={13} /> Edit
                      </button>

                      {item.status === 'published' && (
                        <a
                          href={`/blog/${item.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink size={13} /> View
                        </a>
                      )}

                      {item.status !== 'archived' ? (
                        <button
                          onClick={() => handleArchive(item.id)}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <Archive size={13} /> Archive
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRestore(item.id)}
                            className="px-3 py-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 size={13} /> Restore to Live
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(item.id)}
                            className="px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} /> Delete Permanently
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

      <AnimatePresence>
        {showModal && (
          <BlogModal
            item={editingItem}
            onSave={() => {
              setShowModal(false)
              setEditingItem(null)
              fetchPosts(true)
            }}
            onCancel={() => {
              setShowModal(false)
              setEditingItem(null)
            }}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

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

function BlogModal({
  item,
  onSave,
  onCancel,
  showToast,
}: {
  item: BlogPost | null
  onSave: () => void
  onCancel: () => void
  showToast: (message: string, type?: 'success' | 'error') => void
}) {
  const [loading, setLoading] = useState(false)
  const [slugTouched, setSlugTouched] = useState(!!item)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  // Safely parse initial content so plain strings or invalid JSON never throw
  const getInitialContent = () => {
    if (!item?.content) return undefined
    try {
      return JSON.parse(item.content)
    } catch {
      return item.content
    }
  }

  const [formData, setFormData] = useState<{
    title: string
    slug: string
    excerpt: string
    content: unknown
    cover_image_url: string
    status: BlogStatus
    meta_title: string
    meta_description: string
    author_name: string
  }>({
    title: item?.title || '',
    slug: item?.slug || '',
    excerpt: item?.excerpt || '',
    content: getInitialContent(),
    cover_image_url: item?.cover_image_url || '',
    status: item?.status || 'draft',
    meta_title: item?.meta_title || '',
    meta_description: item?.meta_description || '',
    author_name: item?.author_name || 'PropFyndr Advisory Research',
  })

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = item ? `/admin/blog/${item.id}` : '/admin/blog'
      const method = item ? 'PATCH' : 'POST'

      const contentPayload =
        typeof formData.content === 'object' && formData.content !== null
          ? JSON.stringify(formData.content)
          : String(formData.content || '')

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          content: contentPayload,
        }),
      })

      if (res.ok) {
        showToast(item ? 'Post updated successfully' : 'Post created successfully', 'success')
        onSave()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Failed to save post', 'error')
      }
    } catch (err) {
      console.error('Save failed', err)
      showToast('Error saving post', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
        onClick={onCancel}
      />

      <m.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        className="relative w-full max-w-6xl xl:max-w-7xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Mode Toggle and Pinned Action */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white tracking-tight truncate">
                  {item ? 'Edit Article' : 'New Article'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  formData.status === 'published'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                    : formData.status === 'archived'
                    ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60'
                }`}>
                  {formData.status}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium truncate max-w-md">
                {formData.title ? formData.title : 'Configure content and publishing metadata'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Edit / Preview Segmented Toggle */}
            <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'edit'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Studio Editor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Live Preview
              </button>
            </div>

            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer hidden sm:block"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs hover:bg-black dark:hover:bg-zinc-100 shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white/40 dark:border-zinc-900/40 border-t-white dark:border-t-zinc-900 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{item ? 'Save Changes' : 'Publish Article'}</span>
              )}
            </button>

            <button
              onClick={onCancel}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Studio Content Area */}
        {activeTab === 'preview' ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-12 space-y-6 bg-white dark:bg-zinc-950">
            <div className="max-w-3xl mx-auto space-y-6">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200">
                Live Reader Preview
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
                {formData.title || 'Untitled Article'}
              </h1>
              {formData.excerpt && (
                <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
                  {formData.excerpt}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-zinc-400 border-y border-zinc-100 dark:border-zinc-800 py-3">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {formData.author_name || 'PropFyndr Advisory Research'}
                </span>
                <span>·</span>
                <span>Status: {formData.status.toUpperCase()}</span>
                <span>·</span>
                <span className="font-mono text-zinc-400">/blog/{formData.slug || 'slug'}</span>
              </div>
              {formData.cover_image_url && (
                <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 max-h-80 aspect-video w-full bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={formData.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="pt-4">
                <TiptapEditor
                  content={formData.content}
                  onChange={() => {}}
                  placeholder="No content written yet."
                />
              </div>
            </div>
          </div>
        ) : (
          /* Horizontal Split Workspace: Left Canvas (65%), Right Settings Rail (35%) */
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-100 dark:divide-zinc-800">
            {/* Left Writing Canvas (Main Document) */}
            <div className="lg:col-span-8 overflow-y-auto p-6 sm:p-8 space-y-5 bg-white dark:bg-zinc-900">
              {/* Document Title */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Article Title
                </label>
                <input
                  type="text"
                  placeholder="Enter a captivating article title..."
                  value={formData.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="w-full text-xl sm:text-2xl font-extrabold tracking-tight bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-600 outline-none pb-2 border-b border-zinc-100 dark:border-zinc-800 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              {/* Slug line */}
              <div className="flex items-center gap-2 text-xs py-1 px-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-400 font-mono shrink-0">propfyndr.com/blog/</span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={e => {
                    setSlugTouched(true)
                    setFormData({ ...formData, slug: slugify(e.target.value) })
                  }}
                  placeholder="url-slug"
                  className="w-full bg-transparent font-mono text-zinc-800 dark:text-zinc-200 outline-none"
                  required
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Summary / Excerpt
                </label>
                <textarea
                  placeholder="Provide a concise 1-2 sentence executive summary for search engines and social cards..."
                  value={formData.excerpt}
                  onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/70 rounded-xl outline-none text-zinc-900 dark:text-white font-medium text-xs focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all resize-none leading-relaxed"
                  rows={2}
                />
              </div>

              {/* Rich Body Canvas */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Body Content & Analysis
                </label>
                <div className="border border-zinc-200/90 dark:border-zinc-700/80 rounded-2xl overflow-hidden focus-within:border-blue-500 shadow-2xs">
                  <TiptapEditor
                    content={formData.content}
                    onChange={json => setFormData(prev => ({ ...prev, content: json }))}
                    placeholder="Write your research analysis, corridor comparison matrix, or market guide..."
                  />
                </div>
              </div>
            </div>

            {/* Right Publishing & Settings Rail */}
            <div className="lg:col-span-4 overflow-y-auto p-6 space-y-6 bg-zinc-50/60 dark:bg-zinc-950/40">
              {/* Publishing Controls */}
              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Publishing State
                  </span>
                  <span className="text-[10px] text-zinc-400">Post ID: {item?.id ? item.id.slice(0, 8) : 'new'}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">Status</label>
                  <CustomSelect
                    value={formData.status}
                    onChange={val => setFormData({ ...formData, status: val as BlogStatus })}
                    options={[
                      { value: 'draft', label: 'Draft (Not Public)' },
                      { value: 'published', label: 'Published (Live)' },
                      { value: 'archived', label: 'Archived (Hidden)' },
                    ]}
                    size="sm"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">Author Credential</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {formData.author_name ? formData.author_name[0].toUpperCase() : 'P'}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. PropFyndr Advisory Research"
                      value={formData.author_name}
                      onChange={e => setFormData({ ...formData, author_name: e.target.value })}
                      className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Cover Media Card with Aspect Preview */}
              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl space-y-3 shadow-2xs">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Cover Photography
                </span>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={formData.cover_image_url}
                    onChange={e => setFormData({ ...formData, cover_image_url: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium text-xs"
                  />
                </div>

                {/* 16:9 Aspect Ratio Preview Banner */}
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  {formData.cover_image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={formData.cover_image_url}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                      onError={e => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="text-center p-4">
                      <BookOpen size={24} className="mx-auto mb-1 text-zinc-300 dark:text-zinc-600" />
                      <span className="text-[11px] font-medium text-zinc-400">Paste an Unsplash or CDN URL</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Search Engine Optimization (SEO) */}
              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Google SERP Metadata
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold">SEO Card</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Meta Title</label>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {formData.meta_title?.length || 0}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Defaults to article title if blank"
                    value={formData.meta_title}
                    onChange={e => setFormData({ ...formData, meta_title: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium text-xs"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Meta Description</label>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {formData.meta_description?.length || 0}/160
                    </span>
                  </div>
                  <textarea
                    placeholder="Defaults to excerpt if blank"
                    value={formData.meta_description}
                    onChange={e => setFormData({ ...formData, meta_description: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium text-xs resize-none"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </m.div>
    </div>
  )
}
