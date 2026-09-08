'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Buildings, PhoneCall, SignOut, Flame, Fire, Snowflake, MapPin } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'

interface Project {
  id: string
  name: string
  slug: string
  sector: string
  status: string
  price_range_label: string | null
  created_at: string
}

interface Lead {
  id: string
  name: string
  phone: string
  project_name: string | null
  status: string
  lead_tier: string | null
  created_at: string
}

const TIER_BADGE: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  HOT: {
    bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200/80 dark:border-rose-800/80',
    icon: <Fire size={13} weight="fill" className="text-rose-500" />,
  },
  WARM: {
    bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200/80 dark:border-amber-800/80',
    icon: <Flame size={13} weight="fill" className="text-amber-500" />,
  },
  COLD: {
    bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200/80 dark:border-sky-800/80',
    icon: <Snowflake size={13} weight="fill" className="text-sky-500" />,
  },
}

function TierBadge({ tier }: { tier: string | null }) {
  const t = tier && TIER_BADGE[tier] ? TIER_BADGE[tier] : null
  if (!t) return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">Unscored</span>
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${t.bg} ${t.text} ${t.border}`}>
      {t.icon}{tier}
    </span>
  )
}

const STATUS_STYLE: Record<string, string> = {
  ready_to_move: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80',
  under_construction: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80',
}

/**
 * A builder's own view: their projects, their leads only. Both endpoints
 * (portal.ts) re-derive scope from the database — this page never sends a
 * builder_id, the session already carries it.
 *
 * Deliberately small: no analytics dashboard (BuilderAnalytics has no writer
 * yet), no Ghost Pool. A real, working two-list view rather than a fuller
 * dashboard guessed at without real builder usage to design against.
 */
export default function BuilderPortalPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      adminFetch('/portal/builder/projects').then((r) => r.ok ? r.json() : Promise.reject(r.status)),
      adminFetch('/portal/builder/leads').then((r) => r.ok ? r.json() : Promise.reject(r.status)),
    ])
      .then(([p, l]) => {
        if (cancelled) return
        setProjects(p.projects ?? [])
        setLeads(l.leads ?? [])
      })
      .catch(() => { if (!cancelled) setError('Could not load your portal — sign in again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const hotCount = useMemo(() => leads.filter((l) => l.lead_tier === 'HOT').length, [leads])

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

  return (
    <div className="min-h-screen bg-surface-2 dark:bg-surface">
      <header className="sticky top-0 z-10 bg-surface/90 dark:bg-surface/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/icons/logo-square-black.png" alt="PropFyndr" width={30} height={30} className="object-contain block dark:hidden" unoptimized />
            <Image src="/images/icons/logo-square-white.png" alt="PropFyndr" width={30} height={30} className="object-contain hidden dark:block" unoptimized />
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-tight">Builder Portal</p>
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

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card rounded-[var(--radius-lg)] p-4">
            <div className="flex items-center justify-between text-[var(--color-text-muted)] text-[11px] font-semibold uppercase tracking-wide">
              <span>Projects</span><Buildings size={15} />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">{projects.length}</p>
          </div>
          <div className="glass-card rounded-[var(--radius-lg)] p-4">
            <div className="flex items-center justify-between text-[var(--color-text-muted)] text-[11px] font-semibold uppercase tracking-wide">
              <span>Leads</span><PhoneCall size={15} />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">{leads.length}</p>
          </div>
          <div className="glass-card rounded-[var(--radius-lg)] p-4">
            <div className="flex items-center justify-between text-[var(--color-text-muted)] text-[11px] font-semibold uppercase tracking-wide">
              <span>Hot leads</span><Fire size={15} weight="fill" className="text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">{hotCount}</p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-0.5">Your projects</h2>
          <div className="grid gap-2.5">
            {projects.map((p) => (
              <div key={p.id} className="glass-card rounded-[var(--radius-lg)] p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[14px] text-[var(--color-text-primary)] truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--color-text-muted)]"><MapPin size={12} />{p.sector}</span>
                    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[p.status] || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}>
                      {p.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <span className="text-[13px] font-medium text-[var(--color-text-secondary)] shrink-0 ml-3">{p.price_range_label ?? '—'}</span>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="glass-card rounded-[var(--radius-lg)] p-6 text-center text-[13px] text-[var(--color-text-muted)]">
                No projects linked to your account yet.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-0.5">Leads on your projects</h2>
          <div className="grid gap-2.5">
            {leads.map((l) => (
              <div key={l.id} className="glass-card rounded-[var(--radius-lg)] p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[14px] text-[var(--color-text-primary)] truncate">{l.name}</p>
                  <p className="text-[11.5px] text-[var(--color-text-muted)] mt-0.5">{l.project_name ?? 'General inquiry'}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  <TierBadge tier={l.lead_tier} />
                  <span className="text-[11px] text-[var(--color-text-muted)] capitalize">{l.status}</span>
                </div>
              </div>
            ))}
            {leads.length === 0 && (
              <div className="glass-card rounded-[var(--radius-lg)] p-6 text-center text-[13px] text-[var(--color-text-muted)]">
                No leads yet on your projects.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
