'use client'

import React, { useState } from 'react'
import { CheckCircle, Clock, Scales, ArrowUpRight, Eye } from '@phosphor-icons/react'
import { computeCarpetEfficiency } from '@/lib/chat/carpetEfficiency'

export interface CarpetLoadingProps {
  projectName?: string
  unitType?: string
  superAreaSqft?: number
  carpetAreaSqft?: number
  totalPriceCr?: number
  advertisedRatePerSqft?: number
  totalFlats?: number
  totalLifts?: number
  [key: string]: any
}

export interface CarpetLoadingVisualizerProps {
  props: Record<string, any>
}

export function CarpetLoadingVisualizer({ props }: CarpetLoadingVisualizerProps) {
  const {
    projectName,
    unitType,
    superAreaSqft,
    carpetAreaSqft,
    totalPriceCr = 0,
    advertisedRatePerSqft = 0,
    totalFlats,
    totalLifts,
  } = props

  // Interactive toggle: 'combined' | 'carpet' | 'loading'
  const [activeFocus, setActiveFocus] = useState<'combined' | 'carpet' | 'loading'>('combined')

  // Both areas must be measured; a guessed area would make every figure below a guess.
  if (!superAreaSqft || !carpetAreaSqft || carpetAreaSqft >= superAreaSqft) return null

  const metrics = computeCarpetEfficiency(superAreaSqft, carpetAreaSqft, totalPriceCr, {
    totalFlats,
    totalLifts,
    advertisedRatePerSqft,
  })

  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
  const inrLakh = (n: number) => `₹${(n / 100_000).toFixed(1)} Lakh`

  const loadingValueRupees = totalPriceCr > 0
    ? (totalPriceCr * 1e7) * (metrics.loadingPercentage / 100)
    : (metrics.advertisedRatePerSqft || 0) * metrics.commonAreaSqft

  return (
    <div className="my-3 w-full max-w-xl rounded-2xl border border-border bg-surface dark:bg-zinc-900 overflow-hidden text-[13px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xs bg-surface-3 dark:bg-zinc-800 text-primary flex items-center justify-center">
            <Scales size={15} weight="bold" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">{projectName}</h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{unitType} · RERA Space Audit</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Loading ratio</span>
          <div className="text-[13px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
            {metrics.loadingPercentage}%
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Interactive Comparison Mode Switcher */}
        <div className="flex items-center justify-between text-[11px] font-medium bg-surface-2 dark:bg-zinc-800/50 p-1 rounded-lg border border-border">
          <span className="px-2 text-zinc-500 flex items-center gap-1">
            <Eye size={13} weight="bold" /> View Mode:
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveFocus('combined')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer min-h-[32px] ${
                activeFocus === 'combined'
                  ? 'bg-surface dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Full Split
            </button>
            <button
              type="button"
              onClick={() => setActiveFocus('carpet')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer min-h-[32px] ${
                activeFocus === 'carpet'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Usable Space ({metrics.carpetEfficiencyPercentage}%)
            </button>
            <button
              type="button"
              onClick={() => setActiveFocus('loading')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer min-h-[32px] ${
                activeFocus === 'loading'
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Common Loading ({metrics.loadingPercentage}%)
            </button>
          </div>
        </div>

        {/* Proportional Stacked Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            <span className={`transition-opacity ${activeFocus === 'loading' ? 'opacity-40' : 'opacity-100 font-semibold text-emerald-700 dark:text-emerald-400'}`}>
              Usable Carpet: {metrics.carpetAreaSqft} sq.ft ({metrics.carpetEfficiencyPercentage}%)
            </span>
            <span className={`transition-opacity ${activeFocus === 'carpet' ? 'opacity-40' : 'opacity-100 font-semibold text-amber-700 dark:text-amber-400'}`}>
              Loading: {metrics.commonAreaSqft} sq.ft ({metrics.loadingPercentage}%)
            </span>
          </div>

          <div className="w-full h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{
                width: activeFocus === 'loading' ? '0%' : activeFocus === 'carpet' ? '100%' : `${metrics.carpetEfficiencyPercentage}%`,
              }}
              onClick={() => setActiveFocus(activeFocus === 'carpet' ? 'combined' : 'carpet')}
              className="bg-emerald-500 dark:bg-emerald-600 h-full transition-all duration-300 cursor-pointer"
              title={`Carpet Area: ${metrics.carpetAreaSqft} sq.ft (Click to inspect)`}
            />
            <div
              style={{
                width: activeFocus === 'carpet' ? '0%' : activeFocus === 'loading' ? '100%' : `${metrics.loadingPercentage}%`,
              }}
              onClick={() => setActiveFocus(activeFocus === 'loading' ? 'combined' : 'loading')}
              className="bg-amber-400 dark:bg-amber-500 h-full transition-all duration-300 cursor-pointer"
              title={`Common Loading: ${metrics.commonAreaSqft} sq.ft (Click to inspect)`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-zinc-400 tabular-nums">
            <span>0 sq.ft</span>
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">Total Super: {metrics.superAreaSqft} sq.ft</span>
          </div>
        </div>

        {/* Dynamic focused takeaway */}
        {activeFocus === 'loading' && loadingValueRupees > 0 && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11.5px] text-amber-900 dark:text-amber-200">
            <strong>Common Area Haircut:</strong> You are paying approximately <strong>{inrLakh(loadingValueRupees)}</strong> for elevators, staircases, and corridors ({metrics.commonAreaSqft} sq.ft) outside your front door.
          </div>
        )}

        {activeFocus === 'carpet' && (
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11.5px] text-emerald-900 dark:text-emerald-200">
            <strong>True Living Carpet:</strong> Only <strong>{metrics.carpetAreaSqft} sq.ft</strong> is internal carpet area inside the apartment walls. Real usable cost is <strong>{inr(metrics.effectiveCarpetRatePerSqft)}/sqft</strong>.
          </div>
        )}

        {/* Pricing Reality Comparison */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-sm bg-surface-2 dark:bg-zinc-800/60 border border-border">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Advertised (Super)</div>
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
              {metrics.advertisedRatePerSqft > 0 ? `${inr(metrics.advertisedRatePerSqft)}/sqft` : 'N/A'}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Brochure rate</div>
          </div>

          <div className="p-2.5 rounded-sm bg-surface-2 dark:bg-zinc-800/60 border border-border">
            <div className="text-[11px] text-primary dark:text-blue-400 font-medium flex items-center gap-1">
              Effective Carpet <ArrowUpRight size={11} weight="bold" />
            </div>
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
              {metrics.effectiveCarpetRatePerSqft > 0 ? `${inr(metrics.effectiveCarpetRatePerSqft)}/sqft` : 'N/A'}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Real cost per usable sqft</div>
          </div>

          {metrics.eciScore > 0 && (
          <div className="col-span-2 sm:col-span-1 p-2.5 rounded-sm bg-surface-2 dark:bg-zinc-800/60 border border-border">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1">
              <Clock size={11} weight="bold" /> Elevator (ECI)
            </div>
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                metrics.eciRating === 'Low Wait' ? 'bg-emerald-500' : metrics.eciRating === 'Standard' ? 'bg-blue-500' : 'bg-amber-500'
              }`} />
              {metrics.eciRating}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">
              {metrics.eciScore} flats / lift
            </div>
          </div>
          )}
        </div>

        {/* Takeaway message */}
        <div className="p-2.5 rounded-sm bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-[11px] text-blue-900 dark:text-blue-200 flex items-start gap-2">
          <CheckCircle size={14} weight="fill" className="text-primary shrink-0 mt-0.5" />
          <span>
            <strong>RERA True Usability:</strong> You are paying for {metrics.superAreaSqft} sq.ft, but living in {metrics.carpetAreaSqft} sq.ft.
            {metrics.effectiveCarpetRatePerSqft > 0 && <> Every usable square foot effectively costs {inr(metrics.effectiveCarpetRatePerSqft - metrics.advertisedRatePerSqft)} more than the advertised rate.</>}
          </span>
        </div>
      </div>
    </div>
  )
}

export default CarpetLoadingVisualizer
