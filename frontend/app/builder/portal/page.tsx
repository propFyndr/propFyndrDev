'use client'

/**
 * Builder Console Overview — Executive Developer Dashboard.
 *
 * Implements Apple Human Interface & Master Design Engineering standards:
 * - Scoped strictly to the developer's inventory, inbound leads, and authorized partner firms.
 * - Real-time metrics with continuous squircles, 1px hairlines, and lead tier indicators.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Buildings,
  PhoneCall,
  Fire,
  Handshake,
  ArrowRight,
  Warning,
  ArrowsClockwise
} from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { useScopeId, withScope } from '@/lib/portalScope'
import {
  PageShell,
  PageHeader,
  StatCard,
  Card,
  TierBadge,
  LeadStatusPill,
  EmptyState,
  Spinner,
  ErrorNote
} from '@/components/portal/ui'
import LeadPerformance from '@/components/portal/LeadPerformance'
import ObjectionRollup from '@/components/portal/ObjectionRollup'

interface Project { id: string; name: string; sector: string; status: string }
interface Lead {
  id: string; name: string; project_name: string | null; status: string
  lead_tier: string | null; assigned_partner_id?: string | null; created_at: string
}
interface Partner { id: string; name: string; status: string; is_active: boolean }

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function BuilderOverviewPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  const scopeId = useScopeId('builder_id')
  const scoped = useCallback((path: string) => withScope(path, 'builder_id', scopeId), [scopeId])

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true)
    setError('')
    try {
      const [p, l, cp] = await Promise.all([
        adminFetch(scoped('/portal/builder/projects')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        adminFetch(scoped('/portal/builder/leads')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        adminFetch(scoped('/portal/builder/partners')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      ])
      setProjects(p.projects ?? [])
      setLeads(l.leads ?? [])
      setPartners(cp.partners ?? [])
    } catch {
      setError('Could not load developer console. Try refreshing or signing in again.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [scoped])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) return <Spinner />

  const hot = leads.filter((l) => l.lead_tier === 'HOT').length
  const unassigned = leads.filter((l) => !l.assigned_partner_id).length
  const awaitingApproval = partners.filter((p) => p.status !== 'approved' && p.status !== 'rejected').length
  const activePartners = partners.filter((p) => p.status === 'approved' && p.is_active).length

  return (
    <PageShell>
      {/* Header Banner */}
      <PageHeader
        title="Developer Console"
        subtitle="Catalog developments, verified buyer inquiries, and active broker connections."
        action={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-2xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            >
              <ArrowsClockwise size={13} weight="bold" className={isRefreshing ? 'animate-spin text-[#0066cc]' : ''} />
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        }
      />

      {error && <ErrorNote message={error} />}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Active Projects"
          value={projects.length}
          icon={<Buildings size={18} weight="duotone" />}
          tone="neutral"
          hint={`${projects.length} in catalog`}
        />
        <StatCard
          label="Inbound Leads"
          value={leads.length}
          icon={<PhoneCall size={18} weight="duotone" />}
          tone="neutral"
          hint={unassigned > 0 ? `${unassigned} unassigned` : 'All assigned'}
        />
        <StatCard
          label="High-Intent Leads"
          value={hot}
          icon={<Fire size={18} weight="fill" />}
          tone="hot"
          hint="Immediate priority"
        />
        <StatCard
          label="Active Partners"
          value={activePartners}
          icon={<Handshake size={18} weight="duotone" />}
          tone="good"
          hint={awaitingApproval > 0 ? `${awaitingApproval} pending review` : 'All approved'}
        />
      </div>

      {/* Lead Conversion Velocity */}
      <LeadPerformance leads={leads} subjectLabel="your projects" />

      {/* Objection Insights Engine */}
      <ObjectionRollup endpoint={scoped('/portal/builder/objections')} />

      {/* Pending Partner Approvals Notice */}
      {awaitingApproval > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-3.5 text-xs shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/60 dark:border-amber-800/60">
            <Warning size={17} weight="bold" />
          </div>
          <div className="space-y-0.5">
            <h4 className="font-bold text-amber-900 dark:text-amber-100 text-xs">
              Channel Partner Authorizations Pending Review
            </h4>
            <p className="text-amber-800/90 dark:text-amber-200/80 font-medium text-[11px] leading-relaxed">
              {awaitingApproval} channel {awaitingApproval === 1 ? 'partner agency is' : 'partner agencies are'} waiting on platform review. They will begin receiving routed leads immediately upon approval.{' '}
              <Link href="/builder/portal/partners" className="font-bold text-[#0066cc] dark:text-blue-400 hover:underline">
                Review Roster →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Recent Leads Feed */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
            Latest Inbound Inquiries
          </h2>
          <Link
            href="/builder/portal/leads"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0066cc] dark:text-blue-400 hover:underline"
          >
            <span>View All Leads</span>
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={<PhoneCall size={32} />}
            title="No leads recorded yet"
            body="Buyer callback requests on your projects land here the moment they are generated through chat discovery."
          />
        ) : (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden shadow-2xs">
            {leads.slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-extrabold text-xs flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
                    {getInitials(l.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{l.name}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{l.project_name ?? 'General project inquiry'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <TierBadge tier={l.lead_tier} />
                  <LeadStatusPill status={l.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  )
}
