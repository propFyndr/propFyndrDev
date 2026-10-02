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
  Bot,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Clock,
  Globe,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { AnimatePresence, m } from 'framer-motion'
import CustomSelect from '@/components/admin/CustomSelect'
import TiptapEditor from '@/components/admin/TiptapEditor'
import { adminFetch } from '@/lib/adminFetch'
import { useAdminRole, canDeleteRecords } from '@/lib/adminRole'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/portal/ui'
import BlogKeywordsPanel from '@/components/admin/BlogKeywordsPanel'
import DraftReviewAuditCard from '@/components/admin/DraftReviewAuditCard'
import AIGenerationWidget from '@/components/admin/AIGenerationWidget'

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
  review_notes?: string | null
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
    bg: 'bg-amber-50/80 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/80 dark:border-amber-800/80',
    dot: 'bg-amber-500 shadow-2xs shadow-amber-500/50',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-500 dark:text-zinc-400',
    border: 'border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
  },
}

/** How many rotation topics the generate dialog offers as one-click suggestions. */
const SUGGESTIONS_SHOWN = 5

/** The site's title template (app/layout.tsx) appends this to every article title. */
const TITLE_SUFFIX = ' | PropFyndr'
/** Google truncates titles at roughly 60 characters, suffix included. */
const SERP_TITLE_LIMIT = 60

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

type TiptapNode = { type?: string; text?: string; content?: TiptapNode[] }

/**
 * Words and reading time from the stored Tiptap JSON. Counts text nodes only:
 * counting the stringified JSON also counted "type", "paragraph", "marks"…,
 * which inflated every figure. Older posts may hold plain text or Markdown.
 */
function articleStats(content: string): { words: number; readingTime: number } {
  let text = content
  try {
    const walk = (n: TiptapNode): string => (n.text ?? '') + ' ' + (n.content ?? []).map(walk).join(' ')
    text = walk(JSON.parse(content) as TiptapNode)
  } catch {
    // Not JSON: count it as written.
  }
  const words = text.split(/\s+/).filter(Boolean).length
  return { words, readingTime: Math.max(1, Math.round(words / 200)) }
}

function CopySlugButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    // The admin runs on the public site's host, so its origin is the article's.
    navigator.clipboard.writeText(`${window.location.origin}/blog/${slug}`).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => {}, // clipboard blocked: the path stays visible to copy by hand
    )
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy public URL"
      className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer group/copy"
    >
      <span>/blog/{slug}</span>
      {copied ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-sans">
          <Check size={11} /> Copied
        </span>
      ) : (
        <Copy size={11} className="opacity-0 group-hover/copy:opacity-100 transition-opacity text-zinc-400" />
      )}
    </button>
  )
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

  const [generating, setGenerating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState<{ step: number; text: string; topic: string } | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [customTopic, setCustomTopic] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  /** Bumped after each generation, so topic "last used" views refresh. */
  const [keywordsVersion, setKeywordsVersion] = useState(0)

  // One-click suggestions: the next active topics in the rotation. The API
  // returns them least recently used first, which is the order Generate uses.
  useEffect(() => {
    if (!showGenerateModal) return
    let cancelled = false
    adminFetch('/admin/blog/keywords')
      .then(r => (r.ok ? r.json() : { keywords: [] }))
      .then(({ keywords }: { keywords?: { keyword: string; active: boolean }[] }) => {
        if (!cancelled) setSuggestions((keywords ?? []).filter(k => k.active).slice(0, SUGGESTIONS_SHOWN).map(k => k.keyword))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [showGenerateModal, keywordsVersion])

  // While the dialog is open, warm the server's search for the topic Generate
  // would use (the next one in rotation, or the custom one once typing pauses),
  // so the click only waits for the writing. Fire-and-forget; failure is harmless.
  useEffect(() => {
    if (!showGenerateModal) return
    const topic = customTopic.trim()
    if (topic && topic.length < 3) return
    const t = setTimeout(() => {
      adminFetch('/admin/blog/prefetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topic ? { keyword: topic } : {}),
      }).catch(() => {})
    }, topic ? 800 : 0)
    return () => clearTimeout(t)
  }, [showGenerateModal, customTopic])
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
        setShowGenerateModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Writes an AI draft (never published) and opens it in the editor for review.
  // No keyword = next topic in the rotation.
  const handleGenerate = async (keyword?: string) => {
    setShowGenerateModal(false)
    const topicToUse = keyword?.trim()
    setGenerating(true)
    // The server does not stream progress, so these steps are paced to its
    // measured stages (search 0-3s, usually prefetched while the dialog was
    // open; writing ~4-5s). The wording only claims what the pipeline actually
    // does: a web search, not a "verified records" lookup.
    setGeneratingProgress({
      step: 1,
      text: 'Searching the web for sources on this topic…',
      topic: topicToUse || 'Next topic in queue',
    })

    const timer1 = setTimeout(() => {
      setGeneratingProgress(p => p ? { ...p, step: 2, text: 'Writing the draft from those sources…' } : null)
    }, 1500)

    const timer2 = setTimeout(() => {
      setGeneratingProgress(p => p ? { ...p, step: 3, text: 'Checking links, figures and structure…' } : null)
    }, 5000)

    try {
      const res = await adminFetch('/admin/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicToUse ? { keyword: topicToUse } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      // The server returns the saved post, so no second fetch is needed to open it.
      const post: BlogPost = data.post
      setPosts(prev => [post, ...prev.filter(p => p.id !== post.id)])
      setEditingItem(post)
      setShowModal(true)

      const secs = data.timingsMs?.total ? ` in ${(data.timingsMs.total / 1000).toFixed(1)}s` : ''
      showToast(`Draft written${secs} on "${data.keyword}". Review the notes before publishing.`, 'success')
      setKeywordsVersion(v => v + 1)
      setCustomTopic('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Draft generation failed', 'error')
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setGenerating(false)
      setGeneratingProgress(null)
    }
  }

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
        // The server decides: published if it ever was, otherwise back to draft.
        const { post } = await res.json()
        setPosts(prev => prev.map(p => (p.id === id ? { ...p, status: post.status } : p)))
        showToast(`Post restored to ${post.status}`, 'success')
      } else {
        showToast('Failed to restore post', 'error')
      }
    } catch {
      showToast('Error restoring post', 'error')
    }
  }

  /** One delete path for the list and the editor. Returns whether it deleted. */
  const handlePermanentDelete = async (id: string): Promise<boolean> => {
    const isDraft = posts.find(p => p.id === id)?.status === 'draft'
    const label = isDraft ? 'draft' : 'article'
    if (!confirm(`Permanently delete this ${label}? This action CANNOT be undone.`)) return false
    try {
      const res = await adminFetch(`/admin/blog/${id}?permanent=true`, { method: 'DELETE' })
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== id))
        showToast(`${isDraft ? 'Draft' : 'Article'} permanently deleted`, 'success')
        return true
      }
      const data = await res.json().catch(() => ({}))
      showToast(data.error || 'Failed to delete post', 'error')
    } catch {
      showToast('Error deleting post', 'error')
    }
    return false
  }

  // Analysts may delete drafts; a post that has been public is super-admin only (server enforces).
  const mayDeletePublished = canDeleteRecords(useAdminRole())
  const canDelete = (p: BlogPost) => p.status === 'draft' || mayDeletePublished

  // Parsed once per post list, not on every render (each parse walks the whole article).
  const statsById = useMemo(() => new Map(posts.map(p => [p.id, articleStats(p.content)])), [posts])

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
            onClick={() => setShowGenerateModal(true)}
            disabled={generating}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Generate AI Draft on next topic or custom prompt"
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin text-blue-600" />
            ) : (
              <Bot size={15} className="text-blue-600 dark:text-blue-400" />
            )}
            <span>{generating ? 'Writing draft...' : 'Generate AI Draft'}</span>
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

      <BlogKeywordsPanel
        onError={msg => showToast(msg, 'error')}
        onGenerate={handleGenerate}
        generating={generating}
        reloadToken={keywordsVersion}
      />

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

        {/* Segmented Filter Control — Clean Responsive Grid matching AnalyticsNav */}
        <div className="grid grid-cols-2 sm:inline-flex sm:items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs w-full sm:w-auto shrink-0">
          {(['all', 'published', 'draft', 'archived'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer truncate text-center capitalize min-w-0 ${
                filter === st
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white/40 dark:hover:bg-zinc-850'
              }`}
            >
              <span className="truncate">{st === 'all' ? 'All Posts' : st}</span>
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
            const { words, readingTime } = statsById.get(item.id) ?? { words: 0, readingTime: 0 }

            return (
              <div
                key={item.id}
                className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all font-sans group"
              >
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  {/* Thumbnail / Monogram */}
                  <div className="w-24 sm:w-28 h-24 sm:h-28 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200/70 dark:border-zinc-800 relative group-hover:shadow-sm transition-all">
                    {item.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.cover_image_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white flex flex-col items-center justify-center shrink-0 p-2 relative overflow-hidden group-hover:scale-[1.02] transition-transform">
                        <div className="text-xl font-black tracking-tight">
                          {item.title.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mt-0.5">
                          Article
                        </span>
                        <div className="absolute -right-3 -bottom-3 w-12 h-12 bg-white/10 rounded-full blur-xs pointer-events-none" />
                      </div>
                    )}
                  </div>

                  {/* Body Content Info */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white truncate tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <CopySlugButton slug={item.slug} />
                        </div>
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

                    {/* AI Draft Quality Fact-Check & Verification Audit Card */}
                    {item.status === 'draft' && item.review_notes && (
                      <div className="pt-1">
                        <DraftReviewAuditCard notes={item.review_notes} />
                      </div>
                    )}

                    {/* Meta Row */}
                    <div className="flex items-center gap-3 sm:gap-4 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex-wrap">
                      {item.author_name && (
                        <span className="inline-flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                            {item.author_name[0].toUpperCase()}
                          </span>
                          {item.author_name}
                        </span>
                      )}
                      <span>
                        {item.status === 'published' && item.published_at
                          ? `Published ${formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}`
                          : `Created ${formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}`}
                      </span>
                      {words > 0 && (
                        <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                          <Clock size={11} />
                          <span>~{words} words · {readingTime} min read</span>
                        </span>
                      )}
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item)
                          setShowModal(true)
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                      >
                        <Edit2 size={13} />
                        <span>Edit Article</span>
                      </button>

                      {item.status === 'published' && (
                        <a
                          href={`/blog/${item.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink size={13} /> View Live
                        </a>
                      )}

                      {item.status === 'archived' ? (
                        <button
                          type="button"
                          onClick={() => handleRestore(item.id)}
                          className="px-3 py-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          title={item.published_at ? 'Put it back on the public blog' : 'Back to drafts (it was never published)'}
                        >
                          <CheckCircle2 size={13} /> {item.published_at ? 'Restore to Live' : 'Restore to Draft'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleArchive(item.id)}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <Archive size={13} /> Archive
                        </button>
                      )}
                      {canDelete(item) && (
                        <button
                          type="button"
                          onClick={() => handlePermanentDelete(item.id)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer ml-auto"
                          title={item.status === 'draft' ? 'Delete this draft permanently' : 'Permanently delete (super admin)'}
                        >
                          <Trash2 size={13} /> {item.status === 'draft' ? 'Delete Draft' : 'Delete'}
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
            onDelete={
              editingItem && canDelete(editingItem)
                ? async id => {
                    if (await handlePermanentDelete(id)) {
                      setShowModal(false)
                      setEditingItem(null)
                    }
                  }
                : undefined
            }
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Generate AI Draft Modal with Custom Topic input and Quick Suggestions */}
      <AnimatePresence>
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
              onClick={() => setShowGenerateModal(false)}
            />
            <m.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 z-10 space-y-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 id="generate-dialog-title" className="text-base font-extrabold text-zinc-900 dark:text-white">
                      Generate an article draft
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      Searches the web, writes a draft that links its sources. Nothing goes live until you publish it.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label htmlFor="generate-topic" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Custom topic (optional)
                  </label>
                  <input
                    id="generate-topic"
                    type="text"
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                    maxLength={120}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing && !generating) {
                        handleGenerate(customTopic.trim() || undefined)
                      }
                    }}
                    placeholder="e.g. Authority flat registry delay in Sector 137 or metro extension impact..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/60 text-xs font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-all placeholder:text-zinc-400"
                    autoFocus
                  />
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">
                    Leave blank to generate the next topic in your queue. Press Enter ↵ to begin.
                  </p>
                </div>

                {/* Suggestions come from the rotation, least recently used first:
                    a hardcoded list repeated published articles and bypassed the topics table. */}
                {suggestions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    From your topic rotation
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(topic => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setCustomTopic(topic)}
                        className="text-left px-2.5 py-1 rounded-xl text-[11px] font-medium bg-zinc-100 hover:bg-blue-50 dark:bg-zinc-800 dark:hover:bg-blue-950/40 text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 border border-zinc-200/70 dark:border-zinc-700/70 hover:border-blue-300 transition-all cursor-pointer"
                      >
                        + {topic}
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-all"
                >
                  Cancel
                </button>
                {customTopic.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleGenerate(customTopic.trim())}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Bot size={14} />
                    <span>Generate Custom Draft</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGenerate()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Bot size={14} />
                    <span>Generate Next in Queue</span>
                  </button>
                )}
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Live Generation Progress Overlay (Command Center HUD) */}
      <AIGenerationWidget generating={generating} progress={generatingProgress} />

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
  onDelete,
  showToast,
}: {
  item: BlogPost | null
  onSave: () => void
  onCancel: () => void
  onDelete?: (id: string) => void
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

  // Search preview. Host is read after mount (no window on the server render),
  // and the title is the one the page template renders: "<meta title> | PropFyndr".
  const [siteHost, setSiteHost] = useState('')
  useEffect(() => setSiteHost(window.location.host), [])
  const serpTitle = `${formData.meta_title || formData.title || 'Article title'}${TITLE_SUFFIX}`
  const serpTitleClass =
    serpTitle.length > SERP_TITLE_LIMIT
      ? { text: 'text-rose-600', bar: 'bg-rose-500' }
      : serpTitle.length >= 45
      ? { text: 'text-emerald-600', bar: 'bg-emerald-500' }
      : { text: 'text-zinc-400', bar: 'bg-blue-500' }

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

            {/* Shown only when the page passes onDelete, i.e. this role may delete this post. */}
            {item && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer flex items-center gap-1.5 transition-all"
                title={`Permanently delete this ${item.status === 'draft' ? 'draft' : 'article'}`}
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Delete {item.status === 'draft' ? 'Draft' : 'Article'}</span>
              </button>
            )}

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
              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl space-y-4 shadow-2xs font-sans">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={15} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-[11px] font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                      Google SERP Simulator
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/70 dark:border-blue-800/70">
                    Live Preview
                  </span>
                </div>

                {/* Authentic Google SERP Card Simulation */}
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/70 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-sans">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                      P
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{siteHost || 'your-site'}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">› blog › {formData.slug || 'url-slug'}</span>
                  </div>
                  {/* Rendered exactly as the page title template produces it, and cut where Google cuts. */}
                  <div className="text-sm font-semibold text-blue-700 dark:text-blue-400 leading-snug">
                    {serpTitle.length > SERP_TITLE_LIMIT ? `${serpTitle.slice(0, SERP_TITLE_LIMIT - 1).trimEnd()}…` : serpTitle}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {formData.meta_description || formData.excerpt || 'Add a meta description: it is the snippet searchers read before clicking.'}
                  </div>
                </div>

                {/* Meta title: counted as Google sees it, with the site suffix included */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label htmlFor="meta-title" className="font-bold text-zinc-700 dark:text-zinc-300">Meta Title</label>
                    <span
                      title={`Includes "${TITLE_SUFFIX.trim()}", which the site adds to every title`}
                      className={`text-[10px] font-mono font-bold ${serpTitleClass.text}`}
                    >
                      {serpTitle.length}/{SERP_TITLE_LIMIT} with suffix
                    </span>
                  </div>
                  <input
                    id="meta-title"
                    type="text"
                    placeholder="Defaults to article title if blank"
                    value={formData.meta_title}
                    onChange={e => setFormData({ ...formData, meta_title: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium text-xs focus:border-blue-500 transition-colors"
                  />
                  <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${serpTitleClass.bar}`}
                      style={{ width: `${Math.min(100, (serpTitle.length / SERP_TITLE_LIMIT) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Meta Description Input with length progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label htmlFor="meta-description" className="font-bold text-zinc-700 dark:text-zinc-300">Meta Description</label>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono font-bold ${
                        (formData.meta_description?.length || 0) > 160
                          ? 'text-rose-600'
                          : (formData.meta_description?.length || 0) >= 120
                          ? 'text-emerald-600'
                          : 'text-zinc-400'
                      }`}>
                        {formData.meta_description?.length || 0}/160
                      </span>
                    </div>
                  </div>
                  <textarea
                    id="meta-description"
                    placeholder="Defaults to excerpt if blank"
                    value={formData.meta_description}
                    onChange={e => setFormData({ ...formData, meta_description: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl outline-none text-zinc-900 dark:text-white font-medium text-xs resize-none focus:border-blue-500 transition-colors leading-relaxed"
                    rows={2}
                  />
                  <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        (formData.meta_description?.length || 0) > 160
                          ? 'bg-rose-500'
                          : (formData.meta_description?.length || 0) >= 120
                          ? 'bg-emerald-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, ((formData.meta_description?.length || 0) / 160) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </m.div>
    </div>
  )
}
