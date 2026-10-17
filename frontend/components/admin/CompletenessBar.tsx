'use client'

import { WarningCircle, CheckCircle, X } from '@phosphor-icons/react'

interface CompletenessResult {
  score?: number
  percentage?: number
  missing?: string[]
  missingFields?: string[]
  suggestions?: string[]
}

interface CompletenessBarProps {
  result: CompletenessResult | null
  onClose: () => void
}

export default function CompletenessBar({ result, onClose }: CompletenessBarProps) {
  if (!result) return null

  // Only show if real score exists, no fake defaults
  const score = result.percentage ?? result.score
  if (score === undefined) return null

  const missing = result.missingFields ?? result.missing ?? []

  return (
    <div className="mb-6 p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold text-blue-900 dark:text-blue-200 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black flex-shrink-0">
          {score}%
        </div>
        <div className="min-w-0">
          <h4 className="font-extrabold text-[13px] leading-tight flex items-center gap-1.5 text-gray-900 dark:text-white">
            {score >= 80 ? (
              <>
                <CheckCircle size={15} className="text-emerald-500" /> High Data Quality &amp; Completeness
              </>
            ) : (
              <>
                <WarningCircle size={15} className="text-amber-500" /> Data Completeness Needs Attention
              </>
            )}
          </h4>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5">
            {missing.length > 0
              ? `Missing fields: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` (+${missing.length - 3} more)` : ''}`
              : 'All key marketing, location, unit, and media data points are verified.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
