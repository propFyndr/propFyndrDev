'use client'

/**
 * Builder lead desk. One list, filterable, with the two writes a builder
 * actually needs: move a lead's status, and route it to one of their own
 * approved channel partners.
 *
 * Only approved + active partners appear in the assignment control, and the
 * server re-checks that same condition — the dropdown is a convenience, not
 * the guard.
 */

import { useEffect, useMemo, useState } from 'react'
import { PhoneCall, MagnifyingGlass, Fire, CalendarCheck, Clock } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { type SelectOption } from '@/components/admin/CustomSelect'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, PageHeader, Card, StatCard, TierBadge, LeadStatusPill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface Lead {
  id: string
  name: string
  phone: string
  project_name: string | null
  status: string
  lead_tier: string | null
  intent_tier: string | null
  ai_summary: string | null
  budget_min_cr: number | null
  budget_max_cr: number | null
  assigned_partner_id: string | null
  assigned_at: string | null
  created_at: string
}

interface Partner { id: string; name: string; status: string; is_active: boolean }

/**
 * A booked appointment, not a callback. Its own table and its own shape — it
 * carries a date and a slot and has no partner assignment, so it renders as its
 * own section rather than being flattened into the lead list.
 */
interface SiteVisit {
  id: string
  name: string
  phone: string
  email: string | null
  project_name: string
  visit_date: string
  time_slot: string
  message: string | null
  status: string
  created_at: string
}

/**
 * Status colours match the admin Leads page dot-for-dot — a lead marked
 * "converted" must look the same whoever is looking at it.
 */
const STATUS_OPTIONS: SelectOption[] = [
  { value: 'new', label: 'New', dotColor: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', dotColor: 'bg-amber-500' },
  { value: 'qualified', label: 'Qualified', dotColor: 'bg-emerald-500' },
  { value: 'converted', label: 'Converted', dotColor: 'bg-teal-500' },
  { value: 'lost', label: 'Lost', dotColor: 'bg-zinc-400' },
]

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All statuses' },
  ...STATUS_OPTIONS,
]

function budgetLabel(lead: Lead): string | null {
  if (lead.budget_min_cr == null && lead.budget_max_cr == null) return null
  if (lead.budget_min_cr != null && lead.budget_max_cr != null) return `₹${lead.budget_min_cr}–${lead.budget_max_cr} Cr`
  return `₹${lead.budget_min_cr ?? lead.budget_max_cr} Cr`
}

export default function BuilderLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [savingId, setSavingId] = useState<string | null>(null)
  // Empty for a BUILDER session (the server reads the id off the session);
  // set when a PropFyndr role is viewing this builder's console.
  const scopeId = useScopeId('builder_id')
  const scoped = (path: string) => withScope(path, 'builder_id', scopeId)


  useEffect(() => {
    let cancelled = false
    Promise.all([
      adminFetch(scoped('/portal/builder/leads')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      adminFetch(scoped('/portal/builder/partners')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([l, p]) => {
        if (cancelled) return
        setLeads(l.leads ?? [])
        setSiteVisits(l.siteVisits ?? [])
        setPartners(p.partners ?? [])
      })
      .catch(() => { if (!cancelled) setError('Could not load your leads.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId])

  const assignable = useMemo(
    () => partners.filter((p) => p.status === 'approved' && p.is_active),
    [partners],
  )
  const partnerName = useMemo(() => new Map(partners.map((p) => [p.id, p.name])), [partners])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads.filter((l) => {
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false
      if (!q) return true
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.project_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [leads, query, statusFilter])

  async function patchLead(id: string, body: Record<string, unknown>) {
    setSavingId(id)
    setError('')
    try {
      const res = await adminFetch(scoped(`/portal/builder/leads/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Update failed')
      }
      const { lead } = await res.json()
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...lead } : l)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <Spinner />

  const hot = leads.filter((l) => l.lead_tier === 'HOT').length
  const unassigned = leads.filter((l) => !l.assigned_partner_id).length
  // Today counts as upcoming — a visit booked for this morning is still the
  // builder's problem today.
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const upcoming = siteVisits.filter((v) => new Date(v.visit_date) >= startOfToday)
  const upcomingVisits = upcoming.length

  return (
    <PageShell>
      <PageHeader title="Leads" subtitle="Buyer callback requests on your projects, and who is working each one." />
      {error && <ErrorNote message={error} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total leads" value={leads.length} icon={<PhoneCall size={16} />} />
        <StatCard label="Hot" value={hot} icon={<Fire size={16} weight="fill" />} tone="hot" />
        <StatCard label="Unassigned" value={unassigned} icon={<PhoneCall size={16} />} />
        <StatCard label="Upcoming visits" value={upcomingVisits} icon={<CalendarCheck size={16} />} tone="good" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="group flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-2xs flex-1 focus-within:border-zinc-300 dark:focus-within:border-zinc-600 transition-all">
          <MagnifyingGlass size={16} className="text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, phone or project…"
            aria-label="Filter leads"
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>
        <div className="sm:w-52">
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            size="md"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<PhoneCall size={32} />}
          title={leads.length === 0 ? 'No leads yet' : 'No leads match that filter'}
          body={leads.length === 0 ? 'Buyer callback requests on your projects land here.' : undefined}
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {filtered.map((l) => {
            const budget = budgetLabel(l)
            return (
              <div key={l.id} className="px-4 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{l.name}</p>
                    <TierBadge tier={l.lead_tier} />
                    <LeadStatusPill status={l.status} />
                  </div>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                    {l.phone} · {l.project_name ?? 'General inquiry'}
                    {budget ? ` · ${budget}` : ''}
                    {l.intent_tier ? ` · ${l.intent_tier.replace(/-/g, ' ')}` : ''}
                  </p>
                  {l.ai_summary && (
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{l.ai_summary}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap w-full lg:w-auto">
                  <div className="w-[136px] flex-1 min-w-[128px] lg:flex-none">
                    <CustomSelect
                      value={l.status}
                      onChange={(v) => patchLead(l.id, { status: v })}
                      options={STATUS_OPTIONS}
                      disabled={savingId === l.id}
                      size="sm"
                    />
                  </div>

                  <div className="w-[180px] flex-1 min-w-[150px] lg:flex-none" title={assignable.length === 0 ? 'No approved, active partners yet' : undefined}>
                    <CustomSelect
                      value={l.assigned_partner_id ?? ''}
                      onChange={(v) => patchLead(l.id, { assigned_partner_id: v || null })}
                      options={[
                        { value: '', label: assignable.length === 0 ? 'No partners yet' : 'Unassigned' },
                        // An already-assigned partner that has since been
                        // switched off still needs an entry, or the control
                        // would read "Unassigned" for a lead that is assigned.
                        ...(l.assigned_partner_id && !assignable.some((p) => p.id === l.assigned_partner_id)
                          ? [{
                              value: l.assigned_partner_id,
                              label: `${partnerName.get(l.assigned_partner_id) ?? 'Assigned partner'} (inactive)`,
                              dotColor: 'bg-zinc-400',
                            }]
                          : []),
                        ...assignable.map((p) => ({ value: p.id, label: p.name, dotColor: 'bg-emerald-500' })),
                      ]}
                      disabled={savingId === l.id || assignable.length === 0}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </Card>
      )}
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-0.5">
          Site visits booked on your projects
        </h2>
        {siteVisits.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck size={32} />}
            title="No site visits booked yet"
            body="When a buyer schedules a visit to one of your projects it appears here with the date and slot."
          />
        ) : (
          <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
            {siteVisits.map((v) => {
              const when = new Date(v.visit_date)
              const isUpcoming = when >= startOfToday
              return (
                <div key={v.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{v.name}</p>
                      <LeadStatusPill status={v.status} />
                      {!isUpcoming && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          Past
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                      <a href={`tel:${v.phone}`} className="font-semibold text-zinc-700 dark:text-zinc-200 hover:underline">{v.phone}</a>
                      {' · '}{v.project_name}
                    </p>
                    {v.message && (
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{v.message}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                      <Clock size={12} />{v.time_slot}
                    </p>
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </section>
    </PageShell>
  )
}
