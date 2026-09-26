'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Plus, X } from 'lucide-react'
import { API_BASE } from '@/lib/env'
import { adminAuthHeaders } from '@/lib/authedFetch'
import CustomSelect from './CustomSelect'

interface Builder { id: string; name: string }

interface ProjectData {

  id?: string
  name: string
  slug: string
  builder_id: string
  sector: string
  city: string
  status: 'ready_to_move' | 'under_construction' | 'new_launch'
  tagline: string
  address: string
  lat: string
  lng: string
  rera_number: string
  rera_url: string
  total_units: string
  total_towers: string
  land_area_acres: string
  launch_date: string

  possession_label: string
  possession_date: string
  description: string
  long_description: string
  design_theme: string
  architect: string
  interior_designer: string
  floors: string
  open_space_pct: string
  green_rating: string

  hero_image_url: string
  marketing_claims: string[]
  ai_search_keywords: string[]

  // Phase 5 Fields
  nri_eligible?: boolean
  vastu_compliant?: boolean
  has_penthouse?: boolean
  has_duplex?: boolean
  women_safety_score?: string
  air_quality_index_avg?: string
  noise_level_db?: string
  green_cover_percent?: string
  market_demand_score?: string
  appreciation_potential_5yr?: string
  rental_yield_annual_percent?: string
  resale_lock_in_months?: string
  approvals_status?: string
  escrow_verified?: boolean
  registry_status?: string

  // Living Specs & 2026 Comprehensive Standards
  water_source?: string
  dg_power_rate_per_unit?: string
  maintenance_per_sqft_monthly?: string
  has_png_gas_pipeline?: boolean
  mobile_network_rating?: string
  ceiling_height_ft?: string
  lifts_per_tower?: string
  has_service_lift?: boolean
  shared_walls_type?: string
  authority_dues_cleared?: boolean
  land_tenure?: string
  pet_friendly?: boolean
  bachelor_tenants_allowed?: boolean

  // Forensic Due Diligence & Living Quality (Day 3 Expansion)
  oc_status?: 'FULL_OC' | 'PHASED_OC' | 'APPLIED' | 'NONE'
  oc_details?: string
  amitabh_kant_clearance?: boolean | null
  bank_apf_codes?: string
  water_source_type?: 'GANGA_JAL' | 'BOREWELL' | 'MIXED'
  water_tds_range?: string
  shahdara_drain_impact?: boolean | null
  lift_act_compliant?: boolean | null
  power_supply_type?: 'PVVNL_MULTIPOINT' | 'SINGLE_POINT_BULK'
  all_in_cost_multiplier?: string
}

export function formatApfCodes(val: any): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(', ')
  }
  return ''
}

export function parseApfCodes(val: string): any {
  if (!val || !val.trim()) return null
  try {
    return JSON.parse(val)
  } catch {
    const res: Record<string, string> = {}
    val.split(',').forEach((part) => {
      const [k, ...rest] = part.split(':')
      if (k && rest.length) {
        res[k.trim()] = rest.join(':').trim()
      }
    })
    return Object.keys(res).length > 0 ? res : val.trim()
  }
}

const EMPTY: ProjectData = {
  name: '', slug: '', builder_id: '', sector: '', city: 'Noida',
  status: 'ready_to_move', tagline: '', address: '', lat: '', lng: '',
  rera_number: '', rera_url: '', total_units: '', total_towers: '',
  land_area_acres: '', launch_date: '', possession_label: '', possession_date: '',
  description: '', long_description: '', design_theme: '', architect: '', interior_designer: '', floors: '', open_space_pct: '', green_rating: '',

  hero_image_url: '', marketing_claims: [], ai_search_keywords: [],
  nri_eligible: true, vastu_compliant: true, has_penthouse: false, has_duplex: false,
  women_safety_score: '92', air_quality_index_avg: '155', noise_level_db: '45', green_cover_percent: '75',
  market_demand_score: '90', appreciation_potential_5yr: '14.5', rental_yield_annual_percent: '4.5',
  resale_lock_in_months: '36', approvals_status: 'Fully Approved by RERA', escrow_verified: true, registry_status: 'open',

  water_source: 'Ganga Jal Pipeline (Noida Authority) + Centralized WTP',
  dg_power_rate_per_unit: '21.00',
  maintenance_per_sqft_monthly: '2.75',
  has_png_gas_pipeline: true,
  mobile_network_rating: '4',
  ceiling_height_ft: '10.2',
  lifts_per_tower: '3',
  has_service_lift: true,
  shared_walls_type: 'Zero Shared Walls / 3-Side Open Layout',
  authority_dues_cleared: true,
  land_tenure: '99-Year Authority Leasehold',
  pet_friendly: true,
  bachelor_tenants_allowed: true,

  // Forensic Due Diligence & Living Quality.
  //
  // Every one of these starts unset, and unset is submitted as null. They used
  // to be prefilled — 'NONE', 'MIXED', 'SINGLE_POINT_BULK', false, false, false
  // — so a project saved by anyone who did not scroll this far carried six
  // checkable claims nobody had made. See migrations/forensic_columns_nullable.
  oc_status: undefined,
  oc_details: '',
  amitabh_kant_clearance: null,
  bank_apf_codes: '',
  water_source_type: undefined,
  water_tds_range: '',
  shahdara_drain_impact: null,
  lift_act_compliant: null,
  power_supply_type: undefined,
  // Blank, not 1.30. A prefilled multiplier is saved by anyone who does not
  // notice it, and it then reads downstream as a verified project figure.
  all_in_cost_multiplier: '',
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="col-span-1 md:col-span-2 pt-6 mt-4 first:pt-0 first:mt-0">
      <div className="flex items-center gap-3">
        <span className="text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">{title}</span>
        <div className="flex-1 h-px bg-zinc-200/80 dark:bg-zinc-800" />
      </div>
    </div>
  )
}

function Field({ label, children, hint, required }: {
  label: string
  children: React.ReactNode
  hint?: string
  required?: boolean
}) {
  return (
    <div className="w-full min-w-0 flex flex-col">
      <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
        {label} {required && <span className="text-rose-500 font-semibold">*</span>}
      </label>
      <div className="w-full min-w-0">
        {children}
      </div>
      {hint && <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug font-normal">{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
      className="w-full bg-white dark:bg-zinc-850/80 border border-zinc-200/90 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-[#0066cc] dark:focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/15 rounded-xl h-10 px-3.5 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none transition-all shadow-2xs"
    />
  )
}

function Textarea({ value, onChange, rows = 3, placeholder }: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full bg-white dark:bg-zinc-850/80 border border-zinc-200/90 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-[#0066cc] dark:focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/15 rounded-xl p-3.5 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none transition-all shadow-2xs resize-none"
    />
  )
}

function TagInput({ tags, onChange, placeholder }: {
  tags: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  function add() {
    const v = input.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs px-2.5 py-1 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 font-medium">
              {t}
              <button
                type="button"
                onClick={() => onChange(tags.filter((x) => x !== t))}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          }}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1 bg-white dark:bg-zinc-850/80 border border-zinc-200/90 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-[#0066cc] dark:focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/15 rounded-xl h-10 px-3.5 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none transition-all shadow-2xs"
        />
        <button
          type="button"
          onClick={add}
          className="px-3.5 h-10 bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl transition-all shadow-2xs flex items-center justify-center cursor-pointer active:scale-[0.98]"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}

export default function ProjectForm({ initialData, projectId, onFormChange, onSaved }: {
  initialData?: Partial<ProjectData>
  projectId?: string
  onFormChange?: (values: Partial<ProjectData>) => void
  onSaved?: () => void
}) {
  const router = useRouter()
  const [builders, setBuilders] = useState<Builder[]>([])
  const [form, setForm] = useState<ProjectData>(() => ({
    ...EMPTY,
    ...initialData,
    bank_apf_codes: formatApfCodes(initialData?.bank_apf_codes),
    all_in_cost_multiplier: initialData?.all_in_cost_multiplier != null ? String(initialData.all_in_cost_multiplier) : EMPTY.all_in_cost_multiplier,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const prevFormRef = useRef<string>('')

  const [dirty, setDirty] = useState(false)

  function set(key: keyof ProjectData) {
    return (value: string) => setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      name:               form.name,
      slug:               form.slug,
      builder_id:         form.builder_id,
      sector:             form.sector,
      city:               form.city,
      status:             form.status,
      tagline:            form.tagline || undefined,
      address:            form.address || undefined,
      lat:                form.lat ? parseFloat(form.lat) : undefined,
      lng:                form.lng ? parseFloat(form.lng) : undefined,
      rera_number:        form.rera_number || undefined,
      rera_url:           form.rera_url || undefined,
      total_units:        form.total_units ? parseInt(form.total_units) : undefined,
      total_towers:       form.total_towers ? parseInt(form.total_towers) : undefined,
      land_area_acres:    form.land_area_acres ? parseFloat(form.land_area_acres) : undefined,
      launch_date:        form.launch_date || undefined,

      possession_label:   form.possession_label || undefined,
      possession_date:    form.possession_date || undefined,
      description:        form.description || undefined,
      long_description:   form.long_description || undefined,
      design_theme:       form.design_theme || undefined,
      architect:          form.architect || undefined,
      interior_designer:  form.interior_designer || undefined,
      floors:             form.floors || undefined,
      open_space_pct:     form.open_space_pct ? parseInt(form.open_space_pct) : undefined,
      green_rating:       form.green_rating || undefined,

      hero_image_url:     form.hero_image_url || undefined,
      marketing_claims:   form.marketing_claims,
      ai_search_keywords: form.ai_search_keywords,

      // Phase 5 Fields
      nri_eligible:                form.nri_eligible,
      vastu_compliant:             form.vastu_compliant,
      has_penthouse:               form.has_penthouse,
      has_duplex:                  form.has_duplex,
      women_safety_score:          form.women_safety_score ? parseInt(form.women_safety_score) : undefined,
      air_quality_index_avg:       form.air_quality_index_avg ? parseInt(form.air_quality_index_avg) : undefined,
      noise_level_db:              form.noise_level_db ? parseInt(form.noise_level_db) : undefined,
      green_cover_percent:         form.green_cover_percent ? parseInt(form.green_cover_percent) : undefined,
      market_demand_score:         form.market_demand_score ? parseInt(form.market_demand_score) : undefined,
      appreciation_potential_5yr:  form.appreciation_potential_5yr ? parseFloat(form.appreciation_potential_5yr) : undefined,
      rental_yield_annual_percent: form.rental_yield_annual_percent ? parseFloat(form.rental_yield_annual_percent) : undefined,
      resale_lock_in_months:       form.resale_lock_in_months ? parseInt(form.resale_lock_in_months) : undefined,
      approvals_status:            form.approvals_status || undefined,
      escrow_verified:             form.escrow_verified,
      registry_status:             form.registry_status || undefined,

      // Living Specs & 2026 Standards
      water_source:                 form.water_source || undefined,
      dg_power_rate_per_unit:       form.dg_power_rate_per_unit ? parseFloat(form.dg_power_rate_per_unit) : undefined,
      maintenance_per_sqft_monthly: form.maintenance_per_sqft_monthly ? parseFloat(form.maintenance_per_sqft_monthly) : undefined,
      has_png_gas_pipeline:         form.has_png_gas_pipeline,
      mobile_network_rating:        form.mobile_network_rating ? parseInt(form.mobile_network_rating) : undefined,
      ceiling_height_ft:            form.ceiling_height_ft ? parseFloat(form.ceiling_height_ft) : undefined,
      lifts_per_tower:              form.lifts_per_tower ? parseInt(form.lifts_per_tower) : undefined,
      has_service_lift:             form.has_service_lift,
      shared_walls_type:            form.shared_walls_type || undefined,
      authority_dues_cleared:       form.authority_dues_cleared,
      land_tenure:                  form.land_tenure || undefined,
      pet_friendly:                 form.pet_friendly,
      bachelor_tenants_allowed:     form.bachelor_tenants_allowed,

      // Forensic Due Diligence & Living Quality (Day 3 Expansion)
      oc_status:                    form.oc_status || null,
      oc_details:                   form.oc_details || undefined,
      amitabh_kant_clearance:       form.amitabh_kant_clearance ?? null,
      bank_apf_codes:               form.bank_apf_codes ? parseApfCodes(form.bank_apf_codes) : undefined,
      water_source_type:            form.water_source_type || null,
      water_tds_range:              form.water_tds_range || undefined,
      shahdara_drain_impact:        form.shahdara_drain_impact ?? null,
      lift_act_compliant:           form.lift_act_compliant ?? null,
      power_supply_type:            form.power_supply_type || null,
      all_in_cost_multiplier:       form.all_in_cost_multiplier ? parseFloat(form.all_in_cost_multiplier) : undefined,
    }

    const url    = projectId ? `${API_BASE}/admin/projects/${projectId}` : `${API_BASE}/admin/projects`
    const method = projectId ? 'PATCH' : 'POST'

    const res  = await fetch(url, { method, headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error ?? 'Save failed')
      setSaving(false)
      return
    }

    setSaving(false)
    if (onSaved) {
      onSaved()
    } else {
      router.push('/admin/projects')
    }
  }, [form, projectId, onSaved, router])

  useEffect(() => {
    fetch(`${API_BASE}/admin/builders`, { headers: adminAuthHeaders() })
      .then((r) => r.json())
      .then((d) => setBuilders(d.builders ?? []))
  }, [])

  // Emit form changes to parent for live preview (debounced via the state update itself)
  useEffect(() => {
    const serialized = JSON.stringify(form)
    if (serialized !== prevFormRef.current) {
      if (prevFormRef.current !== '') {
        setDirty(true)
      }
      prevFormRef.current = serialized
      onFormChange?.(form)
    }
  }, [form, onFormChange])

  // Autosave effect (only for existing projects)
  useEffect(() => {
    if (!dirty || !projectId) return
    const timer = setTimeout(() => {
      handleSubmit({ preventDefault: () => {} } as React.FormEvent)
      setDirty(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [dirty, form, projectId, handleSubmit])

  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 w-full">


        <SectionHeader title="Core Info" />

        <Field label="Project Name" required>
          <Input
            value={form.name}
            onChange={(v) => {
              set('name')(v)
              if (!projectId) set('slug')(toSlug(v))
            }}
            placeholder="e.g. ACE Parkway"
            required
          />
        </Field>

        <Field label="Slug" required hint="URL-safe ID — auto-filled from name">
          <Input value={form.slug} onChange={set('slug')} placeholder="ace-parkway" required />
        </Field>

        <Field label="Builder" required>
          <CustomSelect
            value={form.builder_id}
            onChange={set('builder_id')}
            placeholder="Select builder…"
            options={builders.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>

        <Field label="Status" required>
          <CustomSelect
            value={form.status}
            onChange={set('status')}
            options={[
              { value: 'ready_to_move', label: 'Ready to Move', dotColor: 'bg-emerald-500' },
              { value: 'under_construction', label: 'Under Construction', dotColor: 'bg-amber-500' },
              { value: 'new_launch', label: 'New Launch', dotColor: 'bg-blue-500' },
            ]}
          />
        </Field>

        <Field label="Sector" required hint="e.g. Sector 150">
          <Input value={form.sector} onChange={set('sector')} placeholder="Sector 150" required />
        </Field>

        <Field label="City">
          <Input value={form.city} onChange={set('city')} placeholder="Noida" />
        </Field>

        <SectionHeader title="Location & RERA" />

        <Field label="Full Address">
          <Input value={form.address} onChange={set('address')} placeholder="Noida Expressway, Sector 150, Noida" />
        </Field>

        <Field label="Tagline">
          <Input value={form.tagline} onChange={set('tagline')} placeholder="Short marketing tagline" />
        </Field>

        <Field label="Latitude" hint="Right-click on Google Maps → copy coordinates">
          <Input value={form.lat} onChange={set('lat')} placeholder="28.5355" type="number" step="any" />
        </Field>

        <Field label="Longitude">
          <Input value={form.lng} onChange={set('lng')} placeholder="77.3910" type="number" step="any" />
        </Field>

        <Field label="RERA Number" hint="From up-rera.in">
          <Input value={form.rera_number} onChange={set('rera_number')} placeholder="UPRERAPRJXXXXXX" />
        </Field>

        <Field label="RERA URL">
          <Input value={form.rera_url} onChange={set('rera_url')} placeholder="https://up-rera.in/…" type="url" />
        </Field>

        <SectionHeader title="Project Details" />

        <Field label="Total Towers">
          <Input value={form.total_towers} onChange={set('total_towers')} placeholder="4" type="number" />
        </Field>

        <Field label="Total Units">
          <Input value={form.total_units} onChange={set('total_units')} placeholder="800" type="number" />
        </Field>

        <Field label="Land Area (Acres)">
          <Input value={form.land_area_acres} onChange={set('land_area_acres')} placeholder="12.5" type="number" step="any" />
        </Field>

        <Field label="Launch Date" hint="When the project was/will be launched">
          <Input value={form.launch_date} onChange={set('launch_date')} type="date" />
        </Field>


        <Field label="Possession Label">
          <Input value={form.possession_label} onChange={set('possession_label')} placeholder="Expected Dec 2026" />
        </Field>

        <Field label="Possession Date" hint="Actual or expected handover date">
          <Input value={form.possession_date} onChange={set('possession_date')} type="date" />
        </Field>

        <Field label="Design Theme">
          <Input value={form.design_theme} onChange={set('design_theme')} placeholder="Contemporary / Art Deco" />
        </Field>

        <Field label="Architect">
          <Input value={form.architect} onChange={set('architect')} placeholder="Architect firm name" />
        </Field>
        
        <Field label="Interior Designer">
          <Input value={form.interior_designer} onChange={set('interior_designer')} placeholder="Interior designer name" />
        </Field>

        <Field label="Floors" hint="e.g. G+26">
          <Input value={form.floors} onChange={set('floors')} placeholder="G+26" />
        </Field>

        <Field label="Open Space (%)">
          <Input value={form.open_space_pct} onChange={set('open_space_pct')} placeholder="75" type="number" />
        </Field>

        <Field label="Green Rating">
          <Input value={form.green_rating} onChange={set('green_rating')} placeholder="IGBC Gold" />
        </Field>



        <SectionHeader title="Descriptions" />

        <div className="col-span-1 md:col-span-2">
          <Field label="Short Description" hint="1–2 sentences used by the AI in recommendations">
            <Textarea
              value={form.description}
              onChange={set('description')}
              rows={2}
              placeholder="Brief description of the project…"
            />
          </Field>
        </div>

        <div className="col-span-1 md:col-span-2">
          <Field label="Long Description" hint="Full description shown in the property detail panel">
            <Textarea
              value={form.long_description}
              onChange={set('long_description')}
              rows={5}
              placeholder="Full project description…"
            />
          </Field>
        </div>

        <SectionHeader title="Advanced Intelligence & Compliance (Phase 5)" />

        <Field label="NRI Eligible">
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={!!form.nri_eligible}
              onChange={(e) => setForm((f) => ({ ...f, nri_eligible: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">NRI Investment & Remittance Allowed</span>
          </label>
        </Field>

        <Field label="Vastu Compliant">
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={!!form.vastu_compliant}
              onChange={(e) => setForm((f) => ({ ...f, vastu_compliant: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-slate-700">Vastu Compliant Orientations</span>
          </label>
        </Field>

        <Field label="Women Safety Score (0-100)">
          <Input value={form.women_safety_score || ''} onChange={set('women_safety_score')} placeholder="92" type="number" />
        </Field>

        <Field label="Annual Avg AQI">
          <Input value={form.air_quality_index_avg || ''} onChange={set('air_quality_index_avg')} placeholder="155" type="number" />
        </Field>

        <Field label="Green Cover (%)">
          <Input value={form.green_cover_percent || ''} onChange={set('green_cover_percent')} placeholder="75" type="number" />
        </Field>

        <Field label="Market Demand Score (0-100)">
          <Input value={form.market_demand_score || ''} onChange={set('market_demand_score')} placeholder="90" type="number" />
        </Field>

        <Field label="5-Yr Appreciation Potential (%)">
          <Input value={form.appreciation_potential_5yr || ''} onChange={set('appreciation_potential_5yr')} placeholder="14.5" type="number" step="0.1" />
        </Field>

        <Field label="Annual Rental Yield (%)">
          <Input value={form.rental_yield_annual_percent || ''} onChange={set('rental_yield_annual_percent')} placeholder="4.5" type="number" step="0.1" />
        </Field>

        <Field label="Regulatory Approvals Status">
          <Input value={form.approvals_status || ''} onChange={set('approvals_status')} placeholder="Fully Approved by RERA" />
        </Field>

        <Field label="Registry Status">
          <Input value={form.registry_status || ''} onChange={set('registry_status')} placeholder="open" />
        </Field>

        <SectionHeader title="Living Infrastructure, Utilities & Architecture (2026 Standards)" />

        <Field label="Water Supply Source" hint="e.g. Ganga Jal Pipeline (Noida Authority) + Centralized WTP">
          <Input value={form.water_source || ''} onChange={set('water_source')} placeholder="Ganga Jal Pipeline + Centralized WTP" />
        </Field>

        <Field label="DG Power Backup Rate (₹/kWh)" hint="Tariff charged per unit on generator power">
          <Input value={form.dg_power_rate_per_unit || ''} onChange={set('dg_power_rate_per_unit')} placeholder="21.00" type="number" step="0.5" />
        </Field>

        <Field label="Monthly Maintenance (₹/sq.ft)" hint="Recurring maintenance rate per sq.ft per month">
          <Input value={form.maintenance_per_sqft_monthly || ''} onChange={set('maintenance_per_sqft_monthly')} placeholder="2.75" type="number" step="0.1" />
        </Field>

        <Field label="Clear Ceiling Height (ft)" hint="Internal floor-to-ceiling slab height">
          <Input value={form.ceiling_height_ft || ''} onChange={set('ceiling_height_ft')} placeholder="10.2" type="number" step="0.1" />
        </Field>

        <Field label="Lifts Per Tower" hint="Passenger / high-speed elevators count">
          <Input value={form.lifts_per_tower || ''} onChange={set('lifts_per_tower')} placeholder="3" type="number" />
        </Field>

        <Field label="Privacy & Shared Walls Layout" hint="e.g. Zero Shared Walls / 3-Side Open Layout">
          <Input value={form.shared_walls_type || ''} onChange={set('shared_walls_type')} placeholder="Zero Shared Walls / 3-Side Open Layout" />
        </Field>

        <Field label="Land Tenure" hint="e.g. 99-Year Authority Leasehold or Freehold">
          <Input value={form.land_tenure || ''} onChange={set('land_tenure')} placeholder="99-Year Authority Leasehold" />
        </Field>

        <Field label="Mobile Network Rating (1-5)" hint="Airtel/Jio 5G connectivity score inside towers">
          <Input value={form.mobile_network_rating || ''} onChange={set('mobile_network_rating')} placeholder="4" type="number" min="1" max="5" />
        </Field>

        <Field label="Service Elevator">
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={!!form.has_service_lift}
              onChange={(e) => setForm((f) => ({ ...f, has_service_lift: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Dedicated Service / Stretcher Lift Available</span>
          </label>
        </Field>

        <Field label="PNG Gas Pipeline">
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={!!form.has_png_gas_pipeline}
              onChange={(e) => setForm((f) => ({ ...f, has_png_gas_pipeline: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Piped Natural Gas (PNG) Connection Active</span>
          </label>
        </Field>

        <Field label="Authority Dues Cleared">
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={!!form.authority_dues_cleared}
              onChange={(e) => setForm((f) => ({ ...f, authority_dues_cleared: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Authority Land Dues 100% Cleared by Builder</span>
          </label>
        </Field>

        <Field label="Pet Friendly">
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={!!form.pet_friendly}
              onChange={(e) => setForm((f) => ({ ...f, pet_friendly: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Society Permits Pets</span>
          </label>
        </Field>

        <Field label="Bachelor Tenants Allowed">
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={!!form.bachelor_tenants_allowed}
              onChange={(e) => setForm((f) => ({ ...f, bachelor_tenants_allowed: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">RWA Permits Bachelor Tenants</span>
          </label>
        </Field>

        <SectionHeader title="Forensic Due Diligence & Living Quality (Day 3 Expansion)" />

        <Field label="Occupancy Certificate (OC) Status" hint="Legal handover & occupancy approval status">
          <CustomSelect
            value={form.oc_status || ''}
            onChange={(val) => setForm((f) => ({ ...f, oc_status: (val || undefined) as any }))}
            options={[
              { value: '', label: 'Not verified — we have not checked this project' },
              { value: 'FULL_OC', label: 'Full OC Granted (All Towers Live)' },
              { value: 'PHASED_OC', label: 'Phased OC (Specific Towers Only)' },
              { value: 'APPLIED', label: 'OC Applied (Pending Authority Inspection)' },
              { value: 'NONE', label: 'No OC / Under Construction' },
            ]}
          />
        </Field>

        <Field label="OC Details & Tower Specifics" hint="e.g. Towers A-C have full OC, Tower D inspection pending">
          <Input value={form.oc_details || ''} onChange={set('oc_details')} placeholder="Towers A, B & C possess Full OC issued Jan 2024" />
        </Field>

        <Field label="Water Source Type" hint="Civic piped source vs groundwater reliance">
          <CustomSelect
            value={form.water_source_type || ''}
            onChange={(val) => setForm((f) => ({ ...f, water_source_type: (val || undefined) as any }))}
            options={[
              { value: '', label: 'Not verified — we have not checked this project' },
              { value: 'GANGA_JAL', label: 'Pure Ganga Jal Pipeline (Authority Supply)' },
              { value: 'MIXED', label: 'Mixed Supply (Authority Ganga Jal + Borewell Blend)' },
              { value: 'BOREWELL', label: 'Borewell Groundwater Dominant' },
            ]}
          />
        </Field>

        <Field label="Water TDS Range (ppm)" hint="Actual tested Total Dissolved Solids in drinking supply">
          <Input value={form.water_tds_range || ''} onChange={set('water_tds_range')} placeholder="180-250 ppm (Treated Ganga Jal)" />
        </Field>

        <Field label="Power Supply Metering Type" hint="Government direct tariff vs private single point billing">
          <CustomSelect
            value={form.power_supply_type || ''}
            onChange={(val) => setForm((f) => ({ ...f, power_supply_type: (val || undefined) as any }))}
            options={[
              { value: '', label: 'Not verified — we have not checked this project' },
              { value: 'PVVNL_MULTIPOINT', label: 'PVVNL Individual Multipoint Meter (UP Govt Tariff)' },
              { value: 'SINGLE_POINT_BULK', label: 'Single Point Bulk Supply (Sub-metered through Builder/RWA)' },
            ]}
          />
        </Field>

        <Field label="Landed Cost Multiplier (Over BSP)" hint="True all-in purchase cost multiplier (typically 1.28 - 1.35)">
          <Input value={form.all_in_cost_multiplier || ''} onChange={set('all_in_cost_multiplier')} placeholder="1.30" type="number" step="0.01" />
        </Field>

        <div className="col-span-1 md:col-span-2">
          <Field label="Approved Bank APF Codes" hint="Pre-approved home loan approval codes (e.g. HDFC: APF123, SBI: DEL-456, ICICI: ICI-789)">
            <Input value={form.bank_apf_codes || ''} onChange={set('bank_apf_codes')} placeholder="HDFC: APF123, SBI: DEL-456, ICICI: ICI-789" />
          </Field>
        </div>

        <Field label="Amitabh Kant Committee Relief" hint="Leave unverified unless you have seen the authority record. Unverified is not the same as No.">
          <CustomSelect
            value={form.amitabh_kant_clearance === true ? 'yes' : form.amitabh_kant_clearance === false ? 'no' : ''}
            onChange={(val) => setForm((f) => ({ ...f, amitabh_kant_clearance: val === 'yes' ? true : val === 'no' ? false : null }))}
            options={[
              { value: '', label: 'Not verified — we have not checked this project' },
              { value: 'yes', label: 'Cleared — 25% builder dues deposited for sub-lease execution' },
              { value: 'no', label: 'Not cleared — checked, and the dues are outstanding' },
            ]}
          />
        </Field>

        <Field label="UP Lifts Act 2024 Compliance" hint="No is an accusation against a named builder — only pick it if you checked updeslift.org.">
          <CustomSelect
            value={form.lift_act_compliant === true ? 'yes' : form.lift_act_compliant === false ? 'no' : ''}
            onChange={(val) => setForm((f) => ({ ...f, lift_act_compliant: val === 'yes' ? true : val === 'no' ? false : null }))}
            options={[
              { value: '', label: 'Not verified — we have not checked this project' },
              { value: 'yes', label: 'Registered — verified on updeslift.org with OEM AMC and ARD' },
              { value: 'no', label: 'Not registered — checked, and no registration exists' },
            ]}
          />
        </Field>

        <Field label="Shahdara Drain Proximity Risk" hint="No renders to buyers as a clean-zone finding. Leave unverified unless the corridor distance was measured.">
          <CustomSelect
            value={form.shahdara_drain_impact === true ? 'yes' : form.shahdara_drain_impact === false ? 'no' : ''}
            onChange={(val) => setForm((f) => ({ ...f, shahdara_drain_impact: val === 'yes' ? true : val === 'no' ? false : null }))}
            options={[
              { value: '', label: 'Not verified — we have not checked this project' },
              { value: 'yes', label: 'Within the corridor — seasonal odour and metallic corrosion risk within 800m' },
              { value: 'no', label: 'Outside the corridor — distance measured' },
            ]}
          />
        </Field>

        <SectionHeader title="AI & Marketing" />

        <div className="col-span-1 md:col-span-2">
          <Field label="Marketing Claims" hint="Key selling points — press Enter after each">
            <TagInput
              tags={form.marketing_claims}
              onChange={(v) => setForm((f) => ({ ...f, marketing_claims: v }))}
              placeholder="e.g. 70% green area"
            />
          </Field>
        </div>

        <div className="col-span-1 md:col-span-2">
          <Field label="AI Search Keywords" hint="Terms the AI uses to match this project to queries">
            <TagInput
              tags={form.ai_search_keywords}
              onChange={(v) => setForm((f) => ({ ...f, ai_search_keywords: v }))}
              placeholder="e.g. peaceful expressway metro"
            />
          </Field>
        </div>

      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-6 mt-4 border-t border-zinc-200/80 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 border border-zinc-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#0066cc] hover:bg-[#0077ed] text-white rounded-xl text-xs font-medium shadow-xs disabled:opacity-50 transition-all cursor-pointer active:scale-[0.98]"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          <span>{saving ? 'Saving...' : projectId ? 'Save Changes' : 'Create Project'}</span>
        </button>
      </div>
    </form>
  )
}
