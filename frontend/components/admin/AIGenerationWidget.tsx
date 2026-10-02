'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Sparkles, Search, FileEdit, ShieldCheck, CheckCircle2, Loader2, Clock, Compass } from 'lucide-react'

interface Props {
  generating: boolean
  progress: {
    step: number
    text: string
    topic: string
  } | null
}

// Describes what the pipeline actually does (generateDraft.ts): one general
// web search, one model call, then automated checks. Not "UP RERA portals",
// not a fact-check; claiming either would be the overstatement the product
// exists to avoid.
const PIPELINE_STEPS = [
  { step: 1, title: 'Sources', detail: 'Web search on the topic', icon: Search },
  { step: 2, title: 'Writing', detail: 'Draft from those sources', icon: FileEdit },
  { step: 3, title: 'Checks', detail: 'Links, figures, structure, style', icon: ShieldCheck },
]

/** Step-paced, not measured: the server does not stream progress. */
const STEP_WIDTH: Record<number, string> = { 1: '35%', 2: '70%', 3: '95%' }

export default function AIGenerationWidget({ generating, progress }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!generating) {
      setElapsedMs(0)
      return
    }

    const startTime = Date.now()
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime)
    }, 100)

    return () => clearInterval(interval)
  }, [generating])

  const formattedTime = (elapsedMs / 1000).toFixed(1)

  return (
    <AnimatePresence>
      {generating && (
        <m.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94vw] max-w-lg sm:max-w-xl font-sans"
          role="status"
          aria-live="polite"
        >
          {/* Main Capsule */}
          <div className="relative overflow-hidden rounded-3xl bg-zinc-950/95 text-white p-5 border border-zinc-800/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_35px_rgba(59,130,246,0.2)] backdrop-blur-2xl ring-1 ring-white/10 space-y-4">
            {/* Radiant glowing top accent line */}
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
            <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Bar: Icon, Title, Live Status & Stopwatch */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30 ring-2 ring-blue-500/20">
                    <Sparkles size={18} className="motion-safe:animate-pulse" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 ring-2 ring-zinc-950" />
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-white tracking-tight">
                      Writing a draft
                    </h4>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-400 border border-blue-800/80">
                      Step {progress?.step ?? 1} of 3
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 truncate max-w-xs sm:max-w-sm mt-0.5">
                    Writing on: <span className="text-zinc-200 font-medium italic">“{progress?.topic}”</span>
                  </p>
                </div>
              </div>

              {/* Stopwatch & Step badge */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-300 shadow-2xs">
                  <Clock size={12} className="text-blue-400" />
                  <span>{formattedTime}s</span>
                </div>
              </div>
            </div>

            {/* Multi-Step Pipeline Visual Tracker */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {PIPELINE_STEPS.map(item => {
                const currentStep = progress?.step ?? 1
                const isCompleted = item.step < currentStep
                const isActive = item.step === currentStep
                const IconComponent = item.icon

                return (
                  <div
                    key={item.step}
                    className={`relative p-2.5 rounded-2xl border transition-all duration-300 ${
                      isActive
                        ? 'bg-blue-950/40 border-blue-500/60 shadow-sm shadow-blue-500/10'
                        : isCompleted
                        ? 'bg-zinc-900/60 border-emerald-500/40'
                        : 'bg-zinc-900/30 border-zinc-800/60 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isCompleted ? (
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      ) : isActive ? (
                        <Loader2 size={13} className="motion-safe:animate-spin text-blue-400 shrink-0" />
                      ) : (
                        <IconComponent size={13} className="text-zinc-500 shrink-0" />
                      )}
                      <span
                        className={`text-[11px] font-bold tracking-tight truncate ${
                          isActive
                            ? 'text-blue-200'
                            : isCompleted
                            ? 'text-emerald-300'
                            : 'text-zinc-400'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-tight truncate hidden sm:block">
                      {item.detail}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Glowing Shimmer Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                <span className="flex items-center gap-2 text-[11px] text-zinc-300 truncate">
                  <Compass size={13} className="motion-safe:animate-spin text-blue-400 shrink-0" />
                  <span className="truncate">{progress?.text || 'Generating article draft…'}</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400 shrink-0 pl-2">
                  {STEP_WIDTH[progress?.step ?? 1]}
                </span>
              </div>

              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-700 ease-out shadow-sm shadow-blue-500/50"
                  style={{ width: STEP_WIDTH[progress?.step ?? 1] }}
                />
              </div>
            </div>

            {/* Micro disclaimer */}
            <div className="text-[10px] text-zinc-500 flex items-center justify-between border-t border-zinc-850 pt-2">
              <span>Saved as a draft. Nothing is published until you publish it.</span>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
