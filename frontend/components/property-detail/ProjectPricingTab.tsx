'use client'
import { useState, useEffect } from 'react'
import {
  FileText, CalendarDays, Percent, ShieldCheck, Download, CheckCircle2,
  TrendingUp, Home, ArrowUpRight, PhoneCall, IndianRupee,
  MessageSquare, ChevronRight, Calculator, Landmark, Award, Gift, Clock, HelpCircle, Check, Info, X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ProjectDetail, UnitTypeSummary, PaymentPlan } from '@/types/project'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import { PricingTabSkeleton } from '@/components/skeletons'
import { track } from '@/lib/analytics'
import CostSheetTab from './CostSheetTab'

export interface ProjectPricingTabProps {
  unitTypes: UnitTypeSummary[]
  detail: ProjectDetail | null
  loading?: boolean
  onGoToCosts: () => void
}

type PlanTypeKey = 'clp' | 'investor' | 'flexi' | 'full'

// Normalized shape covering both DB milestones ({label, percent, due}) and the
// fallback template milestones ({milestone, due, pct}) rendered by this component.
interface MilestoneItem {
  milestone?: string
  label?: string
  name?: string
  stage?: string
  phase?: string
  due?: string
  desc?: string
  description?: string
  pct?: number
  percent?: number
  percentage?: number
  amt?: number
  amount?: number
  done?: boolean
}

function getMilestonePct(item: MilestoneItem): number {
  const raw = item.pct ?? item.percent ?? item.percentage
  if (raw == null) return 0
  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw).replace('%', '').trim())
  return isNaN(parsed) ? 0 : parsed
}

function fmtCr(cr: number | null): string {
  if (cr == null) return '—'
  return `₹${cr.toFixed(2)} Cr`
}

function fmtRs(num: number): string {
  return `₹${Math.round(num).toLocaleString('en-IN')}`
}

// Small visual flag reused wherever a shown value is a fallback estimate rather than verified project data.
function EstimatedBadge() {
  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 align-middle">
      Est.
    </span>
  )
}

export default function ProjectPricingTab({ unitTypes, detail, loading, onGoToCosts }: ProjectPricingTabProps) {
  const availableBhks = unitTypes.length > 0 ? Array.from(new Set(unitTypes.map(u => `${u.bhk} BHK`))) : []
  const [bhkFilterState, setBhkFilter] = useState<string>(availableBhks[0] ?? '')
  const bhkFilter = availableBhks.includes(bhkFilterState) ? bhkFilterState : (availableBhks[0] ?? '')

  // Selected unit details
  const selectedUnit = unitTypes.find(u => `${u.bhk} BHK` === bhkFilter) || unitTypes[0]
  const unitMinCr: number | null = selectedUnit?.price_min_cr ?? null
  const unitMaxCr: number | null = selectedUnit?.price_max_cr ?? null
  const unitAreaSqft: number | null = selectedUnit?.super_area_sqft ?? null

  // Interactive EMI State (synced precisely with property price & selected unit)
  const [propertyPrice, setPropertyPrice] = useState<number>(unitMinCr ? unitMinCr * 10000000 : 0)
  const [downPaymentPct, setDownPaymentPct] = useState<number>(20)
  const [tenureYears, setTenureYears] = useState<number>(20)

  const isRTM = detail?.status === 'ready_to_move'

  // Payment Plan Selection State & Configuration Picker
  const [selectedPlanTab, setSelectedPlanTab] = useState<'clp' | 'investor' | 'flexi' | 'full'>(isRTM ? 'full' : 'clp')

  // Cost Breakdown Toggle State & Donut Hover Isolation State
  const [costBreakdownStage, setCostBreakdownStage] = useState<'construction' | 'possession'>(isRTM ? 'possession' : 'construction')
  const [hoveredCostIdx, setHoveredCostIdx] = useState<number | null>(null)

  // Modal States for Plan Comparison & Check Eligibility
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false)
  const [showEligibilityModal, setShowEligibilityModal] = useState<boolean>(false)
  const [showAllMilestones, setShowAllMilestones] = useState<boolean>(false)

  // Loan eligibility (45% FOIR affordability against user's monthly income)
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0)

  if (loading && !detail) {
    return <PricingTabSkeleton />
  }

  // DB-backed payment plan & cost sheet properties
  const dbPaymentPlan = detail?.payment_plan ?? null
  const dbCostSheet = detail?.cost_sheet ?? null

  const interestRatePct = dbCostSheet?.base_interest_rate ?? 8.5

  const downPaymentAmount = propertyPrice * (downPaymentPct / 100)
  const loanAmount = Math.max(0, propertyPrice - downPaymentAmount)
  const monthlyRate = interestRatePct / 12 / 100
  const totalMonths = tenureYears * 12

  const estimatedEmi = loanAmount > 0 && monthlyRate > 0
    ? Math.round((loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1))
    : 0

  const totalPayment = estimatedEmi * totalMonths
  const totalInterest = Math.max(0, totalPayment - loanAmount)

  const maxEmiFromIncome = monthlyIncome * 0.45
  const eligibleLoanAmount = monthlyRate > 0 && maxEmiFromIncome > 0
    ? (maxEmiFromIncome * (Math.pow(1 + monthlyRate, totalMonths) - 1)) / (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))
    : 0
  const eligiblePropertyPriceCr = downPaymentPct < 100
    ? (eligibleLoanAmount / (1 - downPaymentPct / 100)) / 10000000
    : 0
  const hasIncomeInput = monthlyIncome > 0
  const meetsUnitPrice = hasIncomeInput && unitMinCr != null && eligiblePropertyPriceCr >= unitMinCr

  const waUrl = detail ? buildWhatsAppUrl(detail, 'panel') : null
  const reraNum = detail?.rera_number ?? null
  const possessionLabel = detail?.possession_label ?? (isRTM ? 'Delivered & Ready' : null)
  const pricePsf: number | null = unitMinCr && unitAreaSqft ? Math.round((unitMinCr * 10000000) / unitAreaSqft) : null

  const dbPlansList = Array.isArray(detail?.payment_plans) ? detail.payment_plans : (dbPaymentPlan ? [dbPaymentPlan] : [])

  const PLAN_TYPE_ALIASES: Record<string, string[]> = {
    clp: ['construction_linked', 'clp'],
    investor: ['investor', 'down_payment'],
    flexi: ['flexi', 'easy_payment'],
    full: ['full', 'full_payment', 'possession_linked'],
  }

  const findPlanByType = (typeKey: string): PaymentPlan | undefined =>
    dbPlansList.find((p) => p.plan_type === typeKey || PLAN_TYPE_ALIASES[typeKey]?.includes(p.plan_type))

  const getMilestonesForType = (typeKey: string, fallback: MilestoneItem[]): MilestoneItem[] => {
    const matchedPlan = findPlanByType(typeKey)
    return matchedPlan?.milestones?.length ? matchedPlan.milestones : fallback
  }

  // Dynamic payment plan milestones derived from DB or structured templates
  const paymentPlanMilestones: Record<PlanTypeKey, MilestoneItem[]> = {
    clp: getMilestonesForType('clp', isRTM ? [
      { milestone: 'Booking Amount', due: 'At the time of booking token', pct: 10 },
      { milestone: 'Within 30 Days of Booking', due: 'Agreement execution & bank sanction', pct: 15 },
      { milestone: 'At Key Handover & Possession', due: 'Immediate OC occupancy & key transfer', pct: 75 }
    ] : [
      { milestone: 'At the Time of Booking', due: 'Within 15 days of booking token', pct: 10 },
      { milestone: 'Within 30 Days of Booking', due: 'Agreement execution & stamp registration', pct: 10 },
      { milestone: 'On Excavation & Substructure', due: 'Substructure & basement raft completion', pct: 15 },
      { milestone: 'On Completion of Superstructure', due: 'Top slab casting across core towers', pct: 25 },
      { milestone: 'On External Facade & Plaster', due: 'Exterior double-glazed glass & painting', pct: 20 },
      { milestone: 'At the Time of Offer of Possession', due: 'Final keys handover & registry execution', pct: 20 }
    ]),
    investor: getMilestonesForType('investor', isRTM ? [
      { milestone: 'Token Booking Amount', due: 'At booking time', pct: 10 },
      { milestone: 'Within 45 Days', due: 'Agreement execution & allotment', pct: 20 },
      { milestone: 'On Handover & Registry', due: 'Final key handover & instant registry', pct: 70 }
    ] : [
      { milestone: 'Booking Amount', due: 'At the time of booking', pct: 20 },
      { milestone: 'Within 60 Days', due: 'Allotment & agreement execution', pct: 30 },
      { milestone: 'On Completion of Superstructure', due: 'Tower roof slab completion', pct: 30 },
      { milestone: 'At the Time of Possession', due: 'Keys handover & registry', pct: 20 }
    ]),
    flexi: getMilestonesForType('flexi', isRTM ? [
      { milestone: 'Booking Token Amount', due: 'Immediate token payment', pct: 10 },
      { milestone: 'Bank Loan / Flexi Disbursal', due: 'Sanction from ICICI/HDFC/SBI', pct: 80 },
      { milestone: 'On Keys Handover', due: 'Final occupancy & unit handover', pct: 10 }
    ] : [
      { milestone: 'Booking Token Amount', due: 'Immediate token payment', pct: 10 },
      { milestone: 'Flexi Bullet Installments', due: 'Quarterly milestone bullet payments', pct: 50 },
      { milestone: 'On Finishing & Fit-outs', due: 'Pre-handover audit check', pct: 20 },
      { milestone: 'On Offer of Possession', due: 'Final keys & registry execution', pct: 20 }
    ]),
    full: getMilestonesForType('full', isRTM ? [
      { milestone: 'Booking Token Amount', due: 'At booking time', pct: 10 },
      { milestone: 'Full Settlement & Handover', due: 'Within 30 days (Instant Possession & Registry)', pct: 90 }
    ] : [
      { milestone: 'Booking Token Amount', due: 'At booking time', pct: 10 },
      { milestone: 'Down Payment Balance', due: 'Within 45 days of booking', pct: 90 }
    ])
  }

  const matchedPlanEntries = (['clp', 'investor', 'flexi', 'full'] as const)
    .map((typeKey) => {
      const matched = findPlanByType(typeKey)
      if (!matched) return null
      const milestones = paymentPlanMilestones[typeKey] || []
      const lastPct = milestones.length > 0 ? getMilestonePct(milestones[milestones.length - 1]) : 0
      return { typeKey, plan: matched, prePossessionPct: 100 - lastPct }
    })
    .filter((x): x is { typeKey: PlanTypeKey; plan: PaymentPlan; prePossessionPct: number } => x !== null)

  // Booking-amount stat card: only show a specific % when it's the real first milestone of a DB-backed plan
  const isSelectedPlanFromDb = !!findPlanByType(selectedPlanTab)?.milestones?.length
  const selectedPlanMilestones = paymentPlanMilestones[selectedPlanTab] || []
  const bookingAmountPct = isSelectedPlanFromDb && selectedPlanMilestones.length > 0
    ? getMilestonePct(selectedPlanMilestones[0])
    : null

  const planLabel = (typeKey: string, fallback: string) => {
    const entry = matchedPlanEntries.find((p) => p.typeKey === typeKey)
    return entry?.plan.plan_name || fallback
  }

  const lowestOutgoEntry = matchedPlanEntries.length > 0
    ? matchedPlanEntries.reduce((min, p) => (p.prePossessionPct < min.prePossessionPct ? p : min))
    : null
  const withDiscount = matchedPlanEntries.filter((p) => p.plan.discount_offered_pct != null)
  const maxDiscountEntry = withDiscount.length > 0
    ? withDiscount.reduce((max, p) => ((p.plan.discount_offered_pct ?? 0) > (max.plan.discount_offered_pct ?? 0) ? p : max))
    : matchedPlanEntries.find((p) => p.typeKey === 'full') ?? null
  const bestRoiEntry = matchedPlanEntries.find((p) => p.typeKey === 'investor') ?? null
  const mostPopularEntry = matchedPlanEntries.find((p) => p.typeKey === 'clp') ?? matchedPlanEntries[0] ?? null

  const planComparisonStrip = [
    lowestOutgoEntry && { icon: Percent, title: 'Lowest Outgo', val: planLabel(lowestOutgoEntry.typeKey, 'Flexi Plan'), color: 'text-blue-600 bg-blue-50' },
    bestRoiEntry && { icon: TrendingUp, title: 'Best for ROI', val: planLabel('investor', 'Investor Plan'), color: 'text-emerald-600 bg-emerald-50' },
    maxDiscountEntry && { icon: Award, title: 'Max Discount', val: planLabel(maxDiscountEntry.typeKey, 'Full Payment'), color: 'text-amber-600 bg-amber-50' },
    mostPopularEntry && { icon: Landmark, title: 'Most Popular', val: planLabel(mostPopularEntry.typeKey, 'Construction Linked'), color: 'text-purple-600 bg-purple-50' },
  ].filter((x): x is { icon: LucideIcon; title: string; val: string; color: string } => x !== null)

  // Plan Comparison Modal rows — same milestone source as the on-page Milestone Schedule, so they can't disagree
  const PLAN_ROW_META: Record<string, { label: string; color: string; bestFor: string }> = {
    clp: { label: 'Construction Linked', color: 'text-blue-600', bestFor: 'Most Home Buyers' },
    investor: { label: 'Investor Plan', color: 'text-emerald-600', bestFor: 'Higher Capital Growth' },
    flexi: { label: 'Flexi Plan', color: 'text-purple-600', bestFor: 'Lower Initial Outgo' },
    full: { label: 'Full Payment', color: 'text-amber-600', bestFor: 'Max Discount Buyers' }
  }
  const planCompareRows = (['clp', 'investor', 'flexi', 'full'] as const).map((typeKey) => {
    const milestones = paymentPlanMilestones[typeKey] || []
    const bookingPct = milestones.length > 0 ? getMilestonePct(milestones[0]) : 0
    const possessionPct = milestones.length > 0 ? getMilestonePct(milestones[milestones.length - 1]) : 0
    const constructionPct = Math.max(0, 100 - bookingPct - possessionPct)
    const meta = PLAN_ROW_META[typeKey]
    const matchedEntry = matchedPlanEntries.find((p) => p.typeKey === typeKey)
    return {
      typeKey,
      label: matchedEntry?.plan.plan_name || meta.label,
      color: meta.color,
      bookingPct,
      constructionPct,
      possessionPct,
      bestFor: matchedEntry?.plan.best_for || meta.bestFor
    }
  })

  // Dynamic Cost Sheet Rates from DB (all from project.cost_sheet)
  const stampDutyPct = dbCostSheet?.stamp_duty_pct ?? 6.0
  const isStampEstimated = dbCostSheet?.stamp_duty_pct == null
  const regPct = dbCostSheet?.registration_pct ?? 1.0
  const isRegEstimated = dbCostSheet?.registration_pct == null
  const gstPct = dbCostSheet?.gst_rate_pct ?? 5.0
  const isGstEstimated = dbCostSheet?.gst_rate_pct == null
  const clubAmt = dbCostSheet?.club_membership ?? 200000
  const isClubEstimated = dbCostSheet?.club_membership == null
  const ifmsAmt = dbCostSheet?.ifms ?? 75000
  const isIfmsEstimated = dbCostSheet?.ifms == null
  const utilFieldsAllMissing = dbCostSheet?.electricity_connection == null && dbCostSheet?.water_sewer_connection == null && dbCostSheet?.maintenance_psf_monthly == null
  const utilAmt = utilFieldsAllMissing
    ? 125000
    : (dbCostSheet?.electricity_connection ?? 0) + (dbCostSheet?.water_sewer_connection ?? 0) + (dbCostSheet?.maintenance_psf_monthly ?? 0)
  const isUtilEstimated = utilFieldsAllMissing

  const baseCostVal = propertyPrice

  // Sum PLC charges from dbCostSheet.plc_charges JSON array if present
  const rawPlcArray = dbCostSheet?.plc_charges ?? []
  let calcPlcVal = 0
  for (const item of rawPlcArray) {
    if (typeof item.amount === 'number') calcPlcVal += item.amount
    else if (typeof item.percent === 'number') calcPlcVal += Math.round(baseCostVal * (item.percent / 100))
  }
  const hasPlcData = rawPlcArray.length > 0
  const plcCostVal = hasPlcData ? calcPlcVal : Math.round(baseCostVal * 0.02)
  const isPlcEstimated = !hasPlcData

  // Sum Other charges from dbCostSheet.other_charges JSON array if present
  const rawOtherArray = dbCostSheet?.other_charges ?? []
  let calcOtherVal = 0
  for (const item of rawOtherArray) {
    if (typeof item.amount === 'number') calcOtherVal += item.amount
    else if (typeof item.percent === 'number') calcOtherVal += Math.round(baseCostVal * (item.percent / 100))
  }
  const hasOtherData = rawOtherArray.length > 0
  const otherCostVal = hasOtherData ? calcOtherVal : 125000
  const isOtherEstimated = !hasOtherData

  const clubCostVal = clubAmt
  const ifmsCostVal = ifmsAmt
  const constructionTotalCost = baseCostVal + plcCostVal + clubCostVal + ifmsCostVal + otherCostVal

  const stampDutyCost = Math.round(baseCostVal * (stampDutyPct / 100))
  const regCost = Math.round(baseCostVal * (regPct / 100))
  const gstCost = Math.round(baseCostVal * (gstPct / 100))
  const utilitiesCost = utilAmt
  const totalPossessionAdditions = stampDutyCost + regCost + gstCost + utilitiesCost
  const grandTotalAtPossession = constructionTotalCost + totalPossessionAdditions

  useEffect(() => {
    if (detail?.name && selectedUnit && grandTotalAtPossession > 0) {
      track('cost_sheet_calculated', {
        project_name: detail.name,
        unit_bhk: selectedUnit.bhk ? `${selectedUnit.bhk} BHK` : bhkFilter,
        total_landed_cost: grandTotalAtPossession,
      })
    }
  }, [detail?.name, selectedUnit?.bhk, bhkFilter, propertyPrice, grandTotalAtPossession])

  // Adaptive breakdown components based on Stage Toggle (At Booking vs At Possession)
  const breakdownComponents = !unitAreaSqft ? [] : costBreakdownStage === 'construction' ? [
    { id: 'base', name: `Base Price (${unitAreaSqft.toLocaleString('en-IN')} sq.ft)`, amount: baseCostVal, pct: ((baseCostVal / constructionTotalCost) * 100).toFixed(1) + '%', color: 'bg-[#2563EB]', stroke: '#2563EB', estimated: false },
    { id: 'plc', name: 'PLC Charges', amount: plcCostVal, pct: ((plcCostVal / constructionTotalCost) * 100).toFixed(1) + '%', color: 'bg-indigo-500', stroke: '#6366F1', estimated: isPlcEstimated },
    { id: 'club', name: 'Club Membership', amount: clubCostVal, pct: ((clubCostVal / constructionTotalCost) * 100).toFixed(1) + '%', color: 'bg-amber-400', stroke: '#FBBF24', estimated: isClubEstimated },
    { id: 'ifms', name: 'IFMS (Advance)', amount: ifmsCostVal, pct: ((ifmsCostVal / constructionTotalCost) * 100).toFixed(1) + '%', color: 'bg-orange-500', stroke: '#F97316', estimated: isIfmsEstimated },
    { id: 'other', name: 'Other Charges', amount: otherCostVal, pct: ((otherCostVal / constructionTotalCost) * 100).toFixed(1) + '%', color: 'bg-pink-500', stroke: '#EC4899', estimated: isOtherEstimated }
  ] : [
    { id: 'base', name: `Base Price (${unitAreaSqft.toLocaleString('en-IN')} sq.ft)`, amount: baseCostVal, pct: ((baseCostVal / grandTotalAtPossession) * 100).toFixed(1) + '%', color: 'bg-[#2563EB]', stroke: '#2563EB', estimated: false },
    { id: 'plc', name: 'PLC Charges', amount: plcCostVal, pct: ((plcCostVal / grandTotalAtPossession) * 100).toFixed(1) + '%', color: 'bg-indigo-500', stroke: '#6366F1', estimated: isPlcEstimated },
    { id: 'club', name: 'Club Membership', amount: clubCostVal, pct: ((clubCostVal / grandTotalAtPossession) * 100).toFixed(1) + '%', color: 'bg-amber-400', stroke: '#FBBF24', estimated: isClubEstimated },
    { id: 'ifms', name: 'IFMS (Advance)', amount: ifmsCostVal, pct: ((ifmsCostVal / grandTotalAtPossession) * 100).toFixed(1) + '%', color: 'bg-orange-500', stroke: '#F97316', estimated: isIfmsEstimated },
    { id: 'other', name: 'Other Charges', amount: otherCostVal, pct: ((otherCostVal / grandTotalAtPossession) * 100).toFixed(1) + '%', color: 'bg-pink-500', stroke: '#EC4899', estimated: isOtherEstimated },
    { id: 'stamp', name: `Stamp Duty (${stampDutyPct}%)`, amount: stampDutyCost, pct: ((stampDutyCost / grandTotalAtPossession) * 100).toFixed(1) + '%', color: 'bg-emerald-500', stroke: '#10B981', estimated: isStampEstimated },
    { id: 'reg', name: `Registration (${regPct}%)`, amount: regCost, pct: ((regCost / grandTotalAtPossession) * 100).toFixed(1) + '%', color: 'bg-teal-500', stroke: '#14B8A6', estimated: isRegEstimated },
    { id: 'gst', name: `GST (${gstPct}%)`, amount: gstCost, pct: ((gstCost / grandTotalAtPossession) * 100).toFixed(1) + '%', color: 'bg-purple-500', stroke: '#A855F7', estimated: isGstEstimated },
    { id: 'util', name: 'Utilities & Charges', amount: utilitiesCost, pct: ((utilitiesCost / grandTotalAtPossession) * 100).toFixed(1) + '%', color: 'bg-rose-500', stroke: '#F43F5E', estimated: isUtilEstimated }
  ]

  const activeTotalVal = costBreakdownStage === 'construction' ? constructionTotalCost : grandTotalAtPossession

  const downloadScheduleCSV = () => {
    const activeMilestones = paymentPlanMilestones[selectedPlanTab]
    const headers = ['Milestone', 'Description', 'Percentage Due']
    const rows: string[][] = activeMilestones.map((m) => [m.milestone || m.label || '', m.desc || m.due || '', String(getMilestonePct(m))])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `payment_plan_${selectedPlanTab}_${detail?.name?.replace(/\s+/g, '_') ?? 'project'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-6 md:space-y-8 bg-[#F7F9FB] dark:bg-[#0f0e0d] text-gray-900 dark:text-gray-100 font-sans">

      {/* ── 1. PRICING & INVESTMENT HEADER ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
        
        {/* Header Title & RERA Pill */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
          <div>
            <h1 className="text-[24px] font-black text-gray-900 dark:text-white tracking-tight">Pricing & Investment</h1>
            <p className="text-[13px] text-gray-500 font-medium mt-0.5">Transparent pricing, flexible plans and complete cost breakdown.</p>
          </div>

          {reraNum && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 text-[11.5px] font-extrabold self-start sm:self-auto">
              <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
              <span>RERA verified · {reraNum}</span>
            </div>
          )}
        </div>

        {/* 4 Stat Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <IndianRupee size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] sm:text-[18px] font-black text-gray-900 dark:text-white leading-tight truncate">{fmtCr(unitMinCr)}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold mt-0.5 leading-tight line-clamp-1 sm:line-clamp-none">Starting Price (All Incl.)</p>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] sm:text-[18px] font-black text-gray-900 dark:text-white leading-tight truncate">₹{pricePsf ? pricePsf.toLocaleString('en-IN') : '—'}/sqft</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold mt-0.5 leading-tight line-clamp-1 sm:line-clamp-none">Avg. Price per sq.ft</p>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <CalendarDays size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] sm:text-[18px] font-black text-gray-900 dark:text-white leading-tight truncate">{possessionLabel}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold mt-0.5 leading-tight line-clamp-1 sm:line-clamp-none">Expected Possession</p>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Percent size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] sm:text-[18px] font-black text-gray-900 dark:text-white leading-tight truncate">{bookingAmountPct != null ? `${bookingAmountPct}%` : 'Varies by plan'}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold mt-0.5 leading-tight line-clamp-1 sm:line-clamp-none">Booking Amount</p>
            </div>
          </div>
        </div>

        {/* Configuration Selector Pills & View Price List */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[12.5px] font-extrabold text-gray-700 dark:text-gray-300 mr-2 flex-shrink-0">Select Configuration</span>
            {availableBhks.map((bhk) => (
              <button
                key={bhk}
                onClick={() => {
                  setBhkFilter(bhk)
                  const unit = unitTypes.find(u => `${u.bhk} BHK` === bhk)
                  if (unit?.price_min_cr) setPropertyPrice(unit.price_min_cr * 10000000)
                }}
                className={`text-[12px] font-extrabold px-4 py-2 rounded-full transition-all whitespace-nowrap ${
                  bhkFilter === bhk
                    ? 'bg-[#111827] text-white dark:bg-white dark:text-gray-900 shadow-md'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200/60'
                }`}
              >
                {bhk}
              </button>
            ))}
          </div>

          <button
            onClick={downloadScheduleCSV}
            className="text-[12px] font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Download size={14} /> View Price List
          </button>
        </div>

      </div>

      {/* ── 2. EMI CALCULATOR & AFFORDABILITY (Left Sliders + Right Bar Chart & Eligibility Card) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Interactive Calculator Controls & Amortization Bar Chart */}
        <div className="lg:col-span-8 bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
          <div>
            <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">EMI Calculator & Affordability</h2>
            <p className="text-[12px] text-gray-500 font-medium mt-0.5">Plan your home loan with our interactive calculator.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Sliders Input Area */}
            <div className="md:col-span-5 space-y-5">
              
              {/* Property Price Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11.5px] font-extrabold">
                  <span className="text-gray-500">Property Price</span>
                  <span className="text-gray-900 dark:text-white font-black">{fmtRs(propertyPrice)}</span>
                </div>
                <input
                  type="range"
                  min={Math.max(1000000, Math.min(propertyPrice * 0.4, 5000000))}
                  max={Math.max(60000000, Math.round(propertyPrice * 1.8))}
                  step={200000}
                  value={propertyPrice}
                  onChange={(e) => setPropertyPrice(Number(e.target.value))}
                  className="w-full accent-blue-600 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-semibold">
                  <span>{fmtRs(Math.max(1000000, Math.min(propertyPrice * 0.4, 5000000)))}</span>
                  <span>{fmtRs(Math.max(60000000, Math.round(propertyPrice * 1.8)))}</span>
                </div>
              </div>

              {/* Down Payment Pct Slider & Quick Pills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11.5px] font-extrabold">
                  <span className="text-gray-500">Down Payment</span>
                  <span className="text-gray-900 dark:text-white font-black">{fmtRs(downPaymentAmount)} ({downPaymentPct}%)</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[10, 20, 30, 40].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setDownPaymentPct(pct)}
                      className={`py-1.5 text-[11px] font-extrabold rounded-lg border transition-all ${
                        downPaymentPct === pct
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-50 dark:bg-white/5 text-gray-600 border-gray-200/60 dark:border-white/5'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={downPaymentPct}
                  onChange={(e) => setDownPaymentPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                  placeholder="Custom %"
                  className="w-full mt-2 px-3 py-2 text-[13px] font-semibold bg-white dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              {/* Loan Tenure Slider & Quick Select Pills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11.5px] font-extrabold">
                  <span className="text-gray-500">Loan Tenure</span>
                  <span className="text-gray-900 dark:text-white font-black">{tenureYears} Years</span>
                </div>
                <div className="grid grid-cols-6 gap-1 pt-1">
                  {[5, 10, 15, 20, 25, 30].map((yr) => (
                    <button
                      key={yr}
                      onClick={() => setTenureYears(yr)}
                      className={`py-1 text-[10.5px] font-extrabold rounded-lg border transition-all ${
                        tenureYears === yr
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200/60 dark:border-white/5 hover:bg-gray-100'
                      }`}
                    >
                      {yr}y
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={5}
                  value={tenureYears}
                  onChange={(e) => setTenureYears(Number(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer mt-1"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-semibold px-0.5">
                  <span>5 yrs</span>
                  <span>10 yrs</span>
                  <span>15 yrs</span>
                  <span>20 yrs</span>
                  <span>25 yrs</span>
                  <span>30 yrs</span>
                </div>
              </div>

            </div>

            {/* Estimated EMI Summary & Amortization Bar Visualization */}
            <div className="md:col-span-7 bg-gray-50/60 dark:bg-white/5 rounded-2xl p-5 border border-gray-100 dark:border-white/5 space-y-5">
              <div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Estimated EMI</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-[28px] font-black text-gray-900 dark:text-white">{fmtRs(estimatedEmi)}</span>
                  <span className="text-[12px] text-gray-400 font-semibold">/ month</span>
                </div>
                <p className="text-[10.5px] text-gray-400 font-medium mt-0.5 flex items-center flex-wrap">
                  @ {interestRatePct}% p.a. {dbCostSheet?.base_interest_rate ? 'project subvention rate' : '(indicative bank benchmark rate)'}
                  {dbCostSheet?.base_interest_rate == null && <EstimatedBadge />}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200/60 dark:border-white/5">
                <div>
                  <p className="text-[9.5px] text-gray-400 font-black uppercase">Loan Amount</p>
                  <p className="text-[13px] font-black text-gray-900 dark:text-white mt-0.5">{fmtRs(loanAmount)}</p>
                </div>
                <div>
                  <p className="text-[9.5px] text-gray-400 font-black uppercase">Total Interest</p>
                  <p className="text-[13px] font-black text-gray-900 dark:text-white mt-0.5">{fmtRs(totalInterest)}</p>
                </div>
                <div>
                  <p className="text-[9.5px] text-gray-400 font-black uppercase">Total Payment</p>
                  <p className="text-[13px] font-black text-gray-900 dark:text-white mt-0.5">{fmtRs(totalPayment)}</p>
                </div>
              </div>

              {/* Stacked Amortization Bar Chart */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-600" /> Principal</span>
                  <span className="flex items-center gap-1 text-purple-400"><span className="w-2 h-2 rounded-full bg-purple-400" /> Interest</span>
                </div>
                <div className="h-20 w-full flex items-end justify-between gap-1 pt-2">
                  {Array.from({ length: Math.min(tenureYears, 30) }).map((_, i) => {
                    const progress = i / Math.max(1, tenureYears - 1)
                    const principalH = Math.min(85, Math.max(15, Math.round(20 + progress * 65)))
                    const interestH = Math.max(10, 100 - principalH)
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end h-full group relative">
                        <div style={{ height: `${interestH}%` }} className="bg-purple-300 dark:bg-purple-900/60 rounded-t-sm w-full transition-all group-hover:bg-purple-500" />
                        <div style={{ height: `${principalH}%` }} className="bg-blue-600 w-full rounded-b-sm transition-all group-hover:bg-blue-700" />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[9.5px] text-gray-400 font-bold pt-1">
                  <span>Year 1</span>
                  <span>Year {Math.round(tenureYears / 2)}</span>
                  <span>Year {tenureYears} (Maturity)</span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Right Loan Eligibility Side Card */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 text-center flex flex-col justify-between h-full">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Landmark size={22} />
            </div>
            <div>
              <h3 className="text-[16px] font-black text-gray-900 dark:text-white">Loan Eligibility</h3>
              <label className="block text-[11px] text-gray-500 font-medium mt-2 mb-1.5">Monthly household income (₹)</label>
              <input
                type="number"
                min={0}
                value={monthlyIncome || ''}
                onChange={(e) => setMonthlyIncome(Math.max(0, Number(e.target.value) || 0))}
                placeholder="e.g. 150000"
                className="w-full text-center px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[13px] font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {hasIncomeInput ? (
                <>
                  <p className="text-[11.5px] text-gray-500 font-medium mt-3">You may be eligible for a loan of</p>
                  <p className="text-[24px] font-black text-gray-900 dark:text-white mt-1">{fmtCr(eligiblePropertyPriceCr)}</p>
                </>
              ) : (
                <p className="text-[11.5px] text-gray-400 font-medium mt-3">Enter your income to estimate eligibility</p>
              )}
            </div>
            {hasIncomeInput && (
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black mx-auto ${
                meetsUnitPrice
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                <CheckCircle2 size={13} /> {meetsUnitPrice ? 'Looks good!' : 'May fall short of this unit'}
              </span>
            )}
          </div>

          <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-white/5">
            <button
              onClick={() => setShowEligibilityModal(true)}
              className="w-full py-3 bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-black rounded-xl text-[12.5px] shadow-sm hover:opacity-95 transition-opacity"
            >
              Check Eligibility
            </button>
            <p className="text-[10px] text-gray-400 font-semibold">Powered by our lending partners</p>
          </div>
        </div>

      </div>

      {/* ── 2.5. BANK APF LOAN APPROVALS & PRE-APPROVED LENDERS ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <Landmark size={20} className="text-blue-600 dark:text-blue-400" /> Bank APF Loan Approvals
            </h2>
            <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Pre-approved project sanction codes (APF) available from major institutional lenders.</p>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-black text-[11px] rounded-full border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1">
            <ShieldCheck size={14} /> Clear Title Verified
          </span>
        </div>

        {detail?.builder_detail?.funding_banks && detail.builder_detail.funding_banks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
            {detail.builder_detail.funding_banks.map((bankName: string, idx: number) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2 hover:border-gray-200 transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 flex items-center justify-center font-black text-[12px]">
                    🏛️
                  </div>
                  <span className="text-[9.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                    Approved
                  </span>
                </div>
                <div>
                  <h4 className="text-[12.5px] font-black text-gray-900 dark:text-white leading-tight">{bankName}</h4>
                  <p className="text-[9.5px] text-gray-400 font-semibold mt-0.5">APF Sanctioned • Fast Track</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-gray-400 font-semibold pt-1">Bank approval details not available.</p>
        )}
      </div>

      {/* ── 2.8. TRUE COST & LANDED PURCHASE CALCULATOR ── */}
      <CostSheetTab detail={detail} unitTypes={unitTypes} initialBhk={bhkFilter} />

      {/* ── 3. PAYMENT PLANS (Full-width milestones with exact ₹ amounts) ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
        
        {/* Header & Inline Configuration Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100 dark:border-white/5">
          <div>
            <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">Payment Plans</h2>
            <p className="text-[12px] text-gray-500 font-medium mt-0.5">Flexible plans tailored to your cash flow and investment goals.</p>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl self-start sm:self-auto">
            {availableBhks.map((bhk) => (
              <button
                key={bhk}
                onClick={() => {
                  setBhkFilter(bhk)
                  const unit = unitTypes.find(u => `${u.bhk} BHK` === bhk)
                  if (unit?.price_min_cr) setPropertyPrice(unit.price_min_cr * 10000000)
                }}
                className={`text-[11.5px] font-black px-3.5 py-1.5 rounded-xl transition-all ${
                  bhkFilter === bhk ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {bhk}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Payment Plan Variant Selectors (Top Tab Deck) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
            <span>Select Payment Structure</span>
            <span className="text-blue-600 dark:text-blue-400 font-extrabold lowercase">Click to preview schedule</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              { id: 'clp', name: 'Construction Linked', tag: 'Most Popular', icon: Landmark, desc: 'Pay per slab milestone' },
              { id: 'investor', name: 'Investor Plan', tag: 'Better Returns', icon: TrendingUp, desc: 'Optimized cash flow' },
              { id: 'flexi', name: 'Flexi Plan', tag: 'Lower Initial Outgo', icon: Percent, desc: '30:70 / 20:80 split' },
              { id: 'full', name: 'Full Payment', tag: 'Max Discount', icon: Award, desc: 'Upfront cash savings' }
            ] as Array<{ id: PlanTypeKey; name: string; tag: string; icon: LucideIcon; desc: string }>).map((plan) => {
              const isSelected = selectedPlanTab === plan.id
              const Icon = plan.icon
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanTab(plan.id)}
                  className={`p-3.5 rounded-2xl cursor-pointer transition-all space-y-2 relative overflow-hidden border ${
                    isSelected
                      ? 'bg-gradient-to-b from-slate-900 to-slate-950 text-white dark:from-zinc-900 dark:to-black shadow-[0_8px_20px_rgba(0,0,0,0.18)] border-blue-500/80 ring-2 ring-blue-500/30'
                      : 'bg-white dark:bg-zinc-900/60 text-gray-800 dark:text-gray-200 border-gray-200/80 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-zinc-700 shadow-sm hover:shadow'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'}`}>
                      <Icon size={16} />
                    </div>
                    <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isSelected
                        ? 'bg-blue-500/30 text-blue-200 border border-blue-400/40'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {plan.tag}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black leading-tight">{plan.name}</h4>
                    <p className={`text-[10.5px] font-semibold mt-0.5 line-clamp-1 ${isSelected ? 'text-zinc-300' : 'text-gray-500'}`}>{plan.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Milestone Schedule List with Step Badges & Exact ₹ Amounts */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch pt-2">
          
          {/* Milestone Schedule Items in a structured pathway */}
          <div className="md:col-span-8 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Scheduled Tranches</span>
              <span className="text-[11px] font-bold text-gray-500">Linked to BSP & Stage Completion</span>
            </div>

            {(() => {
              const allItems = paymentPlanMilestones[selectedPlanTab] || []
              const visibleItems = showAllMilestones ? allItems : allItems.slice(0, 4)

              return (
                <>
                  {!isSelectedPlanFromDb && (
                    <p className="text-[10.5px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1 mb-1 bg-amber-50/80 dark:bg-amber-950/20 p-2 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                      <Info size={13} className="shrink-0" /> Illustrative schedule — confirm exact milestones with developer booking sheet.
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visibleItems.map((item: MilestoneItem, idx: number) => {
                      const milestoneTitle = item.milestone || item.name || item.label || item.stage || item.phase || `Stage ${idx + 1}`
                      const milestoneDesc = item.due || item.desc || item.description || (item.done ? 'Completed stage' : 'As per schedule')

                      const pctVal = getMilestonePct(item)
                      const basePrice = propertyPrice > 0 ? propertyPrice : (unitMinCr ? unitMinCr * 10000000 : 0)

                      const milestoneAmt = (item.amt && item.amt > 0)
                        ? item.amt
                        : (item.amount && item.amount > 0)
                        ? item.amount
                        : (basePrice * (pctVal / 100))

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-white dark:bg-zinc-900/80 border-2 border-slate-100 dark:border-zinc-800/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-3 relative group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-[10px] font-black shadow-sm">
                                {idx + 1}
                              </span>
                              <span className="text-[10.5px] font-black uppercase text-slate-500 tracking-wider">
                                Milestone {idx + 1}
                              </span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 text-[11px] font-black border border-blue-200/60 dark:border-blue-800/50">
                              {pctVal > 0 ? `${pctVal}% Due` : 'Due'}
                            </span>
                          </div>

                          <div>
                            <h5 className="text-[13.5px] font-black text-slate-900 dark:text-white leading-tight">{milestoneTitle}</h5>
                            <div className="flex items-baseline gap-1.5 mt-2">
                              <p className="text-[16px] font-black text-blue-600 dark:text-blue-400 tracking-tight">{fmtRs(milestoneAmt)}</p>
                              <span className="text-[10px] font-bold text-slate-400">est.</span>
                            </div>
                            {milestoneDesc && <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 font-semibold mt-1 flex items-center gap-1">
                              <Clock size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{milestoneDesc}</span>
                            </p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {allItems.length > 4 && (
                    <button
                      onClick={() => setShowAllMilestones(!showAllMilestones)}
                      className="w-full py-2.5 bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-[12px] font-extrabold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>{showAllMilestones ? 'Show Less' : `View All (${allItems.length}) Milestones`}</span>
                      <ChevronRight size={13} className={showAllMilestones ? '-rotate-90 transition-transform' : 'rotate-90 transition-transform'} />
                    </button>
                  )}
                </>
              )
            })()}
          </div>

          {/* Why Choose Checklist Box */}
          <div className="md:col-span-4 self-start p-5 rounded-2xl bg-gradient-to-b from-emerald-50/70 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10 border border-emerald-200/70 dark:border-emerald-800/50 space-y-4 flex flex-col shadow-sm">
            <div className="space-y-2">
              <h4 className="text-[13.5px] font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>Why choose this plan?</span>
              </h4>
              <ul className="space-y-2.5 text-[11.5px] font-bold text-emerald-950 dark:text-emerald-300">
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-600 flex-shrink-0" /> Most preferred by home buyers</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-600 flex-shrink-0" /> Pay strictly as construction advances</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-600 flex-shrink-0" /> Lower initial liquidity requirement</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-600 flex-shrink-0" /> Architect & RERA milestone tied</li>
              </ul>
            </div>

            <button
              onClick={downloadScheduleCSV}
              className="w-full py-2.5 bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 border border-emerald-300/80 dark:border-emerald-700/60 rounded-xl text-[12px] font-black shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-center gap-1.5 transition-all mt-2 cursor-pointer"
            >
              <Download size={14} /> Download Schedule (CSV)
            </button>
          </div>

        </div>

        {/* Plan Comparison Summary Strip (Positioned directly below payment plans) */}
        {planComparisonStrip.length > 0 && (
        <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[13px] font-black text-gray-900 dark:text-white uppercase tracking-wider">Plan Comparison Strip</h4>
            <button onClick={() => setShowCompareModal(true)} className="text-[12px] font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Compare All Plans <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {planComparisonStrip.map((comp, i) => {
              const Icon = comp.icon
              return (
                <div key={i} className="p-3 rounded-xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${comp.color}`}>
                    <Icon size={15} />
                  </div>
                  <div>
                    <p className="text-[9.5px] text-gray-400 font-bold uppercase">{comp.title}</p>
                    <p className="text-[12px] font-black text-gray-900 dark:text-white leading-tight">{comp.val}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )}

      </div>

      {/* ── 4. COST BREAKDOWN (Full-width detailed itemized list) ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
        <div>
          <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">Cost Breakdown</h2>
          <p className="text-[12px] text-gray-500 font-medium mt-0.5">See exactly what you&apos;re paying for. Hover items to isolate components.</p>
        </div>

        {/* Stage Toggle Segmented Control */}
        <div className="grid grid-cols-2 p-1 bg-gray-100 dark:bg-white/10 rounded-2xl max-w-sm w-full gap-1">
          <button
            onClick={() => setCostBreakdownStage('construction')}
            className={`text-[11.5px] sm:text-[12px] font-black py-2 rounded-xl transition-all text-center truncate ${
              costBreakdownStage === 'construction'
                ? 'bg-[#111827] text-white dark:bg-white dark:text-gray-900 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            Booking & Construction
          </button>
          <button
            onClick={() => setCostBreakdownStage('possession')}
            className={`text-[11.5px] sm:text-[12px] font-black py-2 rounded-xl transition-all text-center truncate ${
              costBreakdownStage === 'possession'
                ? 'bg-[#111827] text-white dark:bg-white dark:text-gray-900 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            At Possession
          </button>
        </div>

        {/* Main Donut + Expanded Full Width Itemized Breakdown Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
          
          {/* Donut Chart Visual with Segment Isolation */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-4">
            <div className="relative w-56 h-56 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                {(() => {
                  const CIRCUMFERENCE = 314.159
                  let accumulatedOffset = 0
                  return breakdownComponents.map((item, i) => {
                    const ratio = item.amount / activeTotalVal
                    const strokeLen = ratio * CIRCUMFERENCE
                    const gapLen = CIRCUMFERENCE - strokeLen
                    const currentOffset = accumulatedOffset
                    accumulatedOffset += strokeLen
                    const isIsolated = hoveredCostIdx === i

                    return (
                      <circle
                        key={item.id}
                        cx="60" cy="60" r="50"
                        fill="none"
                        stroke={item.stroke}
                        strokeWidth={isIsolated ? "15" : "10"}
                        strokeDasharray={`${strokeLen} ${gapLen}`}
                        strokeDashoffset={-currentOffset}
                        opacity={hoveredCostIdx === null || isIsolated ? 1 : 0.3}
                        className="transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredCostIdx(i)}
                        onMouseLeave={() => setHoveredCostIdx(null)}
                      />
                    )
                  })
                })()}
              </svg>
              <div className="absolute flex flex-col items-center text-center space-y-0.5 pointer-events-none p-2">
                <span className="text-[9.5px] font-black text-gray-400 uppercase tracking-widest leading-tight">
                  {hoveredCostIdx !== null ? breakdownComponents[hoveredCostIdx].name.split(' (')[0] : (costBreakdownStage === 'construction' ? 'Total (Till Possession)' : 'Total at Possession')}
                </span>
                <span className="text-[19px] font-black text-gray-900 dark:text-white leading-tight mt-1">
                  {hoveredCostIdx !== null ? fmtRs(breakdownComponents[hoveredCostIdx].amount) : fmtRs(activeTotalVal)}
                </span>
              </div>
            </div>
          </div>

          {/* Full-Width Detailed Itemized Table (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-black text-gray-400 uppercase tracking-wider px-3 pb-2 border-b border-gray-100 dark:border-white/5">
              <span>Cost Component</span>
              <div className="flex items-center gap-12">
                <span>Amount (₹)</span>
                <span className="w-16 text-right">% Share</span>
              </div>
            </div>

            {breakdownComponents.map((item, i) => (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredCostIdx(i)}
                onMouseLeave={() => setHoveredCostIdx(null)}
                className={`flex items-center justify-between text-[13px] px-3 py-3 rounded-xl transition-all cursor-pointer border ${
                  hoveredCostIdx === i ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-800/40 font-extrabold shadow-sm' : 'border-transparent hover:bg-gray-50/80 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${item.color} shadow-sm`} />
                  <span className="font-extrabold text-gray-800 dark:text-gray-200">{item.name}</span>
                  {item.estimated && <EstimatedBadge />}
                </div>
                <div className="flex items-center gap-12">
                  <span className="font-black text-gray-900 dark:text-white">{fmtRs(item.amount)}</span>
                  <span className="text-[12px] font-extrabold text-gray-500 dark:text-gray-400 w-16 text-right">{item.pct}</span>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between text-[14px] font-black p-3.5 bg-gray-50/80 dark:bg-white/5 rounded-xl border border-gray-200/60 dark:border-white/10 mt-3">
              <span className="text-gray-900 dark:text-white">
                {costBreakdownStage === 'construction' ? 'Total (Till Possession)' : 'Grand Total (All Inclusive at Possession)'}
              </span>
              <div className="flex items-center gap-12">
                <span className="text-gray-900 dark:text-white text-[15px]">{fmtRs(activeTotalVal)}</span>
                <span className="text-gray-900 dark:text-white w-16 text-right">100%</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── 5. CURRENT OFFERS & BENEFITS ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div>
          <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">Current Offers & Benefits</h2>
          <p className="text-[12px] text-gray-500 font-medium mt-0.5">Limited time offers from builder and our trusted partners.</p>
        </div>

        {(() => {
          const claims = detail?.marketing_claims || []
          const escrowBank = detail?.escrow_bank_name
          const assumptions = detail?.cost_sheet?.assumptions || []
          const promotions = detail?.promotions || []

          const offers: Array<{ tag: string; title: string; desc: string; icon: LucideIcon; bg: string }> = []

          if (claims[0]) {
            offers.push({
              tag: 'Builder Offer',
              title: claims[0],
              desc: claims[1] || 'Confirm exact terms with the builder',
              icon: Gift,
              bg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
            })
          }

          offers.push({
            tag: 'Bank Tie-up',
            title: escrowBank ? `Approved by ${escrowBank}` : 'Pre-approved Loans',
            desc: 'Seamless home loan processing & fast approval',
            icon: Landmark,
            bg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
          })

          if (assumptions[0]) {
            offers.push({
              tag: 'Financing Benefit',
              title: assumptions[0],
              desc: assumptions[1] || 'Confirm exact terms with the builder',
              icon: Percent,
              bg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
            })
          }

          promotions.forEach((promo) => {
            offers.push({
              tag: 'Promotion',
              title: promo.title,
              desc: promo.description || promo.content,
              icon: Award,
              bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400'
            })
          })

          if (offers.length === 0) {
            return <p className="text-[12px] text-gray-400 font-semibold">No current offers listed for this project.</p>
          }

          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {offers.map((offer, i) => {
                const Icon = offer.icon
                return (
                  <div key={i} className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${offer.bg}`}>
                        <Icon size={16} />
                      </div>
                      <span className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 sm:px-2 py-0.5 rounded">
                        {offer.tag}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-[12.5px] sm:text-[13.5px] font-black text-gray-900 dark:text-white leading-tight">{offer.title}</h4>
                      <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium mt-0.5 leading-snug line-clamp-2">{offer.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* ── 6. READY TO BOOK CTA BANNER ── */}
      <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-black dark:from-[#1c1815] dark:to-[#0f0e0d] text-white rounded-[24px] p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center md:text-left">
          <h3 className="text-[20px] md:text-[24px] font-black tracking-tight">Ready to book your dream home?</h3>
          <p className="text-[13px] text-gray-300 font-medium">Get the best price, flexible plans and expert guidance from our relationship manager.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            onClick={onGoToCosts}
            className="px-6 py-3.5 bg-white text-gray-900 hover:bg-gray-100 font-black rounded-2xl text-[13px] transition-all shadow-lg hover:scale-105 flex items-center gap-2 whitespace-nowrap"
          >
            <CalendarDays size={17} />
            Book Site Visit
          </button>

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 border border-white/20 hover:border-white text-white font-black rounded-2xl text-[13px] transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <PhoneCall size={17} />
              Talk to an Advisor
            </a>
          )}
        </div>
      </div>

      <p className="text-center text-[10.5px] text-gray-400 font-medium pt-1">
        ⓘ All prices are in Indian Rupees (₹). Amounts are indicative and subject to change without prior notice. Taxes and registration charges are additional.
      </p>

      {/* ── PLAN COMPARISON MODAL ── */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151515] rounded-[24px] max-w-2xl w-full p-6 shadow-2xl space-y-6 relative border border-gray-200 dark:border-white/10">
            <button
              onClick={() => setShowCompareModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 hover:text-gray-900"
            >
              <X size={16} />
            </button>
            <div>
              <h3 className="text-[20px] font-black text-gray-900 dark:text-white">Compare All Payment Plans</h3>
              <p className="text-[12px] text-gray-500 font-medium">Detailed breakdown across all payment options for {bhkFilter}</p>
            </div>

            <div className="overflow-x-auto touch-pan-x custom-scrollbar">
              <table className="w-full min-w-[480px] sm:min-w-[640px] text-left text-xs sm:text-[12.5px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 text-gray-400 uppercase text-[9px] sm:text-[10px] font-black">
                    <th className="pb-3">Plan Variant</th>
                    <th className="pb-3">Booking Amt</th>
                    <th className="pb-3">Construction Stages</th>
                    <th className="pb-3">On Possession</th>
                    <th className="pb-3 text-right">Best Suited For</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-extrabold">
                  {planCompareRows.map((row) => (
                    <tr key={row.typeKey}>
                      <td className={`py-3 ${row.color}`}>{row.label}</td>
                      <td className="py-3">{row.bookingPct}%</td>
                      <td className="py-3">{row.constructionPct}%</td>
                      <td className="py-3">{row.possessionPct}%</td>
                      <td className="py-3 text-right text-gray-500">{row.bestFor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowCompareModal(false)}
                className="px-6 py-2.5 bg-gray-900 text-white font-black rounded-xl text-[12px]"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHECK ELIGIBILITY MODAL ── */}
      {showEligibilityModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151515] rounded-[24px] max-w-md w-full p-6 shadow-2xl space-y-6 relative border border-gray-200 dark:border-white/10">
            <button
              onClick={() => setShowEligibilityModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 hover:text-gray-900"
            >
              <X size={16} />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Landmark size={24} />
              </div>
              <h3 className="text-[20px] font-black text-gray-900 dark:text-white">Loan Pre-Approval</h3>
              <p className="text-[12px] text-gray-500 font-medium">Calculate instant pre-approval terms with our banking partners (HDFC, ICICI, SBI).</p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 space-y-2 text-[12.5px] font-extrabold">
              <div className="flex justify-between">
                <span className="text-gray-500">Selected Unit</span>
                <span>{bhkFilter} {unitAreaSqft ? `(${unitAreaSqft} sq.ft)` : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Property Price</span>
                <span>{fmtRs(propertyPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estimated EMI</span>
                <span className="text-blue-600">{fmtRs(estimatedEmi)}/mo</span>
              </div>
            </div>

            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-blue-600 text-white font-black rounded-xl text-[13px] flex items-center justify-center gap-2 shadow-md hover:bg-blue-700 transition-colors"
              >
                <PhoneCall size={16} /> Get Bank Pre-Approval Call
              </a>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
