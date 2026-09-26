'use client'
import { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { CaretDown } from '@phosphor-icons/react'
import StatusSteps from '@/components/chat/StatusSteps'

type Variant = 'chat-thinking' | 'skeleton-page' | 'skeleton-list' | 'inline'

interface UniversalLoaderProps {
  variant?: Variant
  label?: string
  sublabel?: string
  rows?: number
  showCards?: boolean
  className?: string
  // chat-thinking only: when provided, shows a collapsible chevron that expands
  // into the real pipeline trace (extracting -> searching -> generating), not
  // just decorative labels — reuses the same streaming state MessageBubble
  // already tracks.
  phase?: 'extracting' | 'searching' | 'generating' | null
  intent?: Record<string, unknown> | null
  resultCount?: number | null
}

function Spinner() {
  return (
    <div className="relative w-5 h-5 flex-shrink-0">
      <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-primary animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
      </div>
    </div>
  )
}

function SkeletonCard({ layout = 'grid' }: { layout?: 'grid' | 'list' }) {
  if (layout === 'list') {
    return (
      <div className="w-full rounded-2xl overflow-hidden bg-white dark:bg-zinc-800 border border-zinc-100/80 dark:border-zinc-700/60 p-4 flex gap-4">
        <div className="w-36 h-28 img-skeleton rounded-xl shrink-0" />
        <div className="flex-1 space-y-2.5 py-1">
          <div className="h-4 img-skeleton rounded-lg w-2/3" />
          <div className="h-3 img-skeleton rounded-md w-1/3" />
          <div className="flex gap-2 pt-2">
            <div className="h-6 img-skeleton rounded-full w-16" />
            <div className="h-6 img-skeleton rounded-full w-20" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-zinc-800 border border-zinc-100/80 dark:border-zinc-700/60 shadow-xs flex flex-col">
      <div className="h-48 img-skeleton" />
      <div className="p-5 space-y-3">
        <div className="h-4 img-skeleton rounded-full w-3/4" />
        <div className="h-3 img-skeleton rounded-full w-1/2" />
        <div className="h-6 img-skeleton rounded-full w-1/3" />
        <div className="h-9 img-skeleton rounded-xl w-full mt-1" />
      </div>
    </div>
  )
}

export default function UniversalLoader({
  variant = 'inline',
  label,
  sublabel,
  rows = 6,
  showCards = false,
  className = '',
  phase,
  intent,
  resultCount,
}: UniversalLoaderProps) {
  const [expanded, setExpanded] = useState(false)

  if (variant === 'chat-thinking') {
    const canExpand = !!phase
    return (
      <div className={`py-2 space-y-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 shadow-inner">
             <div className="w-2.5 h-2.5 bg-zinc-600 dark:bg-zinc-400 rounded-full animate-pulse" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">
            {label ?? 'Thinking'}
            <m.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="ml-0.5">…</m.span>
          </span>
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide reasoning steps' : 'Show reasoning steps'}
              className="ml-auto flex items-center justify-center w-6 h-6 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <CaretDown size={16} weight="bold" className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        <AnimatePresence>
          {expanded && canExpand && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-2"
            >
              <div className="bg-zinc-50/50 dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm overflow-hidden mb-1">
                {sublabel && (
                  <div className="px-4 py-3 border-b border-zinc-200/60 dark:border-zinc-800/80 bg-white/50 dark:bg-black/20 flex items-start gap-3">
                    <div className="mt-0.5">
                      <div className="w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Constraints Identified</p>
                      <p className="text-[13px] text-zinc-800 dark:text-zinc-200 font-medium leading-snug">{sublabel}</p>
                    </div>
                  </div>
                )}
                <div className="bg-white/60 dark:bg-black/20">
                  <StatusSteps phase={phase ?? null} intent={intent} resultCount={resultCount} />
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
        {showCards && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
          </div>
        )}
      </div>
    )
  }

  if (variant === 'skeleton-list') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 rounded-sm bg-zinc-200/50 dark:bg-zinc-800/50 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }

  if (variant === 'skeleton-page') {
    return (
      <div className={`flex flex-col items-center justify-center gap-6 p-8 ${className}`}>
        <div className="w-14 h-14 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
        <div className="space-y-3 w-full max-w-md">
          <div className="h-5 w-3/4 mx-auto rounded-full bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
          <div className="h-4 w-1/2 mx-auto rounded-full bg-zinc-200/40 dark:bg-zinc-800/40 animate-pulse" />
        </div>
        {label && <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Spinner />
      {label && <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300">{label}</span>}
    </div>
  )
}
