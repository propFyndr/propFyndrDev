'use client'

import { useState, useRef, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { CaretDown, Buildings } from '@phosphor-icons/react'
import { renderChipIcon } from '@/lib/chipIconUtils'
import type { ChipAction } from './types'

interface CardSelectorChipProps {
  chip: ChipAction
  projects: Array<{ id: string; name: string }>
  onSelect: (chip: ChipAction, projectId: string) => void
  disabled?: boolean
}

/** Multi-project chip that shows dropdown to select which card to apply action to */
export function CardSelectorChip({ chip, projects, onSelect, disabled }: CardSelectorChipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()

    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onDocClick, { signal: controller.signal })
    document.addEventListener('keydown', onKey, { signal: controller.signal })

    return () => controller.abort()
  }, [isOpen])

  if (projects.length <= 1) {
    return null // Use regular chip if only 1 project
  }

  const handleProjectSelect = (projectId: string) => {
    setIsOpen(false)
    onSelect(chip, projectId)
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-medium transition-colors duration-150 max-w-full select-none cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${isOpen ? 'bg-zinc-900 text-white border border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' : 'bg-surface dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-border hover:bg-surface-3 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50'}`}
        title={chip.label}
        aria-label={chip.label}
        aria-expanded={isOpen}
      >
        {renderChipIcon(chip.label, isOpen)}
        <span className="truncate min-w-0 font-medium tracking-tight">{chip.label}</span>
        <CaretDown
          size={13}
          weight="bold"
          aria-hidden="true"
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'text-zinc-400 dark:text-zinc-500'}`}
        />
      </button>

      {/* Dropdown menu — floating dark glass container */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full mb-2 left-0 bg-surface dark:bg-zinc-900 border border-border rounded-sm shadow-md z-[9999] min-w-[220px] max-w-xs p-1 overflow-hidden"
          >
            <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 border-b border-border mb-1">
              Which property?
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-hide">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleProjectSelect(project.id)}
                  className="w-full text-left px-3 py-2 rounded-xs text-[13px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-surface-3 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 flex items-center gap-2"
                >
                  <Buildings size={13} className="text-zinc-500 dark:text-zinc-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

