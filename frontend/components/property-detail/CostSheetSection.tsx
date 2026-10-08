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
import { calculateStampDuty, calculateGst } from '@/lib/calculators'

export const NOT_ON_RECORD = 'Not on record — ask the builder in writing'

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
    if (!unitTypes || unitTypes.length === 0) return []
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

  // Every builder charge below comes from this project's cost_sheet row. A
  // charge we don't hold is shown as NOT_ON_RECORD and left out of the totals —
  // never replaced with a typical Noida figure.
  const cs = detail?.cost_sheet ?? null

  // No unit area → no per-sqft charges. No price → no sheet.
  const areaSqft: number | null = customArea ?? unit?.super_area_sqft ?? null
  const unitPriceRs = unit?.price_min_cr ? unit.price_min_cr * 10000000 : null
  const baseRatePerSqft: number | null =
    customBspRate ?? cs?.base_price_per_sqft ?? (unitPriceRs && areaSqft ? Math.round(unitPriceRs / areaSqft) : null)
  const baseSalePrice: number | null =
    areaSqft && baseRatePerSqft ? areaSqft * baseRatePerSqft : unitPriceRs

  // PLC is a list of options (corner, park, floor) — which apply depends on the unit,
  // so it is not summed into the agreement value.
  const plcOptions = cs?.plc_charges ?? []
  const coveredParking = cs?.parking_cost ?? null
  const clubhouseCharges = cs?.club_membership ?? null
  const otherCharges = (cs?.other_charges ?? []).length > 0 && baseSalePrice != null
    ? (cs?.other_charges ?? []).reduce(
        (s, c) => s + (typeof c.amount === 'number' ? c.amount : typeof c.percent === 'number' ? Math.round(baseSalePrice * c.percent / 100) : 0),
        0,
      )
    : null

  const sum = (...xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0)

  // Agreement Value subject to Stamp Duty & Registration
  const agreementValue = baseSalePrice != null ? sum(baseSalePrice, coveredParking, clubhouseCharges, otherCharges) : null

  // Status & Statutory Schedule — rates from lib/calculators (UP statutory)
  const isReadyToMove = detail?.status === 'ready_to_move'
  const hasOc = detail?.oc_status === 'FULL_OC' || isReadyToMove

  const stamp = agreementValue != null ? calculateStampDuty(agreementValue / 10000000, buyerGender) : null
  const gst = agreementValue != null
    ? (cs?.gst_applicable === false
        ? { gst_amount: 0, gst_rate: 0 }
        : calculateGst(agreementValue / 10000000, hasOc ? 'ready_to_move' : 'under_construction'))
    : null
  const gstAmount = gst?.gst_amount ?? null
  const stampDutyRate = stamp?.stamp_duty_rate ?? calculateStampDuty(0, buyerGender).stamp_duty_rate
  const stampDutyAmount = stamp?.stamp_duty ?? null
  const registrationAmount = stamp?.registration ?? null

  // Possession & Operational charges (rupees, per the cost_sheet convention)
  const ifmsAmount = cs?.ifms ?? null
  const monthlyMaintRate = cs?.maintenance_psf_monthly ?? detail?.maintenance_per_sqft_monthly ?? null
  const advanceMaintenanceMonths = 12
  const advanceMaintenanceAmount = monthlyMaintRate != null && areaSqft
    ? Math.round(areaSqft * monthlyMaintRate * advanceMaintenanceMonths)
    : null
  const electricityCharges = cs?.electricity_connection ?? null
  const waterSewerCharges = cs?.water_sewer_connection ?? null

  // Total Statutory & Government Outgo
  const statutoryTotal = sum(gstAmount, stampDutyAmount, registrationAmount)

  // Total Possession & Operational Outgo
  const possessionOutgoTotal = sum(ifmsAmount, advanceMaintenanceAmount, electricityCharges, waterSewerCharges)

  // Total of the charges on record (missing ones are excluded, and flagged in the UI)
  const landedTotalCost = agreementValue != null ? agreementValue + statutoryTotal + possessionOutgoTotal : null
  const missingCount = [coveredParking, clubhouseCharges, ifmsAmount, advanceMaintenanceAmount, electricityCharges]
    .filter((x) => x == null).length

  const outOfPocketDeltaPercent = landedTotalCost != null && baseSalePrice
    ? Math.round((landedTotalCost / baseSalePrice - 1) * 100)
    : null

  const money = (v: number | null) =>
    v != null
      ? <span className="font-bold text-gray-900 dark:text-white">{fmtRs(v)}</span>
      : <span className="text-[11px] font-medium text-gray-400 text-right">{NOT_ON_RECORD}</span>

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
              {outOfPocketDeltaPercent != null && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">
                  +{outOfPocketDeltaPercent}% over Base BSP
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-[28px] sm:text-[34px] font-black tracking-tight text-white">
                {landedTotalCost != null ? fmtCr(landedTotalCost / 10000000) : 'Price not on record'}
              </span>
              {baseSalePrice != null && (
                <span className="text-[13px] text-indigo-200/80 line-through">
                  BSP: {fmtCr(baseSalePrice / 10000000)}
                </span>
              )}
            </div>
            <p className="text-[12px] text-indigo-200/90 font-medium mt-1">
              {landedTotalCost == null
                ? 'We do not hold a price for this unit — ask the builder for a written cost sheet.'
                : missingCount > 0
                  ? `Total of the charges on record. ${missingCount} builder charge${missingCount > 1 ? 's are' : ' is'} not on record and not included — ask the builder in writing.`
                  : 'Total cheque + statutory outflow required to take legal possession, from the charges on record.'}
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
                  {`${gender === 'joint' ? 'Joint' : gender === 'female' ? 'Sole Female' : 'Male'} (${calculateStampDuty(0, gender).stamp_duty_rate}%)`}
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
                Under-Construction: {gst?.gst_rate ?? 5}% GST Applicable{gstAmount != null ? ` (${fmtRs(gstAmount)})` : ''}
              </span>
            )}
          </div>
          {areaSqft && baseRatePerSqft ? (
            <span className="text-white/60 text-[11px]">
              Super Area: <strong className="text-white">{areaSqft.toLocaleString('en-IN')} sq.ft</strong> @{' '}
              <strong className="text-white">₹{baseRatePerSqft.toLocaleString('en-IN')}/sq.ft</strong>
            </span>
          ) : (
            <span className="text-white/60 text-[11px]">Unit area not on record — per-sq.ft charges not computed</span>
          )}
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
              {agreementValue != null ? fmtRs(agreementValue) : '—'}
            </span>
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span>Base Sale Price{areaSqft ? ` (${areaSqft} sqft)` : ''}</span>
              {money(baseSalePrice)}
            </div>
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1">
                PLC (Floor / Green / Road)
              </span>
              {plcOptions.length > 0
                ? <span className="text-[11px] font-medium text-gray-500 text-right">Unit-dependent — {plcOptions.map((p) => p.label).join(', ')}</span>
                : <span className="text-[11px] font-medium text-gray-400 text-right">{NOT_ON_RECORD}</span>}
            </div>
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span>Covered Car Parking</span>
              {money(coveredParking)}
            </div>
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span>Clubhouse Membership</span>
              {money(clubhouseCharges)}
            </div>
            {otherCharges != null && (
              <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
                <span>Other Charges on record</span>
                {money(otherCharges)}
              </div>
            )}
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
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span>UP Stamp Duty ({stampDutyRate}%)</span>
              {money(stampDutyAmount)}
            </div>
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span>UP Registration Fee (1%)</span>
              {money(registrationAmount)}
            </div>
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span>GST {hasOc ? '(0% - OC Exempt)' : `(${gst?.gst_rate ?? 5}% - Under Construction)`}</span>
              {money(gstAmount)}
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
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span>IFMS Security</span>
              {money(ifmsAmount)}
            </div>
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span>12 Months Maint.{monthlyMaintRate != null ? ` (₹${monthlyMaintRate}/sqft)` : ''}</span>
              {money(advanceMaintenanceAmount)}
            </div>
            <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
              <span>Electricity Connection</span>
              {money(electricityCharges)}
            </div>
            {waterSewerCharges != null && (
              <div className="flex justify-between items-center gap-3 text-gray-600 dark:text-gray-300">
                <span>Water & Sewer Connection</span>
                {money(waterSewerCharges)}
              </div>
            )}
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
                  {detail?.water_source_type ? detail.water_source_type.replace('_', ' ') : 'Not verified'}
                </strong>{' '}
                {detail?.water_tds_range && `(${detail.water_tds_range})`}
              </span>
              <span>•</span>
              <span>
                Power Metering:{' '}
                <strong className="text-gray-900 dark:text-white capitalize">
                  {detail?.power_supply_type ? detail.power_supply_type.replace('_', ' ') : 'Not verified'}
                </strong>
              </span>
              <span>•</span>
              <span>
                DG Rate:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {detail?.dg_power_rate_per_unit != null ? `₹${detail.dg_power_rate_per_unit}/unit` : 'Not verified'}
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
