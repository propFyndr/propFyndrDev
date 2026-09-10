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

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Posts', value: stats.total, icon: BookOpen, note: `${stats.draft} in draft`, noteColor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Published', value: stats.published, icon: CheckCircle2, note: 'Live on /blog', noteColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Drafts', value: stats.draft, icon: FileText, note: 'Not yet live', noteColor: 'text-amber-600 dark:text-amber-400' },
          { label: 'Archived', value: stats.archived, icon: Archive, note: 'Hidden', noteColor: 'text-zinc-500 dark:text-zinc-400' },
        ].map(card => (
          <div key={card.label} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {card.label}
              </span>
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                {loading ? <Skeleton className="h-8 w-16" /> : card.value}
              </span>
              <span className={`text-xs font-semibold ${card.noteColor}`}>{card.note}</span>
            </div>
          </div>
        ))}
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
                      <BookOpen className="w-8 h-8 opacity-40" />
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

                      {item.status !== 'archived' && (
                        <button
                          onClick={() => handleArchive(item.id)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={13} /> Archive
                        </button>
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
    content: item?.content ? JSON.parse(item.content) : undefined,
    cover_image_url: item?.cover_image_url || '',
    status: item?.status || 'draft',
    meta_title: item?.meta_title || '',
    meta_description: item?.meta_description || '',
    author_name: item?.author_name || '',
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

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          content: JSON.stringify(formData.content),
        }),
      })

      if (res.ok) {
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
        className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 my-auto max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center shadow-xs">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight">
                {item ? 'Edit Post' : 'New Blog Post'}
              </h3>
              <p className="text-xs text-zinc-500 font-medium">Write and publish SEO content</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-sans">
          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Title *</label>
            <input
              type="text"
              placeholder="e.g. 5 Things to Check Before Buying in Sector 150"
              value={formData.title}
              onChange={e => handleTitleChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Slug *</label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 font-mono text-xs shrink-0">/blog/</span>
              <input
                type="text"
                value={formData.slug}
                onChange={e => {
                  setSlugTouched(true)
                  setFormData({ ...formData, slug: slugify(e.target.value) })
                }}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-mono focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Excerpt</label>
            <textarea
              placeholder="Short summary shown in the blog list and search results..."
              value={formData.excerpt}
              onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium focus:border-blue-500 resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Content *</label>
            <TiptapEditor
              content={formData.content}
              onChange={json => setFormData(prev => ({ ...prev, content: json }))}
              placeholder="Start writing your article..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Status</label>
              <CustomSelect
                value={formData.status}
                onChange={val => setFormData({ ...formData, status: val as BlogStatus })}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                  { value: 'archived', label: 'Archived' },
                ]}
                size="sm"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Author Name</label>
              <input
                type="text"
                placeholder="e.g. PropFyndr Team"
                value={formData.author_name}
                onChange={e => setFormData({ ...formData, author_name: e.target.value })}
                className="w-full px-3.5 py-2 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Cover Image URL</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={formData.cover_image_url}
              onChange={e => setFormData({ ...formData, cover_image_url: e.target.value })}
              className="w-full px-3.5 py-2 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium"
            />
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">SEO Metadata</p>
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Meta Title</label>
              <input
                type="text"
                placeholder="Defaults to the post title if left blank"
                value={formData.meta_title}
                onChange={e => setFormData({ ...formData, meta_title: e.target.value })}
                className="w-full px-3.5 py-2 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Meta Description</label>
              <textarea
                placeholder="Defaults to the excerpt if left blank"
                value={formData.meta_description}
                onChange={e => setFormData({ ...formData, meta_description: e.target.value })}
                className="w-full px-3.5 py-2 bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Footer Actions */}
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
              {loading ? 'Saving...' : item ? 'Update Post' : 'Create Post'}
            </button>
          </div>
        </form>
      </m.div>
    </div>
  )
}
