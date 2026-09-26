'use client'

import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, Circle, X } from '@phosphor-icons/react'
import type { ProjectCard as ProjectCardType } from '@/types/project'
import { useDialogA11y } from '@/hooks/useDialogA11y'

interface CompareSelectorOverlayProps {
  properties: ProjectCardType[]
  onConfirm: (selected: ProjectCardType[]) => void
  onCancel: () => void
  onToast?: (message: string) => void
}

export default function CompareSelectorOverlay({
  properties,
  onConfirm,
  onCancel,
  onToast
}: CompareSelectorOverlayProps) {
  const [selected, setSelected] = useState<string[]>([])

  const handleToggleSelect = useCallback((propertyId: string) => {
    setSelected(prev => {
      if (prev.includes(propertyId)) {
        return prev.filter(id => id !== propertyId)
      } else {
        if (prev.length >= 4) {
          onToast?.('You can compare up to 4 properties at a time')
          return prev
        }
        return [...prev, propertyId]
      }
    })
  }, [onToast])

  const handleConfirm = useCallback(() => {
    const selectedProps = properties.filter(p => selected.includes(p.id))
    onConfirm(selectedProps)
  }, [selected, properties, onConfirm])

  // Escape, a focus trap, and focus restored to whatever opened this. Tab used
  // to walk straight out of the sheet into the chat behind the backdrop, where
  // the focus ring is invisible.
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onCancel)

  const getBhkRange = (property: ProjectCardType): string => {
    if (!property.unit_types || property.unit_types.length === 0) return ''
    const bhks = property.unit_types.map(u => u.bhk).filter(Boolean)
    return bhks.length > 0 ? bhks.map(b => `${b}BHK`).join(', ') : ''
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-selector-title"
        className="bg-surface dark:bg-zinc-900 border border-border rounded-2xl shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 id="compare-selector-title" className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">Select properties to compare</h2>
          <button
            onClick={onCancel}
            className="rounded-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            aria-label="Close"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((prop) => {
              const isSelected = selected.includes(prop.id)
              return (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => handleToggleSelect(prop.id)}
                  aria-pressed={isSelected}
                  className={`relative text-left rounded-2xl border overflow-hidden bg-surface dark:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                    isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border-heavy'
                  }`}
                >
                  {/* Thumbnail */}
                  {prop.images && prop.images[0]?.url && (
                    <div className="w-full aspect-[4/3] overflow-hidden bg-surface-3 dark:bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element -- raw img kept; explicit size reserves the space */}
                      <img
                        src={prop.images[0].url}
                        alt={prop.name}
                        width={400}
                        height={300}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Selection Bubble */}
                  <div className="absolute top-3 right-3 z-10">
                    {isSelected ? (
                      <CheckCircle size={24} weight="fill" className="text-primary" aria-hidden="true" />
                    ) : (
                      <Circle size={24} className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="font-semibold text-[13px] text-zinc-900 dark:text-zinc-50">{prop.name}</h3>
                    <p className="text-[12px] text-zinc-600 dark:text-zinc-400 mt-1">{prop.sector}</p>
                    <p className="text-[12px] text-zinc-600 dark:text-zinc-400 tabular-nums">{prop.price_range_label}</p>
                    {getBhkRange(prop) && (
                      <p className="text-[12px] text-zinc-600 dark:text-zinc-400 mt-1">
                        {getBhkRange(prop)}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer Toolbar */}
        <div className="sticky bottom-0 flex items-center justify-between p-6 bg-surface-2 dark:bg-zinc-900 border-t border-border">
          <div className="text-[13px] text-zinc-600 dark:text-zinc-400">
            Select 2–4 properties to compare · <span className="font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">{selected.length} selected</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-[13px] font-medium text-zinc-700 dark:text-zinc-300 bg-surface dark:bg-zinc-800 border border-border rounded-xs hover:bg-surface-3 dark:hover:bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.length < 2}
              className="px-4 py-2 text-[13px] font-medium text-white bg-primary rounded-xs hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              Compare ({selected.length})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
