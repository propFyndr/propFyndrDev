'use client'

import { useEffect, useState } from 'react'
import { API_BASE } from '@/lib/env'
import { getGuestToken } from '@/lib/guestToken'

/** One line of the "what could go wrong" record (backend: handlers/projectCatch.ts riskRecord). */
interface RiskLine {
  key: string
  label: string
  text: string
  flagged: boolean
  source: 'UP-RERA' | 'RealtyAsk record' | null
  readAt: string | null
}

/**
 * The same six lines the chat shows for "what could go wrong". Each comes from a record or says
 * "Not on record". A UP-RERA line without a read date is not shown: no date, no show.
 */
export default function RiskRecordBox({ slug }: { slug: string }) {
  const [lines, setLines] = useState<RiskLine[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = getGuestToken()
    fetch(`${API_BASE}/projects/${slug}/risk-record`, token ? { headers: { 'x-guest-token': token } } : undefined)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setLines(Array.isArray(d?.lines) ? d.lines : null) })
      .catch(() => { if (!cancelled) setLines(null) })
    return () => { cancelled = true }
  }, [slug])

  const shown = lines?.filter((l) => l.source !== 'UP-RERA' || l.readAt)
  if (!shown?.length) return null

  return (
    <section aria-labelledby="risk-record-title" className="mt-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
      <h2 id="risk-record-title" className="text-base font-bold text-slate-900 dark:text-white">What could go wrong</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">From this project&apos;s records we hold and UP-RERA. &ldquo;Not on record&rdquo; means we hold nothing, not that nothing exists.</p>
      <dl className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {shown.map((l) => (
          <div key={l.key} className="py-3 sm:grid sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${l.flagged ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              {l.label}
              {l.flagged && <span className="sr-only">(needs attention)</span>}
            </dt>
            <dd className="mt-1 sm:mt-0 text-sm text-slate-700 dark:text-slate-300">
              {l.text}
              {l.source && <span className="block mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">Source: {l.source}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
