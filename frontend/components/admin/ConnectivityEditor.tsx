'use client'

import { useState } from 'react'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'
import { API_BASE } from '@/lib/env'
import { adminAuthHeaders } from '@/lib/authedFetch'
import CustomSelect from './CustomSelect'

type ConnType = 'metro' | 'road' | 'expressway' | 'school' | 'hospital' | 'mall' | 'landmark' | 'airport' | 'university'
type DataSource = 'brochure' | 'google' | 'estimated' | 'manual'

interface ConnEntry {
  id: string
  type: ConnType
  name: string
  distance_km: number | null
  data_source: DataSource
  notes: string | null
}

interface Props {
  connectivity: ConnEntry[]
  projectId: string
  onSaved: () => Promise<void>
}

const TYPES: ConnType[] = ['metro', 'road', 'expressway', 'school', 'hospital', 'mall', 'landmark', 'airport', 'university']
const SOURCES: DataSource[] = ['brochure', 'google', 'estimated', 'manual']

const TYPE_LABELS: Record<ConnType, string> = {
  metro:      'Metro',
  road:       'Road',
  expressway: 'Expressway',
  school:     'School',
  hospital:   'Hospital',
  mall:       'Mall',
  landmark:   'Landmark',
  airport:    'Airport',
  university: 'University',
}

interface NewRow {
  type: ConnType
  name: string
  distance_km: string
  data_source: DataSource
  notes: string
}

export default function ConnectivityEditor({ connectivity: initial, projectId, onSaved }: Props) {
  const [rows, setRows]     = useState<ConnEntry[]>(initial)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [newRow, setNewRow] = useState<NewRow>({ type: 'metro', name: '', distance_km: '', data_source: 'brochure', notes: '' })

  const handleDelete = async (id: string) => {
    setRows(r => r.filter(x => x.id !== id))
    try {
      const res = await fetch(`${API_BASE}/admin/connectivity/${id}`, { method: 'DELETE', headers: adminAuthHeaders() })
      if (!res.ok) throw new Error('Delete failed')
      await onSaved()
    } catch {
      setError('Delete failed')
      setRows(initial)
    }
  }

  const handleAdd = async () => {
    if (!newRow.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        type:        newRow.type,
        name:        newRow.name.trim(),
        data_source: newRow.data_source,
      }
      if (newRow.distance_km) body.distance_km = parseFloat(newRow.distance_km)
      if (newRow.notes.trim()) body.notes = newRow.notes.trim()
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/connectivity`, {
        method:      'POST',
        headers:     { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
        body:        JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Add failed') }
      const { entry } = await res.json()
      setRows(r => [...r, entry])
      setNewRow({ type: 'metro', name: '', distance_km: '', data_source: 'brochure', notes: '' })
      setAdding(false)
      await onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Add failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xs p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Connectivity & Transit</h2>
          <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">{rows.length} transit & landmark milestones</p>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#0066cc] dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/40 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-2xs"
        >
          <Plus size={13} />
          {adding ? 'Cancel' : 'Add Point'}
        </button>
      </div>

      {error && <p className="text-[12px] text-rose-500">{error}</p>}

      {adding && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-50/70 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
          <CustomSelect
            value={newRow.type}
            onChange={val => setNewRow(r => ({ ...r, type: val as ConnType }))}
            options={TYPES.map(t => ({ value: t, label: TYPE_LABELS[t] }))}
            size="sm"
            className="w-full"
          />
          <input
            value={newRow.name}
            onChange={e => setNewRow(r => ({ ...r, name: e.target.value }))}
            placeholder="Name (e.g. Botanical Garden Metro)"
            className="text-[13px] font-medium bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2 outline-none focus:border-[#0066cc] text-zinc-900 dark:text-zinc-100 shadow-2xs"
          />
          <input
            value={newRow.distance_km}
            onChange={e => setNewRow(r => ({ ...r, distance_km: e.target.value }))}
            placeholder="Distance (km)"
            type="number"
            step="0.1"
            className="text-[13px] font-medium font-mono bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2 outline-none focus:border-[#0066cc] text-zinc-900 dark:text-zinc-100 shadow-2xs"
          />
          <CustomSelect
            value={newRow.data_source}
            onChange={val => setNewRow(r => ({ ...r, data_source: val as DataSource }))}
            options={SOURCES.map(s => ({ value: s, label: s.replace(/\b\w/g, l => l.toUpperCase()) }))}
            size="sm"
            className="w-full"
          />
          <div className="col-span-1 sm:col-span-2 flex gap-2">
            <input
              value={newRow.notes}
              onChange={e => setNewRow(r => ({ ...r, notes: e.target.value }))}
              placeholder="Notes (optional, e.g. 5 min walk)"
              className="flex-1 text-[13px] bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2 outline-none focus:border-[#0066cc] text-zinc-900 dark:text-zinc-100 shadow-2xs"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newRow.name.trim()}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-white bg-[#0066cc] hover:bg-[#0055b3] disabled:opacity-50 px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-[12.5px] text-zinc-400 text-center py-6">No connectivity entries yet.</p>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map(c => (
            <div key={c.id} className="group flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full uppercase tracking-wider border border-zinc-200/50 dark:border-zinc-700/50">
                  {TYPE_LABELS[c.type]}
                </span>
                <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{c.name}</span>
                {c.distance_km != null && (
                  <span className="text-[11.5px] font-mono font-medium text-zinc-500 dark:text-zinc-400">{c.distance_km} km</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-500 p-1.5 transition-all cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

