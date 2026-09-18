'use client'

/**
 * What the leads we sent actually did.
 *
 * Both portals showed counts and nothing else: a builder saw "48 leads" with no
 * way to tell whether that was a good month, and a partner saw a list with no
 * sense of how they were converting. A count is not performance — the shape of
 * the funnel is.
 *
 * Three questions, in the order somebody actually asks them:
 *
 *   1. Of what you were sent, how much is still live and how much converted?
 *   2. How strong were they when they arrived?
 *   3. Is the flow going up or down?
 *
 * Derived entirely from leads the caller already fetched — no new endpoint, no
 * second round trip, and nothing shown that the portal was not already allowed
 * to see.
 */

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import { Card } from '@/components/portal/ui'

export interface PerformanceLead {
  status: string
  lead_tier: string | null
  created_at: string
}

/**
 * Status colours match the pills used on the lead lists, so a bar and a badge
 * for the same status are the same colour in both places.
 */
const STATUS_ORDER: Array<{ key: string; label: string; fill: string }> = [
  { key: 'new', label: 'New', fill: '#3B82F6' },
  { key: 'contacted', label: 'Contacted', fill: '#F59E0B' },
  { key: 'qualified', label: 'Qualified', fill: '#10B981' },
  { key: 'converted', label: 'Converted', fill: '#14B8A6' },
  { key: 'lost', label: 'Lost', fill: '#A1A1AA' },
]

const TIER_FILL: Record<string, string> = {
  HOT: '#E11D48',
  WARM: '#F59E0B',
  COLD: '#A1A1AA',
}

/** Last 12 weeks, oldest first. Weeks rather than days: a builder's lead flow
 *  is lumpy enough daily that the line reads as noise. */
function weeklySeries(leads: PerformanceLead[]) {
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const buckets = Array.from({ length: 12 }, (_, i) => ({
    label: i === 11 ? 'This week' : `${11 - i}w ago`,
    from: now - (12 - i) * WEEK,
    to: now - (11 - i) * WEEK,
    leads: 0,
  }))
  for (const l of leads) {
    const t = new Date(l.created_at).getTime()
    const b = buckets.find((x) => t >= x.from && t < x.to)
    if (b) b.leads++
  }
  return buckets.map(({ label, leads }) => ({ label, leads }))
}

export default function LeadPerformance({
  leads,
  /** "you" for a partner reading their own numbers, "your projects" for a builder. */
  subjectLabel = 'you',
}: {
  leads: PerformanceLead[]
  subjectLabel?: string
}) {
  const { byStatus, byTier, series, converted, conversionRate } = useMemo(() => {
    const byStatus = STATUS_ORDER.map((s) => ({
      ...s,
      count: leads.filter((l) => l.status === s.key).length,
    }))
    const byTier = ['HOT', 'WARM', 'COLD'].map((tier) => ({
      tier,
      count: leads.filter((l) => l.lead_tier === tier).length,
      fill: TIER_FILL[tier],
    }))
    const converted = leads.filter((l) => l.status === 'converted').length
    return {
      byStatus,
      byTier,
      series: weeklySeries(leads),
      converted,
      // Against everything received, not against everything closed. The
      // flattering version of this number divides by closed leads only; this
      // one answers "of what we sent you, how much became a sale".
      conversionRate: leads.length ? Math.round((converted / leads.length) * 100) : 0,
    }
  }, [leads])

  if (leads.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
          Performance appears here once leads start arriving.
        </p>
      </Card>
    )
  }

  const tooltipStyle = {
    background: 'rgb(24 24 27)',
    border: 'none',
    borderRadius: 10,
    fontSize: 12,
    color: '#fff',
    padding: '8px 10px',
  } as const

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Where the leads stand
          </span>
          <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
            {converted} of {leads.length} converted · {conversionRate}%
          </span>
        </div>
        <div className="h-[168px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byStatus} margin={{ top: 12, right: 4, bottom: 0, left: -18 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="currentColor" className="text-zinc-400" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="currentColor" className="text-zinc-400" width={34} />
              <Tooltip cursor={{ fill: 'rgba(120,120,130,0.08)' }} contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {byStatus.map((s) => <Cell key={s.key} fill={s.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          How strong they arrived
        </span>
        <div className="h-[168px] -ml-2 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byTier} layout="vertical" margin={{ top: 12, right: 12, bottom: 0, left: -6 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="tier" tickLine={false} axisLine={false} fontSize={11} width={52} stroke="currentColor" className="text-zinc-400" />
              <Tooltip cursor={{ fill: 'rgba(120,120,130,0.08)' }} contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {byTier.map((t) => <Cell key={t.tier} fill={t.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5 lg:col-span-3">
        <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          Leads sent to {subjectLabel}, last 12 weeks
        </span>
        <div className="h-[150px] -ml-2 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="leadflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} className="text-zinc-400" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={2} stroke="currentColor" className="text-zinc-400" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={34} stroke="currentColor" className="text-zinc-400" />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="leads" stroke="#14B8A6" strokeWidth={2} fill="url(#leadflow)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
