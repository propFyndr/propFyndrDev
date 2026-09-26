'use client'

import { useEffect, useId, useState } from 'react'
import { Info } from '@phosphor-icons/react'

export interface InfoTooltipProps {
  content: string
  title?: string
  className?: string
}

export default function InfoTooltip({ content, title, className = '' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(!open)}
        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-0.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={title ?? 'More info'}
        aria-describedby={open ? id : undefined}
      >
        <Info size={13} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 sm:w-64 bg-zinc-900 text-zinc-100 dark:bg-zinc-800 text-[12px] rounded-sm p-3 shadow-md z-30 pointer-events-none border border-white/10 space-y-1 animate-in fade-in duration-150"
        >
          {title && <p className="font-semibold text-zinc-50 text-[11px]">{title}</p>}
          <p className="text-zinc-300 leading-snug">{content}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-800" />
        </div>
      )}
    </span>
  )
}
