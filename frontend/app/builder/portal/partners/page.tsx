'use client'

/**
 * A builder's own channel partners. The builder adds and switches them on or
 * off; PropFyndr approves. That split is enforced server-side — this page has
 * no control that would set approval, because a builder cannot set it.
 */

import { useEffect, useState } from 'react'
import {
  Handshake,
  Plus,
  MapPin,
  SealCheck,
  X,
  Buildings,
  CheckCircle,
  Clock,
  Phone,
  Envelope,
  User,
} from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { type SelectOption } from '@/components/admin/CustomSelect'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, Card, StatCard, PartnerStatusPill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

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
  'w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-blue-500 transition-colors shadow-2xs'

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
    name: '',
    type: 'broker',
    primary_contact: '',
    email: '',
    phone: '',
    cities: '',
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load()
  }, [scopeId])

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
      const cities = form.cities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
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

  const activeApproved = partners.filter((p) => p.status === 'approved' && p.is_active).length
  const pendingReview = partners.filter((p) => p.status === 'pending').length
  const totalLeadsRouted = partners.reduce((sum, p) => sum + (p.leads_assigned ?? 0), 0)

  return (
    <PageShell>
      {/* Apple-grade Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#0066cc] dark:text-[#2997ff] uppercase tracking-wider">
              Channel Partner Network
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Agency Affiliations
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight mt-1">
            Channel partners
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Brokers and distribution agencies authorized to sell your projects. PropFyndr verifies state RERA licenses before activation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-[#1d1d1f] px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            {showForm ? <X size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
            {showForm ? 'Cancel' : 'Affiliate New Partner'}
          </button>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Affiliates"
          value={partners.length}
          icon={<Handshake size={16} />}
          hint="Registered agencies"
        />
        <StatCard
          label="Active & Approved"
          value={activeApproved}
          tone="good"
          icon={<CheckCircle size={16} />}
          hint="Receiving buyer leads"
        />
        <StatCard
          label="Pending Review"
          value={pendingReview}
          icon={<Clock size={16} />}
          hint="Under RERA verification"
        />
        <StatCard
          label="Leads Dispatched"
          value={totalLeadsRouted}
          icon={<Buildings size={16} />}
          hint="Total assigned callbacks"
        />
      </div>

      {/* Slide-down Partner Onboarding Form */}
      {showForm && (
        <Card className="p-5 sm:p-6 shadow-2xs border-blue-500/30">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Affiliate Channel Partner</h2>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Provide broker details for onboarding. PropFyndr will verify RERA credentials prior to dispatch.
              </p>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={addPartner} className="grid sm:grid-cols-2 gap-3.5">
            <label className="sm:col-span-2">
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Brokerage / Firm name *
              </span>
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={INPUT_CLASS}
                placeholder="e.g. Apex Luxury Real Estate"
              />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Entity Type
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
                Key Contact Person
              </span>
              <input
                value={form.primary_contact}
                onChange={(e) => setForm({ ...form, primary_contact: e.target.value })}
                className={INPUT_CLASS}
                placeholder="e.g. Rajesh Sharma (Director)"
              />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Official Email
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={INPUT_CLASS}
                placeholder="partner@apexluxury.in"
              />
            </label>
            <label>
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Phone Number
              </span>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={INPUT_CLASS}
                placeholder="+91 98110 00000"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Operating Cities (comma separated)
              </span>
              <input
                value={form.cities}
                onChange={(e) => setForm({ ...form, cities: e.target.value })}
                className={INPUT_CLASS}
                placeholder="Noida, Greater Noida, Gurgaon"
              />
            </label>
            <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Added partners will remain inactive until PropFyndr compliance team approves credentials.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="bg-[#1d1d1f] hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-[#1d1d1f] px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer active:scale-95 transition-all shadow-2xs"
              >
                {saving ? 'Registering…' : 'Submit for Verification'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Partners List */}
      {partners.length === 0 ? (
        <EmptyState
          icon={<Handshake size={32} />}
          title="No channel partners yet"
          body="Add the brokers and agencies who sell your projects, then route leads to them once PropFyndr approves."
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-2xs">
          {partners.map((p) => {
            const initials = p.name
              .split(/\s+/)
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()

            return (
              <div
                key={p.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {initials || 'CP'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
                      <PartnerStatusPill status={p.status} />
                      {p.is_verified && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                          <SealCheck size={12} weight="fill" /> Verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[12px] text-zinc-500 dark:text-zinc-400">
                      <span className="capitalize font-semibold text-zinc-700 dark:text-zinc-300">{p.type}</span>
                      {p.primary_contact && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <User size={12} />
                            {p.primary_contact}
                          </span>
                        </>
                      )}
                      {p.phone && (
                        <>
                          <span>·</span>
                          <a href={`tel:${p.phone}`} className="hover:underline">
                            {p.phone}
                          </a>
                        </>
                      )}
                      {p.operating_cities.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} />
                            {p.operating_cities.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                    {p.status === 'rejected' && p.review_notes && (
                      <p className="text-[12px] text-rose-600 dark:text-rose-400 mt-1.5 font-medium">
                        PropFyndr compliance note: {p.review_notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 sm:justify-end pl-13 sm:pl-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Leads Assigned</p>
                    <span className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                      {p.leads_assigned ?? 0} leads
                    </span>
                  </div>

                  <button
                    onClick={() => toggleActive(p)}
                    disabled={p.status !== 'approved'}
                    title={p.status !== 'approved' ? 'PropFyndr has not approved this partner yet' : undefined}
                    className={`shrink-0 px-3.5 py-1.5 rounded-xl text-[12px] font-bold border cursor-pointer transition-all active:scale-95 ${
                      p.is_active
                        ? 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </PageShell>
  )
}
