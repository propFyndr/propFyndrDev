'use client'

import { useEffect, useState } from 'react'
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

/**
 * A builder's own view: their projects, their leads only. Both endpoints
 * (portal.ts) re-derive scope from the database — this page never sends a
 * builder_id, the session already carries it.
 *
 * Deliberately small tonight: no analytics dashboard (BuilderAnalytics has
 * no writer yet — PLAN.md Wave 0), no Ghost Pool. A real, working two-list
 * view rather than a fuller dashboard guessed at without real builder usage
 * to design against.
 */
export default function BuilderPortalPage() {
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
      .catch(() => { if (!cancelled) setError('Could not load your portal — sign in again from /admin/login.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading…</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Builder Portal</h1>
        <p className="text-sm text-zinc-500">Your projects and the leads they've generated.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Your projects ({projects.length})</h2>
        <div className="grid gap-2">
          {projects.map((p) => (
            <div key={p.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">{p.name}</p>
                <p className="text-xs text-zinc-500">{p.sector} · {p.status.replace(/_/g, ' ')}</p>
              </div>
              <span className="text-sm text-zinc-500">{p.price_range_label ?? '—'}</span>
            </div>
          ))}
          {projects.length === 0 && <p className="text-sm text-zinc-400">No projects linked to your account yet.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Leads on your projects ({leads.length})</h2>
        <div className="grid gap-2">
          {leads.map((l) => (
            <div key={l.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">{l.name}</p>
                <p className="text-xs text-zinc-500">{l.project_name ?? 'General inquiry'} · {l.lead_tier ?? 'unscored'}</p>
              </div>
              <span className="text-xs text-zinc-500 capitalize">{l.status}</span>
            </div>
          ))}
          {leads.length === 0 && <p className="text-sm text-zinc-400">No leads yet on your projects.</p>}
        </div>
      </section>
    </div>
  )
}
