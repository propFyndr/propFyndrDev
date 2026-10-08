'use client'

import React, { useState, useEffect } from 'react'
import { Brain, Trash, X, Check, Warning } from '@phosphor-icons/react'
import { API_BASE } from '@/lib/env'

export interface UserMemoryModalProps {
  isOpen: boolean
  onClose: () => void
  userId?: string | null
  guestToken?: string | null
}

export function UserMemoryModal({ isOpen, onClose, userId, guestToken }: UserMemoryModalProps) {
  const [memory, setMemory] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const fetchMemory = async () => {
      setLoading(true)
      try {
        const query = userId ? `userId=${userId}` : `guestToken=${guestToken || ''}`
        const res = await fetch(`${API_BASE}/user/memory?${query}`)
        if (res.ok) {
          const data = await res.json()
          setMemory(data.memory)
        }
      } catch (err) {
        console.warn('[UserMemoryModal] fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMemory()
  }, [isOpen, userId, guestToken])

  if (!isOpen) return null

  const handleClearMemory = async () => {
    setClearing(true)
    try {
      const query = userId ? `userId=${userId}` : `guestToken=${guestToken || ''}`
      const res = await fetch(`${API_BASE}/user/memory?${query}`, { method: 'DELETE' })
      if (res.ok) {
        setMemory(null)
        setCleared(true)
        setTimeout(() => setCleared(false), 3000)
      }
    } catch (err) {
      console.warn('[UserMemoryModal] clear failed:', err)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xl text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-blue-600 dark:text-blue-400" />
            <h3 className="text-[15px] font-bold">Saved Search Preferences</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="py-4 space-y-3">
          {loading ? (
            <p className="text-[13px] text-zinc-500 animate-pulse">Loading saved memory...</p>
          ) : memory ? (
            <div className="space-y-2 text-[12.5px]">
              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-500">BHK Preference</span>
                <span className="font-semibold">{memory.bhk_preference ? `${memory.bhk_preference} BHK` : 'Not set'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-500">Budget Ceiling</span>
                <span className="font-semibold">{memory.budget_max_cr ? `₹${memory.budget_max_cr} Cr` : 'Not set'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-500">Preferred Sector</span>
                <span className="font-semibold">{memory.sector_preference || 'Not set'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-500">Viewed Properties</span>
                <span className="font-semibold">{memory.viewed_slugs?.length || 0} projects</span>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-zinc-500 py-2">
              {cleared ? 'Memory erased successfully.' : 'No active memory saved for your session.'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800 gap-2">
          <p className="text-[11px] text-zinc-500">GDPR Compliance • 1-Click Erasure</p>
          <button
            onClick={handleClearMemory}
            disabled={clearing || !memory}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash size={14} />
            <span>{clearing ? 'Clearing...' : 'Clear Memory'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
