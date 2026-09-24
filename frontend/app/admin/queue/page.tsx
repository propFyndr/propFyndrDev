'use client'

/**
 * The salesperson's day.
 *
 * Every staff role used to land on the same `/admin` dashboard with the items
 * they could not use hidden — a dashboard with holes in it, not a dashboard for
 * anyone. A salesperson opening that saw platform totals they could not act on.
 *
 * This answers one question: who do I call, in what order, and what is going
 * cold. Ordered by lead score rather than arrival, because a HOT lead from this
 * morning outranks a COLD one from last week. Converted and lost leads are
 * finished work and do not appear at all.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PhoneCall, Fire, Clock, Warning, ArrowRight } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import LeadBriefPanel from '@/components/portal/LeadBriefPanel'
import { PageShell, PageHeader, Card, StatCard, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface QueueLead {
  id: string
  name: string
  phone: string
  project_name: string | null
  project_slug: string | null
  status: string
  lead_tier: string | null
  lead_score: number | null
  intent_tier: string | null
  ai_summary: string | null
  budget_min_cr: number | null
  budget_max_cr: number | null
  created_at: string
  assigned_partner_id: string | null
}

interface QueueResponse {
  stats: {
    today: number; hot: number; warm: number; cold: number; stale: number; unassigned: number
    /** Null until something has actually been contacted. */
    median_response_minutes: number | null
    contacted_sample: number
  }
  stale_after_ms: number
  queue: QueueLead[]
}

const TIER_STYLE: Record<string, string> = {
  HOT: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900',
  WARM: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  COLD: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
}

/** Minutes into something a person reads at a glance. */
function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / (60 * 24))}d`
}

function budgetLabel(l: QueueLead): string | null {
  if (l.budget_min_cr == null && l.budget_max_cr == null) return null
  if (l.budget_min_cr != null && l.budget_max_cr != null) return `₹${l.budget_min_cr}–${l.budget_max_cr} Cr`
  return `₹${l.budget_min_cr ?? l.budget_max_cr} Cr`
}

export default function SalesQueuePage() {
  const [data, setData] = useState<QueueResponse | null>(null)
  const [error, setError] = useState('')
  const [briefFor, setBriefFor] = useState<QueueLead | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/admin/boards/queue')
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
    } catch {
      setError('Could not load your queue.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  /** Marking a call made is the one write this screen needs. */
  async function markContacted(lead: QueueLead) {
    setSavingId(lead.id)
    try {
      const res = await adminFetch(`/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'contacted' }),
      })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError('Could not update that lead.')
    } finally {
      setSavingId(null)
    }
  }

  const staleAfter = data?.stale_after_ms ?? 48 * 60 * 60 * 1000

  if (!data && !error) return <Spinner />

  return (
    <PageShell>
      <PageHeader title="Your queue" subtitle="Open leads, strongest first. Converted and lost leads are not shown." />

      {error && <ErrorNote message={error} />}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard label="Today" value={data.stats.today} icon={<PhoneCall size={16} />} />
          {/* The number a sales floor is managed against. Shown next to the
              queue rather than buried in analytics, because it is only useful
              to the person who can still change it today. */}
          <StatCard
            label="Median response"
            value={data.stats.median_response_minutes === null ? '—' : formatWait(data.stats.median_response_minutes)}
            hint={
              data.stats.median_response_minutes === null
                ? (data.stats.contacted_sample > 0 ? `Not measured yet (${data.stats.contacted_sample}/5 leads)` : 'not measured yet')
                : `${data.stats.contacted_sample} leads, 30d`
            }
            tone={data.stats.median_response_minutes !== null && data.stats.median_response_minutes <= 15 ? 'good' : 'neutral'}
            icon={<Clock size={16} />}
          />
          <StatCard label="Hot" value={data.stats.hot} tone="hot" icon={<Fire size={16} weight="fill" />} />
          <StatCard label="Warm" value={data.stats.warm} icon={<PhoneCall size={16} />} />
          <StatCard label="Going cold" value={data.stats.stale} icon={<Warning size={16} weight="bold" />} />
          <StatCard label="Unassigned" value={data.stats.unassigned} icon={<PhoneCall size={16} />} />
        </div>
      )}

      {data && data.queue.length === 0 && (
        <EmptyState
          icon={<PhoneCall size={32} />}
          title="Queue is clear"
          body="Every open lead has been worked. New callback requests appear here as they arrive."
        />
      )}

      {data && data.queue.length > 0 && (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {data.queue.map((l) => {
            const age = Date.now() - new Date(l.created_at).getTime()
            const goingCold = l.status === 'new' && age > staleAfter
            const budget = budgetLabel(l)
            return (
              <div key={l.id} className="px-4 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-bold text-zinc-900 dark:text-white truncate">{l.name}</p>
                    {l.lead_tier && (
                      <span className={`text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${TIER_STYLE[l.lead_tier] ?? TIER_STYLE.COLD}`}>
                        {l.lead_tier}
                      </span>
                    )}
                    {goingCold && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                        <Clock size={10} weight="bold" />Going cold
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                    <a href={`tel:${l.phone}`} className="font-semibold text-zinc-700 dark:text-zinc-200 hover:underline">{l.phone}</a>
                    {' · '}{l.project_name ?? 'General enquiry'}
                    {budget ? ` · ${budget}` : ''}
                    {l.intent_tier ? ` · ${l.intent_tier.replace(/-/g, ' ')}` : ''}
                  </p>
                  {l.ai_summary && (
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">{l.ai_summary}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBriefFor(l)}
                    className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Brief
                  </button>
                  {l.status === 'new' && (
                    <button
                      type="button"
                      disabled={savingId === l.id}
                      onClick={() => void markContacted(l)}
                      className="px-3 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[12px] font-bold disabled:opacity-50 cursor-pointer"
                    >
                      Mark called
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </Card>
      )}

      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
      >
        All leads, including converted and lost <ArrowRight size={14} weight="bold" />
      </Link>

      {briefFor && (
        <LeadBriefPanel
          endpoint={`/admin/leads/${briefFor.id}/brief`}
          leadName={briefFor.name}
          onClose={() => setBriefFor(null)}
        />
      )}
    </PageShell>
  )
}
