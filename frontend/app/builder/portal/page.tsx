'use client'

/**
 * Builder console overview. Every number here is counted from rows one builder
 * owns. A BUILDER session sends no id — the server reads it off the session; a
 * PropFyndr role viewing this console passes ?builder_id=… and the server
 * re-derives every row from that.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Buildings, PhoneCall, Fire, Handshake, ArrowRight, Warning } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, PageHeader, StatCard, Card, TierBadge, LeadStatusPill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface Project { id: string; name: string; sector: string; status: string }
interface Lead {
  id: string; name: string; project_name: string | null; status: string
  lead_tier: string | null; assigned_partner_id?: string | null; created_at: string
}
interface Partner { id: string; name: string; status: string; is_active: boolean }

export default function BuilderOverviewPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Empty for a BUILDER session (the server reads the id off the session);
  // set when a PropFyndr role is viewing this builder's console.
  const scopeId = useScopeId('builder_id')
  const scoped = (path: string) => withScope(path, 'builder_id', scopeId)


  useEffect(() => {
    let cancelled = false
    Promise.all([
      adminFetch(scoped('/portal/builder/projects')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      adminFetch(scoped('/portal/builder/leads')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      adminFetch(scoped('/portal/builder/partners')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([p, l, cp]) => {
        if (cancelled) return
        setProjects(p.projects ?? [])
        setLeads(l.leads ?? [])
        setPartners(cp.partners ?? [])
      })
      .catch(() => { if (!cancelled) setError('Could not load your console. Try signing in again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId])

  if (loading) return <Spinner />

  const hot = leads.filter((l) => l.lead_tier === 'HOT').length
  const unassigned = leads.filter((l) => !l.assigned_partner_id).length
  const awaitingApproval = partners.filter((p) => p.status !== 'approved' && p.status !== 'rejected').length
  const activePartners = partners.filter((p) => p.status === 'approved' && p.is_active).length

  return (
    <PageShell>
      <PageHeader
        title="Your console"
        subtitle="Projects, buyer leads and the channel partners working them."
      />

      {error && <ErrorNote message={error} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Projects" value={projects.length} icon={<Buildings size={16} />} />
        <StatCard label="Leads" value={leads.length} icon={<PhoneCall size={16} />} hint={unassigned > 0 ? `${unassigned} unassigned` : undefined} />
        <StatCard label="Hot leads" value={hot} icon={<Fire size={16} weight="fill" />} tone="hot" />
        <StatCard label="Active partners" value={activePartners} icon={<Handshake size={16} />} hint={awaitingApproval > 0 ? `${awaitingApproval} pending` : undefined} />
      </div>

      {awaitingApproval > 0 && (
        <Card className="p-4 flex items-start gap-3 border-l-[3px] border-l-amber-400">
          <Warning size={18} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[13px] text-zinc-600 dark:text-zinc-300">
            {awaitingApproval} channel {awaitingApproval === 1 ? 'partner is' : 'partners are'} waiting on PropFyndr approval.
            They cannot sign in or receive leads until approved.{' '}
            <Link href="/builder/portal/partners" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Review</Link>
          </p>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Latest leads</h2>
          <Link href="/builder/portal/leads" className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            All leads <ArrowRight size={13} weight="bold" />
          </Link>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={<PhoneCall size={32} />}
            title="No leads yet"
            body="Buyer callback requests on your projects land here the moment they come in."
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
