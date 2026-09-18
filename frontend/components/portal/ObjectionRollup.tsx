'use client'

/**
 * Why buyers are not buying.
 *
 * Every objection a buyer raised has been recorded per lead and per project,
 * with the reason in their own words — and it was only ever shown one lead at a
 * time. Summed, it is the most commercially useful thing we hold about a
 * builder's projects: "possession timeline is your top objection, 34% of
 * hesitations" changes what a builder does next in a way no lead count does.
 *
 * It is also the report that is only credible because we are not their
 * marketing department. That is worth protecting: the moment this is softened
 * to keep a builder comfortable, it stops being worth reading.
 */

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, Spinner } from '@/components/portal/ui'

interface Tally { name: string; count: number; share: number }
interface RecentObjection {
  category: string
  text: string
  confidence: number | null
  project: string | null
  created_at: string
}
interface Rollup {
  total: number
  byCategory: Tally[]
  byProject: Tally[]
  recent: RecentObjection[]
}

/** Ordered by how expensive the fix usually is, not alphabetically. */
const CATEGORY_LABEL: Record<string, string> = {
  possession: 'Possession timeline',
  price: 'Price',
  product_mix: 'Layout / configuration',
  location: 'Location',
  legal: 'Legal & approvals',
  financing: 'Financing',
}

const CATEGORY_FILL: Record<string, string> = {
  possession: '#E11D48',
  price: '#F59E0B',
  product_mix: '#8B5CF6',
  location: '#0EA5E9',
  legal: '#64748B',
  financing: '#10B981',
}

export default function ObjectionRollup({ endpoint }: { endpoint: string }) {
  const [data, setData] = useState<Rollup | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    import('@/lib/adminFetch').then(({ adminFetch }) =>
      adminFetch(endpoint)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: Rollup) => { if (!cancelled) setData(d) })
        .catch(() => { if (!cancelled) setError('Could not load objections.') }),
    )
    return () => { cancelled = true }
  }, [endpoint])

  if (error) return null
  if (!data) return <Spinner />

  if (data.total === 0) {
    return (
      <Card className="p-6">
        <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          What is holding buyers back
        </span>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
          Nothing recorded yet. Objections appear here as buyers raise them in conversation.
        </p>
      </Card>
    )
  }

  const chartData = data.byCategory.map((c) => ({
    ...c,
    label: CATEGORY_LABEL[c.name] ?? c.name,
    fill: CATEGORY_FILL[c.name] ?? '#A1A1AA',
  }))
  const top = chartData[0]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            What is holding buyers back
          </span>
          <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
            {data.total} recorded
          </span>
        </div>
        {top && (
          <p className="text-[13px] text-zinc-700 dark:text-zinc-300 mt-1.5">
            <b className="font-semibold">{top.label}</b> is the most common, at {top.share}% of
            everything buyers raised.
          </p>
        )}
        <div className="h-[190px] -ml-2 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 36 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category" dataKey="label" tickLine={false} axisLine={false}
                fontSize={11} width={116} stroke="currentColor" className="text-zinc-400"
              />
              <Tooltip
                cursor={{ fill: 'rgba(120,120,130,0.08)' }}
                contentStyle={{ background: 'rgb(24 24 27)', border: 'none', borderRadius: 10, fontSize: 12, color: '#fff' }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {chartData.map((c) => <Cell key={c.name} fill={c.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          In buyers&rsquo; own words
        </span>
        <ul className="mt-2 space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
          {data.recent.map((o, i) => (
            <li key={i}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {CATEGORY_LABEL[o.category] ?? o.category}
                {o.project ? ` · ${o.project}` : ''}
              </p>
              {/* Verbatim. A category says what to fix; the sentence says how it
                  is being experienced, and that is the half that changes the
                  brochure. */}
              <p className="text-[13px] text-zinc-700 dark:text-zinc-300">{o.text}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
