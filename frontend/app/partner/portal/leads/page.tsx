'use client'

/**
 * The partner's working list: the leads their builder routed to them, with
 * the two writes a partner needs — move the status, leave a note the builder
 * and PropFyndr can both read.
 */

import { useEffect, useMemo, useState } from 'react'
import { PhoneCall, MagnifyingGlass, NotePencil, Check, Notebook, CalendarCheck, Clock } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { type SelectOption } from '@/components/admin/CustomSelect'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, PageHeader, Card, TierBadge, LeadStatusPill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'
import LeadBriefPanel from '@/components/portal/LeadBriefPanel'

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
  partner_notes: string | null
  assigned_at: string | null
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

/**
 * An appointment routed to this partner. They may move its status and leave a
 * note; they may not reassign it — the server refuses, because a partner who
 * could hand work back invisibly leaves a builder believing it is covered.
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
  partner_notes: string | null
}

const VISIT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'pending', label: 'Pending', dotColor: 'bg-blue-500' },
  { value: 'confirmed', label: 'Confirmed', dotColor: 'bg-emerald-500' },
  { value: 'completed', label: 'Completed', dotColor: 'bg-teal-500' },
  { value: 'cancelled', label: 'Cancelled', dotColor: 'bg-zinc-400' },
]

function budgetLabel(l: Lead): string | null {
  if (l.budget_min_cr == null && l.budget_max_cr == null) return null
  if (l.budget_min_cr != null && l.budget_max_cr != null) return `₹${l.budget_min_cr}–${l.budget_max_cr} Cr`
  return `₹${l.budget_min_cr ?? l.budget_max_cr} Cr`
}

export default function PartnerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([])
  const [briefFor, setBriefFor] = useState<Lead | null>(null)
  // Empty for a PARTNER session; set when a PropFyndr role is viewing theirs.
  const scopeId = useScopeId('partner_id')
  const scoped = (path: string) => withScope(path, 'partner_id', scopeId)


  useEffect(() => {
    let cancelled = false
    Promise.all([
      adminFetch(scoped('/portal/partner/leads')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      adminFetch(scoped('/portal/partner/site-visits')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([l, v]) => {
        if (cancelled) return
        setLeads(l.leads ?? [])
        setSiteVisits(v.siteVisits ?? [])
      })
      .catch(() => { if (!cancelled) setError('Could not load your leads.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads.filter((l) => {
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false
      if (!q) return true
      return l.name.toLowerCase().includes(q) || l.phone.includes(q) || (l.project_name ?? '').toLowerCase().includes(q)
    })
  }, [leads, query, statusFilter])

  async function patchLead(id: string, body: Record<string, unknown>) {
    setSavingId(id)
    setError('')
    try {
      const res = await adminFetch(scoped(`/portal/partner/leads/${id}`), {
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

  async function saveNote(id: string) {
    await patchLead(id, { partner_notes: noteDraft.trim() || null })
    setEditingId(null)
  }

  async function patchVisit(id: string, body: Record<string, unknown>) {
    setSavingId(id)
    setError('')
    try {
      const res = await adminFetch(scoped(`/portal/partner/site-visits/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Update failed')
      }
      const { siteVisit } = await res.json()
      setSiteVisits((prev) => prev.map((v) => (v.id === id ? { ...v, ...siteVisit } : v)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <Spinner />

  return (
    <PageShell>
      <PageHeader title="Leads" subtitle="Buyers your builder routed to you. Update the status as you work them." />
      {error && <ErrorNote message={error} />}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-2xs flex-1 focus-within:border-zinc-300 dark:focus-within:border-zinc-600 transition-all">
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
          title={leads.length === 0 ? 'No leads routed to you yet' : 'No leads match that filter'}
          body={leads.length === 0 ? 'Your builder assigns leads to you from their console.' : undefined}
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {filtered.map((l) => {
            const budget = budgetLabel(l)
            return (
              <div key={l.id} className="px-4 py-4 space-y-2.5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{l.name}</p>
                      <TierBadge tier={l.lead_tier} />
                      <LeadStatusPill status={l.status} />
                    </div>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                      <a href={`tel:${l.phone}`} className="font-semibold text-zinc-700 dark:text-zinc-200 hover:underline">{l.phone}</a>
                      {' · '}{l.project_name ?? 'General inquiry'}
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
                    <button
                      onClick={() => { setEditingId(editingId === l.id ? null : l.id); setNoteDraft(l.partner_notes ?? '') }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                    >
                      <NotePencil size={13} weight="bold" />Note
                    </button>
                  </div>
                </div>

                {editingId === l.id ? (
                  <div className="flex items-start gap-2">
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={2}
                      maxLength={2000}
                      aria-label={`Note for ${l.name}`}
                      placeholder="What happened on the call?"
                      className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors resize-y"
                    />
                    <button
                      onClick={() => saveNote(l.id)}
                      disabled={savingId === l.id}
                      className="inline-flex items-center gap-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-2 rounded-xl text-[12px] font-bold disabled:opacity-60 cursor-pointer active:scale-[0.98] transition-all"
                    >
                      <Check size={13} weight="bold" />Save
                    </button>
                  </div>
                ) : l.partner_notes ? (
                  <p className="text-[12px] text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2">{l.partner_notes}</p>
                ) : null}

                <button
                  type="button"
                  onClick={() => setBriefFor(l)}
                  className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Notebook size={13} weight="bold" />
                  Open brief
                </button>
              </div>
            )
          })}
        </Card>
      )}

      {/* Appointments routed to this partner. Somebody has to attend these, and
          until the routing column existed that somebody could not see them. */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-0.5">
          Site visits assigned to you
        </h2>
        {siteVisits.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck size={32} />}
            title="No site visits assigned yet"
            body="When a builder routes a booked visit to you it appears here with the date and slot."
          />
        ) : (
          <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
            {siteVisits.map((v) => {
              const when = new Date(v.visit_date)
              return (
                <div key={v.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{v.name}</p>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                      <a href={`tel:${v.phone}`} className="font-semibold text-zinc-700 dark:text-zinc-200 hover:underline">{v.phone}</a>
                      {v.email ? ` · ${v.email}` : ''}
                      {' · '}{v.project_name}
                    </p>
                    {v.message && (
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{v.message}</p>
                    )}
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                      <Clock size={12} />{v.time_slot}
                    </p>
                  </div>
                  <div className="w-full sm:w-[150px] shrink-0">
                    <CustomSelect
                      value={v.status}
                      onChange={(val) => patchVisit(v.id, { status: val })}
                      options={VISIT_STATUS_OPTIONS}
                      disabled={savingId === v.id}
                      size="sm"
                    />
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </section>

      {briefFor && (
        <LeadBriefPanel
          endpoint={scoped(`/portal/partner/leads/${briefFor.id}/brief`)}
          leadName={briefFor.name}
          onClose={() => setBriefFor(null)}
        />
      )}
    </PageShell>
  )
}
