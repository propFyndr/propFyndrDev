'use client'

// The generator's reviewer notes as a checklist. These are automated checks,
// not a fact-check: the figures list means "not found in the sources the draft
// used", nothing more. So the card never says "verified"; that word is reserved
// for data read from a project's own records (CLAUDE.md, the four tiers).
import { useState, useMemo } from 'react'
import { ShieldAlert, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileText, Search } from 'lucide-react'
import { parseReviewNotes } from '@/lib/reviewNotes'

export default function DraftReviewAuditCard({ notes }: { notes: string }) {
  const [showRaw, setShowRaw] = useState(false)
  const audit = useMemo(() => parseReviewNotes(notes), [notes])
  const flagged = audit.needsReview

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 p-3.5 sm:p-4 space-y-3 font-sans ${
        flagged
          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/90 dark:border-amber-900/60'
          : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              flagged
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
            }`}
          >
            {flagged ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight">Automated draft checks</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  flagged
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {flagged ? 'Needs review' : 'No flags'}
              </span>
            </div>
            {audit.topic && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-sm sm:max-w-md">
                Topic: <span className="italic font-medium">“{audit.topic}”</span>
              </p>
            )}
          </div>
        </div>

        {/* Metric pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {audit.sourcesFound !== undefined && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                audit.sourcesCited === 0
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                  : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <Search size={11} />
              {audit.sourcesCited}/{audit.sourcesFound} sources cited
            </span>
          )}
          {audit.wordCount !== undefined && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              <FileText size={11} className="text-zinc-400" />
              {audit.wordCount} words
            </span>
          )}
        </div>
      </div>

      {audit.noSourceCited && (
        <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs">
          <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="min-w-0">
            <span className="font-bold">No source is linked in this draft. </span>
            <span className="font-medium text-amber-800 dark:text-amber-300">
              Treat every figure and claim as unverified until you have checked it.
            </span>
          </p>
        </div>
      )}

      {audit.unverifiedFigures.length > 0 && (
        <div className="p-2.5 rounded-xl bg-white/70 dark:bg-zinc-850/70 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Figures to check before publishing</span>
            <span className="text-[10px] text-zinc-400 font-medium">Not found in any source the draft used</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {audit.unverifiedFigures.map((fig, i) => (
              <span
                key={`${fig}-${i}`}
                className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/80 shadow-2xs"
              >
                {fig}
              </span>
            ))}
          </div>
        </div>
      )}

      {audit.templateVocabulary.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-zinc-850/60 border border-zinc-200/80 dark:border-zinc-800 flex-wrap text-xs">
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">Template words to replace:</span>
          {audit.templateVocabulary.map((word, i) => (
            <span
              key={`${word}-${i}`}
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
            >
              “{word}”
            </span>
          ))}
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Use a plainer word.</span>
        </div>
      )}

      {audit.otherFlags.length > 0 && (
        <ul className="space-y-1">
          {audit.otherFlags.map((flag, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
              <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-px" />
              <span>{flag}</span>
            </li>
          ))}
        </ul>
      )}

      {audit.rewrittenReason && (
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 pt-0.5">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Rewritten once during generation: </span>
          {audit.rewrittenReason}
        </p>
      )}

      <div className="pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
        <button
          type="button"
          onClick={() => setShowRaw(r => !r)}
          aria-expanded={showRaw}
          className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          {showRaw ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showRaw ? 'Hide raw notes' : 'Show raw notes'}
        </button>
      </div>

      {showRaw && (
        <pre className="p-2.5 rounded-xl bg-zinc-900 text-zinc-200 text-[10px] font-mono whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
          {notes}
        </pre>
      )}
    </div>
  )
}
