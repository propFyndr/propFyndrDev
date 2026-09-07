'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminFetch'

interface Partner {
  id: string
  name: string
  type: string
  is_verified: boolean
  is_active: boolean
  total_leads: number
  total_conversions: number
  conversion_rate_pct: number | null
  operating_cities: string[]
  created_at: string
}

/**
 * A channel partner's own profile. Honestly small: lead assignment to
 * individual partners has no schema yet (ChannelLead exists, nothing assigns
 * a CallbackRequest to a specific partner — PLAN.md Wave 5), so this shows
 * the partner's own aggregate record rather than guessing at a lead inbox
 * that has nothing to read from.
 */
export default function PartnerPortalPage() {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    adminFetch('/portal/partner/profile')
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        if (cancelled) return
        setPartner(data.partner)
        setNote(data.assignedLeadsNote ?? '')
      })
      .catch(() => { if (!cancelled) setError('Could not load your portal — sign in again from /admin/login.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading…</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>
  if (!partner) return null

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{partner.name}</h1>
        <p className="text-sm text-zinc-500 capitalize">{partner.type} · {partner.is_verified ? 'Verified' : 'Unverified'}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total leads" value={partner.total_leads} />
        <Stat label="Conversions" value={partner.total_conversions} />
        <Stat label="Conversion rate" value={partner.conversion_rate_pct !== null ? `${partner.conversion_rate_pct.toFixed(1)}%` : '—'} />
      </div>

      {partner.operating_cities.length > 0 && (
        <div>
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">Operating cities</span>
          <div className="flex flex-wrap gap-1">
            {partner.operating_cities.map((c) => (
              <span key={c} className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs">{c}</span>
            ))}
          </div>
        </div>
      )}

      {note && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-400">
          {note}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
      <p className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}
