'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { CaretDown } from '@phosphor-icons/react'
import type { ChipAction } from './types'

interface ChipPickerProps {
  chips: ChipAction[]
  onAction: (chip: ChipAction) => void
  className?: string
  /** If true, show as an inline horizontal scroll row; default is horizontal scroll */
  variant?: 'inline' | 'wrap'
}

/**
 * ChipPicker — Renders contextual conversation suggestion chips.
 */
export default function ChipPicker({ chips, onAction, className = '', variant = 'inline' }: ChipPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Dedupe by id (first wins), then sort by priority with NaN safety
  const deduped = useMemo(() => {
    const seen = new Set<string>()
    const out: ChipAction[] = []
    for (const c of chips) {
      if (!c || !c.id || seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
    }
    return out
  }, [chips])
  const sorted = useMemo(
    () => [...deduped].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999)),
    [deduped]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, ChipAction[]>()
    for (const chip of sorted) {
      const key = chip.group?.label ?? '__default__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(chip)
    }
    return map
  }, [sorted])

  if (!sorted.length) return null

  return (
    <AnimatePresence mode="popLayout">
      <m.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`w-full ${className}`}
      >
        <div
          ref={scrollRef}
          className={
            variant === 'wrap'
              ? 'flex flex-wrap gap-2'
              : 'flex gap-2 overflow-x-auto scrollbar-hide pb-0.5'
          }
          style={variant === 'inline' ? { WebkitOverflowScrolling: 'touch' } : undefined}
        >
          {variant === 'wrap' ? (
            sorted.map((chip) => <ChipButton key={chip.id} chip={chip} onAction={onAction} />)
          ) : (
            <div className="flex flex-col gap-3 pb-1">
              {[...grouped.entries()].map(([label, groupChips]) => (
                <div key={label} className="flex flex-col gap-1.5">
                  {label !== '__default__' && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 px-1">{label}</span>
                  )}
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {groupChips.map(chip => <ChipButton key={chip.id} chip={chip} onAction={onAction} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </m.div>
    </AnimatePresence>
  )
}

function ChipButton({ chip, onAction }: { chip: ChipAction; onAction: (chip: ChipAction) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastClickRef = useRef<number>(0)

  const projects = chip.payload?.projects as { id: string; name: string }[] | undefined
  const hasDropdown = projects && projects.length > 1

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Guard AFTER hooks — rules-of-hooks: hooks must run in the same order every render.
  if (!chip.label || !chip.label.trim()) return null

  const handleClick = () => {
    // Debounce: ignore clicks within 600ms of the last one
    const now = Date.now()
    if (now - lastClickRef.current < 600) return
    lastClickRef.current = now

    if (hasDropdown) {
      setIsOpen(!isOpen)
    } else if (projects && projects.length === 1) {
      const prefix = chip.payload?.actionPrefix ? `${chip.payload.actionPrefix} ` : ''
      const suffix = chip.payload?.actionSuffix ? ` ${chip.payload.actionSuffix}` : ''
      onAction({
        ...chip,
        payload: {
          ...chip.payload,
          text: `${prefix}${projects[0].name}${suffix}`.trim()
        }
      })
    } else {
      onAction({
        ...chip,
        payload: {
          ...chip.payload,
          text: chip.payload?.text || chip.label
        }
      })
    }
  }

  const handleSelect = (project: { id: string; name: string }) => {
    const now = Date.now()
    if (now - lastClickRef.current < 500) return
    lastClickRef.current = now
    setIsOpen(false)
    const prefix = chip.payload?.actionPrefix ? `${chip.payload.actionPrefix} ` : ''
    const suffix = chip.payload?.actionSuffix ? ` ${chip.payload.actionSuffix}` : ''
    onAction({
      ...chip,
      payload: {
        ...chip.payload,
        text: `${prefix}${project.name}${suffix}`.trim()
      }
    })
  }

  const baseClass = 'flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-medium transition-colors duration-150 cursor-pointer select-none max-w-[280px] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={hasDropdown ? isOpen : undefined}
        className={`${baseClass} ${isOpen ? 'bg-zinc-900 text-white border border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' : 'bg-surface dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-border hover:bg-surface-3 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50'}`}
        title={chip.label}
      >
        <span className="truncate min-w-0 tracking-tight font-medium">{chip.label}</span>
        {hasDropdown && <CaretDown weight="bold" aria-hidden="true" className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'text-zinc-400 dark:text-zinc-500'}`} />}
      </button>

      <AnimatePresence>
        {isOpen && hasDropdown && (
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full left-0 mb-2 min-w-[200px] max-w-xs bg-surface dark:bg-zinc-900 border border-border rounded-sm shadow-md overflow-hidden z-50 flex flex-col p-1"
          >
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project)}
                type="button"
                className="text-left px-3 py-2 rounded-xs text-[13px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-surface-3 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                {project.name}
              </button>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

