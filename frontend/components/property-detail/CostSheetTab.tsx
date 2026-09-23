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

export interface CostSheetTabProps {
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

export default function CostSheetTab({
  detail,
  unitTypes,
  initialBhk,
}: CostSheetTabProps) {
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
  const baseAgreementValue = areaSqft * baseRatePerSqft

  // Status & GST
  const isRtm = detail?.status === 'ready_to_move'
  const hasFullOc = (detail as any)?.oc_status === 'FULL_OC' || isRtm
  // GST: 0% if RTM with OC, 5% on Under Construction
  const gstRatePct = hasFullOc ? 0 : 5
  const gstAmount = (baseAgreementValue * gstRatePct) / 100

  // UP Statutory Registration & Stamp Duty
  // UP Stamp Duty: Male/Joint 7%, Female 6% (discount up to ₹10L value or 1% off)
  const stampDutyPct = buyerGender === 'female' ? 6.0 : 7.0
  const stampDutyAmount = (baseAgreementValue * stampDutyPct) / 100
  // UP Registration Fee: 1% of Agreement Value
  const registrationFee = (baseAgreementValue * 1.0) / 100
  const legalFee = 25000

  // Society Infrastructure & Utilities
  const ifmsPerSqft = (detail as any)?.ifms_per_sqft ?? 75
  const ifmsAmount = areaSqft * ifmsPerSqft

  const monthlyMaintenanceRate = (detail as any)?.maintenance_per_sqft_monthly ?? 2.85
  const advanceMaintenanceMonths = 12
  const advanceMaintenanceAmount = areaSqft * monthlyMaintenanceRate * advanceMaintenanceMonths

  // Dual Metering (PVVNL Grid + DG Backup dual-source meter)
  const meterCharges = (detail as any)?.power_supply_type === 'PVVNL_MULTIPOINT' ? 55000 : 45000
  const clubCharges = 250000 // Standard Noida/Gr Noida club development charge

  // Total Landed Cost
  const totalLandedCost =
    baseAgreementValue +
    gstAmount +
    stampDutyAmount +
    registrationFee +
    legalFee +
    ifmsAmount +
    advanceMaintenanceAmount +
    meterCharges +
    clubCharges

  // Calculated multiplier over BSP
  const landedMultiplier = baseAgreementValue > 0 ? totalLandedCost / baseAgreementValue : 1.30
  const extraOverBspPct = Math.round((landedMultiplier - 1) * 100)

  return (
    <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[28px] p-6 sm:p-8 shadow-[0_2px_16px_rgba(0,0,0,0.03)] space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                True Cost &amp; Landed Purchase Sheet
              </h2>
              <p className="text-[12px] text-gray-500 font-medium">
                Complete UP statutory schedule (Stamp Duty, Registration, GST) + Society infrastructure charges.
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Pills */}
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl self-start sm:self-auto">
          {availableBhks.map((bhk) => (
            <button
              key={bhk}
              type="button"
              onClick={() => {
                setSelectedBhk(bhk)
                setCustomArea(null)
                setCustomBspRate(null)
              }}
              className={`text-[12px] font-black px-4 py-2 rounded-xl transition-all cursor-pointer ${
                selectedBhk === bhk
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {bhk}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Reality Callout: The +28-35% Landed Reality */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-blue-200 block mb-1">
              Base Sale Price (BSP)
            </span>
            <div className="text-[28px] sm:text-[34px] font-black tracking-tight">
              {fmtRs(baseAgreementValue)}
            </div>
            <p className="text-[12px] text-blue-100 mt-1 font-medium">
              {areaSqft} sq.ft @ ₹{baseRatePerSqft.toLocaleString('en-IN')}/sq.ft
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 text-center">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-blue-200">
              True Landed Multiplier
            </span>
            <span className="text-[26px] font-black mt-0.5 text-amber-300">
              +{extraOverBspPct}% Over BSP
            </span>
            <span className="text-[11px] text-white/80 font-semibold mt-0.5">
              ({landedMultiplier.toFixed(2)}x Base Multiplier)
            </span>
          </div>

          <div className="text-left md:text-right">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-blue-200 block mb-1">
              True All-In Acquisition Cost
            </span>
            <div className="text-[28px] sm:text-[34px] font-black text-emerald-300 tracking-tight">
              {fmtRs(totalLandedCost)}
            </div>
            <p className="text-[12px] text-blue-100 mt-1 font-medium">
              (₹{(totalLandedCost / 10000000).toFixed(2)} Cr Total Out-of-Pocket)
            </p>
          </div>
        </div>
      </div>

      {/* Parameter Adjustment Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200/80 dark:border-zinc-800">
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
            Super Area (sq.ft)
          </label>
          <input
            type="number"
            value={areaSqft}
            onChange={(e) => setCustomArea(Number(e.target.value))}
            className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
            Base Rate (₹/sq.ft)
          </label>
          <input
            type="number"
            value={baseRatePerSqft}
            onChange={(e) => setCustomBspRate(Number(e.target.value))}
            className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
            Buyer Registry Category
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['joint', 'male', 'female'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setBuyerGender(g)}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer capitalize ${
                  buyerGender === g
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comprehensive Line-Item Itemized Breakdown Table */}
      <div className="space-y-4">
        <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt size={18} className="text-blue-600" /> Itemized Cost Breakdown
        </h3>

        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 font-bold border-b border-zinc-200/80 dark:border-zinc-700/80">
              <tr>
                <th className="py-3 px-4">Component &amp; Legal Description</th>
                <th className="py-3 px-4">Rate Basis</th>
                <th className="py-3 px-4">Stage Payable</th>
                <th className="py-3 px-4 text-right">Payable Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {/* 1. Base Agreement Value */}
              <tr className="bg-blue-50/30 dark:bg-blue-950/20 font-bold">
                <td className="py-3 px-4 text-zinc-900 dark:text-white">
                  Base Agreement Value (BSP)
                </td>
                <td className="py-3 px-4 text-zinc-500">
                  {areaSqft} sq.ft × ₹{baseRatePerSqft.toLocaleString('en-IN')}/sq.ft
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold text-[10.5px]">
                    Milestone-linked
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-black text-zinc-900 dark:text-white">
                  {fmtRs(baseAgreementValue)}
                </td>
              </tr>

              {/* 2. GST */}
              <tr>
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900 dark:text-white">Goods &amp; Services Tax (GST)</div>
                  <div className="text-[11px] text-zinc-500">
                    {hasFullOc ? '0% Exempted (Ready to Move with Full OC)' : '5% Non-ITC Standard for Under Construction'}
                  </div>
                </td>
                <td className="py-3 px-4 text-zinc-500">{gstRatePct}% on BSP</td>
                <td className="py-3 px-4">With each slab demand</td>
                <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                  {fmtRs(gstAmount)}
                </td>
              </tr>

              {/* 3. UP Stamp Duty */}
              <tr>
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900 dark:text-white">UP Stamp Duty</div>
                  <div className="text-[11px] text-zinc-500">
                    Mandatory stamp duty paid directly to UP Stamp &amp; Registration Dept
                  </div>
                </td>
                <td className="py-3 px-4 text-zinc-500">{stampDutyPct}% of Agreement Value</td>
                <td className="py-3 px-4">Registry / Possession</td>
                <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                  {fmtRs(stampDutyAmount)}
                </td>
              </tr>

              {/* 4. UP Registration Fee */}
              <tr>
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900 dark:text-white">UP Sub-Registrar Fee</div>
                  <div className="text-[11px] text-zinc-500">Sub-lease deed registry fee at Noida/Gr. Noida Sub-Registrar office</div>
                </td>
                <td className="py-3 px-4 text-zinc-500">1.0% of Agreement Value</td>
                <td className="py-3 px-4">Registry / Possession</td>
                <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                  {fmtRs(registrationFee)}
                </td>
              </tr>

              {/* 5. Legal & Documentation */}
              <tr>
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900 dark:text-white">Advocate Documentation &amp; Legal Charges</div>
                  <div className="text-[11px] text-zinc-500">Builder panel lawyer fee for Agreement to Sell &amp; Sub-lease execution</div>
                </td>
                <td className="py-3 px-4 text-zinc-500">Fixed statutory</td>
                <td className="py-3 px-4">On Booking / Registry</td>
                <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                  {fmtRs(legalFee)}
                </td>
              </tr>

              {/* 6. IFMS */}
              <tr>
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900 dark:text-white">Interest-Free Maintenance Security (IFMS)</div>
                  <div className="text-[11px] text-zinc-500">Transferred 100% to Apartment Owners Association (AOA) upon RWA handover</div>
                </td>
                <td className="py-3 px-4 text-zinc-500">₹{ifmsPerSqft}/sq.ft</td>
                <td className="py-3 px-4">Possession notice</td>
                <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                  {fmtRs(ifmsAmount)}
                </td>
              </tr>

              {/* 7. Advance Maintenance */}
              <tr>
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900 dark:text-white">Advance Maintenance (12 Months)</div>
                  <div className="text-[11px] text-zinc-500">First-year society upkeep @ ₹{monthlyMaintenanceRate}/sq.ft/month</div>
                </td>
                <td className="py-3 px-4 text-zinc-500">₹{monthlyMaintenanceRate}/sq.ft/mo</td>
                <td className="py-3 px-4">Possession notice</td>
                <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                  {fmtRs(advanceMaintenanceAmount)}
                </td>
              </tr>

              {/* 8. Dual Prepaid Meter */}
              <tr>
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900 dark:text-white">Dual Prepaid Meter Connection</div>
                  <div className="text-[11px] text-zinc-500">
                    Dual source smart register (PVVNL Grid + DG GenSet backup) installation &amp; energization
                  </div>
                </td>
                <td className="py-3 px-4 text-zinc-500">Fixed installation</td>
                <td className="py-3 px-4">Possession notice</td>
                <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                  {fmtRs(meterCharges)}
                </td>
              </tr>

              {/* 9. Club Membership */}
              <tr>
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900 dark:text-white">Club Membership &amp; Amenities Development</div>
                  <div className="text-[11px] text-zinc-500">Lifetime access to clubhouse, swimming pool, sports courts &amp; gym</div>
                </td>
                <td className="py-3 px-4 text-zinc-500">Fixed development</td>
                <td className="py-3 px-4">Possession notice</td>
                <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                  {fmtRs(clubCharges)}
                </td>
              </tr>

              {/* Total Footer */}
              <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-black text-sm">
                <td className="py-4 px-4" colSpan={3}>
                  TOTAL ALL-IN LANDED PURCHASE COST
                </td>
                <td className="py-4 px-4 text-right text-emerald-600 dark:text-emerald-400 text-base">
                  {fmtRs(totalLandedCost)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Advisory & Living Standards Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-3">
        <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-bold">PropFyndr Transparency Commitment:</p>
          <p className="leading-relaxed opacity-90">
            Unlike builder brochures that advertise only the Base Sale Price, PropFyndr’s True Cost calculator factors in all UP statutory dues, dual meters, and IFMS upfront. Always budget 28% to 35% above the quoted BSP when acquiring residential property in Noida and Greater Noida.
          </p>
        </div>
      </div>
    </div>
  )
}
