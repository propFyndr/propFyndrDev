'use client'

// Topics the AI draft generator rotates through (least recently used first).
// "Generate AI Draft" picks the least recently used active topic.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Trash2, Tag, ChevronDown, Sparkles, Bot, Play, Pause, Search, X, Clock, Zap, RotateCcw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { AnimatePresence, m } from 'framer-motion'
import { adminFetch } from '@/lib/adminFetch'

interface BlogKeyword {
  id: string
  keyword: string
  active: boolean
  use_count: number
  last_used_at: string | null
}

interface Props {
  onError: (msg: string) => void
  /** Generates a draft on this exact topic. */
  onGenerate: (keyword: string) => void
  generating: boolean
  /** Bumped by the page after any generation, so "last used" stays current. */
  reloadToken: number
}

type TopicFilter = 'all' | 'active' | 'paused' | 'unused'

export default function BlogKeywordsPanel({ onError: onErrorProp, onGenerate, generating, reloadToken }: Props) {
  // Ref so a parent passing an inline callback doesn't re-trigger the load effect.
  const onErrorRef = useRef(onErrorProp)
  onErrorRef.current = onErrorProp
  const onError = (msg: string) => onErrorRef.current(msg)

  const [open, setOpen] = useState(false)
  const [keywords, setKeywords] = useState<BlogKeyword[]>([])
  const [draft, setDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<TopicFilter>('all')
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/admin/blog/keywords')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setKeywords((await res.json()).keywords ?? [])
    } catch {
      onErrorRef.current('Failed to load blog topics')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, reloadToken])

  useEffect(() => {
    if (!generating) {
      setGeneratingTopic(null)
    }
  }, [generating])

  const add = async () => {
    const keyword = draft.trim()
    if (keyword.length < 3 || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await adminFetch('/admin/blog/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      })
      if (res.ok) {
        setDraft('')
        load()
      } else {
        const data = await res.json().catch(() => ({}))
        onError(data.error || 'Failed to add topic')
      }
    } catch {
      onError('Failed to add topic')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggle = async (k: BlogKeyword) => {
    try {
      const res = await adminFetch(`/admin/blog/keywords/${k.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !k.active }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setKeywords(prev => prev.map(x => (x.id === k.id ? { ...x, active: !k.active } : x)))
    } catch {
      onError('Failed to update topic')
    }
  }

  const remove = async (k: BlogKeyword) => {
    if (!confirm(`Remove "${k.keyword}" from the rotation?`)) return
    try {
      const res = await adminFetch(`/admin/blog/keywords/${k.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setKeywords(prev => prev.filter(x => x.id !== k.id))
    } catch {
      onError('Failed to delete topic')
    }
  }

  const handleGenerate = (keyword: string) => {
    setGeneratingTopic(keyword)
    onGenerate(keyword)
  }

  const activeCount = useMemo(() => keywords.filter(k => k.active).length, [keywords])
  const pausedCount = keywords.length - activeCount
  const unusedCount = useMemo(() => keywords.filter(k => !k.last_used_at).length, [keywords])

  // Paused and unused tabs only appear when they have something to show.
  const filterTabs: { id: TopicFilter; label: string; count: number; show: boolean }[] = [
    { id: 'all', label: 'All', count: keywords.length, show: true },
    { id: 'active', label: 'Active', count: activeCount, show: true },
    { id: 'paused', label: 'Paused', count: pausedCount, show: pausedCount > 0 },
    { id: 'unused', label: 'Unused', count: unusedCount, show: unusedCount > 0 },
  ]

  // In the backend, rotation orders by last_used_at asc (nulls first).
  // The first active keyword in the array is guaranteed to be next in queue.
  const nextInQueue = useMemo(() => keywords.find(k => k.active), [keywords])

  const filteredKeywords = useMemo(() => {
    return keywords.filter(k => {
      const matchesSearch =
        !searchQuery.trim() ||
        k.keyword.toLowerCase().includes(searchQuery.toLowerCase().trim())
      if (!matchesSearch) return false

      if (filter === 'active') return k.active
      if (filter === 'paused') return !k.active
      if (filter === 'unused') return !k.last_used_at
      return true
    })
  }, [keywords, searchQuery, filter])

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm transition-all duration-200 overflow-hidden font-sans">
      {/* Header Accordion Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 p-4 sm:px-5 sm:py-4 text-left transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-850/50 cursor-pointer"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20 ring-4 ring-blue-500/10">
            <Sparkles size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight">
                AI Topic Rotation Queue
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {activeCount} Active in Rotation
              </span>
              {pausedCount > 0 && (
                <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
                  · {pausedCount} paused
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {nextInQueue ? (
                <span className="truncate">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Next up: </span>
                  <span className="text-zinc-600 dark:text-zinc-400 italic">“{nextInQueue.keyword}”</span>
                </span>
              ) : (
                <span>Least recently used topic goes first</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
            {keywords.length} {keywords.length === 1 ? 'topic' : 'topics'}
          </span>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border border-zinc-200/70 dark:border-zinc-700/70 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white' : ''}`}>
            <ChevronDown size={16} />
          </div>
        </div>
      </button>

      {/* Expanded Accordion Body */}
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="border-t border-zinc-100 dark:border-zinc-800/80"
          >
            <div className="p-4 sm:p-6 space-y-4">
              {/* Quick Add Topic Input */}
              <div className="relative group">
                <div className="flex items-center gap-2 p-1.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/90 dark:border-zinc-700/80 rounded-2xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all shadow-2xs">
                  <div className="pl-3 text-zinc-400">
                    <Tag size={16} />
                  </div>
                  <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        add()
                      }
                    }}
                    placeholder="Add topic (e.g. circle rates revision 2026 for Noida Expressway, Jewar Airport zone...)"
                    maxLength={120}
                    aria-label="New topic"
                    disabled={isSubmitting}
                    className="flex-1 bg-transparent px-2 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none"
                  />
                  <div className="flex items-center gap-2 pr-1">
                    <kbd className="hidden md:inline-flex items-center px-2 py-1 text-[10px] font-mono font-medium text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-700/70 rounded-lg shadow-2xs">
                      ↵ Enter
                    </kbd>
                    <button
                      type="button"
                      onClick={add}
                      disabled={draft.trim().length < 3 || isSubmitting}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-zinc-900 hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add to Queue</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              {keywords.length > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  {/* Filter Pills */}
                  <div role="tablist" aria-label="Filter topics" className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 w-full sm:w-auto overflow-x-auto text-xs font-semibold">
                    {filterTabs.filter(t => t.show).map(t => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === t.id}
                        onClick={() => setFilter(t.id)}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                          filter === t.id
                            ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                        }`}
                      >
                        {t.label} ({t.count})
                      </button>
                    ))}
                  </div>

                  {/* Search within topics */}
                  <div className="relative flex items-center min-w-[200px] sm:w-64">
                    <Search size={14} className="absolute left-3 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search topics..."
                      aria-label="Search topics"
                      className="w-full pl-8 pr-7 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/70 rounded-xl text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-blue-500 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Keywords List */}
              {keywords.length === 0 ? (
                <div className="py-10 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <Bot size={28} className="mx-auto text-zinc-400 mb-2 opacity-70" />
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No rotation topics yet</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 max-w-sm mx-auto">
                    Add topics above. Each draft is written from a web search on its topic, least recently used first.
                  </p>
                </div>
              ) : filteredKeywords.length === 0 ? (
                <div className="py-8 text-center rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40">
                  <p className="text-xs font-semibold text-zinc-500">No topics match your filter</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilter('all')
                      setSearchQuery('')
                    }}
                    className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {filteredKeywords.map(k => {
                    const isNextInQueue = k.id === nextInQueue?.id
                    const isItemGenerating = generating && generatingTopic === k.keyword

                    return (
                      <div
                        key={k.id}
                        className={`group relative p-3 sm:px-4 sm:py-3 rounded-2xl border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isNextInQueue
                            ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/80 shadow-2xs'
                            : k.active
                            ? 'bg-zinc-50/40 dark:bg-zinc-850/40 border-zinc-200/70 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                            : 'bg-zinc-100/40 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/50 opacity-60'
                        }`}
                      >
                        {/* Topic Information */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isNextInQueue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white shadow-2xs">
                                <Zap size={10} className="fill-white" /> Next in Queue
                              </span>
                            )}
                            <span
                              className={`text-xs font-bold leading-snug tracking-tight break-words ${
                                k.active
                                  ? 'text-zinc-900 dark:text-zinc-100'
                                  : 'text-zinc-400 dark:text-zinc-500 line-through'
                              }`}
                            >
                              {k.keyword}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-500 flex-wrap">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock size={12} className="text-zinc-400" />
                              {k.last_used_at
                                ? `Used ${k.use_count}× · last ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}`
                                : 'Never used · queued'}
                            </span>
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  k.active ? 'bg-emerald-500' : 'bg-zinc-400'
                                }`}
                              />
                              {k.active ? 'Active' : 'Paused'}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleGenerate(k.keyword)}
                            disabled={generating}
                            title="Generate an AI draft on this exact topic now"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-wait active:scale-[0.98]"
                          >
                            {isItemGenerating ? (
                              <RotateCcw size={13} className="motion-safe:animate-spin text-blue-600" />
                            ) : (
                              <Bot size={13} />
                            )}
                            <span>{isItemGenerating ? 'Writing…' : 'Generate'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggle(k)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 transition-all shadow-2xs cursor-pointer"
                            title={k.active ? 'Pause this topic from auto-rotation' : 'Resume auto-rotation'}
                          >
                            {k.active ? <Pause size={12} /> : <Play size={12} />}
                            <span>{k.active ? 'Pause' : 'Resume'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => remove(k)}
                            aria-label={`Delete ${k.keyword}`}
                            title="Remove from queue"
                            className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

