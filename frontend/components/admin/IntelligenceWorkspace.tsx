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
const PERSONAS          = ['FAMILY', 'PROFESSIONAL', 'INVESTOR', 'NRI', 'UPGRADER', 'RETIREE'] as const
const STATUS_OPTS       = ['DRAFT', 'IN_REVIEW', 'PUBLISHED'] as const
const TIER_OPTS         = ['STRONG_BUY', 'BUY', 'HOLD', 'WATCH', 'AVOID'] as const
const RISK_OPTS         = ['LOW', 'MEDIUM', 'HIGH'] as const
const CONF_OPTS         = ['VERIFIED', 'PARTIAL', 'ESTIMATED'] as const

const DNA_DIMS = [
  { key: 'builder_track_record', label: 'Builder Track Record' },
  { key: 'price_position',       label: 'Price Position' },
  { key: 'locality',             label: 'Locality' },
  { key: 'rera_compliance',      label: 'RERA Compliance' },
  { key: 'amenity_depth',        label: 'Amenity Depth' },
  { key: 'possession_certainty', label: 'Possession Certainty' },
] as const

// Maps DNA_DIMS keys to the actual ProjectDna Prisma schema columns
const DNA_SCHEMA_FIELD: Record<string, string> = {
  builder_track_record: 'builder_score',
  price_position:       'price_score',
  locality:             'location_score',
  rera_compliance:      'legal_score',
  amenity_depth:        'amenity_score',
  possession_certainty: 'possession_score',
}

// Score → label lookup. 5 bands: 0-20 / 21-40 / 41-60 / 61-80 / 81-100
const DNA_LABEL_MAP: Record<string, [string, string, string, string, string]> = {
  builder_track_record: ['Unproven',      'Early Stage', 'Emerging',   'Established',      'Proven'],
  price_position:       ['Overpriced',    'Premium',     'Fair Value', 'Competitive',       'Value Buy'],
  locality:             ['Underdeveloped','Emerging',    'Developing', 'Established',       'Prime'],
  rera_compliance:      ['Non-Compliant', 'Minimal',     'Partial',    'Compliant',         'Fully Compliant'],
  amenity_depth:        ['Bare',          'Basic',       'Standard',   'Premium',           'Luxury'],
  possession_certainty: ['High Risk',     'Uncertain',   'Moderate',   'Likely On-Time',    'Certain'],
}

function computeLabel(dim: string, score: number | null): string | null {
  if (score === null) return null
  const map = DNA_LABEL_MAP[dim]
  if (!map) return null
  const idx = score <= 20 ? 0 : score <= 40 ? 1 : score <= 60 ? 2 : score <= 80 ? 3 : 4
  return map[idx]
}

// ── Types ───────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface DnaState {
  [key: string]: string | number
}

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

interface PersonaState {
  primary_persona: string
  secondary_personas: string[]
  persona_descriptions: Record<string, string>
  income_range: string
  family_stage: string
  work_location: string
  risk_appetite: string
  timeline_horizon: string
  motivation_note: string
}

interface RecState {
  status: string
  tier: string
  primary_thesis: string
  end_use_thesis: string
  investment_thesis: string
  family_thesis: string
  investor_thesis: string
  luxury_thesis: string
  risk_thesis: string
  walk_away: [string, string, string]
  timeline_advice: string
  leverage: [string, string, string]
  internal_confidence: string
  admin_notes: string
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
  initialDna?:            any
  initialDecision?:       any
  initialPersona?:        any
  initialRecommendation?: any
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

function initDna(raw?: any): DnaState {
  if (!raw) return {}
  const d: DnaState = {}
  DNA_DIMS.forEach(({ key }) => {
    let val = raw[`${key}_score`]
    if (val === undefined || val === '' || val === null) {
      if (key === 'builder_track_record') val = raw.builder_score
      if (key === 'price_position') val = raw.price_score
      if (key === 'locality') val = raw.location_score
      if (key === 'rera_compliance') val = raw.legal_score
      if (key === 'amenity_depth') val = raw.amenity_score
      if (key === 'possession_certainty') val = raw.possession_score
    }
    d[`${key}_score`] = val ?? ''
  })
  d.last_verified_at = raw.last_verified_at ? new Date(raw.last_verified_at).toISOString().slice(0, 10) : ''
  d.verified_by      = raw.verified_by ?? ''
  return d
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

function initPersona(raw?: any): PersonaState {
  return {
    primary_persona:      raw?.primary_persona      ?? '',
    secondary_personas:   raw?.secondary_personas   ?? [],
    persona_descriptions: raw?.persona_descriptions ?? {},
    income_range:       raw?.income_range       ?? '',
    family_stage:       raw?.family_stage       ?? '',
    work_location:      raw?.work_location      ?? '',
    risk_appetite:      raw?.risk_appetite      ?? '',
    timeline_horizon:   raw?.timeline_horizon   ?? '',
    motivation_note:    raw?.motivation_note    ?? '',
  }
}

function initRec(raw?: any): RecState {
  return {
    status:               raw?.status               ?? 'DRAFT',
    tier:                 raw?.tier                 ?? '',
    primary_thesis:       raw?.primary_thesis       ?? '',
    end_use_thesis:       raw?.end_use_thesis       ?? '',
    investment_thesis:    raw?.investment_thesis     ?? '',
    family_thesis:        raw?.family_thesis        ?? '',
    investor_thesis:      raw?.investor_thesis      ?? '',
    luxury_thesis:        raw?.luxury_thesis        ?? '',
    risk_thesis:          raw?.risk_thesis          ?? '',
    walk_away:            toSlots(raw?.walk_away_conditions),
    timeline_advice:      raw?.timeline_advice      ?? '',
    leverage:             toSlots(raw?.negotiation_leverage),
    internal_confidence:  raw?.internal_confidence  ?? '',
    admin_notes:          raw?.admin_notes          ?? '',
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

function calcCompletion(dna: DnaState, dec: DecisionState, per: PersonaState, rec: RecState, comps: Competitor[]) {
  // DNA completion = dimensions with a score entered
  const dnaFilled = DNA_DIMS.filter(d => {
    const s = dna[`${d.key}_score`]
    return s !== '' && s != null
  }).length
  const dnaScore = Math.round(dnaFilled / DNA_DIMS.length * 100)

  const decPoints = [
    !!dec.decision_thesis.trim(),
    dec.why_buy.some(s => s.trim()),
    dec.why_avoid.some(s => s.trim()),
    !!dec.best_for.trim(),
    dec.confidence_sources.length > 0,
  ]
  const decScore = Math.round(decPoints.filter(Boolean).length / decPoints.length * 100)

  const perPoints = [
    !!per.primary_persona,
    !!per.income_range.trim(),
    !!per.family_stage.trim(),
    !!per.work_location.trim(),
    !!per.motivation_note.trim(),
  ]
  const perScore = Math.round(perPoints.filter(Boolean).length / perPoints.length * 100)

  const recPoints = [
    !!rec.tier,
    !!rec.primary_thesis.trim(),
    rec.walk_away.some(s => s.trim()),
    !!rec.timeline_advice.trim(),
  ]
  const recScore = Math.round(recPoints.filter(Boolean).length / recPoints.length * 100)

  const compScore = comps.filter(c => !c._isNew).some(c => c.verdict.trim()) ? 100
                  : comps.filter(c => !c._isNew).length > 0 ? 50 : 0

  const overall = Math.round((dnaScore + decScore + perScore + recScore + compScore) / 5)
  return { dna: dnaScore, decision: decScore, persona: perScore, recommendation: recScore, competitor: compScore, overall }
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

// Score-band pill — shown beside DNA score
function ScorePill({ dim, score }: { dim: string; score: number | null }) {
  if (score === null) return null
  const label = computeLabel(dim, score)
  if (!label) return null
  const cls = score >= 67
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
    : score >= 34
    ? 'bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
    : 'bg-rose-50 text-rose-600 border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md border ${cls} whitespace-nowrap`}>
      {label}
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
  projectId, initialDna, initialDecision, initialPersona, initialRecommendation, initialCompetitors, initialSpecs,
}: Props) {
  const [dna, setDna]     = useState<DnaState>(() => initDna(initialDna))
  const [dec, setDec]     = useState<DecisionState>(() => initDecision(initialDecision))
  const [per, setPer]     = useState<PersonaState>(() => initPersona(initialPersona))
  const [rec, setRec]     = useState<RecState>(() => initRec(initialRecommendation))
  const [comps, setComps] = useState<Competitor[]>(() => initCompetitors(initialCompetitors))
  const [specs, setSpecs] = useState<any[]>(initialSpecs ?? [])
  
  const [buyerPersonas, setBuyerPersonas] = useState<any>(
    initialDecision?.intelligence_data?.buyerPersonas ?? []
  )

  const [dnaSv,  setDnaSv]  = useState<SaveState>('idle')
  const [decSv,  setDecSv]  = useState<SaveState>('idle')
  const [perSv,  setPerSv]  = useState<SaveState>('idle')
  const [recSv,  setRecSv]  = useState<SaveState>('idle')

  const [collapsed, setCollapsed] = useState({
    dna: false, decision: false, persona: true, recommendation: true, competitors: true,
  })
  const toggle = (k: keyof typeof collapsed) => setCollapsed(p => ({ ...p, [k]: !p[k] }))

  const completion = calcCompletion(dna, dec, per, rec, comps)

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

  const saveDna = useCallback((latest?: DnaState) => {
    const d = latest ?? dna
    const payload: Record<string, any> = {}
    DNA_DIMS.forEach(({ key }) => {
      const score = d[`${key}_score`]
      const numScore = score === '' || score == null ? null : Number(score)
      payload[DNA_SCHEMA_FIELD[key]] = numScore
    })
    payload.last_verified_at = (d.last_verified_at as string) || null
    payload.verified_by      = (d.verified_by as string) || null
    saveFn(`projects/${projectId}/dna`, payload, setDnaSv)
  }, [dna, projectId, saveFn])

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

  const savePersona = useCallback((latest?: PersonaState) => {
    const d = latest ?? per
    saveFn(`projects/${projectId}/persona-profile`, {
      primary_persona:      d.primary_persona      || null,
      secondary_personas:   d.secondary_personas,
      persona_descriptions: Object.keys(d.persona_descriptions).length > 0 ? d.persona_descriptions : null,
      income_range:       d.income_range       || null,
      family_stage:       d.family_stage       || null,
      work_location:      d.work_location      || null,
      risk_appetite:      d.risk_appetite      || null,
      timeline_horizon:   d.timeline_horizon   || null,
      motivation_note:    d.motivation_note    || null,
    }, setPerSv)
  }, [per, projectId, saveFn])

  const saveRec = useCallback((latest?: RecState) => {
    const d = latest ?? rec
    saveFn(`projects/${projectId}/recommendation-profile`, {
      status:               d.status              || null,
      tier:                 d.tier                || null,
      primary_thesis:       d.primary_thesis       || null,
      end_use_thesis:       d.end_use_thesis       || null,
      investment_thesis:    d.investment_thesis    || null,
      family_thesis:        d.family_thesis        || null,
      investor_thesis:      d.investor_thesis      || null,
      luxury_thesis:        d.luxury_thesis        || null,
      risk_thesis:          d.risk_thesis          || null,
      walk_away_conditions: fromSlots(d.walk_away),
      timeline_advice:      d.timeline_advice      || null,
      negotiation_leverage: fromSlots(d.leverage),
      internal_confidence:  d.internal_confidence  || null,
      admin_notes:          d.admin_notes          || null,
    }, setRecSv)
  }, [rec, projectId, saveFn])
  
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
            { label: 'DNA',         value: completion.dna },
            { label: 'Decision',    value: completion.decision },
            { label: 'Persona',     value: completion.persona },
            { label: 'Rec',         value: completion.recommendation },
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

      {/* ── Project DNA ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xs rounded-2xl overflow-hidden">
        <SecHead title="Project DNA" score={completion.dna} save={dnaSv} collapsed={collapsed.dna} onToggle={() => toggle('dna')} />
        {!collapsed.dna && (
          <div className="px-5 pt-3.5 pb-5">
            {/* Header row */}
            <div className="flex items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
              <span className="flex-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Dimension</span>
              <span className="w-16 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Score</span>
              <span className="w-36 pl-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Rating</span>
            </div>

            {DNA_DIMS.map(({ key, label }) => {
              const scoreVal = dna[`${key}_score`] as string
              const numScore = scoreVal !== '' && scoreVal != null ? Number(scoreVal) : null
              return (
                <div key={key} className="flex items-center gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <span className="flex-1 text-[13px] text-zinc-800 dark:text-zinc-200 font-medium">{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreVal ?? ''}
                    placeholder="—"
                    onChange={e => setDna(p => ({ ...p, [`${key}_score`]: e.target.value }))}
                    onBlur={() => saveDna()}
                    className={`${smallInputCls} w-16 text-center font-mono`}
                  />
                  <div className="w-36 pl-1">
                    <ScorePill dim={key} score={numScore} />
                  </div>
                </div>
              )
            })}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-1 border-t border-zinc-100 dark:border-zinc-800/80">
              <FL label="Verified By">
                <input
                  type="text"
                  value={(dna.verified_by as string) ?? ''}
                  placeholder="Name or initials"
                  onChange={e => setDna(p => ({ ...p, verified_by: e.target.value }))}
                  onBlur={() => saveDna()}
                  className={inputCls}
                />
              </FL>
              <FL label="Last Verified">
                <input
                  type="date"
                  value={(dna.last_verified_at as string)?.split('T')[0] ?? ''}
                  onChange={e => setDna(p => ({ ...p, last_verified_at: e.target.value }))}
                  onBlur={() => saveDna()}
                  className={inputCls}
                />
              </FL>
            </div>
          </div>
        )}
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

      {/* ── Persona Profile ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xs rounded-2xl overflow-hidden">
        <SecHead title="Persona Profile" score={completion.persona} save={perSv} collapsed={collapsed.persona} onToggle={() => toggle('persona')} />
        {!collapsed.persona && (
          <div className="px-5 pt-3.5 pb-5 space-y-3">
            <FL label="Primary Persona">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PERSONAS.map(p => {
                  const active = per.primary_persona === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        const next = active ? '' : p
                        const v = { ...per, primary_persona: next }
                        setPer(v); savePersona(v)
                      }}
                      className={`text-[11.5px] font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0066cc] text-white border-[#0066cc]'
                          : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200/90 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </FL>

            <FL label="Secondary Personas">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PERSONAS.map(p => {
                  const active = per.secondary_personas.includes(p) && per.primary_persona !== p
                  const isPrimary = per.primary_persona === p
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={isPrimary}
                      onClick={() => {
                        const next = active
                          ? per.secondary_personas.filter(s => s !== p)
                          : [...per.secondary_personas.filter(s => s !== per.primary_persona), p]
                        const v = { ...per, secondary_personas: next }
                        setPer(v); savePersona(v)
                      }}
                      className={`text-[11.5px] font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        isPrimary ? 'opacity-25 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200'
                        : active   ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200/90 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </FL>

            {(() => {
              const selected = [per.primary_persona, ...per.secondary_personas].filter(Boolean)
              if (selected.length === 0) return null
              return (
                <FL label="Persona Descriptions">
                  <div className="space-y-2 mt-1">
                    {selected.map((p) => (
                      <div key={p}>
                        <p className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">{p}</p>
                        <textarea
                          value={per.persona_descriptions[p] ?? ''}
                          placeholder={`Why ${p.toLowerCase()} buyers fit this project…`}
                          rows={2}
                          onChange={e => setPer(s => ({ ...s, persona_descriptions: { ...s.persona_descriptions, [p]: e.target.value } }))}
                          onBlur={() => savePersona()}
                          className={`${inputCls} resize-none`}
                        />
                      </div>
                    ))}
                  </div>
                </FL>
              )
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FL label="Income Range">
                <input
                  type="text"
                  value={per.income_range}
                  placeholder="₹25–50L annual household"
                  onChange={e => setPer(p => ({ ...p, income_range: e.target.value }))}
                  onBlur={() => savePersona()}
                  className={inputCls}
                />
              </FL>
              <FL label="Risk Appetite">
                <CustomSelect
                  value={per.risk_appetite || ''}
                  onChange={val => { const v = { ...per, risk_appetite: val }; setPer(v); savePersona(v) }}
                  options={[{ value: '', label: 'Select…' }, ...RISK_OPTS.map(o => ({ value: o, label: o }))]}
                  size="sm"
                  className="w-full"
                />
              </FL>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FL label="Family Stage">
                <input
                  type="text"
                  value={per.family_stage}
                  placeholder="School-age kids, joint family OK…"
                  onChange={e => setPer(p => ({ ...p, family_stage: e.target.value }))}
                  onBlur={() => savePersona()}
                  className={inputCls}
                />
              </FL>
              <FL label="Work Location">
                <input
                  type="text"
                  value={per.work_location}
                  placeholder="Noida Sector 62–137, WFH…"
                  onChange={e => setPer(p => ({ ...p, work_location: e.target.value }))}
                  onBlur={() => savePersona()}
                  className={inputCls}
                />
              </FL>
            </div>

            <FL label="Timeline Horizon">
              <input
                type="text"
                value={per.timeline_horizon}
                placeholder="3–5 year possession wait acceptable…"
                onChange={e => setPer(p => ({ ...p, timeline_horizon: e.target.value }))}
                onBlur={() => savePersona()}
                className={inputCls}
              />
            </FL>

            <FL label="Motivation Note">
              <textarea
                value={per.motivation_note}
                placeholder="What drives this buyer — upgrade, first home, investment diversification…"
                rows={2}
                onChange={e => setPer(p => ({ ...p, motivation_note: e.target.value }))}
                onBlur={() => savePersona()}
                className={`${inputCls} resize-none`}
              />
            </FL>

            <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800">
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
          </div>
        )}
      </div>

      {/* ── Recommendation Profile ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xs rounded-2xl overflow-hidden">
        <SecHead title="Recommendation" score={completion.recommendation} save={recSv} collapsed={collapsed.recommendation} onToggle={() => toggle('recommendation')} />
        {!collapsed.recommendation && (
          <div className="px-5 pt-3.5 pb-5 space-y-3">

            <div className="flex items-center gap-2 flex-wrap">
              <CustomSelect
                value={rec.tier || ''}
                onChange={val => { const v = { ...rec, tier: val }; setRec(v); saveRec(v) }}
                options={[{ value: '', label: 'No verdict yet' }, ...TIER_OPTS.map(o => ({ value: o, label: o.replace('_', ' ') }))]}
                size="sm"
                className="w-44"
              />
              <CustomSelect
                value={rec.status || ''}
                onChange={val => { const v = { ...rec, status: val }; setRec(v); saveRec(v) }}
                options={STATUS_OPTS.map(o => ({ value: o, label: o.replace('_', ' ') }))}
                size="sm"
                className="w-36"
              />
              {rec.tier && (
                <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-lg border ${
                  rec.tier === 'STRONG_BUY' ? 'bg-emerald-600 text-white border-emerald-600'
                  : rec.tier === 'BUY'       ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : rec.tier === 'HOLD'       ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                  : rec.tier === 'WATCH'      ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}>
                  {rec.tier.replace('_', ' ')}
                </span>
              )}
            </div>

            <FL label="Primary Thesis">
              <textarea
                value={rec.primary_thesis}
                placeholder="The primary recommendation covering both end-use and investment…"
                rows={3}
                onChange={e => setRec(p => ({ ...p, primary_thesis: e.target.value }))}
                onBlur={() => saveRec()}
                className={`${inputCls} resize-none`}
              />
            </FL>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FL label="End-Use Thesis">
                <textarea
                  value={rec.end_use_thesis}
                  placeholder="Why buy to live here…"
                  rows={2}
                  onChange={e => setRec(p => ({ ...p, end_use_thesis: e.target.value }))}
                  onBlur={() => saveRec()}
                  className={`${inputCls} resize-none`}
                />
              </FL>
              <FL label="Investment Thesis">
                <textarea
                  value={rec.investment_thesis}
                  placeholder="Why buy to hold or sell…"
                  rows={2}
                  onChange={e => setRec(p => ({ ...p, investment_thesis: e.target.value }))}
                  onBlur={() => saveRec()}
                  className={`${inputCls} resize-none`}
                />
              </FL>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { field: 'family_thesis'   as const, label: 'Family Lens' },
                { field: 'investor_thesis' as const, label: 'Investor Lens' },
                { field: 'luxury_thesis'   as const, label: 'Luxury Lens' },
                { field: 'risk_thesis'     as const, label: 'Risk Lens' },
              ]).map(({ field, label }) => (
                <FL key={field} label={label}>
                  <textarea
                    value={rec[field]}
                    placeholder="Coming soon…"
                    rows={2}
                    onChange={e => setRec(p => ({ ...p, [field]: e.target.value }))}
                    onBlur={() => saveRec()}
                    className={`${inputCls} resize-none opacity-60`}
                  />
                </FL>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FL label="Walk Away Conditions">
                <div className="space-y-1.5">
                  {([0, 1, 2] as const).map(i => (
                    <input
                      key={i}
                      type="text"
                      value={rec.walk_away[i]}
                      placeholder={`Condition ${i + 1}…`}
                      onChange={e => {
                        const s: [string, string, string] = [...rec.walk_away] as [string, string, string]
                        s[i] = e.target.value
                        setRec(p => ({ ...p, walk_away: s }))
                      }}
                      onBlur={() => saveRec()}
                      className={`${smallInputCls} w-full`}
                    />
                  ))}
                </div>
              </FL>

              <FL label="Negotiation Leverage">
                <div className="space-y-1.5">
                  {([0, 1, 2] as const).map(i => (
                    <input
                      key={i}
                      type="text"
                      value={rec.leverage[i]}
                      placeholder={`Leverage point ${i + 1}…`}
                      onChange={e => {
                        const s: [string, string, string] = [...rec.leverage] as [string, string, string]
                        s[i] = e.target.value
                        setRec(p => ({ ...p, leverage: s }))
                      }}
                      onBlur={() => saveRec()}
                      className={`${smallInputCls} w-full`}
                    />
                  ))}
                </div>
              </FL>
            </div>

            <FL label="Timeline Advice">
              <input
                type="text"
                value={rec.timeline_advice}
                placeholder="Buy now / Wait for next phase / Negotiate hard before Q4…"
                onChange={e => setRec(p => ({ ...p, timeline_advice: e.target.value }))}
                onBlur={() => saveRec()}
                className={inputCls}
              />
            </FL>

            <AdminDivider />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FL label="Internal Confidence">
                <CustomSelect
                  value={rec.internal_confidence || ''}
                  onChange={val => { const v = { ...rec, internal_confidence: val }; setRec(v); saveRec(v) }}
                  options={[{ value: '', label: 'Select…' }, ...CONF_OPTS.map(o => ({ value: o, label: o }))]}
                  size="sm"
                  className="w-full"
                />
              </FL>
            </div>

            <FL label="Admin Notes">
              <textarea
                value={rec.admin_notes}
                placeholder="Internal notes about this recommendation…"
                rows={2}
                onChange={e => setRec(p => ({ ...p, admin_notes: e.target.value }))}
                onBlur={() => saveRec()}
                className={`${inputCls} resize-none`}
              />
            </FL>
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

