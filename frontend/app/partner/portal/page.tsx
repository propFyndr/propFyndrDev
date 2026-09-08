'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { SignOut, PhoneCall, TrendUp, Target, SealCheck, MapPin, Info } from '@phosphor-icons/react'
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
 * a CallbackRequest to a specific partner), so this shows the partner's own
 * aggregate record rather than guessing at a lead inbox with nothing to
 * read from.
 */
export default function PartnerPortalPage() {
  const router = useRouter()
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
      .catch(() => { if (!cancelled) setError('Could not load your portal — sign in again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function signOut() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_role')
    router.replace('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-2 dark:bg-surface flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen bg-surface-2 dark:bg-surface flex items-center justify-center p-6">
        <p className="text-[13.5px] text-[var(--color-danger)]">{error}</p>
      </div>
    )
  }
  if (!partner) return null

  return (
    <div className="min-h-screen bg-surface-2 dark:bg-surface">
      <header className="sticky top-0 z-10 bg-surface/90 dark:bg-surface/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/icons/logo-square-black.png" alt="PropFyndr" width={30} height={30} className="object-contain block dark:hidden" unoptimized />
            <Image src="/images/icons/logo-square-white.png" alt="PropFyndr" width={30} height={30} className="object-contain hidden dark:block" unoptimized />
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-tight">Partner Portal</p>
              <p className="text-[11px] text-[var(--color-text-muted)] leading-tight">PropFyndr</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors px-2.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-danger)]/8"
          >
            <SignOut size={15} weight="bold" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="glass-card rounded-[var(--radius-2xl)] p-6">
          <div className="flex items-center gap-2">
            <h1 className="text-[19px] font-bold text-[var(--color-text-primary)]">{partner.name}</h1>
            {partner.is_verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                <SealCheck size={12} weight="fill" /> Verified
              </span>
            )}
          </div>
          <p className="text-[13px] text-[var(--color-text-muted)] capitalize mt-1">{partner.type.replace(/_/g, ' ')}</p>

          {partner.operating_cities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {partner.operating_cities.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-2 dark:bg-surface-3 text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  <MapPin size={11} />{c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Total leads" value={partner.total_leads} icon={<PhoneCall size={15} />} />
          <Stat label="Conversions" value={partner.total_conversions} icon={<Target size={15} />} />
          <Stat
            label="Conversion rate"
            value={partner.conversion_rate_pct !== null ? `${partner.conversion_rate_pct.toFixed(1)}%` : '—'}
            icon={<TrendUp size={15} />}
            accent
          />
        </div>

        {note && (
          <div className="glass-card rounded-[var(--radius-lg)] p-4 flex items-start gap-2.5 border-l-[3px] border-l-amber-400">
            <Info size={16} className="text-amber-500 shrink-0 mt-0.5" weight="fill" />
            <p className="text-[12.5px] text-[var(--color-text-secondary)]">{note}</p>
          </div>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className="glass-card rounded-[var(--radius-lg)] p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-[var(--color-text-muted)] text-[10.5px] font-semibold uppercase tracking-wide">
        {icon}<span>{label}</span>
      </div>
      <p className={`text-2xl font-bold mt-2 ${accent ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>{value}</p>
    </div>
  )
}
