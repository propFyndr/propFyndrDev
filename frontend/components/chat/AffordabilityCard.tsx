'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { ShieldCheck, TrendUp, Warning, WarningCircle, CheckCircle, ArrowRight, CurrencyInr, Sliders } from '@phosphor-icons/react'
import { calculateLoanCockpit } from '@/lib/calculators'
import { trackLoanSliderAdjusted } from '@/lib/analytics'

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

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`
const inrCr = (n: number) => {
  if (!n || isNaN(n)) return '₹0.00 Cr'
  const inRupees = n > 10_000 ? n : n * 10_000_000
  return `₹${(inRupees / 10_000_000).toFixed(2)} Cr`
}

export default function AffordabilityCard({ data, onAction }: AffordabilityCardProps) {
  const bumpPct = Math.round(((data.landedMultiplier || 1.15) - 1) * 100)

  // Interactive client-side slider state (Task 5.2)
  const [downPaymentPct, setDownPaymentPct] = useState(20)
  const [tenureYears, setTenureYears] = useState(data.tenureYears || 20)
  const [rateShockActive, setRateShockActive] = useState(false)

  const normalizedLandedCost = useMemo(() => {
    const raw = data.totalLandedCost
    if (!raw || isNaN(raw)) return 10_000_000
    return raw > 10_000 ? raw : Math.round(raw * 10_000_000)
  }, [data.totalLandedCost])

  const cockpit = useMemo(() => calculateLoanCockpit({
    totalLandedCost: normalizedLandedCost,
    downPaymentPct,
    tenureYears,
    annualInterestRatePct: data.baseInterestRatePct || 8.5,
    enableRateShock: rateShockActive,
  }), [normalizedLandedCost, data.baseInterestRatePct, downPaymentPct, tenureYears, rateShockActive])

  // Fires on a real slider move (down payment or tenure), not on first mount
  // with the default values.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    trackLoanSliderAdjusted(cockpit.loanPrincipal / 10_000_000, cockpit.standardMonthlyEmi)
  }, [downPaymentPct, tenureYears])

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
            <h4 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">Financial Cockpit</h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Interactive loan & tax shield calculator</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Landed cost</span>
          <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">{inrCr(data.totalLandedCost)}</div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Interactive Sliders Section */}
        <div className="p-3 rounded-xl bg-surface-2 dark:bg-zinc-800/50 border border-border space-y-3.5">
          <div className="flex items-center justify-between text-[12px] font-semibold text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5"><Sliders size={14} weight="bold" className="text-primary" /> Loan Adjustments</span>
            <button
              type="button"
              onClick={() => setRateShockActive(!rateShockActive)}
              aria-pressed={rateShockActive}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border min-h-[32px] flex items-center cursor-pointer ${
                rateShockActive
                  ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                  : 'bg-surface dark:bg-zinc-800 border-border text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
              }`}
            >
              <TrendUp size={12} weight="bold" className="mr-1" />
              +1.5% RBI Shock {rateShockActive ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Slider 1: Down Payment */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">Down payment</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {downPaymentPct}% ({inrCr(cockpit.downPaymentAmount)})
              </span>
            </div>
            <div className="py-1">
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={downPaymentPct}
                onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                aria-label="Down Payment Percentage"
                className="w-full accent-primary h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg cursor-pointer min-h-[48px]"
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400 tabular-nums">
              <span>10% (Min)</span>
              <span>20% (Std)</span>
              <span>50%</span>
            </div>
          </div>

          {/* Slider 2: Loan Tenure */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">Loan tenure</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {tenureYears} years ({tenureYears * 12} mo)
              </span>
            </div>
            <div className="py-1">
              <input
                type="range"
                min="10"
                max="30"
                step="1"
                value={tenureYears}
                onChange={(e) => setTenureYears(Number(e.target.value))}
                aria-label="Loan Tenure in Years"
                className="w-full accent-primary h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg cursor-pointer min-h-[48px]"
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400 tabular-nums">
              <span>10y</span>
              <span>20y</span>
              <span>30y (Max)</span>
            </div>
          </div>
        </div>

        {/* Top 3 dynamic metric tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-sm bg-surface-2 dark:bg-zinc-800/60 border border-border">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Monthly EMI</div>
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
              {inr(cockpit.standardMonthlyEmi)}<span className="text-[11px] font-normal text-zinc-400">/mo</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">@ {data.baseInterestRatePct || 8.5}% for {tenureYears}y</div>
          </div>

          <div className="p-2.5 rounded-sm bg-surface-2 dark:bg-zinc-800/60 border border-border">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck size={11} weight="bold" aria-hidden="true" /> Net outflow
            </div>
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
              {inr(cockpit.netMonthlyOutflow)}<span className="text-[11px] font-normal text-zinc-400">/mo</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">After Sec 24b relief</div>
          </div>

          <div className={`p-2.5 rounded-sm border transition-colors ${
            rateShockActive
              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
              : 'bg-surface-2 dark:bg-zinc-800/60 border-border'
          }`}>
            <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1">
              <TrendUp size={11} weight="bold" aria-hidden="true" /> +1.5% shock
            </div>
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
              {inr(cockpit.shockMonthlyEmi)}<span className="text-[11px] font-normal text-zinc-400">/mo</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">+{inr(cockpit.monthlyRateShockDelta)} buffer</div>
          </div>
        </div>

        {/* Detailed breakdown */}
        <div className="rounded-sm border border-border divide-y divide-border text-[12px]">
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-400">Base price vs landed cost (+{bumpPct}%)</span>
            <span className={num}>{inrCr(data.basePrice)} → {inrCr(data.totalLandedCost)}</span>
          </div>
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-400">Down payment ({downPaymentPct}%)</span>
            <span className={num}>{inrCr(cockpit.downPaymentAmount)}</span>
          </div>
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-400">Home loan principal ({100 - downPaymentPct}%)</span>
            <span className={num}>{inrCr(cockpit.loanPrincipal)}</span>
          </div>
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-400">Monthly tax shield (Sec 24b)</span>
            <span className={num}>- {inr(cockpit.monthlyTaxShieldSec24b)}/mo</span>
          </div>
          <div className="px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Assumes {cockpit.activeInterestRatePct.toFixed(2)}% interest (typical for Noida — not your bank&apos;s quote).
            The Sec 24(b) saving assumes the old tax regime and the 30% slab; under the new regime it is zero for a self-occupied home.
          </div>
          <div className={row}>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">Safe household income (40% FOIR)</span>
            <span className={`${num} font-semibold`}>{inr(cockpit.safeMonthlyTakeHome)}/mo</span>
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
            className="w-full py-2.5 px-3 rounded-xs bg-primary hover:bg-primary-dark text-white font-medium text-[12px] flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-h-[48px] cursor-pointer"
          >
            <span>Create a shareable dossier</span>
            <ArrowRight size={13} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
