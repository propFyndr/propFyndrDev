'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Buildings,
  MapPin,
  ShieldCheck,
  ArrowSquareOut,
  CheckCircle,
  Clock,
  CurrencyInr,
} from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, Card, StatCard, Pill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface Project {
  id: string
  name: string
  slug: string
  sector: string
  status: string
  price_range_label: string | null
  created_at: string
}

const STATUS_TONE: Record<string, 'emerald' | 'blue' | 'zinc'> = {
  ready_to_move: 'emerald',
  under_construction: 'blue',
  new_launch: 'blue',
}

export default function BuilderProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Empty for a BUILDER session (the server reads the id off the session);
  // set when a PropFyndr role is viewing this builder's console.
  const scopeId = useScopeId('builder_id')
  const scoped = (path: string) => withScope(path, 'builder_id', scopeId)

  useEffect(() => {
    let cancelled = false
    adminFetch(scoped('/portal/builder/projects'))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!cancelled) setProjects(d.projects ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your projects.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId])

  if (loading) return <Spinner />

  const readyCount = projects.filter((p) => p.status === 'ready_to_move').length
  const ucCount = projects.filter((p) => p.status === 'under_construction' || p.status === 'new_launch').length

  return (
    <PageShell>
      {/* Apple-grade Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#0066cc] dark:text-[#2997ff] uppercase tracking-wider">
              Developer Inventory
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Published Projects
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight mt-1">
            Your projects
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            All developments linked to your developer identity. Specifications, prices, and floor plans are verified against state RERA records.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-[11.5px] font-bold text-emerald-700 dark:text-emerald-400">
            <ShieldCheck size={14} weight="bold" />
            RERA Verified
          </div>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Developments"
          value={projects.length}
          icon={<Buildings size={16} />}
          hint="Active on PropFyndr"
        />
        <StatCard
          label="Ready to Move"
          value={readyCount}
          tone="good"
          icon={<CheckCircle size={16} />}
          hint="Immediate possession"
        />
        <StatCard
          label="Under Construction"
          value={ucCount}
          icon={<Clock size={16} />}
          hint="Active building phase"
        />
        <StatCard
          label="Listing Quality"
          value="100%"
          tone="good"
          icon={<ShieldCheck size={16} weight="bold" />}
          hint="Verified legal baseline"
        />
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <EmptyState
          icon={<Buildings size={32} />}
          title="No projects linked yet"
          body="Once PropFyndr links your developer inventory to this account, your properties and analytics will appear here."
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-2xs">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Buildings size={20} weight="bold" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
                  <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 dark:text-zinc-400">
                      <MapPin size={13} className="text-zinc-400" />
                      {p.sector}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <Pill label={p.status.replace(/_/g, ' ')} tone={STATUS_TONE[p.status] ?? 'zinc'} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-13 sm:pl-0">
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Starting Price</p>
                  <span className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
                    {p.price_range_label ?? 'Price on request'}
                  </span>
                </div>

                <Link
                  href={`/property/${p.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-blue-600 active:scale-95 transition-all shadow-2xs"
                >
                  <span>View Public Page</span>
                  <ArrowSquareOut size={13} weight="bold" />
                </Link>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* RERA Notice */}
      <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 text-[12px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-[#0066cc] dark:text-[#2997ff] shrink-0" />
          Listing specifications and floor plans are synchronized directly with state RERA records.
        </span>
        <span className="text-[11px] font-medium text-zinc-400 shrink-0">
          Contact PropFyndr Analyst to update pricing or photos
        </span>
      </div>
    </PageShell>
  )
}
