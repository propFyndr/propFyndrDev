'use client'

/**
 * PropFyndr-side channel-partner control. Every partner on the platform,
 * whichever builder they belong to and however they got here — self-registered
 * at /partner-register, added by their builder, or created here.
 *
 * Three separate switches, kept separate because they mean different things:
 *   approve/reject — our decision on the application
 *   active         — may they sign in at all
 *   verified       — the buyer-facing trust badge
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Handshake,
  Users,
  MagnifyingGlass,
  SealCheck,
  MapPin,
  Plus,
  X,
  Check,
  Prohibit,
  ArrowSquareOut,
  Globe,
  Buildings,
  User,
  EnvelopeSimple,
  Phone,
  Key,
  CaretDown,
  CaretUp,
  PencilSimple,
  Copy,
  Clock
} from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { type SelectOption } from '@/components/admin/CustomSelect'
import OrgAccessPanel from '@/components/admin/OrgAccessPanel'
import { PageShell, PageHeader, Card, StatCard, PartnerStatusPill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'
import { useAdminRole, canEditCatalogue } from '@/lib/adminRole'

interface Partner {
  id: string
  name: string
  type: string
  email: string | null
  phone: string | null
  primary_contact: string | null
  operating_cities: string[]
  specializations: string[]
  status: string
  review_notes: string | null
  reviewed_by: string | null
  is_active: boolean
  is_verified: boolean
  leads_assigned: number
  leads_converted: number
  /** Their own portal host, e.g. `acme` serves acme.propfyndr.in. */
  portal_subdomain: string | null
  builder: { id: string; name: string; slug: string } | null
  created_at: string
}

interface BuilderOption { id: string; name: string }

const TYPES = ['broker', 'agency', 'agent', 'referral', 'corporate'] as const
const STATUS_FILTERS = ['ALL', 'new', 'reviewing', 'approved', 'rejected'] as const

/** Rendered through CustomSelect so the portals match the admin panel. */
const TYPE_OPTIONS: SelectOption[] = TYPES.map((t) => ({
  value: t,
  label: t.charAt(0).toUpperCase() + t.slice(1),
}))

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'new', label: 'New', dotColor: 'bg-amber-500' },
  { value: 'reviewing', label: 'Reviewing', dotColor: 'bg-blue-500' },
  { value: 'approved', label: 'Approved', dotColor: 'bg-emerald-500' },
  { value: 'rejected', label: 'Rejected', dotColor: 'bg-rose-500' },
]

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors'

function getFirmInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || 'CP'
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [builders, setBuilders] = useState<BuilderOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [savingId, setSavingId] = useState<string | null>(null)
  /** Which partner's access panel is open. One at a time — see the button below. */
  const [accessFor, setAccessFor] = useState<string | null>(null)
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null)
  const [domainDraft, setDomainDraft] = useState('')
  const [copiedDomainId, setCopiedDomainId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const mayEdit = canEditCatalogue(useAdminRole())
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'broker', builder_id: '', email: '', phone: '', primary_contact: '' })

  useEffect(() => {
    let cancelled = false
    Promise.all([
      adminFetch('/admin/channel-partners').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      adminFetch('/builders').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([p, b]) => {
        if (cancelled) return
        setPartners(p.partners ?? [])
        setBuilders((b.builders ?? []).map((x: BuilderOption) => ({ id: x.id, name: x.name })))
      })
      .catch(() => { if (!cancelled) setError('Could not load channel partners.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return partners.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.primary_contact ?? '').toLowerCase().includes(q) ||
        (p.builder?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [partners, query, statusFilter])

  async function patchPartner(id: string, body: Record<string, unknown>) {
    setSavingId(id)
    setError('')
    try {
      const res = await adminFetch(`/admin/channel-partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Update failed')
      }
      const { partner } = await res.json()
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, ...partner } : p)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingId(null)
    }
  }

  async function saveSubdomain(id: string) {
    await patchPartner(id, { portal_subdomain: domainDraft.trim() || null })
    setEditingDomainId(null)
  }

  async function copySubdomain(domain: string, partnerId: string) {
    try {
      await navigator.clipboard.writeText(`https://${domain}.propfyndr.in`)
      setCopiedDomainId(partnerId)
      setTimeout(() => setCopiedDomainId(null), 2000)
    } catch {
      // Ignore clipboard fallback error
    }
  }

  function reject(p: Partner) {
    const note = window.prompt(`Reject ${p.name}? Add a reason the builder will see (optional):`, p.review_notes ?? '')
    // `null` is Cancel; an empty string is a deliberate "no reason given".
    if (note === null) return
    patchPartner(p.id, { status: 'rejected', review_notes: note || null })
  }

  async function createPartner(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await adminFetch('/admin/channel-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          builder_id: form.builder_id,
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.primary_contact.trim() ? { primary_contact: form.primary_contact.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Could not create that partner')
      }
      const { partner } = await res.json()
      setPartners((prev) => [{ ...partner, leads_assigned: 0, leads_converted: 0, portal_subdomain: partner.portal_subdomain ?? null }, ...prev])
      setForm({ name: '', type: 'broker', builder_id: '', email: '', phone: '', primary_contact: '' })
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that partner')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  const pending = partners.filter((p) => p.status === 'new' || p.status === 'reviewing').length
  const active = partners.filter((p) => p.status === 'approved' && p.is_active).length
  const totalLeads = partners.reduce((sum, p) => sum + p.leads_assigned, 0)

  return (
    <PageShell>
      <PageHeader
        title="Channel partners"
        subtitle="Every broker and agency on the platform, and the builder each one belongs to."
        action={
          mayEdit ? (
            <button
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            >
              {showForm ? <X size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
              <span>{showForm ? 'Cancel' : 'Add partner'}</span>
            </button>
          ) : null
        }
      />

      {error && <ErrorNote message={error} />}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Partners" value={partners.length} icon={<Users size={17} weight="bold" />} />
        <StatCard
          label="Awaiting review"
          value={pending}
          icon={<Clock size={17} weight="bold" />}
          tone={pending > 0 ? 'hot' : 'neutral'}
        />
        <StatCard label="Active" value={active} icon={<SealCheck size={17} weight="bold" />} tone="good" />
        <StatCard label="Leads routed" value={totalLeads} icon={<Handshake size={17} weight="bold" />} />
      </div>

      {/* Add Partner Form Drawer */}
      {showForm && (
        <Card className="p-5 sm:p-6 border border-zinc-300 dark:border-zinc-700 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Register New Channel Partner</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                New partners created directly from the console are pre-approved and active.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          <form onSubmit={createPartner} className="grid sm:grid-cols-2 gap-4">
            <label className="sm:col-span-2">
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Firm name *
              </span>
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={INPUT_CLASS}
                placeholder="Acme Realty Advisory"
              />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Builder Organization
              </span>
              <CustomSelect
                value={form.builder_id}
                onChange={(v) => setForm({ ...form, builder_id: v })}
                options={builders.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="Select a builder…"
                size="md"
              />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Partner Type
              </span>
              <CustomSelect
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                options={TYPE_OPTIONS}
                size="md"
              />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Primary contact person
              </span>
              <input
                value={form.primary_contact}
                onChange={(e) => setForm({ ...form, primary_contact: e.target.value })}
                className={INPUT_CLASS}
                placeholder="e.g. Rahul Sharma"
              />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Contact Email
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={INPUT_CLASS}
                placeholder="broker@domain.com"
              />
            </label>
            <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Created partners immediately receive portal addressing.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer active:scale-[0.98] transition-all shadow-2xs"
                >
                  {saving ? 'Creating…' : 'Create partner'}
                </button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-2xs flex-1 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all">
          <MagnifyingGlass size={16} className="text-zinc-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by firm, contact, email or builder…"
            aria-label="Filter partners"
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="sm:w-56">
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            size="md"
          />
        </div>
      </div>

      {/* Partners List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Handshake size={32} />}
          title={partners.length === 0 ? 'No channel partners yet' : 'No partners match that filter'}
          body={
            partners.length === 0
              ? 'Builders add their own brokers, or a broker applies at /partner-register. Either way they land here for approval.'
              : undefined
          }
        />
      ) : (
        <div className="space-y-3.5">
          {filtered.map((p) => {
            const isAccessOpen = accessFor === p.id

            return (
              <Card
                key={p.id}
                className={`transition-all duration-200 overflow-hidden ${
                  isAccessOpen
                    ? 'ring-1 ring-zinc-900/10 dark:ring-zinc-700/60 shadow-sm bg-white dark:bg-zinc-900'
                    : 'hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Main Partner Row */}
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* Left: Avatar & Partner Identity */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Monogram Avatar */}
                      <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs">
                        {getFirmInitials(p.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Title & Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                            {p.name}
                          </h3>
                          <PartnerStatusPill status={p.status} />
                          {p.is_verified && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                              <SealCheck size={12} weight="fill" /> Verified
                            </span>
                          )}
                          {p.status === 'approved' && !p.is_active && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              Inactive
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                            {p.type}
                          </span>
                        </div>

                        {/* Metadata Line: Builder Link & Contacts */}
                        <div className="flex items-center gap-3 text-[12px] text-zinc-500 dark:text-zinc-400 mt-1.5 flex-wrap">
                          {p.builder ? (
                            <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
                              <Buildings size={13} className="text-zinc-400" />
                              {p.builder.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                              <Buildings size={13} />
                              No builder linked
                            </span>
                          )}

                          {p.primary_contact && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-700">·</span>
                              <span className="inline-flex items-center gap-1">
                                <User size={13} className="text-zinc-400" />
                                {p.primary_contact}
                              </span>
                            </>
                          )}

                          {p.email && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-700">·</span>
                              <span className="inline-flex items-center gap-1">
                                <EnvelopeSimple size={13} className="text-zinc-400" />
                                {p.email}
                              </span>
                            </>
                          )}

                          {p.phone && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-700">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Phone size={13} className="text-zinc-400" />
                                {p.phone}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Performance & Geography Chips */}
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100/70 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50">
                            <span className="font-semibold text-zinc-900 dark:text-white">{p.leads_assigned}</span> leads routed
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{p.leads_converted}</span> converted
                            {p.leads_assigned > 0 && (
                              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                ({Math.round((p.leads_converted / p.leads_assigned) * 100)}%)
                              </span>
                            )}
                          </div>

                          {p.operating_cities && p.operating_cities.length > 0 && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/40">
                              <MapPin size={12} className="text-zinc-400" />
                              <span>{p.operating_cities.join(', ')}</span>
                            </div>
                          )}

                          {p.reviewed_by && (
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                              Reviewed by {p.reviewed_by}
                            </span>
                          )}
                        </div>

                        {p.review_notes && (
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-200/60 dark:border-amber-900/40 italic inline-block">
                            Note: {p.review_notes}
                          </div>
                        )}

                        {/* Portal Subdomain Address */}
                        <div className="mt-3">
                          {editingDomainId === p.id ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900 shadow-2xs">
                                <span className="pl-2.5 text-zinc-400">
                                  <Globe size={13} />
                                </span>
                                <input
                                  autoFocus
                                  value={domainDraft}
                                  onChange={(e) => setDomainDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveSubdomain(p.id)
                                    if (e.key === 'Escape') setEditingDomainId(null)
                                  }}
                                  placeholder="acme"
                                  aria-label={`Portal subdomain for ${p.name}`}
                                  className="px-2.5 py-1.5 w-32 bg-transparent outline-none text-[12px] font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                                />
                                <span className="px-2 py-1.5 text-[12px] font-mono text-zinc-400 dark:text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                  .propfyndr.in
                                </span>
                              </div>
                              <button
                                onClick={() => saveSubdomain(p.id)}
                                disabled={savingId === p.id}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-60 cursor-pointer shadow-2xs active:scale-[0.98] transition-all"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingDomainId(null)}
                                className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {p.portal_subdomain ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                                  <Globe size={13} className="text-zinc-400" />
                                  <span>{p.portal_subdomain}.propfyndr.in</span>
                                  <button
                                    onClick={() => copySubdomain(p.portal_subdomain!, p.id)}
                                    title="Copy full portal URL"
                                    className="p-1 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer text-zinc-400"
                                  >
                                    {copiedDomainId === p.id ? <Check size={12} weight="bold" className="text-emerald-500" /> : <Copy size={12} />}
                                  </button>
                                  {mayEdit && (
                                    <button
                                      onClick={() => {
                                        setEditingDomainId(p.id)
                                        setDomainDraft(p.portal_subdomain ?? '')
                                      }}
                                      title="Edit portal address"
                                      className="p-1 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer text-zinc-400"
                                    >
                                      <PencilSimple size={12} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingDomainId(p.id)
                                    setDomainDraft(p.portal_subdomain ?? '')
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                                >
                                  <Globe size={13} />
                                  <span>Set portal address</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Consolidated Action Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0 lg:self-start pt-1 lg:pt-0">
                      {/* Direct Console Launch Links */}
                      <Link
                        href={`/partner/portal?partner_id=${p.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-2xs active:scale-[0.98]"
                      >
                        <ArrowSquareOut size={13} weight="bold" />
                        <span>Partner console</span>
                      </Link>

                      {p.builder && (
                        <Link
                          href={`/builder/portal?builder_id=${p.builder.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-2xs active:scale-[0.98]"
                        >
                          <ArrowSquareOut size={13} weight="bold" />
                          <span>Builder console</span>
                        </Link>
                      )}

                      {/* State Review Controls */}
                      {mayEdit && p.status !== 'approved' && (
                        <button
                          onClick={() => patchPartner(p.id, { status: 'approved' })}
                          disabled={savingId === p.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-all shadow-2xs active:scale-[0.98]"
                        >
                          <Check size={13} weight="bold" />
                          <span>Approve</span>
                        </button>
                      )}

                      {mayEdit && p.status !== 'rejected' && (
                        <button
                          onClick={() => reject(p)}
                          disabled={savingId === p.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-rose-600 dark:text-rose-400 border border-zinc-200 dark:border-zinc-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-60 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          <Prohibit size={13} weight="bold" />
                          <span>Reject</span>
                        </button>
                      )}

                      {mayEdit && (
                        <button
                          onClick={() => patchPartner(p.id, { is_verified: !p.is_verified })}
                          disabled={savingId === p.id}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          {p.is_verified ? 'Unverify' : 'Verify'}
                        </button>
                      )}

                      {mayEdit && (
                        <button
                          onClick={() => patchPartner(p.id, { is_active: !p.is_active })}
                          disabled={savingId === p.id || p.status !== 'approved'}
                          title={p.status !== 'approved' ? 'Approve this partner first' : undefined}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-[0.98]"
                        >
                          {p.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}

                      {/* Manage Access Accordion Toggle Button */}
                      {mayEdit && p.status === 'approved' && (
                        <button
                          onClick={() => setAccessFor(isAccessOpen ? null : p.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.98] ${
                            isAccessOpen
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 ring-2 ring-zinc-900/20 dark:ring-white/20'
                              : 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
                          }`}
                        >
                          <Key size={13} weight={isAccessOpen ? 'fill' : 'bold'} />
                          <span>{isAccessOpen ? 'Hide access' : 'Manage access'}</span>
                          {isAccessOpen ? (
                            <CaretUp size={11} weight="bold" />
                          ) : (
                            <CaretDown size={11} weight="bold" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* FULL-WIDTH ACCORDION / DRAWER FOR MANAGE ACCESS */}
                {isAccessOpen && (
                  <div className="border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4 sm:p-6 transition-all animate-fadeIn">
                    <OrgAccessPanel
                      scope="partner"
                      orgId={p.id}
                      orgName={p.name}
                      onClose={() => setAccessFor(null)}
                    />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
