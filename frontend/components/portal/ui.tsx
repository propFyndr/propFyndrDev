'use client'

/**
 * The small set of pieces every console page is built from. The classes here
 * are lifted from the admin panel's own pages, so the builder and partner
 * consoles inherit that look rather than re-inventing a near-miss of it.
 */

import { Fire, Flame, Snowflake } from '@phosphor-icons/react'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
      <div className="min-w-0">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
    </div>
  )
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 pb-16 font-sans max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
      {children}
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  hint?: string
  tone?: 'neutral' | 'hot' | 'good'
}) {
  const valueTone =
    tone === 'hot' ? 'text-rose-600 dark:text-rose-400'
    : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-zinc-900 dark:text-white'
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className={`text-2xl sm:text-3xl font-black ${valueTone}`}>{value}</span>
        {hint && <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 truncate">{hint}</span>}
      </div>
    </Card>
  )
}

export function TierBadge({ tier }: { tier: string | null }) {
  switch (tier) {
    case 'HOT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80">
          <Fire size={13} weight="fill" className="text-rose-500" />HOT
        </span>
      )
    case 'WARM':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
          <Flame size={13} weight="fill" className="text-amber-500" />WARM
        </span>
      )
    case 'COLD':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80">
          <Snowflake size={13} weight="fill" className="text-sky-500" />COLD
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          Unscored
        </span>
      )
  }
}

const PILL_TONES: Record<string, string> = {
  emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80',
  amber:   'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80',
  rose:    'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80',
  blue:    'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80',
  zinc:    'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
}

/**
 * Tones are looked up from a literal map, never interpolated into a class
 * name — Tailwind only ships classes it can see written out in full.
 */
export function Pill({ label, tone = 'zinc' }: { label: string; tone?: keyof typeof PILL_TONES }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${PILL_TONES[tone] ?? PILL_TONES.zinc}`}>
      {label}
    </span>
  )
}

/** Approval state of a channel partner, as PropFyndr decided it. */
export function PartnerStatusPill({ status }: { status: string }) {
  const tone: keyof typeof PILL_TONES =
    status === 'approved' ? 'emerald'
    : status === 'rejected' ? 'rose'
    : status === 'reviewing' ? 'blue'
    : 'amber'
  return <Pill label={status.replace(/_/g, ' ')} tone={tone} />
}

const LEAD_STATUS_TONE: Record<string, keyof typeof PILL_TONES> = {
  new: 'blue',
  contacted: 'amber',
  qualified: 'emerald',
  converted: 'emerald',
  lost: 'zinc',
}

export function LeadStatusPill({ status }: { status: string }) {
  return <Pill label={status} tone={LEAD_STATUS_TONE[status] ?? 'zinc'} />
}

export function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body?: string }) {
  return (
    <Card className="py-16 flex flex-col items-center justify-center text-center px-6">
      <div className="text-zinc-300 dark:text-zinc-700 mb-3">{icon}</div>
      <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      {body && <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400 max-w-sm">{body}</p>}
    </Card>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-slate-800 dark:border-zinc-200 border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <Card className="p-4 border-l-[3px] border-l-rose-400">
      <p className="text-[13px] font-medium text-rose-600 dark:text-rose-400">{message}</p>
    </Card>
  )
}
