'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, ShieldCheck, Users, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminAuthHeaders } from '@/lib/authedFetch'
import { API_BASE } from '@/lib/env'

interface ChannelPartner {
  id: string
  name: string
  type: string
  is_verified: boolean
}

interface ProjectChannelPartner {
  id: string
  channel_partner_id: string
  is_featured: boolean
  channel_partner: ChannelPartner
}

interface Props {
  projectId: string
  initialPartners?: ProjectChannelPartner[]
  onSaved?: () => void
}

export default function ChannelPartnersEditor({ projectId, initialPartners = [], onSaved }: Props) {
  const [allPartners, setAllPartners] = useState<ChannelPartner[]>([])
  const [selectedPartners, setSelectedPartners] = useState<Map<string, boolean>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/channel-partners`, {
          headers: adminAuthHeaders(),
        })
        if (res.ok) {
          const data = await res.json()
          setAllPartners(data.partners || [])
        }
      } catch (err) {
        toast.error('Failed to load channel partners')
      } finally {
        setLoading(false)
      }
    }

    const initSelected = new Map<string, boolean>()
    initialPartners.forEach(p => {
      initSelected.set(p.channel_partner_id, p.is_featured)
    })
    setSelectedPartners(initSelected)

    fetchPartners()
  }, [projectId, initialPartners])

  const handleTogglePartner = (partnerId: string) => {
    const newMap = new Map(selectedPartners)
    if (newMap.has(partnerId)) {
      newMap.delete(partnerId)
    } else {
      newMap.set(partnerId, true)
    }
    setSelectedPartners(newMap)
  }

  const handleToggleFeatured = (partnerId: string) => {
    const newMap = new Map(selectedPartners)
    if (newMap.has(partnerId)) {
      newMap.set(partnerId, !newMap.get(partnerId))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const partners = Array.from(selectedPartners.entries()).map(([id, featured]) => ({
        channel_partner_id: id,
        is_featured: featured,
      }))

      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/channel-partners`, {
        method: 'PUT',
        headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ channel_partners: partners }),
      })

      if (!res.ok) throw new Error('Failed to save channel partners')
      toast.success('Channel partners updated')
      onSaved?.()
    } catch (err: any) {
      toast.error(err.message || 'Error saving partners')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-32 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl animate-pulse" />
  }

  const activeCount = selectedPartners.size
  const featuredCount = Array.from(selectedPartners.values()).filter(Boolean).length

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Channel Partners
              </h3>
              <span className="px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                {activeCount} Selected ({featuredCount} Featured)
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Select authorized channel partners and brokers affiliated with this project.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#0066cc] hover:bg-[#0055b3] text-white font-medium rounded-xl text-xs px-4 py-2 flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 shrink-0 self-start sm:self-auto"
        >
          <Save size={14} />
          <span>{saving ? 'Saving...' : 'Save Partners'}</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {allPartners.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">No channel partners found in registry.</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Add channel partners from the main Channel Partners section to assign them here.</p>
          </div>
        ) : (
          allPartners.map(partner => {
            const isSelected = selectedPartners.has(partner.id)
            const isFeatured = !!selectedPartners.get(partner.id)

            return (
              <div
                key={partner.id}
                className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-blue-50/20 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/60 shadow-2xs'
                    : 'bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-700/60 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <input
                  type="checkbox"
                  id={`cp-${partner.id}`}
                  checked={isSelected}
                  onChange={() => handleTogglePartner(partner.id)}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-[#0066cc] focus:ring-[#0066cc]/20 cursor-pointer"
                />
                <label htmlFor={`cp-${partner.id}`} className="flex-1 cursor-pointer select-none">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{partner.name}</p>
                    {partner.is_verified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 px-1.5 py-0.2 rounded-md">
                        <CheckCircle2 size={10} /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{partner.type}</p>
                </label>

                {isSelected && (
                  <button
                    type="button"
                    onClick={() => handleToggleFeatured(partner.id)}
                    title={isFeatured ? 'Featured Channel Partner' : 'Mark as Featured'}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
                      isFeatured
                        ? 'bg-blue-50 text-[#0066cc] dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    <ShieldCheck size={14} className={isFeatured ? 'text-[#0066cc] dark:text-blue-300' : 'text-zinc-400'} />
                    <span className="text-[11px]">{isFeatured ? 'Featured' : 'Standard'}</span>
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
