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
import { Handshake, MagnifyingGlass, SealCheck, MapPin, Plus, X, Check, Prohibit, ArrowSquareOut, Globe } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { type SelectOption } from '@/components/admin/CustomSelect'
import { PageShell, PageHeader, Card, StatCard, PartnerStatusPill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

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
  'w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors'

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [builders, setBuilders] = useState<BuilderOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null)
  const [domainDraft, setDomainDraft] = useState('')
  const [showForm, setShowForm] = useState(false)
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
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
          >
            {showForm ? <X size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
            {showForm ? 'Cancel' : 'Add partner'}
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Partners" value={partners.length} icon={<Handshake size={16} />} />
        <StatCard label="Awaiting review" value={pending} icon={<Handshake size={16} />} />
        <StatCard label="Active" value={active} icon={<Check size={16} weight="bold" />} tone="good" />
        <StatCard label="Leads routed" value={totalLeads} icon={<Handshake size={16} />} />
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={createPartner} className="grid sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2">
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Firm name</span>
              <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT_CLASS} placeholder="Acme Realty Partners" />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Builder</span>
              <CustomSelect
                value={form.builder_id}
                onChange={(v) => setForm({ ...form, builder_id: v })}
                options={builders.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="Select a builder…"
                size="md"
              />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Type</span>
              <CustomSelect
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                options={TYPE_OPTIONS}
                size="md"
              />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Primary contact</span>
              <input value={form.primary_contact} onChange={(e) => setForm({ ...form, primary_contact: e.target.value })} className={INPUT_CLASS} />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT_CLASS} />
            </label>
            <div className="sm:col-span-2 flex items-center justify-between pt-1">
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Created here means already approved and active.</p>
              <button type="submit" disabled={saving} className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer active:scale-[0.98] transition-all">
                {saving ? 'Creating…' : 'Create partner'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl shadow-2xs flex-1 focus-within:border-zinc-300 dark:focus-within:border-zinc-600 transition-all">
          <MagnifyingGlass size={16} className="text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by firm, contact, email or builder…"
            aria-label="Filter partners"
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
          icon={<Handshake size={32} />}
          title={partners.length === 0 ? 'No channel partners yet' : 'No partners match that filter'}
          body={partners.length === 0 ? 'Builders add their own brokers, or a broker applies at /partner-register. Either way they land here for approval.' : undefined}
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {filtered.map((p) => (
            <div key={p.id} className="px-4 py-4 flex flex-col xl:flex-row xl:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
                  <PartnerStatusPill status={p.status} />
                  {p.is_verified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                      <SealCheck size={12} weight="fill" />Verified
                    </span>
                  )}
                  {p.status === 'approved' && !p.is_active && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 capitalize truncate">
                  {p.type}
                  {p.builder ? ` · ${p.builder.name}` : ' · no builder linked'}
                  {p.primary_contact ? ` · ${p.primary_contact}` : ''}
                  {p.email ? ` · ${p.email}` : ''}
                </p>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                  {p.leads_assigned} leads routed · {p.leads_converted} converted
                  {p.reviewed_by ? ` · reviewed by ${p.reviewed_by}` : ''}
                </p>
                {p.operating_cities.length > 0 && (
                  <p className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                    <MapPin size={12} />{p.operating_cities.join(', ')}
                  </p>
                )}
                {p.review_notes && (
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 italic">Note: {p.review_notes}</p>
                )}

                {/* Their own door. Addressing only — the session still decides
                    what any request may read. */}
                <div className="mt-2">
                  {editingDomainId === p.id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
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
                        <span className="px-2 py-1.5 text-[12px] font-mono text-zinc-400 dark:text-zinc-500 border-l border-zinc-200 dark:border-zinc-700">
                          .propfyndr.in
                        </span>
                      </div>
                      <button
                        onClick={() => saveSubdomain(p.id)}
                        disabled={savingId === p.id}
                        className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-60 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingDomainId(null)}
                        className="px-2 py-1.5 rounded-lg text-[12px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingDomainId(p.id); setDomainDraft(p.portal_subdomain ?? '') }}
                      className="inline-flex items-center gap-1.5 text-[12px] font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                    >
                      <Globe size={12} />
                      {p.portal_subdomain
                        ? `${p.portal_subdomain}.propfyndr.in`
                        : 'Set portal address'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* The consoles belong to someone else, so the id travels in the
                    link — a PropFyndr session carries no partner or builder id. */}
                <Link
                  href={`/partner/portal?partner_id=${p.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ArrowSquareOut size={13} weight="bold" />Partner console
                </Link>
                {p.builder && (
                  <Link
                    href={`/builder/portal?builder_id=${p.builder.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ArrowSquareOut size={13} weight="bold" />Builder console
                  </Link>
                )}
                {p.status !== 'approved' && (
                  <button
                    onClick={() => patchPartner(p.id, { status: 'approved' })}
                    disabled={savingId === p.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-colors"
                  >
                    <Check size={13} weight="bold" />Approve
                  </button>
                )}
                {p.status !== 'rejected' && (
                  <button
                    onClick={() => reject(p)}
                    disabled={savingId === p.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-rose-600 dark:text-rose-400 border border-zinc-200 dark:border-zinc-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-60 cursor-pointer transition-colors"
                  >
                    <Prohibit size={13} weight="bold" />Reject
                  </button>
                )}
                <button
                  onClick={() => patchPartner(p.id, { is_verified: !p.is_verified })}
                  disabled={savingId === p.id}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60 cursor-pointer transition-colors"
                >
                  {p.is_verified ? 'Unverify' : 'Verify'}
                </button>
                <button
                  onClick={() => patchPartner(p.id, { is_active: !p.is_active })}
                  disabled={savingId === p.id || p.status !== 'approved'}
                  title={p.status !== 'approved' ? 'Approve this partner first' : undefined}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  )
}
