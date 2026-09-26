'use client'

/**
 * Channel-Partner Console Overview — Broker Workspace.
 *
 * Implements Apple Human Interface & Master Design Engineering standards:
 * - Scoped strictly to the broker agency's assigned buyer leads and site visits.
 * - Real-time metrics with continuous squircles, 1px hairlines, and lead tier indicators.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  PhoneCall,
  Fire,
  Target,
  SealCheck,
  MapPin,
  ArrowRight,
  Warning,
  ArrowsClockwise,
  Handshake,
  Buildings
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
  ErrorNote,
  PartnerStatusPill
} from '@/components/portal/ui'
import LeadPerformance from '@/components/portal/LeadPerformance'

interface Partner {
  id: string
  name: string
  type: string
  is_verified: boolean
  is_active: boolean
  status: string
  review_notes: string | null
  operating_cities: string[]
  specializations: string[]
  builder: { id: string; name: string; slug: string } | null
}

interface Lead {
  id: string
  name: string
  project_name: string | null
  status: string
  lead_tier: string | null
  assigned_at: string | null
  created_at: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function PartnerOverviewPage() {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  const scopeId = useScopeId('partner_id')
  const scoped = useCallback((path: string) => withScope(path, 'partner_id', scopeId), [scopeId])

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true)
    setError('')
    try {
      const [p, l] = await Promise.all([
        adminFetch(scoped('/portal/partner/profile')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        adminFetch(scoped('/portal/partner/leads')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      ])
      setPartner(p.partner)
      setLeads(l.leads ?? [])
    } catch {
      setError('Could not load channel partner console. Try signing in again.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [scoped])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) return <Spinner />
  if (error) return <PageShell><ErrorNote message={error} /></PageShell>
  if (!partner) return null

  const hot = leads.filter((l) => l.lead_tier === 'HOT').length
  const converted = leads.filter((l) => l.status === 'converted').length
  const conversion = leads.length > 0 ? `${((converted / leads.length) * 100).toFixed(1)}%` : '0%'

  return (
    <PageShell>
      {/* Header Banner */}
      <PageHeader
        title={partner.name}
        subtitle={partner.builder ? `Authorized Channel Partner for ${partner.builder.name}` : 'Authorized Channel Partner Agency'}
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

      {/* Broker Profile Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 font-extrabold text-base flex items-center justify-center shrink-0 shadow-2xs">
            <Handshake size={24} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
                {partner.type.replace(/_/g, ' ')}
              </span>
              <PartnerStatusPill status={partner.status} />
              {partner.is_verified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                  <SealCheck size={12} weight="fill" />
                  Verified Agency
                </span>
              )}
            </div>
            {partner.operating_cities.length > 0 && (
              <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
                <MapPin size={13} className="text-zinc-400" />
                <span>Operating in {partner.operating_cities.join(', ')}</span>
              </p>
            )}
          </div>
        </div>

        {partner.builder && (
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 self-start sm:self-auto">
            <Buildings size={14} className="text-amber-500" />
            <span>Developer: {partner.builder.name}</span>
          </div>
        )}
      </div>

      {/* Account Status Notice */}
      {(partner.status !== 'approved' || !partner.is_active) && (
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-3.5 text-xs shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/60 dark:border-amber-800/60">
            <Warning size={17} weight="bold" />
          </div>
          <div>
            <h4 className="font-bold text-amber-900 dark:text-amber-100 text-xs">
              Account Status Notice
            </h4>
            <p className="text-amber-800/90 dark:text-amber-200/80 font-medium text-[11px] leading-relaxed mt-0.5">
              {partner.status === 'rejected'
                ? `PropFyndr did not approve this brokerage account.${partner.review_notes ? ` Review feedback: ${partner.review_notes}` : ''}`
                : partner.status !== 'approved'
                ? 'PropFyndr compliance is currently reviewing your agency credentials. Lead routing activates upon verification.'
                : 'Your associated developer has temporarily deactivated this account. Contact developer administration for reactivation.'}
            </p>
          </div>
        </div>
      )}

      {/* KPI StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Leads Assigned"
          value={leads.length}
          icon={<PhoneCall size={18} weight="duotone" />}
          tone="neutral"
          hint={`${leads.length} in pipeline`}
        />
        <StatCard
          label="Hot Leads"
          value={hot}
          icon={<Fire size={18} weight="fill" />}
          tone="hot"
          hint="Priority callback"
        />
        <StatCard
          label="Conversion Velocity"
          value={conversion}
          icon={<Target size={18} weight="duotone" />}
          tone="good"
          hint={`${converted} closed`}
        />
      </div>

      {/* Conversion Velocity Chart */}
      <LeadPerformance leads={leads} subjectLabel="your agency" />

      {/* Latest Leads Table */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
            Latest Assigned Leads
          </h2>
          <Link
            href="/partner/portal/leads"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0066cc] dark:text-blue-400 hover:underline"
          >
            <span>View All Leads</span>
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={<PhoneCall size={32} />}
            title="No leads assigned yet"
            body="Buyer callback inquiries routed to your agency by the developer will appear here immediately."
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
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{l.project_name ?? 'General inquiry'}</p>
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
