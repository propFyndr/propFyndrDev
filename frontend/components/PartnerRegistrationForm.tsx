'use client'

/**
 * Public channel-partner (broker house / agency) registration.
 *
 * A channel partner always belongs to a builder, so naming that builder is
 * required, not optional — it is what the application means. Submitting this
 * creates a real ChannelPartner row in `status: new`; PropFyndr approves it
 * before the firm can sign in. Deliberately one page, not a wizard: this is
 * eleven fields, and a six-step flow for eleven fields is theatre.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2, Handshake, AlertCircle } from 'lucide-react'
import { m } from 'framer-motion'
import { API_BASE } from '@/lib/env'

interface BuilderOption { id: string; name: string }

const TYPES = [
  { value: 'broker', label: 'Broker' },
  { value: 'agency', label: 'Agency' },
  { value: 'agent', label: 'Individual agent' },
  { value: 'referral', label: 'Referral partner' },
  { value: 'corporate', label: 'Corporate channel' },
]

const INPUT =
  'w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 transition-colors'
const LABEL = 'block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5'

export default function PartnerRegistrationForm() {
  const [builders, setBuilders] = useState<BuilderOption[]>([])
  const [buildersError, setBuildersError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'broker', builder_id: '',
    primary_contact: '', email: '', phone: '+91',
    website: '', cities: '', specializations: '', description: '',
    rera_compliant: false,
  })

  useEffect(() => {
    fetch(`${API_BASE}/builders`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setBuilders((d.builders ?? []).map((b: BuilderOption) => ({ id: b.id, name: b.name }))))
      .catch(() => setBuildersError(true))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!/^\+91\d{10}$/.test(form.phone)) {
      setError('Phone must be +91 followed by 10 digits.')
      return
    }

    setSubmitting(true)
    try {
      const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
      const res = await fetch(`${API_BASE}/partner-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          builder_id: form.builder_id,
          primary_contact: form.primary_contact.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          ...(form.website.trim() ? { website: form.website.trim() } : {}),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
          operating_cities: list(form.cities),
          specializations: list(form.specializations),
          rera_compliant: form.rera_compliant,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Could not submit your application.')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your application.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] relative overflow-hidden font-sans p-4">
        <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vh] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50vw] h-[50vh] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <m.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[480px] w-full text-center p-8 sm:p-10 bg-white rounded-[28px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] relative z-10"
        >
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-emerald-600">
            <CheckCircle2 size={30} strokeWidth={2.2} />
          </div>
          <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight mb-2">Application received</h2>
          <p className="text-[13px] text-zinc-500 leading-relaxed max-w-sm mx-auto font-medium">
            PropFyndr reviews every channel partner before activation. Once approved, you get a portal login and your
            builder can start routing buyer leads to you.
          </p>
          <Link href="/" className="inline-block mt-7 px-6 py-3 text-[13px] font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors">
            Back to PropFyndr
          </Link>
        </m.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] relative overflow-hidden font-sans py-16 px-4 sm:px-6">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-100/50 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-50/50 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-center mx-auto mb-5 text-zinc-700">
            <Handshake size={24} />
          </div>
          <h1 className="text-[32px] sm:text-[40px] font-bold text-zinc-900 tracking-tight leading-tight mb-3">
            Register as a channel partner
          </h1>
          <p className="text-[15px] text-zinc-500 font-medium max-w-xl mx-auto leading-relaxed">
            For brokers and agencies selling a listed developer&apos;s projects. Name the builder you work with — PropFyndr
            verifies the relationship before activating your account.
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-[28px] p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-100">
              <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[13px] font-medium text-rose-700">{error}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="sm:col-span-2">
              <span className={LABEL}>Firm name</span>
              <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} placeholder="Acme Realty Partners" />
            </label>

            <label className="sm:col-span-2">
              <span className={LABEL}>Builder you work with</span>
              {buildersError ? (
                <p className="text-[13px] font-medium text-rose-600">
                  Could not load the builder list. Reload the page and try again.
                </p>
              ) : (
                <select required value={form.builder_id} onChange={(e) => setForm({ ...form, builder_id: e.target.value })} className={INPUT}>
                  <option value="">{builders.length === 0 ? 'Loading builders…' : 'Select a builder…'}</option>
                  {builders.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </label>

            <label>
              <span className={LABEL}>Partner type</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={INPUT}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>

            <label>
              <span className={LABEL}>Primary contact</span>
              <input required minLength={2} value={form.primary_contact} onChange={(e) => setForm({ ...form, primary_contact: e.target.value })} className={INPUT} placeholder="Full name" />
            </label>

            <label>
              <span className={LABEL}>Email</span>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT} placeholder="you@firm.com" />
            </label>

            <label>
              <span className={LABEL}>Phone</span>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={INPUT} placeholder="+919876543210" />
            </label>

            <label>
              <span className={LABEL}>Operating cities</span>
              <input value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} className={INPUT} placeholder="Noida, Greater Noida" />
            </label>

            <label>
              <span className={LABEL}>Specializations</span>
              <input value={form.specializations} onChange={(e) => setForm({ ...form, specializations: e.target.value })} className={INPUT} placeholder="luxury, nri" />
            </label>

            <label className="sm:col-span-2">
              <span className={LABEL}>Website</span>
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={INPUT} placeholder="https://…" />
            </label>

            <label className="sm:col-span-2">
              <span className={LABEL}>About your firm</span>
              <textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${INPUT} resize-y`} placeholder="Years operating, team size, the developers you already sell for." />
            </label>

            <label className="sm:col-span-2 flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.rera_compliant}
                onChange={(e) => setForm({ ...form, rera_compliant: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-300 accent-zinc-900 cursor-pointer"
              />
              <span className="text-[13px] font-medium text-zinc-600">We hold a valid RERA agent registration</span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-zinc-100">
            <p className="text-[12px] text-zinc-500 leading-relaxed">
              PropFyndr verifies every partner with the named builder before activation.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 text-[13px] font-bold text-white bg-zinc-900 hover:bg-black rounded-xl transition-all disabled:opacity-60 active:scale-[0.98] cursor-pointer"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>

        <p className="text-center text-[13px] text-zinc-500 mt-6">
          A developer instead?{' '}
          <Link href="/builder-register" className="font-semibold text-zinc-900 hover:underline">Register as a builder</Link>
        </p>
      </div>
    </div>
  )
}
