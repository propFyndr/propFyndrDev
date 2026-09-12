'use client'

/**
 * A builder's own channel partners. The builder adds and switches them on or
 * off; PropFyndr approves. That split is enforced server-side — this page has
 * no control that would set approval, because a builder cannot set it.
 */

import { useEffect, useState } from 'react'
import { Handshake, Plus, MapPin, SealCheck, X } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { type SelectOption } from '@/components/admin/CustomSelect'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, PageHeader, Card, PartnerStatusPill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

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
  is_active: boolean
  is_verified: boolean
  review_notes: string | null
  leads_assigned?: number
  created_at: string
}

const TYPES = ['broker', 'agency', 'agent', 'referral', 'corporate'] as const

/** Rendered through CustomSelect so the portals match the admin panel. */
const TYPE_OPTIONS: SelectOption[] = TYPES.map((t) => ({
  value: t,
  label: t.charAt(0).toUpperCase() + t.slice(1),
}))

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors'

export default function BuilderPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  // Empty for a BUILDER session (the server reads the id off the session);
  // set when a PropFyndr role is viewing this builder's console.
  const scopeId = useScopeId('builder_id')
  const scoped = (path: string) => withScope(path, 'builder_id', scopeId)

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'broker', primary_contact: '', email: '', phone: '', cities: '',
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [scopeId])

  function load() {
    adminFetch(scoped('/portal/builder/partners'))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setPartners(d.partners ?? []))
      .catch(() => setError('Could not load your partners.'))
      .finally(() => setLoading(false))
  }

  async function addPartner(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const cities = form.cities.split(',').map((c) => c.trim()).filter(Boolean)
      const res = await adminFetch(scoped('/portal/builder/partners'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          ...(form.primary_contact.trim() ? { primary_contact: form.primary_contact.trim() } : {}),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(cities.length ? { operating_cities: cities } : {}),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Could not add that partner')
      }
      const { partner } = await res.json()
      setPartners((prev) => [partner, ...prev])
      setForm({ name: '', type: 'broker', primary_contact: '', email: '', phone: '', cities: '' })
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that partner')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: Partner) {
    setError('')
    try {
      const res = await adminFetch(scoped(`/portal/builder/partners/${p.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.is_active }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Could not update that partner')
      }
      const { partner } = await res.json()
      setPartners((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...partner } : x)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that partner')
    }
  }

  if (loading) return <Spinner />

  return (
    <PageShell>
      <PageHeader
        title="Channel partners"
        subtitle="Brokers and agencies selling your projects. PropFyndr approves each one before they can sign in or receive leads."
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

      {showForm && (
        <Card className="p-5">
          <form onSubmit={addPartner} className="grid sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2">
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Firm name</span>
              <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT_CLASS} placeholder="Acme Realty Partners" />
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
              <input value={form.primary_contact} onChange={(e) => setForm({ ...form, primary_contact: e.target.value })} className={INPUT_CLASS} placeholder="Name of the person you deal with" />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT_CLASS} placeholder="partner@firm.com" />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Phone</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={INPUT_CLASS} placeholder="+919876543210" />
            </label>
            <label className="sm:col-span-2">
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Operating cities</span>
              <input value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} className={INPUT_CLASS} placeholder="Noida, Greater Noida" />
            </label>
            <div className="sm:col-span-2 flex items-center justify-between pt-1">
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Added partners stay inactive until PropFyndr approves them.</p>
              <button
                type="submit"
                disabled={saving}
                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer active:scale-[0.98] transition-all"
              >
                {saving ? 'Adding…' : 'Add partner'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {partners.length === 0 ? (
        <EmptyState
          icon={<Handshake size={32} />}
          title="No channel partners yet"
          body="Add the brokers and agencies who sell your projects, then route leads to them once PropFyndr approves."
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {partners.map((p) => (
            <div key={p.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
                  <PartnerStatusPill status={p.status} />
                  {p.is_verified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                      <SealCheck size={12} weight="fill" />Verified
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 capitalize truncate">
                  {p.type}
                  {p.primary_contact ? ` · ${p.primary_contact}` : ''}
                  {p.email ? ` · ${p.email}` : ''}
                  {typeof p.leads_assigned === 'number' ? ` · ${p.leads_assigned} leads` : ''}
                </p>
                {p.operating_cities.length > 0 && (
                  <p className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                    <MapPin size={12} />{p.operating_cities.join(', ')}
                  </p>
                )}
                {p.status === 'rejected' && p.review_notes && (
                  <p className="text-[12px] text-rose-600 dark:text-rose-400 mt-1">PropFyndr note: {p.review_notes}</p>
                )}
              </div>

              <button
                onClick={() => toggleActive(p)}
                disabled={p.status !== 'approved'}
                title={p.status !== 'approved' ? 'PropFyndr has not approved this partner yet' : undefined}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {p.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  )
}
