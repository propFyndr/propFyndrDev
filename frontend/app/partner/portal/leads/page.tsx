'use client'

/**
 * The partner's working list: the leads their builder routed to them, with
 * the two writes a partner needs — move the status, leave a note the builder
 * and PropFyndr can both read.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  PhoneCall,
  MagnifyingGlass,
  NotePencil,
  Check,
  Notebook,
  CalendarCheck,
  Clock,
  Fire,
  SealCheck,
  X,
  Phone,
  WhatsappLogo,
} from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { type SelectOption } from '@/components/admin/CustomSelect'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, Card, StatCard, TierBadge, LeadStatusPill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'
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

  const hotCount = leads.filter((l) => l.lead_tier === 'HOT').length
  const qualifiedCount = leads.filter((l) => l.status === 'qualified' || l.status === 'converted').length

  return (
    <PageShell>
      {/* Apple-grade Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#0066cc] dark:text-[#2997ff] uppercase tracking-wider">
              Channel Partner Console
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Assigned Buyer Dispatch
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight mt-1">
            Assigned leads
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            High-intent buyers routed to your brokerage by partner developers. Maintain call notes and milestone statuses.
          </p>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {/* KPI Stat Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Assigned"
          value={leads.length}
          icon={<PhoneCall size={16} />}
          hint="Active buyer callbacks"
        />
        <StatCard
          label="Hot Priority"
          value={hotCount}
          tone="hot"
          icon={<Fire size={16} weight="fill" />}
          hint="Call within 15 minutes"
        />
        <StatCard
          label="Site Visits"
          value={siteVisits.length}
          tone="good"
          icon={<CalendarCheck size={16} />}
          hint="Booked walkthroughs"
        />
        <StatCard
          label="Qualified / Closed"
          value={qualifiedCount}
          icon={<SealCheck size={16} />}
          hint="In closing pipeline"
        />
      </div>

      {/* Search & Status Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-2xs flex-1 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-all">
          <MagnifyingGlass size={16} className="text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by buyer name, phone, or project…"
            aria-label="Filter leads"
            className="flex-1 bg-transparent border-none outline-none text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
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

      {/* Leads List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<PhoneCall size={32} />}
          title={leads.length === 0 ? 'No leads routed to you yet' : 'No leads match that filter'}
          body={leads.length === 0 ? 'Your partner builders assign leads directly to you from their developer consoles.' : undefined}
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-2xs">
          {filtered.map((l) => {
            const budget = budgetLabel(l)
            const cleanPhone = l.phone.replace(/\D/g, '')
            return (
              <div key={l.id} className="p-4 sm:p-5 space-y-3 hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{l.name}</p>
                      <TierBadge tier={l.lead_tier} />
                      <LeadStatusPill status={l.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[12px] text-zinc-500 dark:text-zinc-400">
                      <a
                        href={`tel:${l.phone}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#0066cc] dark:text-[#2997ff] hover:underline"
                      >
                        <Phone size={12} weight="bold" />
                        {l.phone}
                      </a>
                      <span>·</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {l.project_name ?? 'General Inquiry'}
                      </span>
                      {budget && (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{budget}</span>
                        </>
                      )}
                      {l.intent_tier && (
                        <>
                          <span>·</span>
                          <span className="uppercase text-[10px] font-bold tracking-wider text-zinc-400">
                            {l.intent_tier.replace(/-/g, ' ')}
                          </span>
                        </>
                      )}
                    </div>
                    {l.ai_summary && (
                      <p className="text-[12px] text-zinc-600 dark:text-zinc-300 mt-2 line-clamp-2 bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 font-medium">
                        {l.ai_summary}
                      </p>
                    )}
                  </div>

                  {/* Actions & Status Controls */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap w-full lg:w-auto">
                    <div className="w-[140px] flex-1 min-w-[130px] lg:flex-none">
                      <CustomSelect
                        value={l.status}
                        onChange={(v) => patchLead(l.id, { status: v })}
                        options={STATUS_OPTIONS}
                        disabled={savingId === l.id}
                        size="sm"
                      />
                    </div>

                    <a
                      href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi ${l.name}, following up regarding your interest in ${l.project_name ?? 'luxury properties'}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors"
                    >
                      <WhatsappLogo size={14} weight="fill" />
                      WhatsApp
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(editingId === l.id ? null : l.id)
                        setNoteDraft(l.partner_notes ?? '')
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                    >
                      <NotePencil size={13} weight="bold" />
                      {l.partner_notes ? 'Edit note' : 'Add note'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setBriefFor(l)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[#1d1d1f] dark:text-white text-[12px] font-bold cursor-pointer transition-all active:scale-95"
                    >
                      <Notebook size={13} weight="bold" />
                      Brief
                    </button>
                  </div>
                </div>

                {/* Inline Call Note Form */}
                {editingId === l.id ? (
                  <div className="flex items-start gap-2 pt-1">
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={2}
                      maxLength={2000}
                      aria-label={`Note for ${l.name}`}
                      placeholder="Enter update from your call or meeting (visible to builder)..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-blue-500 transition-colors resize-y shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => saveNote(l.id)}
                      disabled={savingId === l.id}
                      className="inline-flex items-center gap-1.5 bg-[#1d1d1f] hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-[#1d1d1f] px-3.5 py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-60 cursor-pointer active:scale-95 transition-all shadow-2xs shrink-0"
                    >
                      <Check size={14} weight="bold" />
                      Save
                    </button>
                  </div>
                ) : l.partner_notes ? (
                  <div className="flex items-center gap-2 text-[12px] text-zinc-600 dark:text-zinc-300 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl px-3 py-2">
                    <NotePencil size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{l.partner_notes}</span>
                  </div>
                ) : null}
              </div>
            )
          })}
        </Card>
      )}

      {/* Appointments routed to this partner */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Site visits assigned to you ({siteVisits.length})
          </h2>
        </div>

        {siteVisits.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck size={32} />}
            title="No site visits assigned yet"
            body="When a builder routes a booked visit to you it appears here with the scheduled date and slot."
          />
        ) : (
          <Card className="divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-2xs">
            {siteVisits.map((v) => {
              const when = new Date(v.visit_date)
              return (
                <div key={v.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{v.name}</p>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                      <a href={`tel:${v.phone}`} className="font-semibold text-[#0066cc] dark:text-[#2997ff] hover:underline">
                        {v.phone}
                      </a>
                      {v.email ? ` · ${v.email}` : ''}
                      {' · '}
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{v.project_name}</span>
                    </p>
                    {v.message && (
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{v.message}</p>
                    )}
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <p className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
                      {when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                      <Clock size={12} />
                      {v.time_slot}
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
