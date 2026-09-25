'use client'

import React from 'react'
import { ShieldCheck, TrendingUp, AlertTriangle, ArrowRight, IndianRupee } from 'lucide-react'

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

  return (
    <div className="my-3 w-full max-w-xl rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden text-sm">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-zinc-950 dark:to-zinc-900 px-4 py-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            <IndianRupee size={15} />
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">Institutional Cash-Flow Advisor</h4>
            <p className="text-[11px] text-slate-400">Net monthly cost & rate shock test</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400">Landed Cost</span>
          <div className="font-extrabold text-xs text-white">{inrCr(data.totalLandedCost)}</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="p-4 space-y-4">
        {/* Top 3 Metric Tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Standard EMI</div>
            <div className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
              {inr(data.standardEmi)}<span className="text-[9px] font-normal text-slate-400">/mo</span>
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">@ {data.baseInterestRatePct}% for 20y</div>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck size={11} /> Net Outflow
            </div>
            <div className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {inr(data.netMonthlyOutflow)}<span className="text-[9px] font-normal text-emerald-600/70">/mo</span>
            </div>
            <div className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">After Sec 24b tax relief</div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
              <TrendingUp size={11} /> +1.5% Shock
            </div>
            <div className="text-xs sm:text-sm font-extrabold text-amber-800 dark:text-amber-300 mt-0.5">
              {inr(data.shockEmi)}<span className="text-[9px] font-normal text-amber-600/70">/mo</span>
            </div>
            <div className="text-[9px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">+{inr(data.rateShockBufferMonthly)} buffer</div>
          </div>
        </div>

        {/* Detailed Breakdown List */}
        <div className="rounded-xl border border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-slate-600 dark:text-zinc-400">Base Price vs True Landed Cost (+{bumpPct}%)</span>
            <span className="font-semibold text-slate-800 dark:text-zinc-200">{inrCr(data.basePrice)} → {inrCr(data.totalLandedCost)}</span>
          </div>
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-slate-600 dark:text-zinc-400">Equity Downpayment (20%)</span>
            <span className="font-semibold text-slate-800 dark:text-zinc-200">{inrCr(data.downpaymentAmount)}</span>
          </div>
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-slate-600 dark:text-zinc-400">Home Loan Principal (80%)</span>
            <span className="font-semibold text-slate-800 dark:text-zinc-200">{inrCr(data.loanPrincipal)}</span>
          </div>
          <div className="px-3 py-2 flex items-center justify-between bg-emerald-50/40 dark:bg-emerald-950/20">
            <span className="text-emerald-800 dark:text-emerald-300 font-medium">Monthly Tax Shield (Sec 24b)</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">- {inr(data.monthlyTaxShieldSec24b)}/mo</span>
          </div>
          <div className="px-3 py-2 flex items-center justify-between bg-slate-50/60 dark:bg-zinc-800/40">
            <span className="text-slate-700 dark:text-zinc-300 font-medium">Safe Household Income (40% FOIR)</span>
            <span className="font-bold text-slate-900 dark:text-zinc-100">{inr(data.safeMonthlyTakeHome)}/mo</span>
          </div>
        </div>

        {/* User FOIR Assessment (if income provided) */}
        {data.userFoirPct !== undefined && (
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
            data.foirStatus === 'comfortable'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-900 dark:text-emerald-200'
              : data.foirStatus === 'manageable'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-900 dark:text-amber-200'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 text-red-900 dark:text-red-200'
          }`}>
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-bold">Debt-to-Income (FOIR): {data.userFoirPct}%</div>
              <div className="text-[11px] mt-0.5 opacity-90">
                {data.foirStatus === 'comfortable' && 'Comfortable debt service. You are well within retail banking safety margins.'}
                {data.foirStatus === 'manageable' && 'Moderate debt ratio. Advisable to keep 6 months of EMI in liquid reserves.'}
                {data.foirStatus === 'stressed' && 'Above recommended 40% FOIR ceiling. Consider increasing equity down payment.'}
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {onAction && (
          <button
            onClick={() => onAction('Generate family deal dossier')}
            className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <span>Create Shareable Family Deal Dossier</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
