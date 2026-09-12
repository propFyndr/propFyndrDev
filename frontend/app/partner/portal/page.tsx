'use client'

/**
 * Channel-partner console overview. A partner belongs to one builder and sees
 * exactly the leads that builder routed to them — the server filters on the
 * session's own partner id, so nothing here can widen that.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PhoneCall, Fire, Target, SealCheck, MapPin, ArrowRight, Warning } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, PageHeader, StatCard, Card, TierBadge, LeadStatusPill, EmptyState, Spinner, ErrorNote, PartnerStatusPill } from '@/components/portal/ui'

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
  id: string; name: string; project_name: string | null
  status: string; lead_tier: string | null; assigned_at: string | null
}

export default function PartnerOverviewPage() {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Empty for a PARTNER session; set when a PropFyndr role is viewing theirs.
  const scopeId = useScopeId('partner_id')
  const scoped = (path: string) => withScope(path, 'partner_id', scopeId)


  useEffect(() => {
    let cancelled = false
    Promise.all([
      adminFetch(scoped('/portal/partner/profile')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      adminFetch(scoped('/portal/partner/leads')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([p, l]) => {
        if (cancelled) return
        setPartner(p.partner)
        setLeads(l.leads ?? [])
      })
      .catch(() => { if (!cancelled) setError('Could not load your console. Try signing in again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId])

  if (loading) return <Spinner />
  if (error) return <PageShell><ErrorNote message={error} /></PageShell>
  if (!partner) return null

  const hot = leads.filter((l) => l.lead_tier === 'HOT').length
  const converted = leads.filter((l) => l.status === 'converted').length
  const conversion = leads.length > 0 ? `${((converted / leads.length) * 100).toFixed(1)}%` : '—'

  return (
    <PageShell>
      <PageHeader
        title={partner.name}
        subtitle={partner.builder ? `Channel partner for ${partner.builder.name}` : 'Channel partner'}
      />

      <Card className="p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-300 capitalize">{partner.type.replace(/_/g, ' ')}</span>
          <PartnerStatusPill status={partner.status} />
          {partner.is_verified && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
              <SealCheck size={12} weight="fill" />Verified
            </span>
          )}
        </div>
        {partner.operating_cities.length > 0 && (
          <p className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400 mt-2">
            <MapPin size={12} />{partner.operating_cities.join(', ')}
          </p>
        )}
      </Card>

      {(partner.status !== 'approved' || !partner.is_active) && (
        <Card className="p-4 flex items-start gap-3 border-l-[3px] border-l-amber-400">
          <Warning size={18} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[13px] text-zinc-600 dark:text-zinc-300">
            {partner.status === 'rejected'
              ? `PropFyndr did not approve this account.${partner.review_notes ? ` Note: ${partner.review_notes}` : ''}`
              : partner.status !== 'approved'
                ? 'PropFyndr is still reviewing this account. Leads start arriving once it is approved.'
                : 'Your builder has switched this account off, so no new leads are being routed to you.'}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Leads assigned" value={leads.length} icon={<PhoneCall size={16} />} />
        <StatCard label="Hot" value={hot} icon={<Fire size={16} weight="fill" />} tone="hot" />
        <StatCard label="Converted" value={conversion} icon={<Target size={16} />} tone="good" hint={`${converted} closed`} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Latest leads</h2>
          <Link href="/partner/portal/leads" className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            All leads <ArrowRight size={13} weight="bold" />
          </Link>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={<PhoneCall size={32} />}
            title="No leads routed to you yet"
            body="Your builder assigns buyer leads to you from their console. They appear here immediately."
          />
        ) : (
          <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
            {leads.slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{l.name}</p>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate">{l.project_name ?? 'General inquiry'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <TierBadge tier={l.lead_tier} />
                  <LeadStatusPill status={l.status} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </PageShell>
  )
}
