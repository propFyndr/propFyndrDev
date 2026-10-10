'use client'

import { useState, useCallback } from 'react'
import { Check, Loader2, AlertCircle, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { API_BASE } from '@/lib/env'
import { adminAuthHeaders } from '@/lib/authedFetch'
import JsonEditor from './JsonEditor'
import CustomSelect from './CustomSelect'
import SpecEditor from './SpecEditor'

// ── Constants ───────────────────────────────────────────────────────────────

const CONFIDENCE_SOURCES = ['RERA', 'Project Documents', 'Site Visit', 'Builder Claim', 'Estimated'] as const
const STATUS_OPTS       = ['DRAFT', 'IN_REVIEW', 'PUBLISHED'] as const

// ── Types ───────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface DecisionState {
  status: string
  decision_thesis: string
  why_buy: [string, string, string]
  why_avoid: [string, string, string]
  best_for: string
  not_ideal_for: string
  confidence_sources: string[]
  recommendation_notes: string
  advisor_notes: string
  last_verified_at: string
  verified_by: string
}

interface Competitor {
  id?: string
  competitor_name: string
  competitor_slug: string
  this_project_advantage: string
  competitor_advantage: string
  verdict: string
  price_delta_note: string
  sort_order: number
  _isNew?: boolean
}

interface Props {
  projectId: string
  initialDecision?:       any
  initialCompetitors?:    any[]
  initialSpecs?:          any[]
  onSaved?:               () => void
}

// ── State initialisers ──────────────────────────────────────────────────────

function toSlots(arr: string[] = []): [string, string, string] {
  return [arr[0] ?? '', arr[1] ?? '', arr[2] ?? '']
}
function fromSlots(s: [string, string, string]): string[] {
  return s.filter(v => v.trim())
}

function initDecision(raw?: any): DecisionState {
  return {
    status:               raw?.status              ?? 'DRAFT',
    decision_thesis:      raw?.decision_thesis      ?? '',
    why_buy:              toSlots(raw?.why_buy),
    why_avoid:            toSlots(raw?.why_avoid),
    best_for:             raw?.best_for             ?? '',
    not_ideal_for:        raw?.not_ideal_for        ?? '',
    confidence_sources:   raw?.confidence_sources   ?? [],
    recommendation_notes: raw?.recommendation_notes ?? '',
    advisor_notes:        raw?.advisor_notes        ?? '',
    last_verified_at:     raw?.last_verified_at     ?? '',
    verified_by:          raw?.verified_by          ?? '',
  }
}

function initCompetitors(raw?: any[]): Competitor[] {
  return (raw ?? []).map(c => ({
    id:                     c.id,
    competitor_name:        c.competitor_name        ?? '',
    competitor_slug:        c.competitor_slug        ?? '',
    this_project_advantage: c.this_project_advantage ?? '',
    competitor_advantage:   c.competitor_advantage   ?? '',
    verdict:                c.verdict               ?? '',
    price_delta_note:       c.price_delta_note      ?? '',
    sort_order:             c.sort_order            ?? 0,
  }))
}

// ── Completion calculation ──────────────────────────────────────────────────

function calcCompletion(dec: DecisionState, comps: Competitor[]) {
  const decPoints = [
    !!dec.decision_thesis.trim(),
    dec.why_buy.some(s => s.trim()),
    dec.why_avoid.some(s => s.trim()),
    !!dec.best_for.trim(),
    dec.confidence_sources.length > 0,
  ]
  const decScore = Math.round(decPoints.filter(Boolean).length / decPoints.length * 100)

  const compScore = comps.filter(c => !c._isNew).some(c => c.verdict.trim()) ? 100
                  : comps.filter(c => !c._isNew).length > 0 ? 50 : 0

  const overall = Math.round((decScore + compScore) / 2)
  return { decision: decScore, competitor: compScore, overall }
}

// ── Design tokens ────────────────────────────────────────────────────────────

// Base input — all interactive inputs share this
const inputCls = [
  'w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2',
  'text-[13px] text-zinc-900 dark:text-zinc-100 font-medium',
  'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
  'focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10',
  'transition-all duration-150 shadow-2xs',
].join(' ')

// Inline/compact input (score field, slug, etc.)
const smallInputCls = [
  'bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3 py-1.5',
  'text-[12.5px] text-zinc-900 dark:text-zinc-100 font-medium',
  'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
  'focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10',
  'transition-all duration-150 shadow-2xs',
].join(' ')

// Select — matches input with sleek SVG chevron and active focus
const selectCls = [
  'admin-select bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2',
  'text-[13px] font-medium text-zinc-900 dark:text-zinc-100',
  'focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10',
  'transition-all duration-150 shadow-2xs cursor-pointer',
].join(' ')

// ── Micro-components ─────────────────────────────────────────────────────────

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  const cfg = {
    saving: { icon: <Loader2 size={10} className="animate-spin" />, text: 'Saving…', cls: 'text-zinc-400' },
    saved:  { icon: <Check size={10} />,                            text: 'Saved',   cls: 'text-emerald-600 dark:text-emerald-400' },
    error:  { icon: <AlertCircle size={10} />,                      text: 'Error',   cls: 'text-rose-500' },
  } as const
  const c = cfg[state as keyof typeof cfg]
  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium ${c.cls}`}>
      {c.icon}{c.text}
    </span>
  )
}

// Completion badge beside section header
function CompPill({ value }: { value: number }) {
  const cls = value >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60'
            : value >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60'
            : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
  return (
    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-lg border tabular-nums flex items-center gap-1 ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value >= 80 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-zinc-400'}`} />
      <span>{value}% Score</span>
    </span>
  )
}

// Collapsible section header
function SecHead({ title, score, save: sv, collapsed, onToggle }: {
  title: string; score: number; save: SaveState; collapsed: boolean; onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-50/70 dark:bg-zinc-900/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 transition-colors text-left border-b border-zinc-100 dark:border-zinc-800/80 cursor-pointer group select-none"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">{title}</span>
        <CompPill value={score} />
      </div>
      <div className="flex items-center gap-2.5">
        <SaveBadge state={sv} />
        <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center transition-all shadow-2xs">
          <ChevronDown size={13} className={`text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 transition-transform duration-200 ${!collapsed ? 'rotate-180' : ''}`} />
        </div>
      </div>
    </button>
  )
}

// Field label + children
function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function AdminDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-zinc-200/70 dark:bg-zinc-800" />
      <span className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider">Internal Admin Only</span>
      <div className="flex-1 h-px bg-zinc-200/70 dark:bg-zinc-800" />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    DRAFT:     'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
  }
  return (
    <span className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 ${cfg[status] ?? 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'PUBLISHED' ? 'bg-emerald-500 animate-pulse' : status === 'IN_REVIEW' ? 'bg-amber-500' : 'bg-zinc-400'}`} />
      <span>{status.replace('_', ' ')}</span>
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntelligenceWorkspace({
  projectId, initialDecision, initialCompetitors, initialSpecs,
}: Props) {
  const [dec, setDec]     = useState<DecisionState>(() => initDecision(initialDecision))
  const [comps, setComps] = useState<Competitor[]>(() => initCompetitors(initialCompetitors))
  const [specs, setSpecs] = useState<any[]>(initialSpecs ?? [])

  const [buyerPersonas, setBuyerPersonas] = useState<any>(
    initialDecision?.intelligence_data?.buyerPersonas ?? []
  )

  const [decSv,  setDecSv]  = useState<SaveState>('idle')

  const [collapsed, setCollapsed] = useState({
    decision: false, persona: true, competitors: true,
  })
  const toggle = (k: keyof typeof collapsed) => setCollapsed(p => ({ ...p, [k]: !p[k] }))

  const completion = calcCompletion(dec, comps)

  // ── Save helpers ────────────────────────────────────────────────────────────

  const saveFn = useCallback(async (path: string, data: object, setSv: (s: SaveState) => void) => {
    setSv('saving')
    try {
      const res = await fetch(`${API_BASE}/admin/${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      setSv('saved')
      setTimeout(() => setSv('idle'), 2500)
    } catch {
      setSv('error')
      setTimeout(() => setSv('idle'), 4000)
    }
  }, [])

  const saveDecision = useCallback((latest?: DecisionState) => {
    const d = latest ?? dec
    saveFn(`projects/${projectId}/decision-profile`, {
      status:               d.status || null,
      decision_thesis:      d.decision_thesis || null,
      why_buy:              fromSlots(d.why_buy),
      why_avoid:            fromSlots(d.why_avoid),
      best_for:             d.best_for || null,
      not_ideal_for:        d.not_ideal_for || null,
      confidence_sources:   d.confidence_sources,
      recommendation_notes: d.recommendation_notes || null,
      advisor_notes:        d.advisor_notes || null,
      last_verified_at:     d.last_verified_at || null,
      verified_by:          d.verified_by || null,
    }, setDecSv)
  }, [dec, projectId, saveFn])

  const handleSaveBuyerPersonas = async () => {
    try {
      const existingIntelligence = initialDecision?.intelligence_data ?? {}
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/decision-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({
          intelligence_data: {
            ...existingIntelligence,
            buyerPersonas
          }
        })
      })
      if (!res.ok) throw new Error('Failed to save buyer personas')
    } catch (e) {
      console.error('[IntelligenceWorkspace] Failed to save buyer personas:', e)
    }
  }

  // ── Competitor helpers ───────────────────────────────────────────────────────

  const compPayload = (c: Competitor) => ({
    competitor_name:        c.competitor_name        || undefined,
    competitor_slug:        c.competitor_slug        || null,
    this_project_advantage: c.this_project_advantage || null,
    competitor_advantage:   c.competitor_advantage   || null,
    verdict:                c.verdict               || null,
    price_delta_note:       c.price_delta_note      || null,
    sort_order:             c.sort_order,
  })

  const handleCompBlur = useCallback(async (index: number) => {
    const comp = comps[index]
    if (!comp) return
    if (comp._isNew) {
      if (!comp.competitor_name.trim()) return
      try {
        const res = await fetch(`${API_BASE}/admin/projects/${projectId}/competitors`, {
          method: 'POST',
          headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(compPayload(comp)),
        })
        if (res.ok) {
          const { competitor } = await res.json()
          setComps(prev => prev.map((c, i) => i === index ? { ...c, id: competitor.id, _isNew: false } : c))
        }
      } catch { /* silent */ }
      return
    }
    if (!comp.id) return
    try {
      await fetch(`${API_BASE}/admin/competitors/${comp.id}`, {
        method: 'PATCH',
        headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(compPayload(comp)),
      })
    } catch { /* silent */ }
  }, [comps, projectId])

  const deleteComp = useCallback(async (index: number) => {
    const comp = comps[index]
    if (comp._isNew) { setComps(p => p.filter((_, i) => i !== index)); return }
    if (!comp.id) return
    if (!window.confirm(`Remove "${comp.competitor_name}"?`)) return
    try {
      await fetch(`${API_BASE}/admin/competitors/${comp.id}`, { method: 'DELETE', headers: adminAuthHeaders() })
      setComps(p => p.filter((_, i) => i !== index))
    } catch { /* silent */ }
  }, [comps])

  const addComp = () => setComps(p => [
    ...p,
    { competitor_name: '', competitor_slug: '', this_project_advantage: '', competitor_advantage: '', verdict: '', price_delta_note: '', sort_order: p.length, _isNew: true },
  ])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-5xl">

      {/* ── Completion strip ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xs rounded-2xl px-5 py-3.5 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[15px] font-bold font-mono tabular-nums leading-none ${
            completion.overall >= 80 ? 'text-emerald-600 dark:text-emerald-400'
            : completion.overall >= 40 ? 'text-amber-600 dark:text-amber-400'
            : 'text-zinc-400'
          }`}>{completion.overall}%</span>
          <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">intelligence readiness</span>
        </div>
        <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
        <div className="flex items-center gap-3.5 flex-wrap">
          {[
            { label: 'Decision',    value: completion.decision },
            { label: 'Competition', value: completion.competitor },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                value >= 80 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-700'
              }`} />
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">{label}</span>
              <span className={`text-[12px] font-semibold font-mono tabular-nums ${
                value >= 80 ? 'text-emerald-600 dark:text-emerald-400' : value >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'
              }`}>{value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Decision Profile ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xs rounded-2xl overflow-hidden">
        <SecHead title="Decision Profile" score={completion.decision} save={decSv} collapsed={collapsed.decision} onToggle={() => toggle('decision')} />
        {!collapsed.decision && (
          <div className="px-5 pt-3.5 pb-5 space-y-4">

            <div className="flex items-center gap-3">
              <CustomSelect
                value={dec.status}
                onChange={val => { const v = { ...dec, status: val }; setDec(v); saveDecision(v) }}
                options={[
                  { value: 'DRAFT', label: 'DRAFT', dotColor: 'bg-zinc-400' },
                  { value: 'IN_REVIEW', label: 'IN REVIEW', dotColor: 'bg-amber-500' },
                  { value: 'PUBLISHED', label: 'PUBLISHED', dotColor: 'bg-emerald-500' },
                ]}
                className="w-48"
              />
              <StatusBadge status={dec.status} />
            </div>

            {/* Decision Thesis — primary hero field */}
            <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-4 shadow-2xs">
              <label className="block text-[11px] font-semibold text-[#0066cc] dark:text-blue-400 uppercase tracking-wider mb-1.5">Decision Thesis</label>
              <textarea
                value={dec.decision_thesis}
                placeholder="One sentence advisor voice. The most defensible long-term buy in this segment…"
                rows={2}
                onChange={e => setDec(p => ({ ...p, decision_thesis: e.target.value }))}
                onBlur={() => saveDecision()}
                className="w-full bg-transparent text-[14px] text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none resize-none placeholder:text-blue-300 dark:placeholder:text-blue-600/70 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Why Buy</label>
                {([0, 1, 2] as const).map(i => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-500 w-3.5 flex-shrink-0 tabular-nums">{i + 1}</span>
                    <input
                      type="text"
                      value={dec.why_buy[i]}
                      placeholder={`Reason ${i + 1}…`}
                      onChange={e => {
                        const slots: [string, string, string] = [...dec.why_buy] as [string, string, string]
                        slots[i] = e.target.value
                        setDec(p => ({ ...p, why_buy: slots }))
                      }}
                      onBlur={() => saveDecision()}
                      className={`${smallInputCls} w-full flex-1`}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Why Avoid</label>
                {([0, 1, 2] as const).map(i => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-amber-500 w-3.5 flex-shrink-0 tabular-nums">{i + 1}</span>
                    <input
                      type="text"
                      value={dec.why_avoid[i]}
                      placeholder={`Concern ${i + 1}…`}
                      onChange={e => {
                        const slots: [string, string, string] = [...dec.why_avoid] as [string, string, string]
                        slots[i] = e.target.value
                        setDec(p => ({ ...p, why_avoid: slots }))
                      }}
                      onBlur={() => saveDecision()}
                      className={`${smallInputCls} w-full flex-1`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FL label="Best For">
                <input
                  type="text"
                  value={dec.best_for}
                  placeholder="End-use families in Sector 75…"
                  onChange={e => setDec(p => ({ ...p, best_for: e.target.value }))}
                  onBlur={() => saveDecision()}
                  className={inputCls}
                />
              </FL>
              <FL label="Not Ideal For">
                <input
                  type="text"
                  value={dec.not_ideal_for}
                  placeholder="Pure investors, timeline-sensitive…"
                  onChange={e => setDec(p => ({ ...p, not_ideal_for: e.target.value }))}
                  onBlur={() => saveDecision()}
                  className={inputCls}
                />
              </FL>
            </div>

            <FL label="Confidence Sources">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {CONFIDENCE_SOURCES.map(src => {
                  const active = dec.confidence_sources.includes(src)
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? dec.confidence_sources.filter(s => s !== src)
                          : [...dec.confidence_sources, src]
                        const v = { ...dec, confidence_sources: next }
                        setDec(v); saveDecision(v)
                      }}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      {src}
                    </button>
                  )
                })}
              </div>
            </FL>

            <AdminDivider />

            <FL label="Recommendation Notes">
              <textarea
                value={dec.recommendation_notes}
                placeholder="Internal notes about this project's recommendation…"
                rows={2}
                onChange={e => setDec(p => ({ ...p, recommendation_notes: e.target.value }))}
                onBlur={() => saveDecision()}
                className={`${inputCls} resize-none`}
              />
            </FL>

            <FL label="Advisor Notes (injected into chat context)">
              <textarea
                value={dec.advisor_notes}
                placeholder="Context injected into the AI advisor when discussing this project…"
                rows={2}
                onChange={e => setDec(p => ({ ...p, advisor_notes: e.target.value }))}
                onBlur={() => saveDecision()}
                className={`${inputCls} resize-none`}
              />
            </FL>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FL label="Verified By">
                <input
                  type="text"
                  value={dec.verified_by}
                  placeholder="Name or initials"
                  onChange={e => setDec(p => ({ ...p, verified_by: e.target.value }))}
                  onBlur={() => saveDecision()}
                  className={inputCls}
                />
              </FL>
              <FL label="Last Verified">
                <input
                  type="date"
                  value={dec.last_verified_at?.split('T')[0] ?? ''}
                  onChange={e => setDec(p => ({ ...p, last_verified_at: e.target.value }))}
                  onBlur={() => saveDecision()}
                  className={inputCls}
                />
              </FL>
            </div>
          </div>
        )}
      </div>

      {/* ── Buyer Personas (DecisionProfile.intelligence_data JSON) ────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xs rounded-2xl overflow-hidden">
        <SecHead title="Buyer Personas" score={0} save="idle" collapsed={collapsed.persona} onToggle={() => toggle('persona')} />
        {!collapsed.persona && (
          <div className="px-5 pt-3.5 pb-5">
            <JsonEditor
              value={buyerPersonas}
              onChange={setBuyerPersonas}
              label="Detailed Buyer Personas (JSON)"
              description="Raw JSON array for detailed buyerPersonas objects."
            />
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={handleSaveBuyerPersonas}
                className="bg-[#0066cc] hover:bg-[#0055b3] text-white px-4 py-2 rounded-xl text-[12.5px] font-medium transition-colors shadow-2xs cursor-pointer"
              >
                Save Personas JSON
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Competitor Intelligence ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xs rounded-2xl overflow-hidden">
        <SecHead title="Competitor Intelligence" score={completion.competitor} save="idle" collapsed={collapsed.competitors} onToggle={() => toggle('competitors')} />
        {!collapsed.competitors && (
          <div className="px-5 pt-3.5 pb-5 space-y-3">
            {comps.length === 0 && (
              <p className="text-[13px] text-zinc-400 text-center py-5">
                No competitors added. Add the first comparison below.
              </p>
            )}

            {comps.map((comp, idx) => (
              <div key={comp.id ?? `new-${idx}`} className="bg-zinc-50/70 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-2">
                  <span className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {comp._isNew ? 'New Competitor' : comp.competitor_name || 'Competitor'}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteComp(idx)}
                    className="p-1 rounded text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FL label="Name *">
                    <input
                      type="text"
                      value={comp.competitor_name}
                      placeholder="Mahagun Moderne"
                      onChange={e => setComps(p => p.map((c, i) => i === idx ? { ...c, competitor_name: e.target.value } : c))}
                      onBlur={() => handleCompBlur(idx)}
                      className={inputCls}
                    />
                  </FL>
                  <FL label="Slug (if in DB)">
                    <input
                      type="text"
                      value={comp.competitor_slug}
                      placeholder="mahagun-moderne"
                      onChange={e => setComps(p => p.map((c, i) => i === idx ? { ...c, competitor_slug: e.target.value } : c))}
                      onBlur={() => handleCompBlur(idx)}
                      className={inputCls}
                    />
                  </FL>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FL label="Our Advantage">
                    <textarea
                      value={comp.this_project_advantage}
                      placeholder="What this project does better…"
                      rows={2}
                      onChange={e => setComps(p => p.map((c, i) => i === idx ? { ...c, this_project_advantage: e.target.value } : c))}
                      onBlur={() => handleCompBlur(idx)}
                      className={`${inputCls} resize-none`}
                    />
                  </FL>
                  <FL label="Their Advantage">
                    <textarea
                      value={comp.competitor_advantage}
                      placeholder="What the competitor does better…"
                      rows={2}
                      onChange={e => setComps(p => p.map((c, i) => i === idx ? { ...c, competitor_advantage: e.target.value } : c))}
                      onBlur={() => handleCompBlur(idx)}
                      className={`${inputCls} resize-none`}
                    />
                  </FL>
                </div>

                <FL label="Verdict">
                  <textarea
                    value={comp.verdict}
                    placeholder="Who should choose which project and why…"
                    rows={2}
                    onChange={e => setComps(p => p.map((c, i) => i === idx ? { ...c, verdict: e.target.value } : c))}
                    onBlur={() => handleCompBlur(idx)}
                    className={`${inputCls} resize-none`}
                  />
                </FL>

                <FL label="Price Delta Note">
                  <input
                    type="text"
                    value={comp.price_delta_note}
                    placeholder="₹8L cheaper per Cr vs Mahagun Moderne…"
                    onChange={e => setComps(p => p.map((c, i) => i === idx ? { ...c, price_delta_note: e.target.value } : c))}
                    onBlur={() => handleCompBlur(idx)}
                    className={inputCls}
                  />
                </FL>
              </div>
            ))}

            <button
              type="button"
              onClick={addComp}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-[12.5px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-[#0066cc] dark:hover:text-blue-400 hover:border-[#0066cc]/40 transition-colors cursor-pointer"
            >
              <Plus size={13} />Add competitor comparison
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

