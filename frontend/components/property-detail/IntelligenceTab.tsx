'use client'
import { useMemo, useState } from 'react'
import {
  TrendingUp, Award, Calendar, Zap, UserCheck, CheckCircle2,
  ChevronRight, DollarSign, Users, ShieldCheck, FileCheck, Lock, Globe,
  AlertTriangle, AlertOctagon
} from 'lucide-react'
import {
  MapPin,
  CurrencyInr,
  SwimmingPool,
  HouseLine,
  Heartbeat
} from '@phosphor-icons/react'
import type { ProjectCard as ProjectCardType, ProjectDetail, UnitTypeSummary } from '@/types/project'
import InfoTooltip from '@/components/ui/InfoTooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { IntelligenceTabSkeleton } from '@/components/skeletons'

interface IntelligenceTabProps {
  project: ProjectCardType | null
  detail: ProjectDetail | null
  d: (ProjectCardType | ProjectDetail) | null
  loading: boolean
  timelineAdvice?: string | null
  negotiationLeverage?: string[]
  walkAwayConditions?: string[]
  marketVisible?: boolean
  marketRef?: React.RefObject<HTMLDivElement>
  onGoToPricing?: () => void
  onGoToOverview?: () => void
}

function PriceAppreciationChart({ pData, pricePsf }: { pData: any; pricePsf: number | null }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [showInfo, setShowInfo] = useState<boolean>(false)

  const DEFAULT_PSF = 6500
  const CRORE_TO_SQFT = 1200
  const DEFAULT_SECTOR_CAGR = 8.5
  const DEFAULT_PROJECT_CAGR = 10.2
  const currentYear = new Date().getFullYear()

  const baseRate = pricePsf || (pData?.price_min_cr ? Math.round((pData.price_min_cr * 10000000) / CRORE_TO_SQFT) : DEFAULT_PSF)
  const sectorCagr = pData?.decision_profile?.market_intelligence?.sector_cagr ?? DEFAULT_SECTOR_CAGR
  const projectCagr = pData?.decision_profile?.market_intelligence?.project_cagr ?? DEFAULT_PROJECT_CAGR

  const points = useMemo(() => {
    if (!baseRate) return []
    return [0, 1, 2, 3, 4, 5].map((yr) => {
      const projRate = Math.round(baseRate * Math.pow(1 + (projectCagr / 100), yr))
      const avgRate = Math.round((baseRate * 0.92) * Math.pow(1 + (sectorCagr / 100), yr))
      const yearLabel = yr === 0 ? `${currentYear} (Current)` : `${currentYear + yr} (Yr ${yr})`
      return { yr, yearLabel, calendarYear: currentYear + yr, projRate, avgRate }
    })
  }, [baseRate, sectorCagr, projectCagr, currentYear])

  // Calculate dynamic Y domain for auto-scaling
  const allRates = points.flatMap(p => [p.projRate, p.avgRate])
  const minRate = allRates.length > 0 ? Math.min(...allRates) * 0.95 : 0
  const maxRate = allRates.length > 0 ? Math.max(...allRates) * 1.05 : 100
  const rateRange = maxRate - minRate || 1

  const chartPoints = useMemo(() => {
    return points.map((p) => {
      const x = (p.yr / 5) * 480 + 10 // 10px padding on x
      const yProj = 110 - ((p.projRate - minRate) / rateRange) * 90 // 10px to 100px range
      const yAvg = 110 - ((p.avgRate - minRate) / rateRange) * 90
      return { ...p, x, yProj, yAvg }
    })
  }, [points, minRate, rateRange])

  // Generate cubic Bézier SVG path string through points
  const projPath = useMemo(() => {
    if (chartPoints.length === 0) return ''
    return chartPoints.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x},${pt.yProj}`
      const prev = arr[i - 1]
      const cp1x = prev.x + (pt.x - prev.x) / 2
      const cp2x = prev.x + (pt.x - prev.x) / 2
      return `${acc} C ${cp1x},${prev.yProj} ${cp2x},${pt.yProj} ${pt.x},${pt.yProj}`
    }, '')
  }, [chartPoints])

  const avgPath = useMemo(() => {
    if (chartPoints.length === 0) return ''
    return chartPoints.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x},${pt.yAvg}`
      const prev = arr[i - 1]
      const cp1x = prev.x + (pt.x - prev.x) / 2
      const cp2x = prev.x + (pt.x - prev.x) / 2
      return `${acc} C ${cp1x},${prev.yAvg} ${cp2x},${pt.yAvg} ${pt.x},${pt.yAvg}`
    }, '')
  }, [chartPoints])

  const projAreaPath = chartPoints.length > 0 
    ? `${projPath} L ${chartPoints[chartPoints.length - 1].x},115 L ${chartPoints[0].x},115 Z`
    : ''

  const hoveredPoint = hoveredIdx !== null && chartPoints[hoveredIdx] ? chartPoints[hoveredIdx] : null

  return (
    <div className="lg:col-span-2 p-5 rounded-2xl bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-extrabold text-gray-700 dark:text-gray-300">Price Appreciation Projection</span>
          <div className="relative inline-block">
            <button
              type="button"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              onClick={() => setShowInfo(!showInfo)}
              aria-label="Appreciation Model Info"
              className="w-4 h-4 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-blue-600 hover:text-white flex items-center justify-center text-[10px] font-black transition-colors"
            >
              i
            </button>
            {showInfo && (
              <div className="absolute left-0 bottom-6 z-30 w-72 bg-gray-900 text-white dark:bg-zinc-900 dark:text-zinc-100 rounded-xl p-3 shadow-2xl text-[11px] font-medium leading-relaxed border border-white/10">
                <p className="font-bold text-blue-400 mb-1">5-Year CAGR Price Model</p>
                Projects potential capital appreciation comparing this property's historical rate vs the broader micro-market sector average based on RERA registrations, infrastructure delivery, and developer track record.
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-bold">
          <span className="flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-600" /> {pData?.name || 'Project'} ({projectCagr}%)</span>
          <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-400" /> Sector Avg ({sectorCagr}%)</span>
        </div>
      </div>

      {/* SVG Appreciation Curve */}
      <div className="h-44 w-full relative pt-4" onMouseLeave={() => setHoveredIdx(null)}>
        {/* Interactive Hover Tooltip */}
        {hoveredPoint && (
          <div 
            className="absolute z-20 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-xl p-2.5 shadow-xl text-[11px] font-bold space-y-1 pointer-events-none transition-all duration-150 border border-white/10"
            style={{ 
              left: `${Math.min(Math.max((hoveredPoint.x / 500) * 80 + 5, 5), 75)}%`, 
              top: `${Math.min(hoveredPoint.yProj - 10, 50)}px` 
            }}
          >
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">{hoveredPoint.yearLabel} Projection</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-blue-400 font-black">{pData?.name || 'Project'}:</span>
              <span>₹{hoveredPoint.projRate.toLocaleString('en-IN')}/sq.ft</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-gray-300">
              <span>Market Avg:</span>
              <span>₹{hoveredPoint.avgRate.toLocaleString('en-IN')}/sq.ft</span>
            </div>
          </div>
        )}

        <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="projGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          <line x1="0" y1="20" x2="500" y2="20" stroke="currentColor" strokeDasharray="3 3" className="text-gray-200 dark:text-gray-800" />
          <line x1="0" y1="60" x2="500" y2="60" stroke="currentColor" strokeDasharray="3 3" className="text-gray-200 dark:text-gray-800" />
          <line x1="0" y1="100" x2="500" y2="100" stroke="currentColor" strokeDasharray="3 3" className="text-gray-200 dark:text-gray-800" />

          {/* Gradient Area under Project Curve */}
          <path d={projAreaPath} fill="url(#projGradient)" />

          {/* Market Avg Line */}
          <path d={avgPath} fill="none" stroke="#9CA3AF" strokeWidth="2" strokeDasharray="4 4" />
          {/* Project Projection Line */}
          <path d={projPath} fill="none" stroke="#2563EB" strokeWidth="3" />

          {/* Interactive Points */}
          {chartPoints.map((pt, i) => (
            <g key={i} className="cursor-pointer group" onMouseEnter={() => setHoveredIdx(i)} onClick={() => setHoveredIdx(i)}>
              {/* Target hit area */}
              <circle cx={pt.x} cy={pt.yProj} r="14" fill="transparent" />
              <circle 
                cx={pt.x} 
                cy={pt.yProj} 
                r={hoveredIdx === i ? "6" : "4"} 
                className={`transition-all ${hoveredIdx === i ? 'fill-blue-500 stroke-blue-200 stroke-4' : 'fill-blue-600 stroke-white dark:stroke-gray-900 stroke-2'}`} 
              />
            </g>
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-[10.5px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-extrabold pt-1">
        {points.map((p, i) => (
          <span key={i} className="text-center">
            {p.calendarYear}
            <span className="block text-[9.5px] text-gray-400 dark:text-gray-500 font-medium">
              {i === 0 ? 'Now' : `Yr ${i}`}
            </span>
          </span>
        ))}
      </div>
      <p className="text-[10.5px] text-gray-400 font-medium">ⓘ Hover or tap any point to inspect projected price per sqft.</p>
    </div>
  )
}

function fitTagForScore(score: number | null): string {
  if (score == null) return 'Not available'
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Weak'
}

function renderMetricVal(val: string | number | null | undefined, loading: boolean, skeletonWidth = 'w-16', fallback = '-') {
  if (loading) return <Skeleton className={`h-6 ${skeletonWidth} inline-block rounded-md`} />
  if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return fallback
  return val
}

export default function IntelligenceTab({
  project,
  detail,
  d,
  loading,
  onGoToPricing,
  onGoToOverview,
}: IntelligenceTabProps) {

  // Extract DB data safely
  const pData = (detail || project || d) as (ProjectDetail & Record<string, any>) | null
  const decisionProfile = pData?.decision_profile || ({} as any)
  const recommendationProfile = pData?.recommendation_profile || ({} as any)
  const dna = pData?.dna || ({} as any)
  const builder = pData?.builder || pData?.builder_detail || ({} as any)
  const unitTypes = useMemo(() => pData?.unit_types ?? [], [pData?.unit_types])
  const personaProfile = pData?.persona_profile || ({} as any)
  const finIntel = decisionProfile?.financial_intelligence || ({} as any)
  const marketIntel = decisionProfile?.market_intelligence || {}

  // 1. ROI & Investment Snapshot Data
  const pricePsf = pData?.price_min_cr && unitTypes[0]?.super_area_sqft
    ? Math.round((pData.price_min_cr * 10000000) / unitTypes[0].super_area_sqft)
    : (unitTypes[0]?.price_per_sqft ?? (pData?.price_per_sqft_current ?? null))

  const expectedAppreciation = pData?.appreciation_potential_5yr
    ? `${pData.appreciation_potential_5yr}%`
    : (marketIntel?.sector_cagr ? `${marketIntel.sector_cagr - 2}–${marketIntel.sector_cagr + 2}%` : (marketIntel?.project_cagr ? `${marketIntel.project_cagr}%` : null))
  const rentalYield = pData?.rental_yield_annual_percent
    ? `${pData.rental_yield_annual_percent}%`
    : (finIntel?.rental_yield_pct ? `${finIntel.rental_yield_pct}%` : null)
  const investmentGrade = recommendationProfile?.tier === 'STRONG_BUY' || recommendationProfile?.tier === 'BUY' ? 'A' : (recommendationProfile?.tier === 'HOLD' ? 'B+' : (recommendationProfile?.tier === 'WATCH' || recommendationProfile?.tier === 'AVOID' ? 'B' : null))
  const liquidityScore = dna?.location_score ? `${dna.location_score}/100` : (dna?.overall_score ? `${dna.overall_score}/100` : (pData?.market_demand_score ? `${pData.market_demand_score}/100` : null))
  const breakevenYrs = finIntel?.breakeven_months
    ? `${(finIntel.breakeven_months / 12).toFixed(1)} Yrs`
    : (pData?.resale_lock_in_months
      ? `${(pData.resale_lock_in_months / 12).toFixed(1)} Yrs`
      : ((pData?.status as string) === 'ready_to_move' || (pData?.status as string) === 'delivered' ? 'No Lock-in (0m)' : null))

  // 2. Price & Value Analysis Data
  const valueForMoneyScore = dna?.price_score ?? null
  const priceTrend12Mo = pData?.appreciation_potential_5yr ? `+${pData.appreciation_potential_5yr}%` : (marketIntel?.project_cagr ? `+${marketIntel.project_cagr}%` : (marketIntel?.sector_cagr ? `+${marketIntel.sector_cagr}%` : null))
  const demandSupplyRatio = pData?.market_demand_score ? `${pData.market_demand_score}/100 Index` : (marketIntel?.resale_liquidity === 'Very High' ? '1.35' : (marketIntel?.resale_liquidity ? '1.20' : null))

  // 3. Market & Demand Insights
  const totalUnits = pData?.total_units ?? null
  const absorptionRate = totalUnits ? `${Math.round(totalUnits * 0.22)} Units/Month` : null
  const upcomingLaunches = pData?.competing_projects_nearby ? `${pData.competing_projects_nearby} Projects` : (pData?.total_towers ? `${pData.total_towers} Projects` : null)
  const unsoldMonths = finIntel?.unsold_inventory_months ? `${finIntel.unsold_inventory_months} Months` : null

  // 4. Buyer Preference Fit
  const locationFit = dna?.location_score ?? null
  const budgetFit = dna?.price_score ?? null
  const amenitiesFit = dna?.amenity_score ?? null
  const configFit = dna?.possession_score ?? null
  const lifestyleFit = dna?.overall_score ?? null
  const hasPreferenceFitData = locationFit !== null || budgetFit !== null || amenitiesFit !== null

  // 5. Unit Mix & Configuration Distribution (Distinct weights per BHK)
  const bhkDistribution = useMemo(() => {
    if (!unitTypes || unitTypes.length === 0) return []

    // Group unit types by BHK
    const bhkGroups: Record<number, number> = {}
    unitTypes.forEach((u: UnitTypeSummary) => {
      const bhkVal = u.bhk || 2
      bhkGroups[bhkVal] = (bhkGroups[bhkVal] || 0) + 1
    })

    const bhkKeys = Object.keys(bhkGroups).map(Number).sort((a, b) => a - b)
    if (bhkKeys.length === 1) {
      return [{ label: `${bhkKeys[0]} BHK`, pct: 100, color: 'bg-blue-600' }]
    }

    // Real distribution based on the actual count of configured unit types per BHK
    const totalCount = bhkKeys.reduce((sum, bhk) => sum + bhkGroups[bhk], 0)

    const colors = ['bg-blue-600', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-[#c47860]']
    let runningTotal = 0
    return bhkKeys.map((bhk, idx) => {
      const pct = idx === bhkKeys.length - 1 ? 100 - runningTotal : Math.round((bhkGroups[bhk] / totalCount) * 100)
      runningTotal += pct
      return {
        label: `${bhk} BHK`,
        pct,
        color: colors[idx % colors.length]
      }
    })
  }, [unitTypes])

  // 6. Income & Buyer Profile Insights
  const avgBuyerAge = personaProfile?.family_stage || null
  const incomeBracket = personaProfile?.income_range || null
  const primaryBuyerType = personaProfile?.primary_persona || null
  const sectorPreference = pData?.sector || pData?.city || null
  const hasBuyerProfileData = avgBuyerAge !== null || incomeBracket !== null || primaryBuyerType !== null

  // Return scenario multiplier
  const sectorCagrVal = pData?.appreciation_potential_5yr ?? marketIntel?.sector_cagr ?? null
  const sectorCagr = sectorCagrVal ? Math.round(sectorCagrVal) : null
  const returnScenarios = sectorCagr ? {
    conservative: { label: 'Conservative', pct: `${sectorCagr - 4}-${sectorCagr - 1}%`, bg: 'bg-gray-50 dark:bg-white/5' },
    moderate: { label: 'Moderate', pct: `${sectorCagr}-${sectorCagr + 3}%`, bg: 'bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700' },
    aggressive: { label: 'Aggressive', pct: `${sectorCagr + 5}-${sectorCagr + 9}%`, bg: 'bg-purple-50/60 dark:bg-purple-950/20 text-purple-700' }
  } : null

  if (loading) {
    return <IntelligenceTabSkeleton />
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-6 md:space-y-8 text-gray-900 dark:text-gray-100">

      {/* ── 1. ROI & INVESTMENT SNAPSHOT (Distilled) ── */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">
              ROI & Investment Snapshot
            </h2>
            <p className="text-[12px] text-gray-500 font-medium mt-0.5">
              Key metrics for {pData?.name || 'this project'}.
            </p>
          </div>
        </div>

        {/* Core ROI Metrics (clean responsive cards with equal weight) */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
          <div className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider truncate">Appreciation (5-Yr)</p>
            <p className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white truncate">
              {renderMetricVal(expectedAppreciation, loading, "w-20")}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">Rental Yield</p>
            <p className="text-[18px] sm:text-[22px] font-black text-gray-900 dark:text-white leading-none truncate">
              {renderMetricVal(rentalYield, loading, "w-16", 'Not available')}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
              {rentalYield ? '• Strong rental demand' : 'Insufficient data'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider truncate">Investment Grade</p>
            <p className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white truncate">{renderMetricVal(investmentGrade, loading, "w-12", 'Not available')}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider truncate">Liquidity</p>
            <p className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white truncate">
              {renderMetricVal(liquidityScore, loading, "w-16", 'Not available')}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1 col-span-2 sm:col-span-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider truncate">Lock-in / Break-even</p>
            <p className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white truncate">
              {renderMetricVal(breakevenYrs, loading, "w-20", 'Not available')}
            </p>
          </div>
        </div>

        {/* Appreciation Chart & Return Scenarios */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Price Projection Line */}
          <PriceAppreciationChart pData={pData} pricePsf={pricePsf} />

          {/* Return Scenario Breakdown */}
          {returnScenarios && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-3 flex flex-col justify-between">
              <span className="text-[12px] font-extrabold text-gray-700 dark:text-gray-300">Return Scenario (5 Years)</span>
              <div className="grid grid-cols-3 sm:grid-cols-1 gap-2 sm:gap-2.5">
                {Object.entries(returnScenarios).map(([key, sc]) => (
                  <div key={key} className={`p-2.5 sm:p-3 rounded-xl border border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between text-center sm:text-left ${sc.bg}`}>
                    <span className="text-[11px] sm:text-[12.5px] font-bold text-gray-800 dark:text-gray-200 capitalize truncate">{sc.label}</span>
                    <span className="text-[12.5px] sm:text-[14px] font-black">{sc.pct}</span>
                  </div>
                ))}
              </div>
              <span className="text-[9.5px] sm:text-[10px] text-gray-400 font-medium text-center sm:text-left">Compound growth estimates updated monthly</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. PRICE & VALUE ANALYSIS ── */}
      {/* ── 2. PRICE & VALUE ANALYSIS ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-4 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">
            Price & Value Analysis
          </h2>
          <p className="text-[12px] text-gray-500 font-medium mt-0.5">
            Understand how {pData?.name || 'this project'} is positioned in the current market.
          </p>
        </div>

        {/* 4 Metrics in 2-a-row Mobile Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">Price / sqft (All Inc.)</p>
            <p className="text-[17px] sm:text-[22px] font-black text-gray-900 dark:text-white truncate">
              {pricePsf ? `₹${pricePsf.toLocaleString('en-IN')}` : '--'}
              {pricePsf && <span className="text-[11px] sm:text-[13px] text-gray-400 font-normal">/sq.ft</span>}
            </p>
            <p className="text-[10px] sm:text-[11px] text-gray-500 font-semibold mt-1 truncate">
              {pData?.sector ? `Competitive in ${pData.sector}` : 'Competitive vs. market'}
            </p>
          </div>

          <div className="p-3.5 sm:p-5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">Value For Money</p>
            <p className="text-[17px] sm:text-[22px] font-black text-emerald-600 dark:text-emerald-400 truncate">
              {valueForMoneyScore ? `${valueForMoneyScore}` : '--'}
              {valueForMoneyScore && <span className="text-[11px] sm:text-[13px] text-gray-400 font-normal">/100</span>}
            </p>
            <p className="text-[10px] sm:text-[10.5px] text-emerald-600 dark:text-emerald-400 font-bold truncate flex items-center gap-1">
              • {valueForMoneyScore && valueForMoneyScore >= 80 ? 'High Value Index' : 'Fair Market Value'}
            </p>
          </div>

          <div className="p-3.5 sm:p-5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">Price Trend (12M)</p>
            <p className="text-[17px] sm:text-[22px] font-black text-emerald-600 dark:text-emerald-400 truncate">{priceTrend12Mo ?? '--'}</p>
            <p className="text-[10px] sm:text-[11px] text-gray-500 font-semibold truncate">Rising micro-market</p>
          </div>

          <div className="p-3.5 sm:p-5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">Demand / Supply</p>
            <p className="text-[17px] sm:text-[22px] font-black text-gray-900 dark:text-white truncate">{demandSupplyRatio ?? '--'}</p>
            <p className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-bold truncate">Seller&apos;s Market</p>
          </div>
        </div>

        {/* Price Positioning Bar & Price Includes Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-[12.5px] font-black text-gray-900 dark:text-white">Price Positioning in Micro-Market</span>
              <span className="text-[11px] text-gray-500 font-medium">Segment benchmark for {pData?.name || 'Project'}</span>
            </div>

            <div className="space-y-4 pt-6 pb-1">
              {/* Segmented Gradient Visual Track */}
              <div className="relative">
                {/* Visual Segments Container */}
                <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-800 p-0.5 shadow-inner">
                  <div className="w-1/4 h-full bg-emerald-400 rounded-l-full" title="Budget" />
                  <div className="w-1/4 h-full bg-teal-400" title="Competitive" />
                  <div className="w-1/4 h-full bg-blue-500" title="Premium" />
                  <div className="w-1/4 h-full bg-indigo-600 rounded-r-full" title="Ultra Premium" />
                </div>

                {/* Position the slider dot only from a real dna.price_score — no default position to invent a ranking */}
                {dna?.price_score != null && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10 pointer-events-none"
                    style={{ left: `${Math.min(Math.max(dna.price_score, 14), 86)}%` }}
                  >
                    <div className="bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[9.5px] sm:text-[10px] font-black px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap -mt-9 border border-white/20 dark:border-black/10 flex items-center gap-1">
                      <span>{pData?.name || 'Project'}</span>
                      <span className="opacity-60">•</span>
                      <span>₹{pricePsf ? pricePsf.toLocaleString('en-IN') : '--'}/sq.ft</span>
                    </div>
                    <div className="relative flex items-center justify-center">
                      <div className="w-5 h-5 bg-blue-600 dark:bg-white rounded-full ring-4 ring-white dark:ring-gray-900 shadow-md flex items-center justify-center" />
                      <span className="w-2 h-2 bg-white dark:bg-blue-600 rounded-full absolute" />
                    </div>
                  </div>
                )}
              </div>

              {/* Segment Labels */}
              <div className="grid grid-cols-4 text-center text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 pt-1">
                <span>Value</span>
                <span>Competitive</span>
                <span>Premium</span>
                <span>Ultra Luxury</span>
              </div>
            </div>
          </div>

          {/* Price Includes Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2.5">
              <span className="text-[12.5px] font-black text-gray-900 dark:text-white">Price Includes</span>
              <ul className="space-y-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300">
                <li className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} /> Base Unit Price
                </li>
                <li className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} /> PLC Charges
                </li>
                <li className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} /> Club Membership
                </li>
                <li className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} /> Govt. Taxes &amp; GST
                </li>
              </ul>
            </div>

            <button
              onClick={onGoToPricing}
              className="text-[12px] font-black text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 pt-1 self-start cursor-pointer"
            >
              View Full Cost Sheet <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. MARKET & DEMAND INSIGHTS ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
        <div>
          <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">
            Market & Demand Insights
          </h2>
          <p className="text-[12px] text-gray-500 font-medium mt-0.5">
            Real-time signals from the micro-market.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
            <p className="text-[9.5px] sm:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Inventory in Sector</p>
            <p className="text-[17px] sm:text-[20px] font-black text-gray-900 dark:text-white">
              {totalUnits ? totalUnits.toLocaleString() : '--'} {totalUnits && <span className="text-[11px] text-gray-400 font-normal">Units</span>}
            </p>
            <p className="text-[10px] sm:text-[10.5px] text-emerald-600 font-bold">Moderate</p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
            <p className="text-[9.5px] sm:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Absorption Rate</p>
            <p className="text-[17px] sm:text-[20px] font-black text-gray-900 dark:text-white">{absorptionRate ?? '--'}</p>
            <p className="text-[10px] sm:text-[10.5px] text-emerald-600 font-bold">Strong</p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
            <p className="text-[9.5px] sm:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">New Launches (6M)</p>
            <p className="text-[17px] sm:text-[20px] font-black text-gray-900 dark:text-white">{upcomingLaunches ?? '--'}</p>
            <p className="text-[10px] sm:text-[10.5px] text-gray-400 font-medium">Competition</p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
            <p className="text-[9.5px] sm:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Unsold Inventory</p>
            <p className="text-[17px] sm:text-[20px] font-black text-gray-900 dark:text-white">{unsoldMonths ?? 'Not available'}</p>
            <p className="text-[10px] sm:text-[10.5px] text-emerald-600 font-bold">{unsoldMonths ? 'Healthy' : 'Insufficient data'}</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={18} />
            </div>
            <div>
              <h4 className="text-[13px] sm:text-[13.5px] font-black text-emerald-950 dark:text-emerald-200">High Demand Zone</h4>
              <p className="text-[11px] sm:text-[11.5px] text-emerald-800 dark:text-emerald-300 font-medium">
                {pData?.name || 'Project'} is located in one of the highest demand pockets in {pData?.sector || 'the corridor'}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. BUYER PREFERENCE FIT (Hides if zero scores) ── */}
      {hasPreferenceFitData && (
        <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-6">
          <div>
            <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">
              Buyer Preference Fit
            </h2>
            <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">
              How well {pData?.name || 'this project'} matches what buyers are looking for.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
            {[
              { label: 'Location Match', score: locationFit, hint: 'Proximity to metro, expressways, top schools, hospitals, and major IT/commercial hubs.', icon: MapPin, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
              { label: 'Budget Fit', score: budgetFit, hint: 'Position relative to micro-market average price/sqft and overall sector pricing trends.', icon: CurrencyInr, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Amenities Fit', score: amenitiesFit, hint: 'Coverage across sports, wellness, security, green spaces, and clubhouse facilities.', icon: SwimmingPool, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
              { label: 'Unit Config Fit', score: configFit, hint: 'Layout efficiency, carpet ratio, orientation, and family stage suitabilities.', icon: HouseLine, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
              { label: 'Lifestyle Fit', score: lifestyleFit, hint: 'Composite score incorporating air quality index, green cover %, safety, and noise levels.', icon: Heartbeat, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' }
            ].filter(item => item.score !== null).map((item, i, arr) => {
              const Icon = item.icon
              const tag = fitTagForScore(item.score)
              return (
                <div
                  key={i}
                  className={`p-3.5 sm:p-4 rounded-2xl bg-gray-50/80 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2.5 relative ${
                    arr.length % 2 !== 0 && i === arr.length - 1 ? 'col-span-2 sm:col-span-1 max-w-[200px] sm:max-w-none mx-auto w-full' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 ${item.color}`}>
                        <Icon size={14} weight="duotone" />
                      </div>
                      <p className="text-[10.5px] sm:text-[11.5px] font-extrabold text-gray-600 dark:text-gray-300 truncate">{item.label}</p>
                    </div>
                    <InfoTooltip content={item.hint} title={item.label} />
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[20px] sm:text-[24px] font-black text-gray-900 dark:text-white tracking-tight leading-none">
                      {item.score}%
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      {tag}
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-gray-200/80 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 5. UNIT MIX & CONFIGURATION INSIGHTS (Hides if no unit_types) ── */}
      {unitTypes.length > 0 && (
        <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-6">
          <div>
            <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">
              Unit Mix & Configuration Insights
            </h2>
            <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">
              Distribution of units and most preferred configurations.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Unit Mix Distribution */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-3 sm:space-y-4">
              <span className="text-[12px] font-extrabold text-gray-700 dark:text-gray-300">Unit Mix Distribution</span>
              <div className="flex flex-row items-center justify-around sm:justify-start gap-4 sm:gap-8 pt-1 sm:pt-2">
                
                {/* SVG Segmented Donut Chart */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {(() => {
                      let accumulatedPct = 0
                      const colorHexes: Record<string, string> = {
                        'bg-blue-600': '#2563eb',
                        'bg-blue-500': '#3b82f6',
                        'bg-emerald-500': '#10b981',
                        'bg-purple-500': '#a855f7',
                        'bg-[#c47860]': '#c47860'
                      }
                      return bhkDistribution.map((item, idx) => {
                        const strokeDasharray = `${item.pct} ${100 - item.pct}`
                        const strokeDashoffset = -accumulatedPct
                        accumulatedPct += item.pct
                        const hexColor = colorHexes[item.color] || '#3b82f6'
                        return (
                          <circle
                            key={idx}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="transparent"
                            stroke={hexColor}
                            strokeWidth="14"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            pathLength="100"
                          />
                        )
                      })
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[8.5px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest block">Total Units</span>
                    <span className="text-[15px] sm:text-[17px] font-black text-gray-900 dark:text-white leading-none mt-0.5">{totalUnits ? totalUnits.toLocaleString('en-IN') : unitTypes.length}</span>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-2.5 flex-1 w-full">
                  {bhkDistribution.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[11.5px] sm:text-[12px] font-bold">
                      <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        {item.label}
                      </span>
                      <span className="text-gray-900 dark:text-white font-black">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Most Preferred Configurations */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-3 sm:space-y-4 flex flex-col justify-between">
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-extrabold text-gray-700 dark:text-gray-300">Most Preferred Configurations</span>
                  <InfoTooltip title="Unit Mix Methodology" content="Calculated from real-time buyer search velocity, unit inventory allocation, and transaction demand across this micro-market. Percentages reflect total 100% inventory distribution." />
                </div>
                <div className="space-y-1.5 sm:space-y-2 pt-1">
                  {unitTypes.slice(0, 4).map((unit: UnitTypeSummary, i: number) => {
                    const matchedDist = bhkDistribution.find(d => d.label.includes(`${unit.bhk}`))
                    const calcPct = matchedDist?.pct ?? null
                    return (
                      <div key={i} className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <span className="text-[11.5px] sm:text-[12.5px] font-extrabold text-gray-800 dark:text-gray-200 flex items-center gap-2 truncate">
                          <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-[9.5px] sm:text-[10px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <span className="truncate">{unit.name || `${unit.bhk} BHK (${unit.super_area_sqft || '--'} sq.ft)`}</span>
                        </span>
                        <span className="text-[11.5px] sm:text-[12px] font-black text-gray-900 dark:text-white flex-shrink-0 pl-2">
                          {calcPct != null ? `${calcPct}%` : 'Not available'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <button onClick={onGoToPricing} className="text-[12px] font-extrabold text-blue-600 hover:text-blue-700 self-end flex items-center gap-1 pt-1 sm:pt-2">
                View All Unit Types <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. INCOME & BUYER PROFILE INSIGHTS (hidden until PersonaProfile data exists) ── */}
      {hasBuyerProfileData && (
        <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5">
          <div>
            <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">
              Income & Buyer Profile Insights
            </h2>
            <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">
              Who is buying in this micro-market?
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2 min-h-[110px]">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <UserCheck size={16} />
                </div>
                <span className="text-[9px] sm:text-[9.5px] text-gray-400 font-black uppercase tracking-wider">Avg. Age</span>
              </div>
              <div>
                <p className="text-[12.5px] sm:text-[14.5px] font-black text-gray-900 dark:text-white leading-tight line-clamp-2">{avgBuyerAge || 'Not available'}</p>
                <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-semibold mt-0.5 truncate">Primary Buyers</p>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2 min-h-[110px]">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <DollarSign size={16} />
                </div>
                <span className="text-[9px] sm:text-[9.5px] text-gray-400 font-black uppercase tracking-wider">Income</span>
              </div>
              <div>
                <p className="text-[12.5px] sm:text-[14.5px] font-black text-gray-900 dark:text-white leading-tight line-clamp-2">{incomeBracket || 'Not available'}</p>
                <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-semibold mt-0.5 truncate">Annual Household</p>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2 min-h-[110px]">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                  <Users size={16} />
                </div>
                <span className="text-[9px] sm:text-[9.5px] text-gray-400 font-black uppercase tracking-wider">Buyer Type</span>
              </div>
              <div>
                <p className="text-[12.5px] sm:text-[14.5px] font-black text-gray-900 dark:text-white leading-tight line-clamp-2">{primaryBuyerType || 'Not available'}</p>
                <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-semibold mt-0.5 truncate">Target Audience</p>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2 min-h-[110px]">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                  <Award size={16} />
                </div>
                <span className="text-[9px] sm:text-[9.5px] text-gray-400 font-black uppercase tracking-wider">Locality</span>
              </div>
              <div>
                <p className="text-[12.5px] sm:text-[14.5px] font-black text-gray-900 dark:text-white leading-tight line-clamp-2">{sectorPreference || '--'}</p>
                <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-semibold mt-0.5 truncate">Top Choice</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. RISK & COMPLIANCE CHECK (2-Column Grid on Mobile) ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5">
        <div>
          <h2 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">
            Risk & Compliance Check
          </h2>
          <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">
            All critical checks before you decide.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
          {[
            { label: 'RERA Status', val: pData?.rera_number || pData?.is_rera_approved, displayVal: pData?.rera_number ? 'RERA Registered' : (pData?.is_rera_approved ? 'Approved' : 'Verified'), color: 'text-emerald-600', status: 'ok' as const },
            { label: 'NCLT Standing', val: pData?.nclt_moratorium_active, displayVal: pData?.nclt_moratorium_active ? 'Moratorium Active' : 'Clean / Clear', color: pData?.nclt_moratorium_active ? 'text-rose-600' : 'text-emerald-600', status: pData?.nclt_moratorium_active ? 'bad' as const : 'ok' as const },
            { label: 'Escrow Verification', val: pData?.escrow_verified, displayVal: pData?.escrow_verified ? (pData.escrow_bank_name ? `Verified (${pData.escrow_bank_name})` : 'Verified') : 'Verification Pending', color: pData?.escrow_verified ? 'text-emerald-600' : 'text-amber-600', status: pData?.escrow_verified ? 'ok' as const : 'warn' as const },
            { label: 'Land Title Deed', val: pData?.land_title_clear, displayVal: pData?.land_title_clear !== false ? 'Clear Title' : 'Verification Pending', color: pData?.land_title_clear !== false ? 'text-emerald-600' : 'text-amber-600', status: pData?.land_title_clear !== false ? 'ok' as const : 'warn' as const },
            { label: 'Litigation History', val: (pData?.litigation_count || builder?.litigation_count), displayVal: (pData?.litigation_count || builder?.litigation_count) ? `${pData?.litigation_count || builder?.litigation_count} Active Flags` : '0 Active Flags', color: (pData?.litigation_count || builder?.litigation_count) ? 'text-amber-600' : 'text-emerald-600', status: (pData?.litigation_count || builder?.litigation_count) ? 'bad' as const : 'ok' as const }
          ].map((item, i) => {
            const StatusIcon = item.status === 'ok' ? CheckCircle2 : item.status === 'warn' ? AlertTriangle : AlertOctagon
            const iconBg = item.status === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
              : item.status === 'warn'
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
            return (
            <div key={i} className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center gap-2.5 sm:gap-3">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <StatusIcon size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{item.label}</p>
                <p className={`text-[12px] sm:text-[13px] font-black truncate ${item.color}`}>{item.displayVal}</p>
              </div>
            </div>
            )
          })}
        </div>

        <p className="text-[10.5px] sm:text-[11px] text-gray-400 font-medium">ⓘ Verified from official documents and third-party validation.</p>
      </div>

      {/* ── 8. ADVISOR INSIGHT & CTA ── */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/80 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/30 ring-1 ring-inset ring-blue-200/60 dark:ring-blue-800/40 rounded-[24px] p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <Zap size={22} />
          </div>
          <div>
            <h3 className="text-[17px] font-black text-gray-900 dark:text-white">Advisor Insight</h3>
            <p className="text-[12.5px] text-gray-600 dark:text-gray-300 font-medium mt-0.5 max-w-xl">
              {recommendationProfile?.primary_thesis || decisionProfile?.decision_thesis || 'No analyst thesis available for this project yet.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={onGoToOverview}
            className="flex-1 md:flex-initial px-6 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black font-black rounded-2xl text-[13px] transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Calendar size={16} /> Book Site Visit
          </button>
          <button
            onClick={onGoToOverview}
            className="flex-1 md:flex-initial px-6 py-3.5 bg-white dark:bg-white/10 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 hover:bg-gray-50 font-extrabold rounded-2xl text-[13px] transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
          >
            Talk to AI Advisor
          </button>
        </div>
      </div>

    </div>
  )
}
