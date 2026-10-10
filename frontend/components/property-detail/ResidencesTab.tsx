'use client'
import { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  Bed, Bath, Columns, Ruler, ZoomIn, ChevronDown, ChevronRight,
  Maximize2, TrendingDown, CheckCircle2, Crown,
  HelpCircle, Lightbulb, Wind,
  Layout, Home, Users, Compass, Eye, Trophy, CalendarDays, ShieldCheck, Leaf
} from 'lucide-react'
import type { ProjectDetail, UnitTypeSummary } from '@/types/project'
import { resolveImgUrl } from '@/lib/utils'
import InfoTooltip from '@/components/ui/InfoTooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { ResidencesSkeletonFull } from '@/components/skeletons'
import { CustomDropdown } from '@/components/ui/CustomDropdown'

type FloorPlanImage = { id: string; url: string; caption?: string | null; bhk?: number | null; size_sqft?: number | null }
type LazyState<T> = { loaded: boolean; available: boolean; data: T | null; message?: string }
type AvailabilityRow = { tower: string; floor: string; unitNo: string; facing: string; view: string; price: string; status: string }
type UnitInventoryEntry = { unit_type_id: string; tower_name: string; floor_number: number; unit_number: string; facing: string | null; view: string | null; status: string }
type HighlightEntry = string | { title: string; desc?: string }

function priceLabel(u: UnitTypeSummary): string {
  if (u.price_label) return u.price_label
  if (u.price_min_cr == null) return 'Price on Request'
  if (u.price_max_cr == null || u.price_min_cr === u.price_max_cr) return `₹${Number(u.price_min_cr).toFixed(2)} Cr`
  return `₹${Number(u.price_min_cr).toFixed(2)} – ${Number(u.price_max_cr).toFixed(2)} Cr`
}

// Small visual flag for values computed as a fallback estimate rather than pulled from verified DB fields.
function EstimatedBadge() {
  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 align-middle">
      Est.
    </span>
  )
}

function AvailabilityTable({ rows }: { rows: AvailabilityRow[] }) {
  return (
    <div className="overflow-x-auto touch-pan-x custom-scrollbar border border-gray-100 dark:border-white/5 rounded-2xl">
      <table className="w-full min-w-[540px] sm:min-w-[720px] text-left text-xs sm:text-[12.5px] border-collapse">
        <thead>
          <tr className="bg-gray-50/70 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 text-gray-400 font-black text-[9px] sm:text-[10px] uppercase tracking-wider">
            <th className="p-3.5 pl-4">Tower</th>
            <th className="p-3.5">Floor</th>
            <th className="p-3.5">Unit No.</th>
            <th className="p-3.5">Facing</th>
            <th className="p-3.5">View</th>
            <th className="p-3.5">Price</th>
            <th className="p-3.5 text-right pr-4">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-semibold text-gray-800 dark:text-gray-200">
          {rows.length > 0 ? (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                <td className="p-3.5 pl-4 font-bold">{row.tower}</td>
                <td className="p-3.5">{row.floor}</td>
                <td className="p-3.5 font-extrabold text-gray-900 dark:text-white">{row.unitNo}</td>
                <td className="p-3.5">{row.facing}</td>
                <td className="p-3.5">{row.view}</td>
                <td className="p-3.5 font-black">{row.price}</td>
                <td className="p-3.5 text-right pr-4">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {row.status}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="p-6 text-center text-gray-400 font-medium text-[12px]">
                No active inventory rows found for this configuration. Contact advisor for offline availability.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function areaSqft(u: UnitTypeSummary): number | null {
  return u.super_area_sqft ?? u.carpet_area_sqft ?? null
}

export interface ResidencesTabProps {
  unitTypes: UnitTypeSummary[]
  floorPlanImages: FloorPlanImage[]
  loading: boolean
  detail: ProjectDetail | null
  projectStatus?: string
  paymentPlan: LazyState<Record<string, unknown>>
  costSheet: LazyState<Record<string, unknown>> & { illustration: Record<string, number | null> | null; note?: string }
  onViewFloorPlans: (plans: FloorPlanImage[]) => void
  onGoToCosts: () => void
  onGoToOverview: () => void
}

export default function ResidencesTab({
  unitTypes, floorPlanImages, loading, detail, projectStatus, paymentPlan, costSheet, onViewFloorPlans, onGoToCosts, onGoToOverview,
}: ResidencesTabProps) {
  const [filter, setFilter] = useState<number | 'all' | 'penthouse' | 'duplex' | 'villa'>('all')
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [activePlanTab, setActivePlanTab] = useState<'floor' | 'details' | 'availability'>('floor')
  const [floorType, setFloorType] = useState<string>('Typical Floor')
  const [selectedTower, setSelectedTower] = useState<string>(() => detail?.unit_inventory?.[0]?.tower_name || '')
  const [selectedUnitNo, setSelectedUnitNo] = useState<string>(() => detail?.unit_inventory?.[0]?.unit_number || '')
  const [selectedSlice, setSelectedSlice] = useState<'carpet' | 'balcony' | 'shaft' | null>(null)
  const [unitMetric, setUnitMetric] = useState<'sqft' | 'sqm'>('sqft')

  const formatArea = (sqftVal: number | null) => {
    if (sqftVal == null) return '—'
    if (unitMetric === 'sqm') {
      return `${Math.round(sqftVal * 0.092903)} sq.m`
    }
    return `${sqftVal.toLocaleString()} sq.ft`
  }

  // Conditional special configuration detection — strictly check if project actually has them in unitTypes!
  const hasPenthouse = unitTypes.some(u => /penthouse/i.test(u.name || ''))
  const hasDuplex = unitTypes.some(u => /duplex/i.test(u.name || ''))
  const hasVilla = unitTypes.some(u => /villa/i.test(u.name || ''))

  const bhkOptions = [...new Set(unitTypes.map((u) => u.bhk))].sort((a, b) => a - b)
  const filteredUnits = filter === 'all'
    ? unitTypes
    : typeof filter === 'number'
      ? unitTypes.filter((u) => u.bhk === filter)
      : unitTypes.filter((u) => u.name?.toLowerCase().includes(filter))

  // Default select first unit if none selected
  const activeUnit = unitTypes.find(u => u.id === selectedUnitId) || filteredUnits[0] || unitTypes[0] || null

  const getPricePerSqftStr = (u: UnitTypeSummary) => {
    const area = areaSqft(u)
    if (!area || u.price_min_cr == null) return '—'
    const minPps = Math.round((u.price_min_cr * 1e7) / area)
    return `₹${minPps.toLocaleString('en-IN')}/sq.ft`
  }

  // Matching floor plans
  const getUnitFloorPlans = (bhk?: number) => {
    if (!bhk) return floorPlanImages
    const matched = floorPlanImages.filter((img) =>
      img.bhk === bhk || img.caption?.toLowerCase().includes(`${bhk}bhk`) || img.caption?.toLowerCase().includes(`${bhk} bhk`)
    )
    return matched.length > 0 ? matched : floorPlanImages
  }

  const activeFloorPlans = activeUnit ? getUnitFloorPlans(activeUnit.bhk) : floorPlanImages
  const previewImg = activeFloorPlans[0]

  const area = activeUnit ? areaSqft(activeUnit) : null
  const carpetArea = activeUnit?.carpet_area_sqft || null
  const balconyArea = activeUnit?.balcony_area_sqft || null

  // perfect_for/key_highlights dropped (lean-schema migration, 2026-10) — no
  // per-unit marketing copy source exists until sub-project C re-sources it.
  const perfectForList: string[] = []
  const keyHighlightsList: HighlightEntry[] = []

  // Unit availability from unit_inventory table, fallback to empty if no DB data
  const unitInventory: UnitInventoryEntry[] = detail?.unit_inventory || []
  const filteredInventory = activeUnit?.id ? unitInventory.filter((u) => u?.unit_type_id === activeUnit.id) : unitInventory
  const availabilityRows: AvailabilityRow[] = filteredInventory
    .filter((u): u is UnitInventoryEntry => u != null)
    .map((u) => ({
      tower: u?.tower_name ?? '—',
      floor: u?.floor_number ? String(u.floor_number) : '—',
      unitNo: u?.unit_number ?? '—',
      facing: u?.facing ?? '—',
      view: u?.view ?? '—',
      price: activeUnit ? priceLabel(activeUnit) : 'Price on Request',
      status: u?.status === 'available' ? 'Available' : u?.status === 'booked' ? 'Booked' : 'Hold'
    }))

  const selectedInventoryEntry = filteredInventory.find(
    (u) => u?.tower_name === selectedTower && u?.unit_number === selectedUnitNo
  ) ?? filteredInventory[0] ?? null
  const selectedFacing: string | null = selectedInventoryEntry?.facing ?? null

  if (loading && !detail) {
    return <ResidencesSkeletonFull />
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-6 md:space-y-8 bg-[#F7F9FB] dark:bg-[#0f0e0d] text-gray-900 dark:text-gray-100 font-sans">

      {/* ── 1. HEADER SECTION ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-black text-gray-900 dark:text-white tracking-tight">Explore Floor Plans</h1>
          <p className="text-[13px] text-gray-500 font-medium mt-0.5">Choose the perfect configuration that fits your lifestyle.</p>
        </div>

        {/* Need Help CTA Pill */}
        <div
          onClick={onGoToCosts}
          className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-2xl p-3 px-4 flex items-center gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] cursor-pointer hover:border-gray-300 transition-all self-start md:self-auto"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <HelpCircle size={16} />
          </div>
          <div>
            <p className="text-[11.5px] font-black text-gray-900 dark:text-white leading-none">Need help choosing?</p>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Talk to our property expert</p>
          </div>
          <ChevronRight size={14} className="text-gray-400 ml-1" />
        </div>
      </div>

      {/* BHK Category Filter Pills */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`text-[12px] sm:text-[12.5px] font-extrabold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all whitespace-nowrap ${
            filter === 'all'
              ? 'bg-[#111827] text-white dark:bg-white dark:text-gray-900 shadow-md'
              : 'bg-white dark:bg-[#111] text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-white/10 hover:bg-gray-50'
          }`}
        >
          All Configurations
        </button>
        {bhkOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => setFilter(opt)}
            className={`text-[12px] sm:text-[12.5px] font-extrabold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all whitespace-nowrap ${
              filter === opt
                ? 'bg-[#111827] text-white dark:bg-white dark:text-gray-900 shadow-md'
                : 'bg-white dark:bg-[#111] text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-white/10 hover:bg-gray-50'
            }`}
          >
            {opt} BHK
          </button>
        ))}

        {/* Conditional Special Configurations (Only show if project has them) */}
        {hasPenthouse && (
          <button
            onClick={() => setFilter('penthouse')}
            className={`text-[12.5px] font-extrabold px-5 py-2.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'penthouse'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 hover:bg-amber-100'
            }`}
          >
            <Crown size={14} /> Penthouse
          </button>
        )}

        {hasDuplex && (
          <button
            onClick={() => setFilter('duplex')}
            className={`text-[12.5px] font-extrabold px-5 py-2.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'duplex'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 hover:bg-purple-100'
            }`}
          >
            <Columns size={14} /> Duplex
          </button>
        )}

        {hasVilla && (
          <button
            onClick={() => setFilter('villa')}
            className={`text-[12.5px] font-extrabold px-5 py-2.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'villa'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 hover:bg-emerald-100'
            }`}
          >
            <Home size={14} /> Villa
          </button>
        )}
      </div>

      {/* ── 2. MAIN EXPLORER WORKSPACE (Left List on Desktop + 2-Column Grid on Mobile + Right Detail Card) ── */}
      {/* Mobile Unit Picker (2-Column Responsive Grid - Zero Horizontal Scroll) */}
      <div className="lg:hidden grid grid-cols-2 gap-2 pb-1">
        {filteredUnits.map((unit) => {
          const isSelected = activeUnit?.id === unit.id
          return (
            <button
              key={unit.id}
              onClick={() => setSelectedUnitId(unit.id)}
              className={`p-3 rounded-2xl text-[12px] font-black transition-all flex flex-col items-start gap-1 border cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white dark:bg-[#111] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-gray-400'
              }`}
            >
              <span className="truncate w-full text-left">{unit.name}</span>
              <span className={`text-[10.5px] font-bold ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                {priceLabel(unit)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: Configuration Selection Sidebar (Desktop Full Sidebar) */}
        <div className="hidden lg:block lg:col-span-4 space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[14px] font-black text-gray-900 dark:text-white uppercase tracking-wider">All Configurations</h3>
            <span className="text-[11.5px] text-gray-400 font-bold">{unitTypes.length} options available</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredUnits.map((unit, idx) => {
              const isSelected = activeUnit?.id === unit.id
              const badgeLabel = unit.category_badge || (idx === 0 ? 'BEST VALUE' : idx === 1 ? 'MOST POPULAR' : idx === 2 ? 'PREMIUM CHOICE' : 'LUXURY')
              const badgeBg = idx === 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : idx === 1 ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'

              return (
                <div
                  key={unit.id}
                  onClick={() => setSelectedUnitId(unit.id)}
                  className={`p-4 md:p-5 rounded-[20px] bg-white dark:bg-[#111] border transition-all cursor-pointer space-y-3 relative min-w-0 ${
                    isSelected
                      ? 'border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-gray-100 dark:border-white/5 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md ${badgeBg}`}>
                      {badgeLabel}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Selected
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-[16px] sm:text-[18px] font-black text-gray-900 dark:text-white leading-tight truncate">{unit.name}</h4>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] sm:text-[11.5px] text-gray-500 font-bold">
                      <span className="flex items-center gap-1"><Bed size={12} /> {unit.bhk} Beds</span>
                      <span className="flex items-center gap-1"><Bath size={12} /> {unit.bathrooms || unit.bhk} Baths</span>
                      {(() => { const sqft = areaSqft(unit); return sqft ? <span className="flex items-center gap-1"><Ruler size={12} /> {sqft.toLocaleString()} sqft</span> : null; })()}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-[16px] sm:text-[18px] font-black text-gray-900 dark:text-white leading-none">{priceLabel(unit)}</p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Starting Price</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={onGoToOverview}
            className="w-full p-3.5 rounded-[20px] border border-dashed border-gray-300 dark:border-gray-800 bg-white/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:border-gray-400 text-[12.5px] font-extrabold transition-all flex items-center justify-center gap-2"
          >
            <Columns size={16} /> Compare Configurations
          </button>
        </div>

        {/* RIGHT COLUMN: Active Configuration Full Viewer Workspace */}
        {activeUnit && (
          <div className="lg:col-span-8 space-y-6">

            {/* Top Details & Interactive Floor Plan Card */}
            <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
              
              {/* Unit Title & Header Metrics */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[26px] font-black text-gray-900 dark:text-white tracking-tight">{activeUnit.name}</h2>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {activeUnit.category_badge || 'BEST VALUE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[12.5px] text-gray-500 font-bold">
                    <span className="flex items-center gap-1.5"><Bed size={14} className="text-gray-400" /> {activeUnit.bhk} Bedrooms</span>
                    <span className="flex items-center gap-1.5"><Bath size={14} className="text-gray-400" /> {activeUnit.bathrooms || activeUnit.bhk} Bathrooms</span>
                    {area && <span className="flex items-center gap-1.5"><Ruler size={14} className="text-gray-400" /> {area.toLocaleString()} sqft</span>}
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-[26px] font-black text-gray-900 dark:text-white leading-none">{priceLabel(activeUnit)}</p>
                  <p className="text-[11px] text-gray-400 font-semibold mt-1">Starting Price</p>
                </div>
              </div>

              {/* Floor Plan View Mode Tabs (Floor Plan / Details / Unit Availability) */}
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-white/5 pb-2">
                <div className="flex items-center gap-6">
                  {([
                    { id: 'floor', label: 'Floor Plan' },
                    { id: 'details', label: 'Details' },
                    { id: 'availability', label: 'Unit Availability' }
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActivePlanTab(tab.id)}
                      className={`text-[13px] font-extrabold pb-2 border-b-2 transition-all ${
                        activePlanTab === tab.id
                          ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                          : 'border-transparent text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activePlanTab === 'floor' && (
                  <button
                    onClick={() => onViewFloorPlans(activeFloorPlans)}
                    className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    title="Expand Fullscreen"
                  >
                    <Maximize2 size={18} />
                  </button>
                )}
              </div>

              {/* ── TAB 1: FLOOR PLAN VIEW ── */}
              {activePlanTab === 'floor' && (
                <>
                  {/* Space & Layout Dimension Summary Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11.5px]">
                    <div>
                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Super Area</span>
                      <span className="font-black text-gray-900 dark:text-white">{area ? `${area.toLocaleString()} sq.ft` : '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Carpet Area</span>
                      <span className="font-black text-emerald-700 dark:text-emerald-400">
                        {carpetArea ? `${carpetArea.toLocaleString()} sq.ft` : (area ? `${Math.round(area * 0.70)} sq.ft` : '—')}
                        {!carpetArea && area && <EstimatedBadge />}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Balcony Space</span>
                      <span className="font-black text-gray-900 dark:text-white">
                        {balconyArea ? `${balconyArea.toLocaleString()} sq.ft` : (area ? `${Math.round(area * 0.12)} sq.ft` : '—')}
                        {!balconyArea && area && <EstimatedBadge />}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Layout Efficiency</span>
                      <span className="font-black text-blue-600 dark:text-blue-400">
                        {carpetArea && area ? `${Math.round((carpetArea / area) * 100)}% Usable` : '70% Usable'}
                        {!(carpetArea && area) && <EstimatedBadge />}
                      </span>
                    </div>
                  </div>

                  {/* Main Interactive Image Viewport */}
                  <div className="relative w-full h-[340px] md:h-[420px] bg-slate-100/70 dark:bg-black/40 rounded-2xl border border-slate-200/80 dark:border-white/10 flex items-center justify-center p-4 overflow-hidden group">
                    {previewImg ? (
                      <Image
                        src={resolveImgUrl(previewImg.url)}
                        alt={activeUnit.name}
                        fill
                        className="object-contain p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 max-w-md">
                        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-200">
                          <Layout size={32} />
                        </div>
                        <div>
                          <h4 className="text-[15px] font-black text-slate-900 dark:text-white tracking-tight">
                            {activeUnit.name} Architectural Blueprint
                          </h4>
                          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                            {activeUnit.bhk} Bedrooms • {activeUnit.bathrooms || activeUnit.bhk} Bathrooms • Living & Dining with Extended Deck
                          </p>
                        </div>
                        <button
                          onClick={() => onViewFloorPlans(activeFloorPlans)}
                          className="px-4 py-2 bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Maximize2 size={13} /> View Full Layout Dossier
                        </button>
                      </div>
                    )}
                    <span className="absolute bottom-3 text-[10px] text-gray-400 font-medium italic">
                      Floor plans are for representation purposes only. Actual plans may vary.
                    </span>
                  </div>

                  {/* Viewport Action Controls Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                      <CustomDropdown
                        value={floorType}
                        onChange={(val) => setFloorType(val)}
                        options={[
                          { value: 'Typical Floor', label: 'Typical Floor' },
                          { value: 'Refuge Floor', label: 'Refuge Floor' },
                          { value: 'Penthouse Level', label: 'Penthouse Level' },
                        ]}
                        size="xs"
                        triggerClassName="text-[11.5px] font-bold py-2 px-3 rounded-xl min-w-[110px]"
                      />

                      {activeUnit.tower_association && activeUnit.tower_association.length > 0 && (
                        <CustomDropdown
                          value={selectedTower}
                          onChange={(val) => setSelectedTower(val)}
                          options={activeUnit.tower_association.map((t) => ({ value: t, label: t }))}
                          size="xs"
                          triggerClassName="text-[11.5px] font-bold py-2 px-3 rounded-xl min-w-[90px]"
                        />
                      )}
                    </div>

                    <button
                      onClick={() => onViewFloorPlans(activeFloorPlans)}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl border border-gray-200/90 dark:border-white/10 bg-white/90 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[11.5px] font-black text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <ZoomIn size={14} /> Download Plan
                    </button>
                  </div>

                  {unitTypes.length === 0 && (
                    <p className="text-gray-500 text-sm">No unit types available</p>
                  )}
                </>
              )}

              {/* ── TAB 2: DETAILS VIEW ── */}
              {activePlanTab === 'details' && (
                <div className="space-y-6 pt-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Super Built-up Area</p>
                      <p className="text-[16px] font-black text-gray-900 dark:text-white">{area ? `${area.toLocaleString()} sqft` : '—'}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Carpet Area</p>
                      <p className="text-[16px] font-black text-gray-900 dark:text-white">{carpetArea ? `${carpetArea.toLocaleString()} sqft` : '—'}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Balcony Area</p>
                      <p className="text-[16px] font-black text-gray-900 dark:text-white">{balconyArea ? `${balconyArea.toLocaleString()} sqft` : '—'}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Built-up Area</p>
                      <p className="text-[16px] font-black text-gray-900 dark:text-white">{activeUnit.built_up_area_sqft ? `${activeUnit.built_up_area_sqft.toLocaleString()} sqft` : '—'}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Bedrooms</p>
                      <p className="text-[16px] font-black text-gray-900 dark:text-white">{activeUnit.bhk}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Bathrooms</p>
                      <p className="text-[16px] font-black text-gray-900 dark:text-white">{activeUnit.bathrooms ?? '—'}</p>
                    </div>

                    {activeUnit.balconies != null && (
                      <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Private Balcony</p>
                        <p className="text-[16px] font-black text-gray-900 dark:text-white">{activeUnit.balconies}</p>
                      </div>
                    )}

                    {activeUnit.utility_area_sqft != null && (
                      <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Utility Area</p>
                        <p className="text-[16px] font-black text-gray-900 dark:text-white">{activeUnit.utility_area_sqft} sqft</p>
                      </div>
                    )}

                    <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Floor Type</p>
                      <p className="text-[16px] font-black text-gray-900 dark:text-white">{floorType}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 3: UNIT AVAILABILITY VIEW ── */}
              {activePlanTab === 'availability' && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-end">
                    <button onClick={onGoToCosts} className="text-[12px] font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      Inquire Specific Unit <ChevronRight size={14} />
                    </button>
                  </div>

                  <AvailabilityTable rows={availabilityRows} />
                </div>
              )}

            </div>

            {/* ── 3. KEY HIGHLIGHTS ── */}
            {/* key_highlights is dropped (lean-schema migration, 2026-10) — no
                per-unit marketing source exists, so this section renders
                nothing rather than invented generic claims (e.g. "Vastu
                Compliant") that were shown for every unit regardless of
                whether it was true. */}
            {keyHighlightsList.length > 0 && (
              <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
                <h3 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">Key Highlights</h3>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
                  {keyHighlightsList.map((item: HighlightEntry, i: number) => (
                    <div key={i} className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <h4 className="text-[12.5px] sm:text-[13px] font-extrabold text-gray-900 dark:text-white leading-tight">{typeof item === 'string' ? item : item.title}</h4>
                        {typeof item !== 'string' && item.desc && (
                          <p className="text-[10.5px] text-gray-400 font-medium mt-1 leading-snug">{item.desc}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 5. INTERACTIVE USABLE AREA EFFICIENCY BREAKDOWN ── */}
            {area != null && (
            <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[19px] font-black text-gray-900 dark:text-white tracking-tight">Space Utilization &amp; Efficiency Breakdown</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10.5px] font-extrabold uppercase">
                      Interactive Analysis
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium mt-1">
                    Architectural ratio breakdown of usable carpet area versus super built-up area footprint.
                  </p>
                </div>

                {/* Unit Metric Converter Toggle (Sq. Ft. vs Sq. M.) */}
                <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-white/10 self-start sm:self-auto text-[11px] font-black">
                  <button
                    onClick={() => setUnitMetric('sqft')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      unitMetric === 'sqft'
                        ? 'bg-white dark:bg-[#222] text-gray-900 dark:text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Sq. Ft
                  </button>
                  <button
                    onClick={() => setUnitMetric('sqm')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      unitMetric === 'sqm'
                        ? 'bg-white dark:bg-[#222] text-gray-900 dark:text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Sq. M
                  </button>
                </div>
              </div>

              {(() => {
                const superSqft = area
                const cSqft = carpetArea || Math.round(superSqft * 0.70)
                const bSqft = balconyArea || Math.round(superSqft * 0.12)
                const isCarpetEstimated = !carpetArea
                const isBalconyEstimated = !balconyArea
                const shaftSqft = Math.max(0, superSqft - cSqft - bSqft)

                const cPct = Math.round((cSqft / superSqft) * 100)
                const bPct = Math.round((bSqft / superSqft) * 100)
                const shaftPct = Math.max(0, 100 - cPct - bPct)

                const gradeLabel = cPct >= 72 ? 'Superior Space Efficiency' : cPct >= 66 ? 'High Efficiency Layout' : 'Standard Market Layout'
                const gradeBg = cPct >= 72
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/20'
                  : 'bg-blue-500/10 text-blue-800 dark:text-blue-300 ring-1 ring-blue-500/20'

                // Displayed metric based on active slice or default carpet
                const activeData = selectedSlice === 'balcony'
                  ? { label: 'Private Balconies', val: bSqft, pct: bPct, color: 'text-emerald-500', desc: 'Covered sit-out deck & ventilation spaces' }
                  : selectedSlice === 'shaft'
                  ? { label: 'Common & Shafts', val: shaftSqft, pct: shaftPct, color: 'text-slate-400', desc: 'Circulation, lift lobby loading & utility shafts' }
                  : { label: 'Net Carpet Area', val: cSqft, pct: cPct, color: 'text-blue-600', desc: '100% usable internal carpet living space' }

                return (
                  <div className="space-y-6">
                    {/* Interactive Donut Visualization Row */}
                    <div className="p-5 sm:p-6 rounded-[22px] bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                      
                      {/* Interactive SVG Segmented Donut with Slice Highlights */}
                      <div className="relative w-44 h-44 flex items-center justify-center flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90 filter drop-shadow-sm" viewBox="0 0 100 100">
                          {/* Background Track */}
                          <circle cx="50" cy="50" r="37" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-gray-200/50 dark:text-white/5" />
                          
                          {/* Carpet Area Slice */}
                          <circle
                            cx="50"
                            cy="50"
                            r="37"
                            fill="transparent"
                            stroke="#2563eb"
                            strokeWidth={selectedSlice === 'carpet' ? '15' : '12'}
                            strokeDasharray={`${cPct} ${100 - cPct}`}
                            strokeDashoffset="0"
                            pathLength="100"
                            className="cursor-pointer transition-all duration-300 hover:opacity-90"
                            onClick={() => setSelectedSlice(selectedSlice === 'carpet' ? null : 'carpet')}
                            onMouseEnter={() => setSelectedSlice('carpet')}
                          />
                          
                          {/* Balcony Slice */}
                          <circle
                            cx="50"
                            cy="50"
                            r="37"
                            fill="transparent"
                            stroke="#10b981"
                            strokeWidth={selectedSlice === 'balcony' ? '15' : '12'}
                            strokeDasharray={`${bPct} ${100 - bPct}`}
                            strokeDashoffset={-cPct}
                            pathLength="100"
                            className="cursor-pointer transition-all duration-300 hover:opacity-90"
                            onClick={() => setSelectedSlice(selectedSlice === 'balcony' ? null : 'balcony')}
                            onMouseEnter={() => setSelectedSlice('balcony')}
                          />

                          {/* Shafts & Common Area Slice */}
                          <circle
                            cx="50"
                            cy="50"
                            r="37"
                            fill="transparent"
                            stroke="#94a3b8"
                            strokeWidth={selectedSlice === 'shaft' ? '15' : '12'}
                            strokeDasharray={`${shaftPct} ${100 - shaftPct}`}
                            strokeDashoffset={-(cPct + bPct)}
                            pathLength="100"
                            className="cursor-pointer transition-all duration-300 hover:opacity-90"
                            onClick={() => setSelectedSlice(selectedSlice === 'shaft' ? null : 'shaft')}
                            onMouseEnter={() => setSelectedSlice('shaft')}
                          />
                        </svg>

                        {/* Interactive Center Hub */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
                          <span className={`text-[24px] font-black leading-none transition-colors duration-200 ${activeData.color}`}>
                            {activeData.pct}%
                          </span>
                          <span className="text-[9.5px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1 truncate max-w-[100px]">
                            {selectedSlice ? selectedSlice : 'Usable Space'}
                          </span>
                          <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 mt-0.5">
                            {formatArea(activeData.val)}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Legend & Breakdown Controls */}
                      <div className="space-y-2.5 flex-1 w-full">
                        {/* Carpet Area Row */}
                        <div
                          onClick={() => setSelectedSlice(selectedSlice === 'carpet' ? null : 'carpet')}
                          onMouseEnter={() => setSelectedSlice('carpet')}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedSlice === 'carpet'
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
                              : 'bg-white/80 dark:bg-white/5 border-gray-100 dark:border-white/5 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-md bg-blue-600 flex-shrink-0" />
                            <div>
                              <p className="text-[12.5px] font-black text-gray-900 dark:text-white leading-tight">Net Carpet Living Area</p>
                              <p className="text-[10.5px] text-gray-400 font-medium mt-0.5">Air-conditioned internal rooms</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-black text-gray-900 dark:text-white leading-tight">{formatArea(cSqft)}{isCarpetEstimated && <EstimatedBadge />}</p>
                            <span className="text-[11px] font-black text-blue-600 dark:text-blue-400">{cPct}%</span>
                          </div>
                        </div>

                        {/* Balcony Area Row */}
                        <div
                          onClick={() => setSelectedSlice(selectedSlice === 'balcony' ? null : 'balcony')}
                          onMouseEnter={() => setSelectedSlice('balcony')}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedSlice === 'balcony'
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs'
                              : 'bg-white/80 dark:bg-white/5 border-gray-100 dark:border-white/5 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-md bg-emerald-500 flex-shrink-0" />
                            <div>
                              <p className="text-[12.5px] font-black text-gray-900 dark:text-white leading-tight">Private Deck &amp; Utility</p>
                              <p className="text-[10.5px] text-gray-400 font-medium mt-0.5">Balconies &amp; dry utility deck</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-black text-gray-900 dark:text-white leading-tight">{formatArea(bSqft)}{isBalconyEstimated && <EstimatedBadge />}</p>
                            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{bPct}%</span>
                          </div>
                        </div>

                        {/* Common Walls & Shafts Row */}
                        <div
                          onClick={() => setSelectedSlice(selectedSlice === 'shaft' ? null : 'shaft')}
                          onMouseEnter={() => setSelectedSlice('shaft')}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedSlice === 'shaft'
                              ? 'bg-slate-100 dark:bg-white/10 border-slate-300 dark:border-slate-600 shadow-xs'
                              : 'bg-white/80 dark:bg-white/5 border-gray-100 dark:border-white/5 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-md bg-slate-400 flex-shrink-0" />
                            <div>
                              <p className="text-[12.5px] font-black text-gray-900 dark:text-white leading-tight">Walls, Columns &amp; Shafts</p>
                              <p className="text-[10.5px] text-gray-400 font-medium mt-0.5">External walls and service conduits</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-black text-gray-900 dark:text-white leading-tight">{formatArea(shaftSqft)}</p>
                            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">{shaftPct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Efficiency Insights & Benchmark Strip (3-across on mobile & desktop) */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                      <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-0.5 sm:space-y-1">
                        <span className="text-[8.5px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider block truncate">Super Area</span>
                        <p className="text-[14px] sm:text-[18px] font-black text-gray-900 dark:text-white leading-tight">{formatArea(superSqft)}</p>
                        <p className="text-[9px] sm:text-[10.5px] text-gray-500 font-semibold truncate">Salable Area</p>
                      </div>

                      <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-0.5 sm:space-y-1">
                        <span className="text-[8.5px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider block truncate">Carpet Ratio</span>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] sm:text-[18px] font-black text-blue-600 dark:text-blue-400 leading-tight">{cPct}%</p>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-black uppercase truncate inline-block ${gradeBg}`}>
                          {cPct >= 70 ? 'High' : 'Std'}
                        </span>
                      </div>

                      <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-0.5 sm:space-y-1">
                        <span className="text-[8.5px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider block truncate">Net Usable</span>
                        <p className="text-[14px] sm:text-[18px] font-black text-emerald-600 dark:text-emerald-400 leading-tight">{formatArea(cSqft + bSqft)}</p>
                        <p className="text-[9px] sm:text-[10.5px] text-gray-500 font-semibold truncate">Living + Deck</p>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
            )}

            {/* ── 6. REFINED VASTU & OUTDOOR LIVING ARCHITECTURAL SPECIFICATIONS ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

              {/* Vastu & Orientation Card (Architectural styling). vastu_compliant
                  is dropped (lean-schema migration, 2026-10) — gated on
                  selectedFacing alone now. */}
              {selectedFacing && (
              <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5 flex flex-col justify-between">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center ring-1 ring-amber-500/20 flex-shrink-0">
                        <Compass size={18} />
                      </div>
                      <div>
                        <h3 className="text-[15px] sm:text-[17px] font-black text-gray-900 dark:text-white tracking-tight leading-tight">Vastu &amp; Orientation</h3>
                        <p className="text-[10.5px] sm:text-[11.5px] text-gray-400 font-medium">Solar pathway &amp; energy</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
                    <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-0.5 sm:space-y-1">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-400">Entry Facing</p>
                      <p className="text-[13.5px] sm:text-[15px] font-black text-gray-900 dark:text-white leading-tight">{selectedFacing || 'North-East / East'}</p>
                      <p className="text-[9.5px] sm:text-[10px] text-amber-600 dark:text-amber-400 font-bold">Auspicious Entry</p>
                    </div>

                    <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-0.5 sm:space-y-1">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-400">Sunlight Profile</p>
                      <p className="text-[13.5px] sm:text-[15px] font-black text-gray-900 dark:text-white leading-tight">Morning Sun</p>
                      <p className="text-[9.5px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Cross-Breeze</p>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 text-[10.5px] sm:text-[11.5px] text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-2">
                  <ShieldCheck size={15} className="text-amber-600 flex-shrink-0" />
                  <span>Vedic architectural principles for optimal harmony and light.</span>
                </div>
              </div>
              )}

              {/* Balcony & Outdoor Deck Visualizer Card (Architectural styling) */}
              {activeUnit?.balconies != null && (
              <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5 flex flex-col justify-between">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center ring-1 ring-emerald-500/20 flex-shrink-0">
                        <Wind size={18} />
                      </div>
                      <div>
                        <h3 className="text-[15px] sm:text-[17px] font-black text-gray-900 dark:text-white tracking-tight leading-tight">Balcony &amp; Outdoor Living</h3>
                        <p className="text-[10.5px] sm:text-[11.5px] text-gray-400 font-medium">Panoramic deck spaces</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 ring-1 ring-emerald-500/20 text-[9.5px] sm:text-[10.5px] font-black uppercase tracking-wider whitespace-nowrap">
                      {activeUnit.balconies} {activeUnit.balconies === 1 ? 'Balcony' : 'Balconies'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
                    <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-0.5 sm:space-y-1">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-400">Total Deck Area</p>
                      <p className="text-[13.5px] sm:text-[15px] font-black text-gray-900 dark:text-white leading-tight">{formatArea(balconyArea || (area ? Math.round(area * 0.12) : null))}{!balconyArea && <EstimatedBadge />}</p>
                      <p className="text-[9.5px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Extended Sit-out</p>
                    </div>

                    <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-0.5 sm:space-y-1">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-400">Deck-to-Carpet</p>
                      <p className="text-[13.5px] sm:text-[15px] font-black text-gray-900 dark:text-white leading-tight">
                        {balconyArea && carpetArea ? `${Math.round((balconyArea / carpetArea) * 100)}%` : '17%'}
                      </p>
                      <p className="text-[9.5px] sm:text-[10px] text-blue-600 dark:text-blue-400 font-bold">Outdoor Ratio</p>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/40 text-[10.5px] sm:text-[11.5px] text-emerald-900 dark:text-emerald-200 font-semibold flex items-center gap-2">
                  <Leaf size={15} className="text-emerald-600 flex-shrink-0" />
                  <span>Continuous open deck providing 270° views and natural airflow.</span>
                </div>
              </div>
              )}

            </div>

            {/* ── 7. UNIT AVAILABILITY (Renders only if inventory records exist) ── */}
            {availabilityRows.length > 0 && (
              <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">Unit Availability</h3>
                    <p className="text-[11.5px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Only {availabilityRows.length} units active in this configuration
                    </p>
                  </div>
                  <button onClick={onGoToCosts} className="text-[12.5px] font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    View Full Availability <ChevronRight size={14} />
                  </button>
                </div>

                <AvailabilityTable rows={availabilityRows} />
              </div>
            )}

            {/* ── 6. WHO IS THIS HOME PERFECT FOR — real data only ── */}
            {perfectForList.length > 0 && (
              <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
                <div>
                  <h3 className="text-[18px] font-black text-gray-900 dark:text-white tracking-tight">Who is this home perfect for?</h3>
                  <p className="text-[12px] text-gray-500 font-medium mt-0.5">Based on lifestyle and space needs.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
                  {perfectForList.map((pf: string, i: number, arr: string[]) => {
                    const isOddLast = arr.length % 2 !== 0 && i === arr.length - 1
                    return (
                      <div
                        key={i}
                        className={`p-3.5 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-2 ${
                          isOddLast ? 'col-span-2 md:col-span-1 max-w-xs md:max-w-none mx-auto w-full text-center sm:text-left' : ''
                        }`}
                      >
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <Users size={16} />
                        </div>
                        <h4 className="text-[12.5px] sm:text-[14px] font-black text-gray-900 dark:text-white leading-snug">{pf}</h4>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── 7. BOOK SITE VISIT CTA CARD ── */}
            <div className="bg-gradient-to-r from-gray-900 to-black dark:from-[#1c1815] dark:to-[#0f0e0d] text-white rounded-[24px] p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <h3 className="text-[19px] md:text-[22px] font-black tracking-tight">Want to see this floor plan in person?</h3>
                <p className="text-[12.5px] text-gray-300 font-medium">Book a private tour and experience the space, views and lifestyle.</p>
              </div>
              <button
                onClick={onGoToCosts}
                className="px-8 py-3.5 bg-white text-gray-900 hover:bg-gray-100 font-black rounded-2xl text-[13.5px] transition-all shadow-lg hover:scale-105 flex items-center gap-2 whitespace-nowrap"
              >
                <CalendarDays size={17} />
                Book Site Visit
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  )
}
