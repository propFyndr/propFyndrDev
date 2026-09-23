'use client'

import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Save, CheckCircle2, AlertCircle,
  Building2, Shield, Layers, Tag, ChevronDown, RefreshCw
} from 'lucide-react'
import { adminFetch } from '@/lib/adminFetch'
import Toast from '@/components/Toast'
import CustomSelect from './CustomSelect'

export const SPEC_CATEGORIES = [
  { id: 'structure', label: 'Structure & Safety', desc: 'Frame, seismic rating, foundation' },
  { id: 'flooring', label: 'Flooring & Finishes', desc: 'Living, bedrooms, balconies, lobby' },
  { id: 'kitchen', label: 'Kitchen & Countertops', desc: 'Modular kitchen, granite, gas pipeline' },
  { id: 'bathrooms', label: 'Sanitary & CP Fittings', desc: 'Fixtures, CP fittings, geysers' },
  { id: 'doors_windows', label: 'Doors & Windows', desc: 'Main door, UPVC/Aluminium windows' },
  { id: 'electrical', label: 'Electrical & Switches', desc: 'Wiring, modular switches, power backup' },
  { id: 'plumbing', label: 'Plumbing & Water', desc: 'Pipes, solar heating, treated water' },
  { id: 'lifts', label: 'Elevators & Lifts', desc: 'High-speed passenger & service lifts' },
  { id: 'security', label: 'Security & Automation', desc: 'CCTV, video door phone, smart locks' },
  { id: 'sustainability', label: 'Green & Sustainability', desc: 'Rainwater harvesting, IGBC rating' },
  { id: 'parking', label: 'Parking & EV', desc: 'Covered parking, EV charging ports' },
] as const

export const SPEC_TIERS = [
  { id: 'standard', label: 'Standard', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
  { id: 'premium', label: 'Premium', color: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300' },
  { id: 'luxury', label: 'Luxury', color: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' },
] as const

export function normalizeSpecCategory(cat: string): string {
  if (!cat) return 'structure'
  const trimmed = cat.trim().toLowerCase()
  const map: Record<string, string> = {
    'structure': 'structure',
    'structure & safety': 'structure',
    'flooring': 'flooring',
    'flooring & finishes': 'flooring',
    'balcony': 'flooring',
    'kitchen': 'kitchen',
    'kitchen & countertops': 'kitchen',
    'sanitaryware': 'bathrooms',
    'sanitary': 'bathrooms',
    'bathrooms': 'bathrooms',
    'bathroom': 'bathrooms',
    'sanitary & cp fittings': 'bathrooms',
    'doors & windows': 'doors_windows',
    'doors_windows': 'doors_windows',
    'doors and windows': 'doors_windows',
    'doors': 'doors_windows',
    'windows': 'doors_windows',
    'electrical': 'electrical',
    'electrical & switches': 'electrical',
    'plumbing': 'plumbing',
    'plumbing & water': 'plumbing',
    'lifts': 'lifts',
    'elevators & lifts': 'lifts',
    'elevators': 'lifts',
    'security': 'security',
    'security & automation': 'security',
    'green': 'sustainability',
    'sustainability': 'sustainability',
    'green & sustainability': 'sustainability',
    'parking': 'parking',
    'parking & ev': 'parking',
  }
  return map[trimmed] || trimmed.replace(/\s+/g, '_')
}

export interface SpecItem {
  id?: string
  project_id?: string
  unit_type_id?: string | null
  category: string
  label: string
  value: string
  brand?: string | null
  tier?: string | null
  is_highlight?: boolean
  sort_order?: number
  notes?: string | null
  unit_type?: { id: string; name: string; bhk: number } | null
}

interface SpecEditorProps {
  projectId: string
  unitTypes?: Array<{ id: string; name: string; bhk: number }>
  initialSpecs?: SpecItem[]
  specs?: SpecItem[]
  onSpecsChange?: (specs: SpecItem[]) => void
  onSaved?: () => void
}

const COMMON_PRESETS: Array<Omit<SpecItem, 'id'>> = [
  { category: 'structure', label: 'Structure Type', value: 'Earthquake Resistant Mivan RCC Shear Wall Construction (Zone IV)', brand: 'Mivan Tech', tier: 'premium', is_highlight: true },
  { category: 'flooring', label: 'Living & Dining', value: 'Imported Italian Marble / Large Format Glazed Vitrified Tiles', brand: 'Kajaria / Imported', tier: 'luxury', is_highlight: true },
  { category: 'flooring', label: 'Master Bedroom', value: 'Laminated Engineered Wooden Flooring with AC4 Grade', brand: 'Pergo / QuickStep', tier: 'premium', is_highlight: false },
  { category: 'bathrooms', label: 'Sanitary Fixtures', value: 'Wall-hung EWCs with Concealed Dual-Flush Cisterns', brand: 'Kohler / Grohe', tier: 'luxury', is_highlight: true },
  { category: 'doors_windows', label: 'Main Entrance Door', value: '8ft High Teak Wood Frame with Veneer Polished Flush Door & Digital Smart Lock', brand: 'Yale / Godrej', tier: 'luxury', is_highlight: true },
  { category: 'kitchen', label: 'Countertop & Sink', value: 'Polished Granite Slab with Double Bowl Stainless Steel Sink & Piped Gas Provision', brand: 'Franke / Carysil', tier: 'premium', is_highlight: false },
  { category: 'electrical', label: 'Switches & Wiring', value: 'Concealed FRLS Copper Wiring with Modular Smart Touch Switches & 100% DG Backup', brand: 'Schneider / Legrand', tier: 'premium', is_highlight: false },
  { category: 'lifts', label: 'Passenger Elevators', value: 'High-Speed Automatic Elevators with Automatic Rescue Device (ARD)', brand: 'Schindler / Otis', tier: 'premium', is_highlight: false },
  { category: 'security', label: 'Access & Surveillance', value: '3-Tier Security with 24x7 HD CCTV, Video Door Phone & RFID Boom Barrier', brand: 'Hikvision', tier: 'premium', is_highlight: false },
]

export default function SpecEditor({
  projectId,
  unitTypes = [],
  initialSpecs = [],
  specs: specsProp,
  onSpecsChange,
  onSaved,
}: SpecEditorProps) {
  const sanitizeSpecs = (items: SpecItem[]) =>
    items.map(s => ({
      ...s,
      category: normalizeSpecCategory(s.category),
    }))

  const [specs, setSpecs] = useState<SpecItem[]>(
    specsProp && specsProp.length > 0 ? sanitizeSpecs(specsProp) : sanitizeSpecs(initialSpecs)
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({})

  useEffect(() => {
    if (specsProp && specsProp.length > 0) {
      setSpecs(sanitizeSpecs(specsProp))
    }
  }, [specsProp])

  const fetchSpecs = async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`/admin/projects/${projectId}/specs`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.specs)) {
          setSpecs(data.specs)
          onSpecsChange?.(data.specs)
        }
      }
    } catch (err) {
      console.error('[SpecEditor] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId && initialSpecs.length === 0 && (!specsProp || specsProp.length === 0)) {
      fetchSpecs()
    }
  }, [projectId])

  const handleAddSpec = (category = 'structure') => {
    const newSpec: SpecItem = {
      category,
      label: '',
      value: '',
      brand: null,
      tier: 'premium',
      is_highlight: false,
      sort_order: specs.length + 1,
      unit_type_id: null,
    }
    setSpecs(prev => [newSpec, ...prev])
  }

  const handleApplyPresets = () => {
    if (specs.length > 0 && !confirm(`Replace all ${specs.length} specifications with luxury presets?`)) {
      return
    }
    setSpecs(COMMON_PRESETS)
    setValidationErrors({})
    setToast({ message: `Loaded ${COMMON_PRESETS.length} luxury specifications presets`, type: 'success' })
  }

  const handleUpdate = (index: number, field: keyof SpecItem, value: any) => {
    setSpecs(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleDelete = (index: number) => {
    setSpecs(prev => prev.filter((_, i) => i !== index))
  }

  const validateSpecs = (): Record<number, string[]> => {
    const errors: Record<number, string[]> = {}
    specs.forEach((spec, idx) => {
      const errs: string[] = []
      if (!spec.label?.trim()) errs.push('Label required')
      if (!spec.value?.trim()) errs.push('Value required')
      if (errs.length > 0) errors[idx] = errs
    })
    return errors
  }

  const handleSave = async () => {
    const errors = validateSpecs()
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) {
      setToast({ message: `Fix ${Object.keys(errors).length} validation error(s)`, type: 'error' })
      return
    }

    setSaving(true)
    try {
      const res = await adminFetch(`/admin/projects/${projectId}/specs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specs }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Failed to save specifications')
      }

      const data = await res.json()
      if (Array.isArray(data.specs)) {
        setSpecs(data.specs)
        onSpecsChange?.(data.specs)
      }
      setValidationErrors({})
      setToast({ message: 'Specifications saved successfully!', type: 'success' })
      onSaved?.()
    } catch (err: any) {
      setToast({ message: err.message || 'Error saving specifications', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const filteredSpecs = selectedCategoryFilter === 'all'
    ? specs
    : specs.filter(s => normalizeSpecCategory(s.category) === selectedCategoryFilter)

  return (
    <div className="bg-white dark:bg-[#121214] rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6 md:p-8 space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Layers size={16} />
            </div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              Construction &amp; Material Specifications
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Define architectural materials, brands, fittings, and finishes. Highlight items show in the public buyer card.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleApplyPresets}
            className="px-3 py-1.5 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 hover:border-blue-500 text-xs font-bold text-gray-700 dark:text-gray-300 transition-all flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <Layers size={13} className="text-blue-500" />
            <span>Load Presets</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddSpec(selectedCategoryFilter === 'all' ? 'structure' : selectedCategoryFilter)}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Spec</span>
          </button>
        </div>
      </div>

      {/* Category Filter Chips - Wrapped Cleanly Without Horizontal Scroll */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setSelectedCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
            selectedCategoryFilter === 'all'
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs font-bold'
              : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70'
          }`}
        >
          All Categories ({specs.length})
        </button>
        {SPEC_CATEGORIES.map(cat => {
          const count = specs.filter(s => normalizeSpecCategory(s.category) === cat.id).length
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedCategoryFilter === cat.id
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70'
              }`}
            >
              <span>{cat.label}</span>
              {count > 0 && <span className="text-[10px] opacity-80 font-bold">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-8 rounded-2xl border border-gray-200 dark:border-white/10 text-center space-y-3">
          <div className="flex justify-center">
            <RefreshCw size={20} className="text-gray-400 dark:text-gray-600 animate-spin" />
          </div>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Loading specifications...</p>
        </div>
      )}

      {/* Specifications List */}
      {!loading && filteredSpecs.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-center space-y-3">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">No specifications added in this category yet.</p>
          <button
            type="button"
            onClick={() => handleAddSpec(selectedCategoryFilter === 'all' ? 'structure' : selectedCategoryFilter)}
            className="px-4 py-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-black rounded-xl border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 cursor-pointer"
          >
            + Add First Specification
          </button>
        </div>
      ) : !loading && (
        <div className="space-y-4">

          {filteredSpecs.map((spec, idx) => {
            const canonicalCat = normalizeSpecCategory(spec.category)
            const catObj = SPEC_CATEGORIES.find(c => c.id === canonicalCat) || SPEC_CATEGORIES[0]
            const realIdx = specs.indexOf(spec)

            return (
              <div
                key={spec.id || realIdx}
                className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3 transition-all hover:border-zinc-300 dark:hover:border-zinc-600"
              >
                {/* Top Row: Category, Tier, Unit, Highlight, Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CustomSelect
                      value={canonicalCat}
                      onChange={val => handleUpdate(realIdx, 'category', val)}
                      options={SPEC_CATEGORIES.map(c => ({ value: c.id, label: c.label }))}
                      size="sm"
                      className="w-48"
                    />

                    <CustomSelect
                      value={spec.tier || 'premium'}
                      onChange={val => handleUpdate(realIdx, 'tier', val)}
                      options={SPEC_TIERS.map(t => ({ value: t.id, label: `${t.label} Tier` }))}
                      size="sm"
                      className="w-36"
                    />

                    {unitTypes.length > 0 && (
                      <CustomSelect
                        value={spec.unit_type_id || ''}
                        onChange={val => handleUpdate(realIdx, 'unit_type_id', val || null)}
                        options={[
                          { value: '', label: 'All Units (Project-Wide)' },
                          ...unitTypes.map(u => ({ value: u.id, label: `Only for ${u.name} (${u.bhk} BHK)` }))
                        ]}
                        size="sm"
                        className="w-56"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={spec.is_highlight || false}
                        onChange={e => handleUpdate(realIdx, 'is_highlight', e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                      />
                      <span>Highlight</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDelete(realIdx)}
                      className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                      title="Delete specification"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Validation Errors */}
                {validationErrors[realIdx] && (
                  <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg flex items-start gap-2">
                    <AlertCircle size={14} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-red-700 dark:text-red-300 space-y-0.5">
                      {validationErrors[realIdx].map((err, i) => <div key={i}>• {err}</div>)}
                    </div>
                  </div>
                )}

                {/* Input Fields */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider block">
                      Feature / Component Label *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Master Bedroom Flooring"
                      value={spec.label}
                      onChange={e => {
                        handleUpdate(realIdx, 'label', e.target.value)
                        if (validationErrors[realIdx]) setValidationErrors(prev => ({ ...prev, [realIdx]: prev[realIdx].filter(e => !e.includes('Label')) }))
                      }}
                      className={`w-full px-3 py-2 text-xs font-extrabold border rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder:text-gray-400 transition-colors ${
                        validationErrors[realIdx]?.some(e => e.includes('Label'))
                          ? 'border-red-300 dark:border-red-700'
                          : 'border-gray-200 dark:border-zinc-700'
                      }`}
                    />
                  </div>

                  <div className="md:col-span-5 space-y-1">
                    <label className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider block">
                      Specification &amp; Material Value *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Engineered laminated wooden flooring (AC4 grade)"
                      value={spec.value}
                      onChange={e => {
                        handleUpdate(realIdx, 'value', e.target.value)
                        if (validationErrors[realIdx]) setValidationErrors(prev => ({ ...prev, [realIdx]: prev[realIdx].filter(e => !e.includes('Value')) }))
                      }}
                      className={`w-full px-3 py-2 text-xs font-bold border rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder:text-gray-400 transition-colors ${
                        validationErrors[realIdx]?.some(e => e.includes('Value'))
                          ? 'border-red-300 dark:border-red-700'
                          : 'border-gray-200 dark:border-zinc-700'
                      }`}
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider block">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kohler, QuickStep"
                      value={spec.brand || ''}
                      onChange={e => handleUpdate(realIdx, 'brand', e.target.value || null)}
                      className="w-full px-3 py-2 text-xs font-bold border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* Notes Field */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider block">
                    Internal Notes (Admin Only)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified on site visit, pending brand confirmation"
                    value={spec.notes || ''}
                    onChange={e => handleUpdate(realIdx, 'notes', e.target.value || null)}
                    className="w-full px-3 py-2 text-xs font-medium border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Save Button Bar */}
      <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400">
          {specs.length} total specifications ({specs.filter(s => s.is_highlight).length} highlighted)
        </span>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          <span>{saving ? 'Saving Specs...' : 'Save Specifications'}</span>
        </button>
      </div>
    </div>
  )
}
