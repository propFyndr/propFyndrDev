'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, TrendingUp, Calendar, IndianRupee } from 'lucide-react'
import { toast } from 'sonner'
import { adminAuthHeaders } from '@/lib/authedFetch'
import { API_BASE } from '@/lib/env'

export interface PricePoint {
  id?: string
  quarter_label: string
  price_per_sqft: number | string
  total_price_cr?: number | string
  event_note?: string
}

export default function PriceHistoryEditor({ projectId }: { projectId: string }) {
  const [history, setHistory] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/price-history`, {
        headers: adminAuthHeaders(),
      })
      if (res.ok) {
        const d = await res.json()
        if (Array.isArray(d.price_history)) {
          setHistory(d.price_history)
        }
      }
    } catch {
      toast.error('Failed to load price history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [projectId])

  const addPoint = () => {
    setHistory([...history, { quarter_label: 'Q1 2025', price_per_sqft: 7200, event_note: '' }])
  }

  const updatePoint = (i: number, key: string, val: any) => {
    const updated = [...history]
    updated[i] = { ...updated[i], [key]: val }
    setHistory(updated)
  }

  const removePoint = (i: number) => {
    setHistory(history.filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/price-history`, {
        method: 'PUT',
        headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ price_history: history }),
      })
      if (!res.ok) throw new Error('Failed to save price history')
      toast.success('Price history saved successfully')
    } catch (err: any) {
      toast.error(err.message || 'Error saving price history')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xs border border-zinc-200/90 dark:border-zinc-800 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/40">
            <TrendingUp size={17} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Price Appreciation History ({history.length} Points)</h3>
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">Track quarterly price-per-sqft growth and market milestones.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#0066cc] hover:bg-[#0055b3] text-white px-4 py-2 rounded-xl text-[13px] font-medium flex items-center gap-2 transition-colors shadow-2xs disabled:opacity-50"
        >
          <Save size={14} /> {saving ? 'Saving...' : 'Save Price History'}
        </button>
      </div>

      <div className="space-y-2">
        {history.map((point, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 bg-zinc-50/70 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <input
              type="text"
              placeholder="Q1 2025"
              value={point.quarter_label}
              onChange={(e) => updatePoint(i, 'quarter_label', e.target.value)}
              className="w-28 px-3 py-1.5 text-[12.5px] font-semibold font-mono border border-zinc-200/90 dark:border-zinc-700/80 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs"
            />
            <input
              type="number"
              placeholder="Price/Sqft (₹)"
              value={point.price_per_sqft}
              onChange={(e) => updatePoint(i, 'price_per_sqft', e.target.value)}
              className="w-36 px-3 py-1.5 text-[12.5px] font-semibold font-mono border border-zinc-200/90 dark:border-zinc-700/80 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs"
            />
            <input
              type="text"
              placeholder="Event Note (e.g. Metro Line Opened, Slab Cast)"
              value={point.event_note || ''}
              onChange={(e) => updatePoint(i, 'event_note', e.target.value)}
              className="flex-1 px-3 py-1.5 text-[12.5px] border border-zinc-200/90 dark:border-zinc-700/80 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs"
            />
            <button
              onClick={() => removePoint(i)}
              className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg cursor-pointer transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="pt-2">
        <button
          onClick={addPoint}
          className="text-[12.5px] font-medium text-[#0066cc] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus size={14} /> Add Price Snapshot Point
        </button>
      </div>
    </div>
  )
}
