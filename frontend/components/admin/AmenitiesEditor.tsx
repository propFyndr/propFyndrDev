'use client'

import { useState } from 'react'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'
import { API_BASE } from '@/lib/env'
import { adminAuthHeaders } from '@/lib/authedFetch'
import CustomSelect from './CustomSelect'

type AmenityCategory = 'sports' | 'lifestyle' | 'wellness' | 'kids' | 'security' | 'parking'

interface Amenity {
  id: string
  name: string
  category: AmenityCategory
}

interface Props {
  amenities: Amenity[]
  projectId: string
  onSaved: () => Promise<void>
}

const CATEGORIES: AmenityCategory[] = ['sports', 'lifestyle', 'wellness', 'kids', 'security', 'parking']

const CATEGORY_LABELS: Record<AmenityCategory, string> = {
  sports:    'Sports',
  lifestyle: 'Lifestyle',
  wellness:  'Wellness',
  kids:      'Kids',
  security:  'Security',
  parking:   'Parking',
}

interface NewRow {
  name: string
  category: AmenityCategory
}

export default function AmenitiesEditor({ amenities: initial, projectId, onSaved }: Props) {
  const [rows, setRows]     = useState<Amenity[]>(initial)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [newRow, setNewRow] = useState<NewRow>({ name: '', category: 'lifestyle' })

  const handleDelete = async (id: string) => {
    setRows(r => r.filter(x => x.id !== id))
    try {
      const res = await fetch(`${API_BASE}/admin/amenities/${id}`, { method: 'DELETE', headers: adminAuthHeaders() })
      if (!res.ok) throw new Error('Delete failed')
      await onSaved()
    } catch {
      setError('Delete failed')
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}`, { headers: adminAuthHeaders() })
      const json = await res.json()
      setRows(json.project?.amenities ?? initial)
    }
  }

  const handleAdd = async () => {
    if (!newRow.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/amenities`, {
        method:      'POST',
        headers:     { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
        body:        JSON.stringify({ name: newRow.name.trim(), category: newRow.category }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Add failed') }
      const { amenity } = await res.json()
      setRows(r => [...r, amenity])
      setNewRow({ name: '', category: 'lifestyle' })
      setAdding(false)
      await onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Add failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xs p-6 md:p-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100">Amenities</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{rows.length} entries configured</p>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#0066cc] dark:text-[#3399ff] bg-[#0066cc]/10 hover:bg-[#0066cc]/15 border border-[#0066cc]/20 px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-[0.98]"
        >
          <Plus size={13} />
          <span>{adding ? 'Cancel' : 'Add Amenity'}</span>
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 mb-3">{error}</p>
      )}

      {/* Add row */}
      {adding && (
        <div className="flex flex-wrap sm:flex-nowrap gap-2.5 mb-4 p-3 bg-zinc-50 dark:bg-zinc-850/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
          <input
            value={newRow.name}
            onChange={e => setNewRow(r => ({ ...r, name: e.target.value }))}
            placeholder="Amenity name (e.g. Olympic Swimming Pool)"
            className="flex-1 text-[13px] bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700 rounded-xl h-9 px-3 outline-none focus:border-[#0066cc] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 shadow-2xs"
          />
          <CustomSelect
            value={newRow.category}
            onChange={val => setNewRow(r => ({ ...r, category: val as AmenityCategory }))}
            options={CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))}
            size="sm"
            className="w-36"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newRow.name.trim()}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#0066cc] hover:bg-[#0077ed] disabled:opacity-50 px-3.5 h-9 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            <span>Save</span>
          </button>
        </div>
      )}

      {/* Existing rows */}
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-6">No amenities added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rows.map(a => (
            <div
              key={a.id}
              className="group flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/70 px-3 py-1.5 rounded-full shadow-2xs transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
            >
              <span>{a.name}</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">({CATEGORY_LABELS[a.category]})</span>
              <button
                onClick={() => handleDelete(a.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                title="Delete amenity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

