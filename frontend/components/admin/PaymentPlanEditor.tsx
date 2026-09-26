'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Save, FileText, CheckCircle2, Award, Zap, Percent, Clock } from 'lucide-react'
import { API_BASE } from '@/lib/env'
import { toast } from 'sonner'
import { adminAuthHeaders } from '@/lib/authedFetch'

const PLAN_TYPES = [
  { id: 'construction_linked', name: 'Construction Linked (CLP)' },
  { id: 'flexi', name: 'Flexi Payment Plan' },
  { id: 'down_payment', name: 'Down Payment Plan' },
  { id: 'investor', name: 'Investor Plan' },
  { id: 'possession_linked', name: 'Possession Linked (PLP)' },
  { id: 'nri', name: 'NRI Remittance Plan' }
]

export default function PaymentPlanEditor({ projectId, initialData }: { projectId: string; initialData?: any }) {
  const [plans, setPlans] = useState<any[]>([])
  const [activeType, setActiveType] = useState<string>('construction_linked')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/payment-plans`, {
        headers: adminAuthHeaders()
      })
      if (res.ok) {
        const d = await res.json()
        if (Array.isArray(d.payment_plans) && d.payment_plans.length > 0) {
          setPlans(d.payment_plans)
          return
        }
      }
      if (initialData) setPlans([initialData])
    } catch (err) {
      console.warn('[PaymentPlanEditor] fetch failed, using initial data:', err)
      if (initialData) setPlans([initialData])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [projectId])

  const currentPlan = plans.find(p => p.plan_type === activeType) || {
    plan_type: activeType,
    plan_name: PLAN_TYPES.find(t => t.id === activeType)?.name || 'Custom Plan',
    description: '',
    milestones: [],
    down_payment_pct: 10,
    booking_amount_lakh: 5,
    discount_offered_pct: 0,
    best_for: '',
    watch_out: ''
  }

  const updateCurrentPlan = (field: string, val: any) => {
    const exists = plans.some(p => p.plan_type === activeType)
    let updated: any[]
    if (exists) {
      updated = plans.map(p => p.plan_type === activeType ? { ...p, [field]: val } : p)
    } else {
      updated = [...plans, { ...currentPlan, [field]: val }]
    }
    setPlans(updated)
  }

  const addMilestone = () => {
    const ms = currentPlan.milestones || []
    updateCurrentPlan('milestones', [...ms, { milestone: 'New Milestone', pct: 0, amt: 0, due: '', done: false }])
  }

  const updateMilestone = (i: number, key: string, val: any) => {
    const ms = [...(currentPlan.milestones || [])]
    ms[i] = { ...ms[i], [key]: val }
    updateCurrentPlan('milestones', ms)
  }

  const removeMilestone = (i: number) => {
    const ms = (currentPlan.milestones || []).filter((_: any, idx: number) => idx !== i)
    updateCurrentPlan('milestones', ms)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/payment-plans`, {
        method: 'PUT',
        headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ payment_plans: plans }),
      })
      if (!res.ok) throw new Error('Failed to save payment plans')
      toast.success('All payment plans saved successfully')
    } catch (e: any) {
      toast.error(e.message || 'Error saving payment plans')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xs border border-zinc-200/90 dark:border-zinc-800 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
            <FileText size={17} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Payment Plans Arsenal ({plans.length} Configured)</h3>
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">Configure multi-plan structures, upfront discounts, and stage milestones.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#0066cc] hover:bg-[#0055b3] text-white px-4 py-2 rounded-xl text-[13px] font-medium flex items-center gap-2 transition-colors shadow-2xs disabled:opacity-50"
        >
          <Save size={14} /> {saving ? 'Saving...' : 'Save All Plans'}
        </button>
      </div>

      {/* Plan Type Selector Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/70 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 overflow-x-auto [scrollbar-width:none]">
        {PLAN_TYPES.map(t => {
          const isConfigured = plans.some(p => p.plan_type === t.id)
          const isActive = activeType === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <span>{t.name}</span>
              {isConfigured && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#0066cc]' : 'bg-emerald-500'}`} />}
            </button>
          )
        })}
      </div>

      {/* Selected Plan Details Form */}
      <div className="space-y-4 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Plan Display Name</label>
            <input
              value={currentPlan.plan_name || ''}
              onChange={(e) => updateCurrentPlan('plan_name', e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3.5 py-2 text-[13px] font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10 outline-none transition-all shadow-2xs"
              placeholder="e.g. Construction Linked Plan (10:90 CLP)"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Description Summary</label>
            <input
              value={currentPlan.description || ''}
              onChange={(e) => updateCurrentPlan('description', e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3.5 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10 outline-none transition-all shadow-2xs"
              placeholder="Standard stage-by-stage schedule tied to site progress."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Down Payment %</label>
            <input
              type="number"
              value={currentPlan.down_payment_pct ?? ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0
                const clamped = Math.max(0, Math.min(100, val))
                updateCurrentPlan('down_payment_pct', clamped)
              }}
              min="0"
              max="100"
              className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-1.5 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none transition-all shadow-2xs"
              placeholder="10"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Booking Amt (Lakhs)</label>
            <input
              type="number"
              value={currentPlan.booking_amount_lakh ?? ''}
              onChange={(e) => updateCurrentPlan('booking_amount_lakh', parseFloat(e.target.value) || 0)}
              className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-1.5 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none transition-all shadow-2xs"
              placeholder="5.0"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Discount Offered %</label>
            <input
              type="number"
              value={currentPlan.discount_offered_pct ?? ''}
              onChange={(e) => updateCurrentPlan('discount_offered_pct', parseFloat(e.target.value) || 0)}
              className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-1.5 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none transition-all shadow-2xs"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Tenure (Months)</label>
            <input
              type="number"
              value={currentPlan.total_duration_months ?? 36}
              onChange={(e) => updateCurrentPlan('total_duration_months', parseInt(e.target.value) || 36)}
              className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3 py-1.5 text-[13px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none transition-all shadow-2xs"
              placeholder="36"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Best For (Target Persona)</label>
            <input
              value={currentPlan.best_for || ''}
              onChange={(e) => updateCurrentPlan('best_for', e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3.5 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none transition-all shadow-2xs"
              placeholder="End users seeking risk-mitigated payments."
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Watch Out / Caveat</label>
            <input
              value={currentPlan.watch_out || ''}
              onChange={(e) => updateCurrentPlan('watch_out', e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 rounded-xl px-3.5 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none transition-all shadow-2xs"
              placeholder="Late payment penalty SBI MCLR + 2% applies."
            />
          </div>
        </div>
      </div>

      {/* Milestone List */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Stage Milestones ({currentPlan.milestones?.length || 0})</label>
          <button onClick={addMilestone} className="text-[12.5px] font-medium text-[#0066cc] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
            <Plus size={14} /> Add Stage Milestone
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {(currentPlan.milestones || []).map((m: any, i: number) => (
            <div key={i} className="grid grid-cols-[auto_minmax(180px,3fr)_minmax(80px,1fr)_minmax(100px,1.5fr)_minmax(120px,2fr)_auto] items-center gap-2 bg-zinc-50/70 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <button
                onClick={() => updateMilestone(i, 'done', !m.done)}
                className={`w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${m.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}
              >
                {m.done && <CheckCircle2 size={12} />}
              </button>
              <input
                value={m.milestone || m.stage || m.label || ''}
                onChange={(e) => updateMilestone(i, 'milestone', e.target.value)}
                className="bg-white dark:bg-zinc-900 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none"
                placeholder="Milestone description"
              />
              <input
                value={m.pct || ''}
                onChange={(e) => updateMilestone(i, 'pct', e.target.value)}
                className="bg-white dark:bg-zinc-900 rounded-lg px-2.5 py-1.5 text-[12px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none"
                placeholder="10%"
              />
              <input
                value={m.amt || ''}
                onChange={(e) => updateMilestone(i, 'amt', e.target.value)}
                className="bg-white dark:bg-zinc-900 rounded-lg px-2.5 py-1.5 text-[12px] font-medium font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none"
                placeholder="₹12.5 Lakhs"
              />
              <input
                value={m.due || m.timeline || ''}
                onChange={(e) => updateMilestone(i, 'due', e.target.value)}
                className="bg-white dark:bg-zinc-900 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 focus:border-[#0066cc] outline-none"
                placeholder="Stage 1 / Timeline"
              />
              <button onClick={() => removeMilestone(i)} className="text-zinc-400 hover:text-rose-500 p-1.5 cursor-pointer transition-colors">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
