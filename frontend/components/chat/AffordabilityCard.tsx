'use client'

import React from 'react'
import { ShieldCheck, TrendUp, Warning, WarningCircle, CheckCircle, ArrowRight, CurrencyInr } from '@phosphor-icons/react'

export interface AffordabilityData {
  basePrice: number
  landedMultiplier: number
  totalLandedCost: number
  downpaymentAmount: number
  loanPrincipal: number
  tenureYears: number
  baseInterestRatePct: number
  standardEmi: number
  shockInterestRatePct: number
  shockEmi: number
  rateShockBufferMonthly: number
  monthlyTaxShieldSec24b: number
  netMonthlyOutflow: number
  safeMonthlyTakeHome: number
  safeAnnualHouseholdIncome: number
  userMonthlyIncome?: number
  userFoirPct?: number
  foirStatus?: 'comfortable' | 'manageable' | 'stressed'
}

interface AffordabilityCardProps {
  data: AffordabilityData
  onAction?: (text: string) => void
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const inrCr = (n: number) => `₹${(n / 10_000_000).toFixed(2)} Cr`

export default function AffordabilityCard({ data, onAction }: AffordabilityCardProps) {
  const bumpPct = Math.round((data.landedMultiplier - 1) * 100)

  const FoirIcon = data.foirStatus === 'comfortable' ? CheckCircle : data.foirStatus === 'manageable' ? WarningCircle : Warning
  const row = 'px-3 py-2 flex items-center justify-between gap-3'
  const num = 'font-medium text-zinc-900 dark:text-zinc-100 tabular-nums text-right'

  return (
    <div className="my-3 w-full max-w-xl rounded-2xl border border-border bg-surface dark:bg-zinc-900 overflow-hidden text-[13px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xs bg-surface-3 dark:bg-zinc-800 text-primary flex items-center justify-center">
            <CurrencyInr size={15} weight="bold" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">Monthly cost</h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Net monthly cost and rate shock test</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Landed cost</span>
          <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">{inrCr(data.totalLandedCost)}</div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Top 3 metric tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-sm bg-surface-2 dark:bg-zinc-800/60 border border-border">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Standard EMI</div>
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
              {inr(data.standardEmi)}<span className="text-[11px] font-normal text-zinc-400">/mo</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">@ {data.baseInterestRatePct}% for {data.tenureYears}y</div>
          </div>

          <div className="p-2.5 rounded-sm bg-surface-2 dark:bg-zinc-800/60 border border-border">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck size={11} weight="bold" aria-hidden="true" /> Net outflow
            </div>
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
              {inr(data.netMonthlyOutflow)}<span className="text-[11px] font-normal text-zinc-400">/mo</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">After Sec 24b tax relief</div>
          </div>

          <div className="p-2.5 rounded-sm bg-surface-2 dark:bg-zinc-800/60 border border-border">
            <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1">
              <TrendUp size={11} weight="bold" aria-hidden="true" /> +1.5% shock
            </div>
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
              {inr(data.shockEmi)}<span className="text-[11px] font-normal text-zinc-400">/mo</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">+{inr(data.rateShockBufferMonthly)} buffer</div>
          </div>
        </div>

        {/* Detailed breakdown */}
        <div className="rounded-sm border border-border divide-y divide-border text-[12px]">
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-400">Base price vs landed cost (+{bumpPct}%)</span>
            <span className={num}>{inrCr(data.basePrice)} → {inrCr(data.totalLandedCost)}</span>
          </div>
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-400">Down payment (20%)</span>
            <span className={num}>{inrCr(data.downpaymentAmount)}</span>
          </div>
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-400">Home loan principal (80%)</span>
            <span className={num}>{inrCr(data.loanPrincipal)}</span>
          </div>
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-400">Monthly tax shield (Sec 24b)</span>
            <span className={num}>- {inr(data.monthlyTaxShieldSec24b)}/mo</span>
          </div>
          <div className={row}>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">Safe household income (40% FOIR)</span>
            <span className={`${num} font-semibold`}>{inr(data.safeMonthlyTakeHome)}/mo</span>
          </div>
        </div>

        {/* User FOIR assessment (if income provided) */}
        {data.userFoirPct !== undefined && (
          <div className={`p-3 rounded-sm border flex items-start gap-2.5 text-[12px] ${
            data.foirStatus === 'comfortable'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200'
              : data.foirStatus === 'manageable'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-200'
          }`}>
            <FoirIcon size={16} weight="fill" className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <div className="font-semibold tabular-nums">Debt-to-income (FOIR): {data.userFoirPct}%</div>
              <div className="text-[11px] mt-0.5 opacity-90">
                {data.foirStatus === 'comfortable' && 'Comfortable debt service. You are well within retail banking safety margins.'}
                {data.foirStatus === 'manageable' && 'Moderate debt ratio. Advisable to keep 6 months of EMI in liquid reserves.'}
                {data.foirStatus === 'stressed' && 'Above recommended 40% FOIR ceiling. Consider increasing equity down payment.'}
              </div>
            </div>
          </div>
        )}

        {onAction && (
          <button
            type="button"
            onClick={() => onAction('Create a shareable dossier of this chat')}
            className="w-full py-2.5 px-3 rounded-xs bg-primary hover:bg-primary-dark text-white font-medium text-[12px] flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <span>Create a shareable dossier</span>
            <ArrowRight size={13} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
