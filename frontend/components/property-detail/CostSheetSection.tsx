'use client'

import { useState, useMemo } from 'react'
import {
  Calculator,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  FileCheck,
  Zap,
  Info,
  Building,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
} from 'lucide-react'
import type { ProjectDetail, UnitTypeSummary } from '@/types/project'

export interface CostSheetSectionProps {
  detail: ProjectDetail | null
  unitTypes: UnitTypeSummary[]
  initialBhk?: string
}

function fmtRs(num: number): string {
  return `₹${Math.round(num).toLocaleString('en-IN')}`
}

function fmtCr(cr: number): string {
  return `₹${cr.toFixed(2)} Cr`
}

export default function CostSheetSection({
  detail,
  unitTypes,
  initialBhk,
}: CostSheetSectionProps) {
  const availableBhks = useMemo(() => {
    if (!unitTypes || unitTypes.length === 0) return ['2 BHK', '3 BHK', '4 BHK']
    return Array.from(new Set(unitTypes.map((u) => `${u.bhk} BHK`)))
  }, [unitTypes])

  const [selectedBhk, setSelectedBhk] = useState<string>(
    initialBhk || availableBhks[0] || '3 BHK'
  )
  const [buyerGender, setBuyerGender] = useState<'male' | 'female' | 'joint'>('joint')
  const [customArea, setCustomArea] = useState<number | null>(null)
  const [customBspRate, setCustomBspRate] = useState<number | null>(null)

  // Find matching unit type
  const unit = useMemo(() => {
    return unitTypes.find((u) => `${u.bhk} BHK` === selectedBhk) || unitTypes[0]
  }, [unitTypes, selectedBhk])

  // Derive parameters from detail or unit
  const areaSqft = customArea ?? unit?.super_area_sqft ?? (selectedBhk.includes('2') ? 1200 : selectedBhk.includes('3') ? 1650 : 2200)
  const rawPriceMinCr = unit?.price_min_cr ?? 1.25
  const baseRatePerSqft = customBspRate ?? (areaSqft > 0 ? Math.round((rawPriceMinCr * 10000000) / areaSqft) : 7500)

  // Base Agreement Value
  const baseSalePrice = areaSqft * baseRatePerSqft

  // Preferential Location & Parking / Other builder charges
  const plcCharges = Math.round(baseSalePrice * 0.05) // ~5% typical PLC (corner, park, road)
  const coveredParking = 350000 // Standard covered car parking slot in Noida/Gr Noida
  const clubhouseCharges = 300000 // Standard club membership

  // Agreement Value subject to Stamp Duty & Registration
  const agreementValue = baseSalePrice + plcCharges + coveredParking + clubhouseCharges

  // Status & Statutory Schedule (UP RERA & Noida Authority Norms)
  const isReadyToMove = detail?.status === 'ready_to_move'
  const hasOc = detail?.oc_status === 'received' || isReadyToMove

  // GST: 0% on RTM with OC, 5% on under-construction non-affordable
  const gstRate = hasOc ? 0 : 0.05
  const gstAmount = Math.round(agreementValue * gstRate)

  // Stamp Duty (UP): 7% for male/joint, 6% for sole female buyer
  const stampDutyRate = buyerGender === 'female' ? 0.06 : 0.07
  const stampDutyAmount = Math.round(agreementValue * stampDutyRate)

  // Registration Charges: 1% capped/standard in UP
  const registrationAmount = Math.round(agreementValue * 0.01)

  // Possession & Operational Fixed Charges
  const ifmsPerSqft = 75 // Interest-Free Maintenance Security standard ₹50-100/sqft
  const ifmsAmount = areaSqft * ifmsPerSqft

  const monthlyMaintRate = detail?.maintenance_per_sqft_monthly ?? 3.5
  const advanceMaintenanceMonths = 12
  const advanceMaintenanceAmount = Math.round(areaSqft * monthlyMaintRate * advanceMaintenanceMonths)

  const dualMeterCharges = 50000 // Dual source pre-paid smart meter installation (NPCL/PVVNL)
  const legalAdvocateCharges = 25000 // Title search & registry advocate fee

  // Total Statutory & Government Outgo
  const statutoryTotal = gstAmount + stampDutyAmount + registrationAmount + legalAdvocateCharges

  // Total Possession & Operational Outgo
  const possessionOutgoTotal = ifmsAmount + advanceMaintenanceAmount + dualMeterCharges

  // Total All-Inclusive Landed Purchase Outlay
  const landedTotalCost = agreementValue + statutoryTotal + possessionOutgoTotal

  // Multiplier over bare BSP
  const multiplier = baseSalePrice > 0 ? (landedTotalCost / baseSalePrice) : 1.30
  const outOfPocketDeltaPercent = Math.round((multiplier - 1) * 100)

  return (
    <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Calculator size={18} />
            </span>
            <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">
              True Cost & Landed Purchase Sheet
            </h2>
            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              UP Statutory Schedule
            </span>
          </div>
          <p className="text-[12px] text-gray-500 font-medium mt-1">
            Real out-of-pocket acquisition outlay factoring Stamp Duty, UP Registration, IFMS, GST & 1-Year Advance Maintenance.
          </p>
        </div>

        {/* Configuration Pills */}
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl self-start sm:self-auto">
          {availableBhks.map((bhk) => (
            <button
              key={bhk}
              onClick={() => {
                setSelectedBhk(bhk)
                setCustomArea(null)
                setCustomBspRate(null)
              }}
              className={`text-[11.5px] font-black px-3.5 py-1.5 rounded-xl transition-all ${
                selectedBhk === bhk
                  ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {bhk}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Reality Callout: BSP vs Real Landed Out-Of-Pocket */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-300">
                Reality Check
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">
                +{outOfPocketDeltaPercent}% over Base BSP
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-[28px] sm:text-[34px] font-black tracking-tight text-white">
                {fmtCr(landedTotalCost / 10000000)}
              </span>
              <span className="text-[13px] text-indigo-200/80 line-through">
                BSP: {fmtCr(baseSalePrice / 10000000)}
              </span>
            </div>
            <p className="text-[12px] text-indigo-200/90 font-medium mt-1">
              Estimated total cheque + statutory outflow required to take legal possession.
            </p>
          </div>

          {/* Gender / Buyer Type for Stamp Duty concessions in UP */}
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/15 space-y-2">
            <span className="text-[11px] font-bold text-indigo-200 block">
              UP Stamp Duty Buyer Category:
            </span>
            <div className="flex items-center gap-1">
              {(['male', 'female', 'joint'] as const).map((gender) => (
                <button
                  key={gender}
                  onClick={() => setBuyerGender(gender)}
                  className={`text-[11px] font-black px-3 py-1.5 rounded-lg capitalize transition-all ${
                    buyerGender === gender
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {gender === 'joint' ? 'Male / Joint (7%)' : gender === 'female' ? 'Sole Female (6%)' : 'Male (7%)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* GST Status Banner */}
        <div className="pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <div className="flex items-center gap-2">
            {hasOc ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                <CheckCircle2 size={13} />
                OC Received / Ready: 0% GST Exempt
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30">
                <AlertTriangle size={13} />
                Under-Construction: 5% GST Applicable ({fmtRs(gstAmount)})
              </span>
            )}
          </div>
          <span className="text-white/60 text-[11px]">
            Super Area: <strong className="text-white">{areaSqft.toLocaleString('en-IN')} sq.ft</strong> @{' '}
            <strong className="text-white">₹{baseRatePerSqft.toLocaleString('en-IN')}/sq.ft</strong>
          </span>
        </div>
      </div>

      {/* Breakdown Grid into 3 Clear Tiers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pillar 1: Base Agreement Value */}
        <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-white/10">
            <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-extrabold text-[13px]">
              <Building size={15} className="text-blue-600" />
              <span>1. Agreement Value</span>
            </div>
            <span className="text-[12.5px] font-black text-gray-900 dark:text-white">
              {fmtRs(agreementValue)}
            </span>
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Base Sale Price ({areaSqft} sqft)</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(baseSalePrice)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1">
                PLC (Floor / Green / Road ~5%)
              </span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(plcCharges)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Covered Car Parking (1 Bay)</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(coveredParking)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Clubhouse Membership</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(clubhouseCharges)}</span>
            </div>
          </div>
          <p className="text-[10.5px] text-gray-400 pt-1">
            *Agreement value constitutes the base contract amount on which government taxes are calculated.
          </p>
        </div>

        {/* Pillar 2: Government & Statutory Outgo (UP) */}
        <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-white/10">
            <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-extrabold text-[13px]">
              <Receipt size={15} className="text-amber-600" />
              <span>2. Statutory & Taxes</span>
            </div>
            <span className="text-[12.5px] font-black text-amber-600 dark:text-amber-400">
              {fmtRs(statutoryTotal)}
            </span>
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>UP Stamp Duty ({Math.round(stampDutyRate * 100)}%)</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(stampDutyAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>UP Registration Fee (1%)</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(registrationAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>GST {hasOc ? '(0% - OC Exempt)' : '(5% - Under Construction)'}</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(gstAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Advocate Legal & Stamping</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(legalAdvocateCharges)}</span>
            </div>
          </div>
          <p className="text-[10.5px] text-gray-400 pt-1">
            *Non-negotiable government dues payable strictly via UP IGRS stamp portal at registry.
          </p>
        </div>

        {/* Pillar 3: Possession & Operational Handover */}
        <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-white/10">
            <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-extrabold text-[13px]">
              <Zap size={15} className="text-emerald-600" />
              <span>3. Handover & Living</span>
            </div>
            <span className="text-[12.5px] font-black text-emerald-600 dark:text-emerald-400">
              {fmtRs(possessionOutgoTotal)}
            </span>
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>IFMS Security (₹{ifmsPerSqft}/sqft)</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(ifmsAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>12 Months Maint. (₹{monthlyMaintRate}/sqft)</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(advanceMaintenanceAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Dual Prepaid Smart Meter</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtRs(dualMeterCharges)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>DG Power Backup Setup</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Included in Meter</span>
            </div>
          </div>
          <p className="text-[10.5px] text-gray-400 pt-1">
            *IFMS is an escrow corpus transferred to the Apartment Owners Association (AOA) upon formation.
          </p>
        </div>
      </div>

      {/* Living Quality & Due Diligence Advisory Row */}
      <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-[13px] font-black text-gray-900 dark:text-white">
              Forensic Living Quality Telemetry
            </h4>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-gray-600 dark:text-gray-300 mt-1">
              <span>
                Water Source:{' '}
                <strong className="text-gray-900 dark:text-white capitalize">
                  {detail?.water_source_type ? detail.water_source_type.replace('_', ' ') : 'Ganga Water + Borewell'}
                </strong>{' '}
                {detail?.water_tds_range && `(${detail.water_tds_range})`}
              </span>
              <span>•</span>
              <span>
                Power Metering:{' '}
                <strong className="text-gray-900 dark:text-white capitalize">
                  {detail?.power_supply_type ? detail.power_supply_type.replace('_', ' ') : 'Dual Prepaid Metering'}
                </strong>
              </span>
              <span>•</span>
              <span>
                DG Rate:{' '}
                <strong className="text-gray-900 dark:text-white">
                  ₹{detail?.dg_power_rate_per_unit ?? 18}/unit
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Bank APF Badges */}
        {detail?.bank_apf_codes && typeof detail.bank_apf_codes === 'object' && Object.keys(detail.bank_apf_codes).length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider">
              Approved Bank APF:
            </span>
            {Object.entries(detail.bank_apf_codes as Record<string, string>).map(([bank, code]) => (
              <span
                key={bank}
                className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200"
                title={`APF Code: ${code}`}
              >
                {bank}: {code}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
