'use client'

import React from 'react'
import { ShieldCheck } from '@phosphor-icons/react'

export interface ProvenancePillProps {
  claim: string
  onClick?: () => void
  className?: string
}

export function ProvenancePill({ claim, onClick, className = '' }: ProvenancePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 rounded-full text-[11.5px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:border-emerald-400 transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 select-none ${className}`}
      title="Click to inspect official verification proof docket"
    >
      <ShieldCheck size={13} weight="fill" className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
      <span>{claim}</span>
    </button>
  )
}

export default ProvenancePill
