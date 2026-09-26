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
import {
  MagnifyingGlass,
  Buildings,
  SealCheck,
  CalendarBlank,
  CurrencyInr,
  MapPin,
  X,
  Copy,
  Check,
  ShieldCheck,
  HouseLine,
  Ruler,
  ShareNetwork,
} from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { PageShell, Spinner, ErrorNote } from '@/components/portal/ui'

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

function FactRow({
  label,
  value,
  icon,
  copyable = false,
}: {
  label: string
  value: string | null
  icon: React.ReactNode
  copyable?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 last:border-b-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {label}
          </p>
          {value ? (
            <p className="text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 leading-snug">
              {value}
            </p>
          ) : (
            <p className="text-[12.5px] text-zinc-400 dark:text-zinc-500 mt-0.5 italic">
              Not recorded — confirm with analyst
            </p>
          )}
        </div>
      </div>

      {copyable && value && (
        <button
          type="button"
          onClick={handleCopy}
          title={`Copy ${label}`}
          className="p-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
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
  return bhks.map((b) => `${b} BHK`).join(', ')
}

export default function ProjectLookupPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ListItem[]>([])
  const [selected, setSelected] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedSummary, setCopiedSummary] = useState(false)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
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
    const t = setTimeout(() => void search(query), 280)
    return () => clearTimeout(t)
  }, [query, search])

  async function open(id: string) {
    setError('')
    setDetailLoading(true)
    try {
      const res = await adminFetch(`/admin/projects/${id}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setSelected(data.project ?? data)
    } catch {
      setError('Could not open that project.')
    } finally {
      setDetailLoading(false)
    }
  }

  const copyCallSummary = () => {
    if (!selected) return
    const price = priceLine(selected) ?? 'Price on request'
    const configs = configLine(selected) ?? 'Configurations on request'
    const possession = possessionLine(selected) ?? 'Possession on request'
    const rera = selected.rera_number ? `RERA: ${selected.rera_number}` : ''

    const text = `*${selected.name}* (${selected.sector}, ${selected.city})\nBuilder: ${selected.builder?.name ?? 'Reputed Developer'}\nConfigs: ${configs}\nPricing: ${price}\nPossession: ${possession}\n${rera}`.trim()

    navigator.clipboard.writeText(text)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  return (
    <PageShell>
      {/* Apple-grade Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#0066cc] dark:text-[#2997ff] uppercase tracking-wider">
              Sales Quick Lookup
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Mid-Call Fact Sheet
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1d1f] dark:text-white tracking-tight mt-1">
            Project lookup
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Instant verified facts to answer buyer questions during calls. Read-only by design to guarantee 100% catalog integrity.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-[11.5px] font-bold text-emerald-700 dark:text-emerald-400">
            <ShieldCheck size={14} weight="bold" />
            Verified DB Read
          </div>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {/* Interactive Search Bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#18181b] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-2xs focus-within:border-blue-500 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
        <MagnifyingGlass size={18} className="text-zinc-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search project name, sector (e.g. Sector 62), or builder (e.g. DLF)…"
          aria-label="Search projects"
          autoFocus
          className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
        {loading && <span className="text-[12px] font-semibold text-blue-600 dark:text-blue-400">Searching…</span>}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* 2-Column Split: Results List & Live Fact Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Matches */}
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Matching Catalog Projects {results.length > 0 && `(${results.length})`}
            </span>
          </div>

          {query.trim().length < 2 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                <MagnifyingGlass size={20} />
              </div>
              <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white">Quick search</h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                Type 2 or more letters of a project, sector, or developer to pull immediate mid-call specs.
              </p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 text-center">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto mb-3">
                <Buildings size={20} />
              </div>
              <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white">No matches found</h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                Try searching just the sector number or developer surname.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[620px] overflow-y-auto shadow-2xs">
              {results.map((r) => {
                const isSelected = selected?.id === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void open(r.id)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-l-[#0066cc] dark:border-l-[#2997ff]'
                        : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-[13.5px] font-bold truncate ${isSelected ? 'text-[#0066cc] dark:text-[#2997ff]' : 'text-zinc-900 dark:text-white'}`}>
                        {r.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                        <MapPin size={11} className="shrink-0" />
                        <span>{r.sector}</span>
                        {r.builder?.name && (
                          <>
                            <span>·</span>
                            <span className="truncate">{r.builder.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {r.price_range_label && (
                      <span className="text-[11.5px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md shrink-0">
                        {r.price_range_label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Project Spec Sheet */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Verified Buyer Spec Sheet
            </span>
            {selected && (
              <button
                type="button"
                onClick={copyCallSummary}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#0066cc] dark:text-[#2997ff] hover:underline cursor-pointer"
              >
                {copiedSummary ? (
                  <>
                    <Check size={13} className="text-emerald-500" />
                    <span>Copied for WhatsApp!</span>
                  </>
                ) : (
                  <>
                    <ShareNetwork size={13} />
                    <span>Copy Call Summary</span>
                  </>
                )}
              </button>
            )}
          </div>

          {!selected ? (
            <div className="p-12 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 text-center min-h-[380px] flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mb-3">
                <HouseLine size={24} />
              </div>
              <h3 className="text-[15px] font-bold text-zinc-900 dark:text-white">No project selected</h3>
              <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                Click any project on the left to see verified price brackets, delivery dates, RERA, and layout configurations.
              </p>
            </div>
          ) : detailLoading ? (
            <div className="p-12 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-center min-h-[380px]">
              <Spinner />
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-2xs">
              {/* Card Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                      {selected.name}
                    </h2>
                    <p className="text-[12.5px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {selected.builder?.name ?? 'Independent Builder'} · {selected.sector}, {selected.city}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70 shrink-0">
                    {selected.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Verified Fact Rows */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                <FactRow
                  label="Pricing Brackets"
                  value={priceLine(selected)}
                  icon={<CurrencyInr size={16} weight="bold" />}
                  copyable
                />
                <FactRow
                  label="Available Configurations"
                  value={configLine(selected)}
                  icon={<HouseLine size={16} weight="bold" />}
                  copyable
                />
                <FactRow
                  label="Possession & Delivery"
                  value={possessionLine(selected)}
                  icon={<CalendarBlank size={16} weight="bold" />}
                />
                <FactRow
                  label="RERA Registration"
                  value={selected.rera_number}
                  icon={<SealCheck size={16} weight="bold" />}
                  copyable
                />
                <FactRow
                  label="Site Address & Landmarks"
                  value={selected.address}
                  icon={<MapPin size={16} weight="bold" />}
                  copyable
                />
                <FactRow
                  label="Project Scale"
                  value={
                    selected.total_units || selected.total_towers
                      ? [
                          selected.total_units ? `${selected.total_units} total units` : null,
                          selected.total_towers ? `${selected.total_towers} towers` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : null
                  }
                  icon={<Buildings size={16} weight="bold" />}
                />
              </div>

              {/* Unit Types Breakdown */}
              {selected.unit_types.length > 0 && (
                <div className="p-4 bg-zinc-50/40 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2.5 flex items-center gap-1.5">
                    <Ruler size={13} />
                    Unit Types & Dimensions
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selected.unit_types.map((u, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-zinc-700/70 text-[12px]"
                      >
                        <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-white">
                          <span>{u.bhk ? `${u.bhk} BHK` : 'Custom Unit'}</span>
                          {u.price_min_cr != null && (
                            <span className="text-[#0066cc] dark:text-[#2997ff]">
                              ₹{u.price_min_cr}{u.price_max_cr && u.price_max_cr !== u.price_min_cr ? `–${u.price_max_cr}` : ''} Cr
                            </span>
                          )}
                        </div>
                        {u.super_area_sqft && (
                          <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5 font-medium">
                            {u.super_area_sqft} sq ft {u.carpet_area_sqft ? `(Carpet: ${u.carpet_area_sqft} sq ft)` : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Note */}
              <div className="px-5 py-3 bg-zinc-100/60 dark:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  Read-only sales console · Updates must be submitted to Data Analyst
                </span>
                <span className="font-mono">ID: {selected.id.slice(0, 8)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
