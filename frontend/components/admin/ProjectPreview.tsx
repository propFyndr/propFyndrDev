'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  CheckCircle,
  Clock,
  Lightning,
  Shield,
  MapPin,
  Buildings,
  Bed,
  ArrowSquareOut,
  ArrowsClockwise,
  DeviceMobile,
  Stack,
  CalendarDots,
  FileText,
  CurrencyInr,
  ChartLine,
  ArrowsOut,
  Train,
  Leaf,
  Users,
} from '@phosphor-icons/react'

interface UnitType {
  bhk: number
  price_min_cr: number | null
  price_max_cr: number | null
  super_area_sqft: number | null
}

interface ProjectData {
  id?: string
  slug: string
  name: string
  tagline?: string
  sector: string
  city: string
  status: string
  hero_image_url?: string
  rera_number?: string
  possession_label?: string
  possession_date?: string
  total_units?: number
  total_towers?: number
  land_area_acres?: number
  description?: string
  marketing_claims?: string[]
  builder?: { name: string }
  builder_name?: string
  builder_detail?: { name: string }
  unit_types?: UnitType[]
  amenities?: { name: string; category: string }[]
  open_space_pct?: number
  images?: { url: string; type: string }[]
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
  ready_to_move:      { label: 'Ready to Move',      cls: 'bg-emerald-500/90 text-white backdrop-blur-md shadow-xs', icon: CheckCircle },
  under_construction: { label: 'Under Construction', cls: 'bg-amber-500/90 text-white backdrop-blur-md shadow-xs',   icon: Clock },
  new_launch:         { label: 'New Launch',         cls: 'bg-blue-600/90 text-white backdrop-blur-md shadow-xs',     icon: Lightning },
}

function priceRange(units: UnitType[]): string {
  const mins = units.map((u) => u.price_min_cr).filter((v): v is number => v !== null)
  const maxs = units.map((u) => u.price_max_cr).filter((v): v is number => v !== null)
  if (!mins.length) return 'Price TBA'
  const lo = Math.min(...mins)
  const hi = maxs.length ? Math.max(...maxs) : null
  return hi ? `₹${lo} – ${hi} Cr` : `from ₹${lo} Cr`
}

function bhkList(units: UnitType[]): string[] {
  return [...new Set(units.map((u) => `${u.bhk} BHK`))].sort()
}

interface Props {
  project: ProjectData
  onRefresh?: () => void
  refreshing?: boolean
}

export default function ProjectPreview({ project, onRefresh, refreshing }: Props) {
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light')
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop')
  const [activeMobileTab, setActiveMobileTab] = useState<'Overview' | 'Analysis' | 'Floor Plans' | 'Pricing' | 'Location' | 'Builder'>('Overview')

  const status = STATUS_CFG[project.status] ?? STATUS_CFG.ready_to_move
  const units  = project.unit_types ?? []

  const rawImageUrl = project.images?.find(i => i.type === 'hero')?.url ||
    project.images?.[0]?.url ||
    project.hero_image_url

  const fallbackImageUrl = 'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=1200&q=80'
  const isValidImageUrl = rawImageUrl ? (() => {
    try {
      const url = new URL(rawImageUrl)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  })() : false
  const displayImageUrl: string = (isValidImageUrl && rawImageUrl) ? rawImageUrl : fallbackImageUrl

  const builderName = project.builder?.name ?? project.builder_name ?? project.builder_detail?.name ?? 'Unknown Builder'
  const isDark = previewTheme === 'dark'

  return (
    <div className="space-y-3.5">
      {/* Sleek Header Bar */}
      <div className="p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-2xs shrink-0">
            <DeviceMobile size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">Real-Time Buyer Card</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Live property presentation preview</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Segmented Desktop/Mobile Toggle */}
          <div className="flex items-center p-0.5 bg-zinc-200/60 dark:bg-zinc-800 rounded-xl border border-zinc-300/50 dark:border-zinc-700/60">
            <button
              type="button"
              onClick={() => setDeviceMode('desktop')}
              className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                deviceMode === 'desktop' ? 'bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('mobile')}
              className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                deviceMode === 'mobile' ? 'bg-blue-600 text-white shadow-xs font-extrabold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Mobile Sheet
            </button>
          </div>

          {/* Segmented Light/Dark Toggle */}
          <div className="flex items-center p-0.5 bg-zinc-200/60 dark:bg-zinc-800 rounded-xl border border-zinc-300/50 dark:border-zinc-700/60">
            <button
              type="button"
              onClick={() => setPreviewTheme('light')}
              className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                !isDark ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setPreviewTheme('dark')}
              className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                isDark ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Dark
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              title="Refresh Preview Data"
              className="w-7 h-7 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <ArrowsClockwise size={12} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            </button>
          )}

          {project.slug && (
            <Link
              href={`/discover?project=${project.slug}`}
              target="_blank"
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800/80 px-2.5 py-1 rounded-xl transition-all shadow-2xs active:scale-95"
            >
              <ArrowSquareOut size={12} />
              <span>Public View</span>
            </Link>
          )}
        </div>
      </div>

      {deviceMode === 'mobile' ? (
        /* Mobile Sheet Frame Mockup */
        <div className="max-w-[340px] mx-auto rounded-[28px] border-4 border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden text-zinc-100 font-sans relative flex flex-col h-[520px]">
          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-12">
            
            {/* New full-height luxury Mobile Hero */}
            {(() => {
              const rates = units.map(u => u.super_area_sqft && u.price_min_cr ? Math.round((u.price_min_cr * 10000000) / u.super_area_sqft) : null).filter(Boolean) as number[]
              const minRate = rates.length > 0 ? Math.min(...rates) : null
              const perSqftRate = minRate ? minRate.toLocaleString('en-IN') : '15,942'
              const displayPossession = project.possession_label || 'Dec 2028'
              const displayScore = (project as any).recommendation_score?.total || (project as any).recommendation_score || 94
              const isRTM = project.status === 'ready_to_move'
              const isNew = project.status === 'new_launch'

              return (
                <div className="relative w-full overflow-hidden flex-shrink-0 h-[280px]">
                  <Image src={displayImageUrl} alt={project.name || ''} fill unoptimized className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20" />

                  {/* Top-left Status */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className={`text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full shadow-md
                      ${isRTM ? 'bg-emerald-500 text-white' : isNew ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'}`}>
                      {isRTM ? 'Ready to Move' : isNew ? 'New Launch' : 'Under Construction'}
                    </span>
                  </div>

                  {/* Top-right AI Score */}
                  {displayScore && (
                    <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-md border border-white/20 rounded-xl p-2 text-right flex flex-col items-center justify-center">
                      <span className="text-[7.5px] text-zinc-300 font-bold tracking-wider leading-none">⚡ AI SCORE</span>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <span className="text-lg font-black text-white leading-none">{displayScore}</span>
                        <span className="text-[8px] text-zinc-400 font-bold">/100</span>
                      </div>
                      <span className="text-[7.5px] font-extrabold text-emerald-400 mt-0.5 uppercase tracking-wider leading-none">Strong Buy</span>
                    </div>
                  )}

                  {/* Middle Title / Builder / Location */}
                  <div className="absolute bottom-[76px] left-3 right-3 z-10 space-y-0.5">
                    <h3 className="text-lg font-black text-white leading-tight">{project.name || 'Project Name'}</h3>
                    <p className="text-[11px] font-semibold text-zinc-300">
                      by <span className="underline decoration-dashed decoration-zinc-400 font-bold text-white">{builderName}</span> ˅
                    </p>
                    <p className="text-[10px] text-zinc-300 flex items-center gap-1">
                      <MapPin size={10} className="text-zinc-400" />
                      {project.sector || 'Sector'}, {project.city || 'Noida'}
                    </p>
                  </div>

                  {/* Bottom Translucent Price & Possession Dock */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 bg-black/40 backdrop-blur-md border border-white/15 rounded-xl p-2.5 flex items-center justify-between shadow-xl">
                    <div>
                      <p className="text-xs font-black text-white leading-tight">{priceRange(units)}</p>
                      <p className="text-[8.5px] text-zinc-300 font-semibold mt-0.5">Starts ₹{perSqftRate} / sq.ft</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider leading-none">Possession</p>
                      <p className="text-[10.5px] font-extrabold text-white mt-1 leading-none">{displayPossession}</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Mobile Tab Strip Sync */}
            <div className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 flex justify-around px-1 py-1">
              {(['Overview', 'Analysis', 'Floor Plans', 'Pricing', 'Location', 'Builder'] as const).map((tab) => {
                const isActive = activeMobileTab === tab
                const labels: Record<string, string> = {
                  Overview: 'Overview',
                  Analysis: 'Analysis',
                  'Floor Plans': 'Residences',
                  Pricing: 'Pricing',
                  Location: 'Location',
                  Builder: 'Docs'
                }
                const icons: Record<string, React.ReactNode> = {
                  Overview: <Buildings size={15} />,
                  Analysis: <ChartLine size={15} />,
                  'Floor Plans': <Bed size={15} />,
                  Pricing: <CurrencyInr size={15} />,
                  Location: <MapPin size={15} />,
                  Builder: <FileText size={15} />
                }
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveMobileTab(tab)}
                    className={`flex flex-col items-center gap-1 py-1.5 px-0.5 relative transition-all flex-1 min-w-[42px] ${
                      isActive ? 'text-blue-500 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {icons[tab]}
                    <span className={`text-[8.5px] font-bold tracking-tight ${isActive ? 'text-blue-500' : 'text-zinc-400'}`}>
                      {labels[tab]}
                    </span>
                    {isActive && (
                      <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-blue-500 rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Tab content mockup matching grid-cols-3 layout */}
            <div className="p-3 space-y-3">
              {activeMobileTab === 'Overview' ? (
                <>
                  {/* USP Bento Grid 3 columns */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: project.open_space_pct ? `${project.open_space_pct}%` : '75%', sub: 'Open Green', icon: Leaf, color: 'bg-emerald-950 text-emerald-400' },
                      { value: '3 mins', sub: 'Aqua Metro', icon: Train, color: 'bg-blue-950 text-blue-400' },
                      { value: 'IGBC', sub: 'Gold Rated', icon: Leaf, color: 'bg-amber-950 text-amber-400' },
                      { value: 'Low', sub: 'Density Living', icon: Users, color: 'bg-purple-950 text-purple-400' },
                      { value: 'Corner', sub: 'Smart Units', icon: ArrowsOut, color: 'bg-orange-950 text-orange-400' },
                      { value: 'RERA', sub: 'Registered', icon: Shield, color: 'bg-teal-950 text-teal-400' }
                    ].map((item, idx) => {
                      const Icon = item.icon
                      return (
                        <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex flex-col items-center justify-center text-center">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color} mb-1`}>
                            <Icon size={14} />
                          </div>
                          <span className="text-[11px] font-black text-white">{item.value}</span>
                          <span className="text-[8px] text-zinc-400 font-bold mt-0.5">{item.sub}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Persona recommendation info callout */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Perfect For</p>
                    <p className="font-semibold text-zinc-200">{project.name || 'Ivy County'} — {builderName}</p>
                    <p className="text-[9.5px] text-zinc-400">RERA Approved project in top premium sector.</p>
                  </div>
                </>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center text-zinc-400">
                  <p className="text-[10px] font-bold uppercase tracking-wider">{activeMobileTab} Tab Content</p>
                  <p className="text-[9.5px] mt-1">Preview of edited layout fields synced live.</p>
                </div>
              )}
            </div>

          </div>

          {/* Sticky Bottom CTA */}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-zinc-900 border-t border-zinc-800 flex gap-2 z-10">
            <button type="button" className="w-full bg-white text-zinc-900 font-black py-2 rounded-xl text-[11px] shadow-sm">
              Book Site Visit
            </button>
          </div>
        </div>
      ) : (
        <>
        {/* Main Luxury Preview Card Container */}
        <div className={`rounded-3xl border shadow-lg overflow-hidden transition-all duration-300 ${
          isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-100 shadow-black/40' : 'bg-white border-zinc-200/90 text-zinc-900 shadow-zinc-200/60'
        }`}>
        {/* Image Frame */}
        <div className="relative w-full bg-zinc-900" style={{ height: 195 }}>
          <Image
            src={displayImageUrl}
            alt={project.name || 'Property'}
            fill
            unoptimized
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
          
          <div className="absolute top-3 left-3">
            <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl backdrop-blur-md shadow-xs ${status.cls}`}>
              <status.icon size={12} />
              {status.label}
            </span>
          </div>

          <div className="absolute bottom-3 right-3 bg-zinc-900/90 backdrop-blur-md text-white border border-white/20 px-3 py-1 rounded-xl text-[11px] font-black tracking-tight shadow-md">
            {priceRange(units)}
          </div>
        </div>

        {/* Card Details */}
        <div className="p-4 space-y-3.5">
          <div>
            <h3 className={`text-base font-extrabold leading-snug tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              {project.name || <span className="text-zinc-400 font-normal">Project Name Required</span>}
            </h3>
            <p className={`text-xs mt-0.5 line-clamp-1 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {project.tagline || `${project.sector || 'Sector'}, ${project.city || 'City'}`}
            </p>
          </div>

          {/* Key Facts Pills */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold">
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
              isDark ? 'bg-zinc-900 text-zinc-300 border-zinc-800' : 'bg-zinc-100 text-zinc-700 border-zinc-200/80'
            }`}>
              <MapPin size={12} className="text-blue-500 shrink-0" /> {project.sector || 'Sector'}, {project.city || 'Noida'}
            </span>
            {builderName && (
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                isDark ? 'bg-purple-950/40 text-purple-300 border-purple-800/60' : 'bg-purple-50 text-purple-700 border-purple-200/60'
              }`}>
                <Buildings size={12} className="text-purple-500 shrink-0" /> {builderName}
              </span>
            )}
          </div>

          {/* Unit BHK Badges */}
          {units.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {bhkList(units).map((b) => (
                <span key={b} className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                  isDark ? 'bg-blue-950/60 text-blue-300 border-blue-800/80' : 'bg-blue-50 text-blue-700 border-blue-200/70'
                }`}>
                  <Bed size={11} /> {b}
                </span>
              ))}
            </div>
          )}

          {/* Top Amenities Chips */}
          {project.amenities && project.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {project.amenities.slice(0, 3).map((am: any, idx: number) => (
                <span key={idx} className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  isDark ? 'bg-zinc-900 text-emerald-400 border-zinc-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                }`}>
                  ✓ {typeof am === 'string' ? am : am.name}
                </span>
              ))}
            </div>
          )}

          {/* RERA & Possession Bar */}
          <div className={`flex items-center justify-between text-[11px] pt-3 border-t font-medium ${
            isDark ? 'border-zinc-800/80 text-zinc-400' : 'border-zinc-100 text-zinc-500'
          }`}>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <Shield size={13} /> {project.rera_number ? 'RERA Approved' : 'RERA Verification'}
            </span>
            {(project.possession_label || project.possession_date) && (
              <span className="flex items-center gap-1.5 font-semibold">
                <Clock size={12} /> {project.possession_label || 'Ready to Move'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Compact Project Stats Strip */}
      {(project.total_units || project.total_towers || project.land_area_acres) && (
        <div className={`rounded-2xl border p-3 shadow-xs ${
          isDark ? 'bg-zinc-900/80 border-zinc-800 text-white' : 'bg-white border-zinc-200/80 text-zinc-900'
        }`}>
          <div className="grid grid-cols-3 gap-2 text-center">
            {project.total_towers && (
              <div>
                <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{project.total_towers}</p>
                <p className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider">Towers</p>
              </div>
            )}
            {project.total_units && (
              <div>
                <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{project.total_units}</p>
                <p className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider">Units</p>
              </div>
            )}
            {project.land_area_acres && (
              <div>
                <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{project.land_area_acres}</p>
                <p className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider">Acres</p>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
