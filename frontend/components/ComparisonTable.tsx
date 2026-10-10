'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { m } from 'framer-motion'
import { TrendingUp, Users, Zap, ChevronDown, IndianRupee, HeartHandshake, Building2 } from 'lucide-react'
import type { ProjectCard, ProjectDetail } from '@/types/project'
import { API_BASE } from '@/lib/env'
import { usePreferredImages } from '@/lib/hooks'

// ── Data helpers ──────────────────────────────────────────────────────────────

interface IntelligenceData {
  investment_insights?: {
    appreciation_1yr?: string | null
    rental_yield?: string | null
    liquidity_score?: string | null
  }
  social_proof?: {
    overall_rating?: number | null
    demographic_tags?: string[]
    sentiment_summary?: string | null
  }
}

// ── Render helpers ────────────────────────────────────────────────────────────

function formatArea(d: ProjectDetail | null): React.ReactNode {
  const u = d?.unit_types?.[0]
  if (!u) return <span className="text-gray-400 text-[11px]">—</span>

  const superVal = typeof u.super_area_sqft === 'number' ? u.super_area_sqft : (u.super_area_sqft ? parseInt(String(u.super_area_sqft), 10) : 0)
  const carpetVal = typeof u.carpet_area_sqft === 'number' ? u.carpet_area_sqft : (u.carpet_area_sqft ? parseInt(String(u.carpet_area_sqft), 10) : 0)

  let effPct: number | null = null
  if (superVal > 0 && carpetVal > 0) {
    effPct = Math.round((carpetVal / superVal) * 100)
  }

  return (
    <div className="inline-flex flex-col items-center gap-0.5 text-[11px]">
      <span className="font-bold text-slate-800 dark:text-slate-200">
        {carpetVal ? `${carpetVal.toLocaleString('en-IN')} sqft` : (superVal ? `${superVal.toLocaleString('en-IN')} sqft` : '—')}
      </span>
      {superVal > 0 && (
        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
          Super: {superVal.toLocaleString('en-IN')} sqft
        </span>
      )}
      {effPct !== null && (
        <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full mt-0.5 ${effPct >= 68
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60'
            : effPct >= 60
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300/60 dark:border-blue-800/60'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>
          {effPct}% Space Efficiency
        </span>
      )}
    </div>
  )
}

function renderCons(d: ProjectDetail | null): string {
  const reasons = d?.decision_profile?.why_avoid ?? []
  if (reasons.length === 0) return '—'
  return reasons.slice(0, 2).join(', ')
}

const MATRIX_WHITELIST = [
  'Entry Price',
  'Possession',
  'Area',
  'True Landed Cost',
  'Registry & Dues',
  'Water Reality (TDS)',
  'UP Lifts Act 2024',
  'Drain Corridor Buffer',
  'Density / Acre',
  'Cons',
];

function winnerIdx(scores: number[]): number[] {
  const max = Math.max(...scores)
  return max === 0 ? [] : scores.map((s, i) => (s === max ? i : -1)).filter(i => i >= 0)
}

// ProjectDna and PersonaProfile are dropped (lean-schema migration, 2026-10)
// — 'overall'/'risk'/'family'/'investor'/'luxury' categories had no signal
// besides those two models, so only the price-based 'value' category remains.
function categoryWinner(
  details: (ProjectDetail | null)[],
  projects: ProjectCard[],
  cat: string,
): number | null {
  switch (cat) {
    case 'value': {
      const prices = projects.map(p => p.price_min_cr ?? Infinity)
      const min = Math.min(...prices)
      const idx = prices.indexOf(min)
      return min < Infinity ? idx : null
    }
    default: return null
  }
}

// ── Matrix row builder ────────────────────────────────────────────────────────

interface MatrixRow {
  label: string
  values: React.ReactNode[]
  winners: number[]
  winnerLabel: string
}

function buildMatrix(details: (ProjectDetail | null)[], projects: ProjectCard[]): MatrixRow[] {
  const rows: MatrixRow[] = []

  // Advisor Rating, Builder, Delivery Risk, RERA Standing, Value, Location and
  // Lifestyle rows all read ProjectDna/RecommendationProfile, both dropped
  // (lean-schema migration, 2026-10). Re-sourcing them with real data is
  // sub-project C, not this one — dropped entirely rather than rendering a
  // dash for every project in every comparison forever.

  // Entry Price (lowest wins)
  const prices = projects.map(p => p.price_min_cr ?? 0)
  const validPrices = prices.filter(p => p > 0)
  if (validPrices.length > 1) {
    const minP = Math.min(...validPrices)
    rows.push({
      label: 'Entry Price',
      values: projects.map((p, i) => (
        <span key={i} className="text-[11px] font-bold text-gray-700 dark:text-gray-300 font-mono">
          {p.price_range_label}
        </span>
      )),
      winners: prices.map((p, i) => (p === minP && p > 0 ? i : -1)).filter(i => i >= 0),
      winnerLabel: 'Lowest Entry',
    })
  }

  // Possession
  const rtmIdxs = projects.map((p, i) => (p.status === 'ready_to_move' ? i : -1)).filter(i => i >= 0)
  rows.push({
    label: 'Possession',
    values: projects.map((p, i) =>
      p.status === 'ready_to_move' ? (
        <span key={i} className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ Ready Now</span>
      ) : (
        <span key={i} className="text-[11px] text-gray-600 dark:text-gray-400">{p.possession_label ?? 'TBD'}</span>
      )
    ),
    winners: rtmIdxs.length < projects.length ? rtmIdxs : [],
    winnerLabel: 'Ready to Move',
  })

  // Area — only show if at least one project has area data
  if (details.some(d => d?.unit_types?.[0]?.super_area_sqft || d?.unit_types?.[0]?.carpet_area_sqft)) {
    rows.push({
      label: 'Area',
      values: details.map(d => formatArea(d)),
      winners: [],
      winnerLabel: '',
    });
  }

  // True Landed Cost Multiplier
  if (details.some(d => (d as any)?.all_in_cost_multiplier) || projects.some(p => (p as any)?.all_in_cost_multiplier)) {
    const mults = details.map((d, i) => (d as any)?.all_in_cost_multiplier || (projects[i] as any)?.all_in_cost_multiplier || null)
    const validMults = mults.filter((m): m is number => typeof m === 'number' && m > 0)
    const minMult = validMults.length > 0 ? Math.min(...validMults) : null
    rows.push({
      label: 'True Landed Cost',
      values: mults.map((m, i) => m ? (
        <span key={i} className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
          {m.toFixed(2)}x <span className="text-[9px] font-normal text-slate-500">(+{Math.round((m - 1) * 100)}% over base)</span>
        </span>
      ) : <span key={i} className="text-gray-400 text-[11px]">—</span>),
      winners: minMult ? mults.map((m, i) => m === minMult ? i : -1).filter(i => i >= 0) : [],
      winnerLabel: 'Lowest Overhead',
    })
  }

  // Registry & Dues Standing
  if (details.some(d => (d as any)?.amitabh_kant_clearance !== undefined || (d as any)?.oc_status) || projects.some(p => (p as any)?.amitabh_kant_clearance !== undefined || (p as any)?.oc_status)) {
    const regScores = details.map((d, i) => {
      const p = projects[i] as any
      const oc = (d as any)?.oc_status || p?.oc_status
      const ak = (d as any)?.amitabh_kant_clearance ?? p?.amitabh_kant_clearance
      if (ak === true || oc === 'FULL_OC') return 2
      if (ak === false || oc === 'PHASED_OC' || oc === 'APPLIED') return 1
      return 0
    })
    rows.push({
      label: 'Registry & Dues',
      values: details.map((d, i) => {
        const p = projects[i] as any
        const oc = (d as any)?.oc_status || p?.oc_status
        const ak = (d as any)?.amitabh_kant_clearance ?? p?.amitabh_kant_clearance
        if (ak === true || oc === 'FULL_OC') {
          return <span key={i} className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ Dues Paid / Registry Active</span>
        }
        if (ak === false) {
          return <span key={i} className="text-[11px] font-bold text-amber-600 dark:text-amber-400">⚠ Land Dues (Under Review)</span>
        }
        if (oc === 'PHASED_OC') return <span key={i} className="text-[11px] text-slate-600 dark:text-zinc-300">Phased OC</span>
        if (oc === 'APPLIED') return <span key={i} className="text-[11px] text-slate-600 dark:text-zinc-300">OC applied</span>
        return <span key={i} className="text-[11px] text-slate-500">Not on record</span>
      }),
      winners: winnerIdx(regScores),
      winnerLabel: 'Clear Title & Registry',
    })
  }

  // Water Reality (TDS)
  if (details.some(d => (d as any)?.water_source_type || (d as any)?.water_tds_range) || projects.some(p => (p as any)?.water_source_type)) {
    const waterScores = details.map((d, i) => {
      const src = (d as any)?.water_source_type || (projects[i] as any)?.water_source_type
      if (src === 'GANGA_JAL') return 2
      if (src === 'BOREWELL') return 0
      return 1
    })
    rows.push({
      label: 'Water Reality (TDS)',
      values: details.map((d, i) => {
        const src = (d as any)?.water_source_type || (projects[i] as any)?.water_source_type
        const tds = (d as any)?.water_tds_range || (projects[i] as any)?.water_tds_range
        if (src === 'GANGA_JAL') {
          return <span key={i} className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ Ganga Jal{tds ? ` (${tds})` : ''}</span>
        }
        if (src === 'BOREWELL') {
          return <span key={i} className="text-[11px] font-bold text-amber-600 dark:text-amber-400">⚠ Borewell{tds ? ` (${tds})` : ''}</span>
        }
        return <span key={i} className="text-[11px] text-slate-500">{src === 'MIXED' ? `Mixed supply${tds ? ` (${tds})` : ''}` : 'Not on record'}</span>
      }),
      winners: winnerIdx(waterScores),
      winnerLabel: 'Potable Ganga Jal',
    })
  }

  // UP Lifts Act 2024
  if (details.some(d => (d as any)?.lift_act_compliant !== undefined) || projects.some(p => (p as any)?.lift_act_compliant !== undefined)) {
    const liftScores = details.map((d, i) => {
      const compliant = (d as any)?.lift_act_compliant ?? (projects[i] as any)?.lift_act_compliant
      return compliant === true ? 2 : compliant === false ? 0 : 1
    })
    rows.push({
      label: 'UP Lifts Act 2024',
      values: details.map((d, i) => {
        const compliant = (d as any)?.lift_act_compliant ?? (projects[i] as any)?.lift_act_compliant
        if (compliant === true) {
          return <span key={i} className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ Registered & Certified</span>
        }
        if (compliant === false) {
          return <span key={i} className="text-[11px] font-bold text-amber-600 dark:text-amber-400">⚠ Registration Pending</span>
        }
        return <span key={i} className="text-[11px] text-slate-500">Under Standard Audit</span>
      }),
      winners: winnerIdx(liftScores),
      winnerLabel: 'Certified Compliant',
    })
  }

  // Drain Corridor Buffer
  if (details.some(d => (d as any)?.shahdara_drain_impact !== undefined) || projects.some(p => (p as any)?.shahdara_drain_impact !== undefined)) {
    const drainScores = details.map((d, i) => {
      const impact = (d as any)?.shahdara_drain_impact ?? (projects[i] as any)?.shahdara_drain_impact
      return impact === false ? 2 : impact === true ? 0 : 1
    })
    rows.push({
      label: 'Drain Corridor Buffer',
      values: details.map((d, i) => {
        const impact = (d as any)?.shahdara_drain_impact ?? (projects[i] as any)?.shahdara_drain_impact
        if (impact === false) {
          return <span key={i} className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ Safe Buffer (&gt;1.5km)</span>
        }
        if (impact === true) {
          return <span key={i} className="text-[11px] font-bold text-amber-600 dark:text-amber-400">⚠ &lt;500m Odor Corridor</span>
        }
        return <span key={i} className="text-[11px] text-slate-500">Standard Buffer</span>
      }),
      winners: winnerIdx(drainScores),
      winnerLabel: 'Safe Green Buffer',
    })
  }

  // Density / Acre
  if (details.some(d => d?.total_units && (d?.land_area_acres || projects.find(p => p.id === d.id)?.land_area_acres))) {
    const densities = details.map((d, i) => {
      const units = d?.total_units
      const acres = d?.land_area_acres || projects[i].land_area_acres
      if (units && acres && acres > 0) {
        return Math.round(units / acres)
      }
      return null
    })
    const validDensities = densities.filter((d): d is number => d !== null && d > 0)
    const minDensity = validDensities.length > 0 ? Math.min(...validDensities) : null
    rows.push({
      label: 'Density / Acre',
      values: densities.map((den, i) => den ? (
        <span key={i} className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
          {den} <span className="text-[9px] font-normal text-slate-500">units/acre</span>
        </span>
      ) : <span key={i} className="text-gray-400 text-[11px]">—</span>),
      winners: minDensity ? densities.map((den, i) => den === minDensity ? i : -1).filter(i => i >= 0) : [],
      winnerLabel: 'Lower Density (More Private)',
    })
  }

  // Advantages read dna.builder_track_record_label/rera_compliance_label —
  // both dropped (lean-schema migration, 2026-10). No honest signal left.

  // Cons — only show if at least one project has a recorded reason to avoid
  if (details.some(d => (d?.decision_profile?.why_avoid?.length ?? 0) > 0)) {
    rows.push({
      label: 'Cons',
      values: details.map(d => renderCons(d)),
      winners: [],
      winnerLabel: '',
    });
  }

  // Reorder rows according to whitelist
  const orderedRows: MatrixRow[] = MATRIX_WHITELIST
    .map(label => rows.find(r => r.label === label))
    .filter((r): r is MatrixRow => !!r);
  return orderedRows
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={12} className="text-gray-400 flex-shrink-0" />}
        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em]">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

// ── Project mini-card ─────────────────────────────────────────────────────────

function ProjectMiniCard({
  project,
}: {
  project: ProjectCard
}) {
  const { activeUrl, allFailed } = usePreferredImages(project)
  const isRTM = project.status === 'ready_to_move'

  return (
    <div className="flex-1 rounded-2xl overflow-hidden border border-black/[0.04] dark:border-white/[0.05] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all duration-300 bg-white dark:bg-[#111]">
      {/* Image */}
      <div className="relative h-[110px] bg-zinc-50 dark:bg-zinc-900">
        {activeUrl && !allFailed ? (
          <Image
            src={activeUrl}
            alt={project.name}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
            <Building2 size={24} className="text-zinc-300 dark:text-zinc-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />

        {/* Status */}
        <div className={`absolute bottom-2 left-2 text-[9px] font-medium px-1.5 py-0.5 rounded-full shadow-sm backdrop-blur-md ${isRTM ? 'bg-emerald-500/90 text-white' : 'bg-zinc-800/80 text-white'

          }`}>
          {isRTM ? '✓ Ready' : (project.possession_label ?? 'UC')}
        </div>
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5 truncate">
          {project.builder.name}
        </p>
        <h4 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2 tracking-tight">
          {project.name}
        </h4>
        <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{project.sector}</p>
        <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 mt-2 leading-none">
          {project.price_range_label}
        </p>

      </div>
    </div>
  )
}

// ── Accordion Component ───────────────────────────────────────────────────────

function Accordion({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: React.ElementType, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-100 dark:border-gray-700/60 rounded-xl overflow-hidden mb-3 bg-white dark:bg-gray-800/40 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-500 dark:text-gray-400" />
          <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{title}</span>
        </div>
        <div className={`transform transition-transform text-gray-400 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={16} />
        </div>
      </button>
      {isOpen && (
        <div className="p-0 border-t border-gray-100 dark:border-gray-700/60 overflow-x-auto">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ n }: { n: number }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-3">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="flex-1 rounded-2xl h-[180px] bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
      {[80, 60, 70, 55, 65].map((w, i) => (
        <div key={i} className={`h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse`} style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComparisonTable({ projects }: { projects: ProjectCard[] }) {
  const slugKey = projects.map(p => p.slug).join(',')

  const [details, setDetails] = useState<(ProjectDetail | null)[]>(
    projects.map(() => null)
  )
  const [loading, setLoading] = useState(true)
  const [onlyDifferences, setOnlyDifferences] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(
      projects.map(p =>
        fetch(`${API_BASE}/projects/${p.slug}`)
          .then(r => (r.ok ? r.json() : null))
          .then(d => (d?.project as ProjectDetail) ?? null)
          .catch(() => null)
      )
    ).then(results => {
      if (!cancelled) {
        setDetails(results)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugKey])

  const isMulti = projects.length > 2

  const matrixRows = useMemo(
    () => buildMatrix(details, projects),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [details]
  )

  const visibleMatrixRows = useMemo(() => {
    if (!onlyDifferences) return matrixRows
    return matrixRows.filter(row => {
      if (row.winners.length > 0 && row.winners.length < projects.length) return true
      const firstVal = typeof row.values[0] === 'string' ? row.values[0] : (row.values[0] ? String(row.values[0]) : '')
      const hasDifference = row.values.some(v => {
        const strVal = typeof v === 'string' ? v : (v ? String(v) : '')
        return strVal !== firstVal
      })
      return hasDifference
    })
  }, [matrixRows, onlyDifferences, projects.length])

  // ProjectDna/RecommendationProfile dropped (lean-schema migration, 2026-10)
  // — 'overall'/'risk'/'family'/'investor'/'luxury' had no honest signal left.
  const EXEC_CATS = [
    { key: 'value', label: 'Best Value' },
  ] as const


  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full rounded-[24px] overflow-hidden border border-black/[0.04] dark:border-white/[0.05] bg-white dark:bg-[#111] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
    >
      {/* ── Content ───────────────────────────────────────────────────────── */}
      {loading ? (
        <Skeleton n={projects.length} />
      ) : (
        <div className="p-4 space-y-5">

          {/* Project cards */}
          {isMulti ? (
            <div className="flex gap-2.5 overflow-x-auto pb-0.5">
              {projects.map((p) => (
                <div key={p.id} className="flex-none w-[150px]">
                  <ProjectMiniCard project={p} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3">
              <ProjectMiniCard project={projects[0]} />
              <div className="flex items-center justify-center w-6 flex-shrink-0">
                <span className="text-[10px] font-black text-gray-200 dark:text-gray-700 rotate-0">
                  VS
                </span>
              </div>
              <ProjectMiniCard project={projects[1]} />
            </div>
          )}

          {/* ── Executive Summary ────────────────────────────────────────── */}
          <Section title="Decision Summary" icon={Zap}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXEC_CATS.map(cat => {
                const idx = categoryWinner(details, projects, cat.key)
                const w = idx !== null ? projects[idx] : null
                return (
                  <div
                    key={cat.key}
                    className={`rounded-xl px-3 py-2.5 border transition-colors ${w
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        : 'bg-gray-50/60 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/40 opacity-60'
                      }`}
                  >

                    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide block">
                      {cat.label}
                    </span>
                    <span className="text-[11px] font-black text-gray-900 dark:text-gray-100 block mt-0.5 line-clamp-1">
                      {w ? w.name : 'Tied'}
                    </span>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* ── Decision Matrix ──────────────────────────────────────────── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={12} className="text-gray-400 flex-shrink-0" />
                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em]">
                  Decision Matrix
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOnlyDifferences(!onlyDifferences)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border ${onlyDifferences
                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800 shadow-2xs'
                    : 'bg-slate-100/80 text-slate-600 border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200'
                  }`}
              >
                <span>{onlyDifferences ? '✓ Differences Only' : 'Show Differences Only'}</span>
              </button>
            </div>
            {isMulti ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative scrollbar-hide">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Feature
                      </th>
                      {projects.map((p) => (
                        <th
                          key={p.id}
                          className="px-4 py-3 text-[11px] font-bold tracking-wide text-center w-[160px] text-slate-700 dark:text-slate-300"
                        >
                          {p.name.split(' ').slice(0, 2).join(' ')}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
                        Winner
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#111]">
                    {visibleMatrixRows.map((row) => (
                      <tr key={row.label} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {row.label}
                        </td>
                        {row.values.map((val, i) => (
                          <td
                            key={i}
                            className={`px-4 py-3.5 text-center transition-colors ${row.winners.includes(i)
                                ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                                : ''
                              }`}
                          >
                            {typeof val === 'string' ? (
                              <span className={`text-[12px] ${row.winners.includes(i)
                                  ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-700 dark:text-slate-300'
                                }`}>
                                {val}
                              </span>
                            ) : val}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-center">
                          {row.winners.length === 1 ? (
                            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {row.winnerLabel}
                            </span>
                          ) : row.winners.length > 1 ? (
                            <span className="text-[9px] text-gray-400">Tie</span>
                          ) : (
                            <span className="text-gray-200 dark:text-gray-700 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // 2 projects: center-label layout
              <div className="space-y-2">
                {visibleMatrixRows.map(row => {
                  const leftWins = row.winners.includes(0)
                  const rightWins = row.winners.includes(1)
                  const tied = leftWins && rightWins
                  return (
                    <div
                      key={row.label}
                      className="flex items-stretch rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm"
                    >
                      {/* Left cell */}
                      <div className={`flex-1 px-4 py-3.5 flex items-center gap-2 min-w-0 ${leftWins && !tied
                          ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                          : 'bg-white dark:bg-[#111]'
                        }`}>
                        {leftWins && !tied && (
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/40 px-2 py-1 rounded-md flex-shrink-0 whitespace-nowrap">
                            {row.winnerLabel}
                          </span>
                        )}
                        <div className={`min-w-0 ${leftWins && !tied
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-slate-700 dark:text-slate-300'
                          }`}>
                          {typeof row.values[0] === 'string' ? (
                            <span className="text-[12px] truncate block">{row.values[0]}</span>
                          ) : row.values[0]}
                        </div>
                      </div>

                      {/* Center label */}
                      <div className="flex items-center justify-center px-4 bg-slate-50/80 dark:bg-slate-900/50 border-x border-slate-200 dark:border-slate-800 flex-shrink-0">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                          {row.label}
                        </span>
                      </div>

                      {/* Right cell */}
                      <div className={`flex-1 px-4 py-3.5 flex items-center justify-end gap-2 min-w-0 ${rightWins && !tied
                          ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                          : 'bg-white dark:bg-[#111]'
                        }`}>
                        <div className={`min-w-0 text-right ${rightWins && !tied
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-slate-700 dark:text-slate-300'
                          }`}>
                          {typeof row.values[1] === 'string' ? (
                            <span className="text-[12px] truncate block">{row.values[1]}</span>
                          ) : row.values[1]}
                        </div>
                        {rightWins && !tied && (
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/40 px-2 py-1 rounded-md flex-shrink-0 whitespace-nowrap">
                            {row.winnerLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Detailed Comparison Accordions ────────────────────────────── */}
          {/* Trust & Legal / Lifestyle & Build read dna.*, dropped entirely
              (lean-schema migration, 2026-10) — removed along with the gates
              that always evaluated false once the relation stopped existing. */}
          <Section title="Detailed Breakdown" icon={HeartHandshake}>
            <Accordion title="Price & Cost" icon={IndianRupee}>
              <div className="flex divide-x divide-gray-100 dark:divide-gray-700/60">
                {projects.map((p, i) => {
                  const units = details[i]?.unit_types;
                  const psfValues = (units && units.length > 0)
                    ? units.map((u) => u.super_area_sqft && u.price_min_cr ? Math.round((u.price_min_cr * 10000000) / u.super_area_sqft) : null).filter((v): v is number => v !== null)
                    : [];
                  const minCr = psfValues.length > 0 ? Math.min(...psfValues) : null;
                  const psf = minCr !== null ? `₹${minCr.toLocaleString('en-IN')}/sqft` : '--'
                  return (
                    <div key={p.id} className="flex-1 p-3 space-y-2 text-[11px]">
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="text-gray-500">Entry Price</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{details[i]?.price_range_label || p.price_range_label || '--'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="text-gray-500">Price PSF</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{psf}</span>
                      </div>

                    </div>
                  )
                })}
              </div>
            </Accordion>

            <Accordion title="Investment Potential" icon={TrendingUp}>
              <div className="flex divide-x divide-gray-100 dark:divide-gray-700/60">
                {projects.map((p, i) => {
                  const intel = (details[i]?.decision_profile?.intelligence_data as IntelligenceData | undefined)?.investment_insights
                  return (
                    <div key={p.id} className="flex-1 p-3 space-y-2 text-[11px]">
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="text-gray-500">1 Yr Growth</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{intel?.appreciation_1yr || '--'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="text-gray-500">Rental Yield</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{intel?.rental_yield || '--'}</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-gray-500">Liquidity</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{intel?.liquidity_score || '--'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Accordion>

            <Accordion title="Social Proof" icon={Users}>
              <div className="flex divide-x divide-gray-100 dark:divide-gray-700/60">
                {projects.map((p, i) => {
                  const sp = (details[i]?.decision_profile?.intelligence_data as IntelligenceData | undefined)?.social_proof
                  return (
                    <div key={p.id} className="flex-1 p-3 space-y-2 text-[11px]">
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="text-gray-500">Resident Rating</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{sp?.overall_rating ? `${sp.overall_rating}/5` : '--'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="text-gray-500">Community</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1 text-right ml-2">{sp?.demographic_tags?.join(', ') || '--'}</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-gray-500">Sentiment</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1 text-right ml-2">{sp?.sentiment_summary || '--'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Accordion>
          </Section>

          {/* Builder Intelligence and Buyer Persona Match read dna / persona_profile,
              both dropped entirely (lean-schema migration, 2026-10) — removed
              along with their always-false gates. */}

          {/* ── Pros & Cons ──────────────────────────────────────────────── */}
          {details.some(
            d =>
              (d?.decision_profile?.why_buy?.length ?? 0) > 0 ||
              (d?.decision_profile?.why_avoid?.length ?? 0) > 0
          ) && (
              <Section title="Strengths & Concerns">
                <div className={`${isMulti ? 'flex gap-2.5 overflow-x-auto' : 'grid grid-cols-2 gap-2.5'}`}>
                  {projects.map((p, i) => {
                    const dp = details[i]?.decision_profile
                    return (
                      <div
                        key={p.id}
                        className={`${isMulti ? 'flex-none w-[200px]' : ''} rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden`}
                      >
                        <div className="px-3 py-2 bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wide line-clamp-1">
                            {p.name}
                          </span>
                        </div>
                        <div className="p-3 space-y-1.5">
                          {dp?.why_buy?.slice(0, 3).map((w, wi) => (
                            <div key={wi} className="flex items-start gap-1.5">
                              <span className="text-emerald-500 text-[11px] flex-shrink-0 leading-relaxed">✓</span>
                              <span className="text-[11px] text-gray-700 dark:text-gray-300 leading-snug">{w}</span>
                            </div>
                          ))}
                          {dp?.why_avoid?.slice(0, 2).map((w, wi) => (
                            <div key={wi} className="flex items-start gap-1.5">
                              <span className="text-red-400 text-[11px] flex-shrink-0 leading-relaxed">✗</span>
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{w}</span>
                            </div>
                          ))}
                          {!dp && (
                            <p className="text-[11px] text-gray-400 italic">No analysis available yet.</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

          {/* ── Advisor Take (per-project decision_thesis) ────────────────────── */}
          {details.some(d => d?.decision_profile?.decision_thesis) && (
            <Section title="Advisor Take" icon={HeartHandshake}>
              <div className={`${isMulti ? 'flex gap-2.5 overflow-x-auto' : 'grid grid-cols-2 gap-2.5'}`}>
                {projects.map((p, i) => {
                  const dp = details[i]?.decision_profile
                  const thesis = dp?.decision_thesis
                  return (
                    <div
                      key={p.id}
                      className={`${isMulti ? 'flex-none w-[220px]' : ''} rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden`}
                    >
                      <div className="px-3 py-2 bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wide line-clamp-1">
                          {p.name}
                        </span>
                      </div>
                      <div className="p-3">
                        {thesis ? (
                          <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                            {thesis.length > 200 ? thesis.slice(0, 200) + '...' : thesis}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-400 italic">No advisor take available yet.</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}
        </div>
      )}

    </m.div>
  )
}
