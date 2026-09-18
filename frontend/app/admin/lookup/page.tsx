'use client'

/**
 * Project lookup, for answering a buyer on the phone.
 *
 * Sales lost the Projects tab because that screen is built around editing and
 * the server refuses every one of those writes from a sales account — so a
 * salesperson met a row of buttons that answered "Editing project records is
 * done by an analyst or super admin". Offering an action and then refusing it
 * reads as a broken product; not offering it reads as a boundary.
 *
 * But they still need the facts, and they need them mid-call. This is that:
 * search, then the handful of things a buyer actually asks — price, possession,
 * RERA, configurations, builder — and nothing to click that could change any of
 * it.
 *
 * Every figure is read straight from the project's own row. Where a field is
 * absent it says so rather than showing a plausible substitute: a salesperson
 * quoting a number we invented is worse than one saying "let me confirm that".
 */

import { useCallback, useEffect, useState } from 'react'
import { MagnifyingGlass, Buildings, SealCheck, CalendarBlank, CurrencyInr } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { PageShell, PageHeader, Card, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface UnitType {
  bhk: number | null
  price_min_cr: number | null
  price_max_cr: number | null
  super_area_sqft: number | null
  carpet_area_sqft: number | null
}

interface ProjectDetail {
  id: string
  name: string
  slug: string
  sector: string
  city: string
  status: string
  rera_number: string | null
  rera_url: string | null
  possession_date: string | null
  possession_label: string | null
  price_min_cr: number | null
  price_range_label: string | null
  address: string | null
  total_units: number | null
  total_towers: number | null
  description: string | null
  builder: { name: string; slug: string } | null
  unit_types: UnitType[]
  _count?: { amenities: number; connectivity: number }
  amenity_count?: number
  connectivity_count?: number
}

interface ListItem {
  id: string
  name: string
  sector: string
  status: string
  price_range_label: string | null
  builder: { name: string } | null
}

/** An absent value says so. It never renders as a dash a reader could misread. */
function Fact({ label, value, icon }: { label: string; value: string | null; icon?: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
        {icon}{label}
      </p>
      {value ? (
        <p className="text-[14px] text-zinc-900 dark:text-white mt-0.5">{value}</p>
      ) : (
        <p className="text-[13px] text-zinc-400 dark:text-zinc-500 mt-0.5 italic">
          Not recorded — confirm before quoting
        </p>
      )}
    </div>
  )
}

function priceLine(p: ProjectDetail): string | null {
  if (p.price_range_label) return p.price_range_label
  const mins = p.unit_types.map((u) => u.price_min_cr).filter((v): v is number => v != null)
  const maxes = p.unit_types.map((u) => u.price_max_cr).filter((v): v is number => v != null)
  if (mins.length && maxes.length) return `₹${Math.min(...mins)} – ${Math.max(...maxes)} Cr`
  if (p.price_min_cr != null) return `from ₹${p.price_min_cr} Cr`
  return null
}

function possessionLine(p: ProjectDetail): string | null {
  if (p.possession_label) return p.possession_label
  if (!p.possession_date) return null
  return new Date(p.possession_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function configLine(p: ProjectDetail): string | null {
  const bhks = [...new Set(p.unit_types.map((u) => u.bhk).filter((b): b is number => b != null))].sort()
  if (!bhks.length) return null
  return bhks.map((b) => `${b}BHK`).join(', ')
}

export default function ProjectLookupPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ListItem[]>([])
  const [selected, setSelected] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch(`/admin/projects?limit=25&q=${encodeURIComponent(q.trim())}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setResults(data.projects ?? [])
    } catch {
      setError('Could not search projects.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced so a mid-call typist does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => void search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  async function open(id: string) {
    setError('')
    try {
      const res = await adminFetch(`/admin/projects/${id}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setSelected(data.project ?? data)
    } catch {
      setError('Could not open that project.')
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Project lookup"
        subtitle="The facts a buyer asks for, ready to read out. Nothing here changes a record."
      />

      {error && <ErrorNote message={error} />}

      <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl">
        <MagnifyingGlass size={16} className="text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Project, sector or builder…"
          aria-label="Search projects"
          className="flex-1 bg-transparent border-none outline-none text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
        {loading && <span className="text-[12px] text-zinc-400">Searching…</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          {query.trim().length < 2 ? (
            <EmptyState
              icon={<MagnifyingGlass size={32} />}
              title="Search for a project"
              body="Type a project name, a sector or a builder to pull up its verified details."
            />
          ) : results.length === 0 && !loading ? (
            <EmptyState
              icon={<Buildings size={32} />}
              title="Nothing matched"
              body="Try the sector on its own, or the builder's name."
            />
          ) : (
            <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void open(r.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer ${
                    selected?.id === r.id ? 'bg-zinc-50 dark:bg-zinc-800/60' : ''
                  }`}
                >
                  <p className="text-[14px] font-semibold text-zinc-900 dark:text-white truncate">{r.name}</p>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate">
                    {r.sector}{r.builder ? ` · ${r.builder.name}` : ''}
                  </p>
                </button>
              ))}
            </Card>
          )}
        </div>

        <div className="lg:col-span-3">
          {!selected ? (
            <EmptyState
              icon={<Buildings size={32} />}
              title="No project open"
              body="Pick one from the results to see its details."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-[16px] font-bold text-zinc-900 dark:text-white">{selected.name}</p>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                  {selected.builder?.name ?? 'Builder not recorded'} · {selected.sector}, {selected.city}
                  {' · '}{selected.status.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>

              <Fact label="Price" value={priceLine(selected)} icon={<CurrencyInr size={12} weight="bold" />} />
              <Fact label="Configurations" value={configLine(selected)} />
              <Fact label="Possession" value={possessionLine(selected)} icon={<CalendarBlank size={12} weight="bold" />} />
              <Fact
                label="RERA"
                value={selected.rera_number}
                icon={<SealCheck size={12} weight="bold" />}
              />
              <Fact label="Address" value={selected.address} />
              <Fact
                label="Scale"
                value={
                  selected.total_units || selected.total_towers
                    ? [
                        selected.total_units ? `${selected.total_units} units` : null,
                        selected.total_towers ? `${selected.total_towers} towers` : null,
                      ].filter(Boolean).join(' · ')
                    : null
                }
              />

              {selected.unit_types.length > 0 && (
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Unit types
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {selected.unit_types.map((u, i) => (
                      <li key={i} className="text-[13px] text-zinc-700 dark:text-zinc-300">
                        {u.bhk ? `${u.bhk}BHK` : 'Unit'}
                        {u.super_area_sqft ? ` · ${u.super_area_sqft} sq ft` : ''}
                        {u.price_min_cr != null ? ` · ₹${u.price_min_cr}${u.price_max_cr != null && u.price_max_cr !== u.price_min_cr ? `–${u.price_max_cr}` : ''} Cr` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="px-4 py-3 text-[11.5px] text-zinc-400 dark:text-zinc-500">
                Read-only. Corrections to any of this go through an analyst.
              </p>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  )
}
