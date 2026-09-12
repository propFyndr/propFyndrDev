'use client'

import { useEffect, useState } from 'react'
import { Buildings, MapPin } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, PageHeader, Card, Pill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface Project {
  id: string
  name: string
  slug: string
  sector: string
  status: string
  price_range_label: string | null
  created_at: string
}

const STATUS_TONE: Record<string, 'emerald' | 'blue' | 'zinc'> = {
  ready_to_move: 'emerald',
  under_construction: 'blue',
}

export default function BuilderProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Empty for a BUILDER session (the server reads the id off the session);
  // set when a PropFyndr role is viewing this builder's console.
  const scopeId = useScopeId('builder_id')
  const scoped = (path: string) => withScope(path, 'builder_id', scopeId)


  useEffect(() => {
    let cancelled = false
    adminFetch(scoped('/portal/builder/projects'))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (!cancelled) setProjects(d.projects ?? []) })
      .catch(() => { if (!cancelled) setError('Could not load your projects.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId])

  if (loading) return <Spinner />

  return (
    <PageShell>
      <PageHeader
        title="Projects"
        subtitle="Everything of yours listed on PropFyndr. Listing changes go through PropFyndr so every project stays checked against RERA."
      />
      {error && <ErrorNote message={error} />}

      {projects.length === 0 ? (
        <EmptyState
          icon={<Buildings size={32} />}
          title="No projects linked yet"
          body="Once PropFyndr links your projects to this account they appear here."
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                    <MapPin size={12} />{p.sector}
                  </span>
                  <Pill label={p.status.replace(/_/g, ' ')} tone={STATUS_TONE[p.status] ?? 'zinc'} />
                </div>
              </div>
              <span className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">
                {p.price_range_label ?? '—'}
              </span>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  )
}
