'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowCounterClockwise, CaretRight, MapPin, Buildings } from '@phosphor-icons/react'
import { format } from 'date-fns'
import AnalyticsNav from '@/components/admin/AnalyticsNav'
import { Skeleton } from '@/components/ui/skeleton'
import { adminFetch } from '@/lib/adminFetch'

interface GapItem {
  question: string
  answer: string | null
  at: string
  sessionId: string
  lane: string | null
  seconds: number | null
}

interface GapKind {
  id: string
  label: string
  count: number
  items: GapItem[]
}

interface Asked {
  asks: number
  lastAsked: string
  sessionId: string
  query: string | null
}

interface Gaps {
  windowDays: number
  turnsChecked: number
  turnsWithAGap: number
  kinds: GapKind[]
  missingSectors: Array<Asked & { sector: string }>
  missingProjects: Array<Asked & { name: string }>
}

const WINDOWS = [7, 30, 90]
const chatLink = (sessionId: string) => `/admin/conversations?sessionId=${encodeURIComponent(sessionId)}`

/** Where the chat fell short for real buyers, grouped by what to fix. Data: GET /admin/analytics/answer-gaps. */
export default function AnswerGapsPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Gaps | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async (d: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch(`/admin/analytics/answer-gaps?days=${d}`)
      if (!res.ok) throw new Error(res.status === 403 ? 'Only a super admin can see buyer questions.' : `Could not load (HTTP ${res.status}).`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(days)
  }, [days, load])

  const share = data && data.turnsChecked ? Math.round((data.turnsWithAGap / data.turnsChecked) * 100) : 0

  return (
    <div className="space-y-6 pb-16 font-sans max-w-[1400px] mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 min-w-0 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pt-1 min-w-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link
            href="/admin/analytics"
            className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all shadow-2xs shrink-0"
            title="Back to Analytics Overview"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight truncate">
              Where We Fell Short
            </h1>
            <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
              Real buyers&apos; questions we could not answer well, grouped by what to fix
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                days === d
                  ? 'bg-[#0066cc] text-white border-[#0066cc]'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {d} days
            </button>
          ))}
          <button
            type="button"
            onClick={() => load(days)}
            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            title="Refresh"
          >
            <ArrowCounterClockwise size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <AnalyticsNav />

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            In the last {data.windowDays} days, <strong className="tabular-nums">{data.turnsWithAGap}</strong> of{' '}
            <strong className="tabular-nums">{data.turnsChecked}</strong> real buyer questions ({share}%) fell short in at least one way.
            Scripts and test runs are not counted.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <AskedList
              title="Sectors buyers asked for that we hold nothing in"
              icon={<MapPin size={16} weight="bold" className="text-[#0066cc]" />}
              empty="Every sector buyers searched has at least one project."
              rows={data.missingSectors.map((s) => ({ ...s, label: s.sector }))}
            />
            <AskedList
              title="Projects buyers asked for that we do not hold"
              icon={<Buildings size={16} weight="bold" className="text-[#0066cc]" />}
              empty="No project asked by name was missing."
              rows={data.missingProjects.map((p) => ({ ...p, label: p.name }))}
            />
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {data.kinds.map((k) => {
              const isOpen = open === k.id
              return (
                <div key={k.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : k.id)}
                    aria-expanded={isOpen}
                    disabled={k.count === 0}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]"
                  >
                    <CaretRight size={12} weight="bold" className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''} ${k.count === 0 ? 'opacity-0' : ''}`} />
                    <span className="flex-1 text-sm font-semibold text-zinc-900 dark:text-white">{k.label}</span>
                    <span
                      className={`tabular-nums text-sm font-bold px-2 py-0.5 rounded-md ${
                        k.count ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'text-zinc-400'
                      }`}
                    >
                      {k.count}
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="px-5 pb-4 space-y-3">
                      {k.items.map((it, i) => (
                        <li key={`${it.sessionId}-${it.at}-${i}`} className="text-xs border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-400">
                            <span className="tabular-nums">{format(new Date(it.at), 'd MMM, HH:mm')}</span>
                            {it.lane && <span>lane: {it.lane}</span>}
                            {it.seconds != null && <span className="tabular-nums">{it.seconds}s</span>}
                            <Link href={chatLink(it.sessionId)} className="font-semibold text-[#0066cc] dark:text-blue-400 hover:underline">
                              Open chat
                            </Link>
                          </div>
                          <p className="mt-1 text-zinc-900 dark:text-zinc-100 break-words">{it.question}</p>
                          {it.answer && <p className="mt-0.5 text-zinc-500 dark:text-zinc-400 break-words line-clamp-2">{it.answer}</p>}
                        </li>
                      ))}
                      {k.count > k.items.length && (
                        <li className="text-xs text-zinc-400">Showing the newest {k.items.length} of {k.count}.</li>
                      )}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}

function AskedList({
  title,
  icon,
  empty,
  rows,
}: {
  title: string
  icon: React.ReactNode
  empty: string
  rows: Array<Asked & { label: string }>
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 space-y-3 min-w-0">
      <h2 className="text-sm font-bold text-zinc-900 dark:text-white inline-flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-400">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 text-xs">
              <span className="flex-1 min-w-0 truncate font-semibold text-zinc-800 dark:text-zinc-200" title={r.query ?? undefined}>
                {r.label}
              </span>
              <span className="tabular-nums text-zinc-500">
                {r.asks} {r.asks === 1 ? 'ask' : 'asks'}
              </span>
              <span className="tabular-nums text-zinc-400 w-16 text-right">{format(new Date(r.lastAsked), 'd MMM')}</span>
              <Link href={chatLink(r.sessionId)} className="font-semibold text-[#0066cc] dark:text-blue-400 hover:underline">
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
