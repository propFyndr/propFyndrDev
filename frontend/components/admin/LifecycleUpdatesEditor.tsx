'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Home, CheckCircle2, Shield, Calendar, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { adminAuthHeaders } from '@/lib/authedFetch'
import { API_BASE } from '@/lib/env'
import CustomSelect from './CustomSelect'

export interface LifecycleItem {
  id?: string
  update_type: string
  title: string
  description?: string
  update_date?: string
  impact?: string
  maintenance_fee_monthly_psf?: number | string
  note?: string
}

const UPDATE_TYPES = [
  { id: 'possession_status_change', name: 'Possession & Resident Handover' },
  { id: 'maintenance_fee_update', name: 'Maintenance Fee Revision' },
  { id: 'amenity_addition', name: 'Amenity Launch' },
  { id: 'regulatory_compliance', name: 'Regulatory & Fire NOC' },
  { id: 'infrastructure_nearby', name: 'Nearby Infra Development' },
  { id: 'building_certification', name: 'Green Building / Safety Audit' }
]

export default function LifecycleUpdatesEditor({ projectId }: { projectId: string }) {
  const [updates, setUpdates] = useState<LifecycleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchUpdates = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/lifecycle-updates`, {
        headers: adminAuthHeaders(),
      })
      if (res.ok) {
        const d = await res.json()
        if (Array.isArray(d.updates)) {
          setUpdates(d.updates)
        }
      }
    } catch {
      toast.error('Failed to load post-delivery updates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUpdates()
  }, [projectId])

  const addUpdate = () => {
    setUpdates([
      ...updates,
      {
        update_type: 'possession_status_change',
        title: 'Resident Possession Active',
        description: 'Living society with functional AOA facility management.',
        maintenance_fee_monthly_psf: 3.50,
        impact: 'Positive'
      }
    ])
  }

  const updateItem = (i: number, key: string, val: any) => {
    const updated = [...updates]
    updated[i] = { ...updated[i], [key]: val }
    setUpdates(updated)
  }

  const removeUpdate = (i: number) => {
    setUpdates(updates.filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/lifecycle-updates`, {
        method: 'PUT',
        headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) throw new Error('Failed to save post-delivery updates')
      toast.success('Post-delivery society updates saved successfully')
    } catch (err: any) {
      toast.error(err.message || 'Error saving post-delivery updates')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-32 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl animate-pulse" />
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-zinc-200/90 dark:border-zinc-800 p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
            <Home size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Post-Delivery & Society Feed
              </h3>
              <span className="px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                {updates.length} {updates.length === 1 ? 'Update' : 'Updates'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Manage RWA/AOA maintenance fees, resident handover news, and amenity launches.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#0066cc] hover:bg-[#0055b3] text-white px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 shrink-0 self-start sm:self-auto"
        >
          <Save size={14} />
          <span>{saving ? 'Saving...' : 'Save Society Updates'}</span>
        </button>
      </div>

      <div className="space-y-3">
        {updates.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">No society or lifecycle updates recorded yet.</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Add handover status, maintenance revisions, or facility updates for ready-to-move projects.</p>
          </div>
        ) : (
          updates.map((item, i) => (
            <div
              key={i}
              className="p-4 bg-zinc-50/60 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 space-y-3 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
            >
              <div className="flex flex-col sm:flex-row gap-2.5">
                <CustomSelect
                  value={item.update_type}
                  onChange={(val) => updateItem(i, 'update_type', val)}
                  options={UPDATE_TYPES.map(t => ({ value: t.id, label: t.name }))}
                  size="sm"
                  className="w-full sm:w-64 shrink-0"
                />
                <input
                  type="text"
                  placeholder="Update Title"
                  value={item.title}
                  onChange={(e) => updateItem(i, 'title', e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
                />
                <button
                  onClick={() => removeUpdate(i)}
                  className="p-2 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors self-end sm:self-center"
                  title="Delete Update"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Description detail..."
                  value={item.description || ''}
                  onChange={(e) => updateItem(i, 'description', e.target.value)}
                  className="md:col-span-2 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
                />
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Monthly Maint (₹/sqft)"
                    value={item.maintenance_fee_monthly_psf ?? ''}
                    onChange={(e) => updateItem(i, 'maintenance_fee_monthly_psf', e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-400 pointer-events-none">
                    ₹/sqft
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-1">
        <button
          onClick={addUpdate}
          className="text-xs font-semibold text-[#0066cc] hover:text-[#0055b3] bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/30 dark:hover:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/50 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <Plus size={14} /> Add Society Update
        </button>
      </div>
    </div>
  )
}
