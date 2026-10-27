'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CaretRight, ChatCircleDots, Clock, MagnifyingGlass } from '@phosphor-icons/react'
import { formatDistanceToNow, format } from 'date-fns'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { adminFetch } from '@/lib/adminFetch'

interface Person {
  key: string
  kind: 'account' | 'guest'
  label: string
  sessions: number
  questions: number
  firstSeen: string
  lastActive: string
}

interface Question {
  sessionId: string
  text: string
  at: string
}

interface Expanded {
  items: Question[]
  total: number
  loading: boolean
}

const FIRST_BATCH = 10
const MORE_BATCH = 50

/**
 * One row per real person (account or website guest), newest activity first. A row expands
 * to that person's questions, newest first, each linking to its full conversation.
 * Data: GET /admin/analytics/people and /admin/analytics/people/questions.
 */
export default function PeopleChatLog() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [people, setPeople] = useState<Person[]>([])
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, Expanded>>({})

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (q.trim()) params.set('search', q.trim())
      const res = await adminFetch(`/admin/analytics/people?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPeople(data.people ?? [])
      setPagination(data.pagination ?? null)
    } catch (err) {
      console.error('People chat log load failed:', err)
      setPeople([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search; a new term starts again at page 1.
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1)
      load(1, search)
    }, 300)
    return () => clearTimeout(handle)
  }, [search, load])

  const goToPage = (p: number) => {
    setPage(p)
    load(p, search)
  }

  const loadQuestions = async (key: string, offset: number, limit: number) => {
    setExpanded((e) => ({ ...e, [key]: { items: e[key]?.items ?? [], total: e[key]?.total ?? 0, loading: true } }))
    try {
      const params = new URLSearchParams({ key, offset: String(offset), limit: String(limit) })
      const res = await adminFetch(`/admin/analytics/people/questions?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setExpanded((e) => ({
        ...e,
        [key]: { items: [...(offset ? e[key]?.items ?? [] : []), ...(data.questions ?? [])], total: data.total ?? 0, loading: false },
      }))
    } catch (err) {
      console.error('Questions load failed:', err)
      setExpanded((e) => ({ ...e, [key]: { items: e[key]?.items ?? [], total: e[key]?.total ?? 0, loading: false } }))
    }
  }

  const toggle = (key: string) => {
    if (expanded[key]) {
      setExpanded(({ [key]: _closed, ...rest }) => rest)
    } else {
      loadQuestions(key, 0, FIRST_BATCH)
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-2xs">
      {/* Toolbar */}
      <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight uppercase inline-flex items-center gap-2">
            <ChatCircleDots size={16} weight="bold" className="text-[#0066cc]" />
            Live User Chat Sessions
            <AdminInfoTooltip
              title="Live User Chat Sessions"
              description="One row per person: a signed-in account or a guest on the website. Open a row to see their questions, newest first."
              details={['Scripts and test runs are not listed', 'One person on two devices shows as two guests']}
            />
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
            {pagination ? `${pagination.total.toLocaleString()} people` : 'People'} · most recent activity first
          </p>
        </div>

        <div className="relative min-w-[220px]">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            id="people-search"
            type="text"
            placeholder="Search person or question..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#0066cc] focus:border-[#0066cc] transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : people.length > 0 ? (
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[640px]">
            <thead>
              <tr className="bg-zinc-50/75 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Person</th>
                <th className="py-3.5 px-4 text-center">Chats</th>
                <th className="py-3.5 px-4 text-center">Questions</th>
                <th className="py-3.5 px-4">First Seen</th>
                <th className="py-3.5 px-6 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
              {people.map((p) => {
                const open = expanded[p.key]
                const last = new Date(p.lastActive)
                const isRecent = Date.now() - last.getTime() < 30 * 60 * 1000
                return (
                  <Fragment key={p.key}>
                    <tr className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-6">
                        <button
                          type="button"
                          onClick={() => toggle(p.key)}
                          aria-expanded={!!open}
                          className="flex items-center gap-2 text-left cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]"
                        >
                          <CaretRight
                            size={12}
                            weight="bold"
                            className={`text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`}
                          />
                          <span className="relative flex h-2 w-2 shrink-0">
                            {isRecent && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            )}
                            <span
                              className={`relative inline-flex rounded-full h-2 w-2 ${isRecent ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                            />
                          </span>
                          <span className="font-mono font-bold text-[#0066cc] dark:text-blue-400">{p.label}</span>
                          {p.kind === 'account' && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                              Signed in
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                        {p.sessions}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                        {p.questions}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">{format(new Date(p.firstSeen), 'd MMM yyyy')}</td>
                      <td className="py-3.5 px-6 text-right text-zinc-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <Clock size={12} className="text-zinc-400" />
                          {formatDistanceToNow(last, { addSuffix: true })}
                        </span>
                      </td>
                    </tr>

                    {open && (
                      <tr className="bg-zinc-50/60 dark:bg-zinc-800/30">
                        <td colSpan={5} className="px-6 py-3">
                          {open.items.length === 0 && open.loading ? (
                            <Skeleton className="h-8 w-full rounded-lg" />
                          ) : open.items.length === 0 ? (
                            <p className="text-zinc-400 italic py-1">No questions recorded for this person.</p>
                          ) : (
                            <ul className="space-y-1.5 pl-5">
                              {open.items.map((q, i) => (
                                <li key={`${q.sessionId}-${q.at}-${i}`} className="flex items-start gap-3">
                                  <span className="w-24 shrink-0 text-zinc-400 tabular-nums">
                                    {format(new Date(q.at), 'd MMM, HH:mm')}
                                  </span>
                                  <span className="flex-1 min-w-0 text-zinc-800 dark:text-zinc-200 break-words line-clamp-2" title={q.text}>
                                    {q.text}
                                  </span>
                                  <Link
                                    href={`/admin/conversations?sessionId=${encodeURIComponent(q.sessionId)}`}
                                    className="shrink-0 font-semibold text-[#0066cc] dark:text-blue-400 hover:underline"
                                  >
                                    Open chat
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                          {open.items.length < open.total && (
                            <button
                              type="button"
                              disabled={open.loading}
                              onClick={() => loadQuestions(p.key, open.items.length, MORE_BATCH)}
                              className="mt-2 ml-5 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                            >
                              {open.loading
                                ? 'Loading…'
                                : `Show ${Math.min(MORE_BATCH, open.total - open.items.length)} more of ${open.total - open.items.length} left`}
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-zinc-400 italic">
          {search ? `No people matching "${search}"` : 'No chats recorded yet'}
        </div>
      )}

      {pagination && pagination.total > pagination.pageSize && (
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800/80 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span>
            Showing {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page * pagination.pageSize >= pagination.total || loading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
