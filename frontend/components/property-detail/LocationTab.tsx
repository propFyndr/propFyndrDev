'use client'

import { useState } from 'react'
import {
  MapPin, Share2, Car, ShoppingBag, GraduationCap, Briefcase, TrendingUp,
  CalendarDays, Map as MapIcon, Compass, ShieldCheck, Building2, Trees, Footprints, Bus, Stethoscope,
  Shield, Wind, Volume2, Leaf
} from 'lucide-react'
import type { ProjectCard as ProjectCardType, ProjectDetail } from '@/types/project'
import SectorMap, { SECTOR_CENTROIDS } from '@/components/SectorMap'
import { buildWhatsAppUrl, trackWhatsAppHandoff } from '@/lib/whatsapp'
import { LocationTabSkeleton } from '@/components/skeletons'

export interface LocationTabProps {
  project: ProjectCardType | null
  detail: ProjectDetail | null
  d: (ProjectCardType | ProjectDetail) | null
  projectAddress: string
  loading?: boolean
}

const ICONS: Record<string, any> = {
  car: Car,
  shopping: ShoppingBag,
  school: GraduationCap,
  briefcase: Briefcase,
  "trending-up": TrendingUp,
  "map-pin": MapPin,
}

export default function LocationTab({ project, detail, d, projectAddress, loading }: LocationTabProps) {
  // State handles
  const [selectedMapFilter, setSelectedMapFilter] = useState<string>('All')
  const [sharedStatus, setSharedStatus] = useState(false)
  const [showAllNearby, setShowAllNearby] = useState(false)

  // Commute calculator inputs
  const [destInput, setDestInput] = useState('')
  const [calculatedTime, setCalculatedTime] = useState<string | null>(null)

  if (loading && !detail && !d) {
    return <LocationTabSkeleton />
  }
  const waUrl = d ? buildWhatsAppUrl(d, 'panel') : 'https://wa.me/'

  // Coordinates
  const projectLat = project?.lat || SECTOR_CENTROIDS[project?.sector || '']?.[0] || 28.535
  const projectLng = project?.lng || SECTOR_CENTROIDS[project?.sector || '']?.[1] || 77.391

  // Connectivity: No fake data fallback
  const connectivity = detail?.all_connectivity || []

  const handleGetDirections = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(projectAddress)}`, '_blank')
  }

  const handleShareLocation = () => {
    if (navigator.share) {
      navigator.share({ title: d?.name || 'Elite X', url: window.location.href })
    } else {
      navigator.clipboard.writeText(window.location.href)
      setSharedStatus(true)
      setTimeout(() => setSharedStatus(false), 2500)
    }
  }

  const quickSuggestions = [
    'Noida City Center',
    'Sector 18, Noida',
    'DND Flyway',
    'Indira Gandhi Intl. Airport',
    'Knowledge Park II'
  ]

  const handleCommuteCalc = (destination: string) => {
    setDestInput(destination)
    // Commute calculation requires real API data, not hardcoded values
    setCalculatedTime(null)
  }

  const nearbyPlacesList = showAllNearby ? connectivity : connectivity.slice(0, 5)

  return (
    <div className="space-y-8 py-2">
      
      {/* ── 1. PROJECT ADDRESS HERO BANNER ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 md:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-4 max-w-xl z-10">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Project Address</p>
          <h1 className="text-[26px] md:text-[32px] font-black text-gray-900 dark:text-white leading-tight tracking-tight">
            {projectAddress || (d?.sector ? `Sector ${d.sector}` : 'Address not available')}
          </h1>
          <p className="text-[12px] text-gray-400 font-semibold italic">Location details not verified yet</p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleGetDirections}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-[13px] shadow-sm flex items-center gap-2 transition-all"
            >
              <Compass size={16} /> Get Directions
            </button>
            <button
              onClick={handleShareLocation}
              className="px-5 py-2.5 bg-white dark:bg-white/10 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 font-extrabold rounded-xl text-[13px] shadow-sm flex items-center gap-2 hover:bg-gray-50 transition-all"
            >
              <Share2 size={16} /> {sharedStatus ? 'Copied!' : 'Share Location'}
            </button>
          </div>
        </div>

        {/* Minimalist City Skyline Graphic */}
        <div className="hidden md:flex items-center justify-center opacity-30 dark:opacity-20 pointer-events-none pr-4">
          <svg className="w-64 h-32 text-blue-600" viewBox="0 0 200 100" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 90 V50 H40 V30 H60 V90 H80 V40 H110 V90 H130 V20 H160 V90 H180 V90" />
            <circle cx="130" cy="15" r="8" fill="#3B82F6" fillOpacity="0.4" />
          </svg>
        </div>
      </div>

      {/* ── 2. EXPLORE THE NEIGHBORHOOD (Leaflet Map + Commute Calculator) ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Explore the Neighborhood</h2>
            <p className="text-[12px] text-gray-500 font-medium mt-0.5">Interactive map with nearby places, commute &amp; key amenities.</p>
          </div>
          <button className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-[12px] font-black text-gray-700 dark:text-gray-300 hover:bg-gray-50">
            <Car size={14} /> Show Traffic
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Interactive Map (8 columns) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="h-64 sm:h-80 md:h-[420px] rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 relative shadow-inner">
              {projectAddress && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                <iframe
                  title="Google Maps Location"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(projectAddress)}`}
                />
              ) : project ? (
                <SectorMap properties={[project]} />
              ) : (
                <div className="w-full h-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400">
                  <MapIcon size={32} />
                </div>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pb-1 text-[11px] sm:text-[11.5px] font-black">
              {['All', 'Transport', 'Expressway', 'Schools', 'Hospitals', 'Malls', 'Parks'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedMapFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                    selectedMapFilter === cat
                      ? 'bg-[#111827] text-white dark:bg-white dark:text-gray-900 shadow-sm'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200/70'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Commute Calculator Sidebar (4 columns) */}
          <div className="lg:col-span-4 bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl p-5 space-y-4 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div>
                <h3 className="text-[16px] font-black text-gray-900 dark:text-white">Commute Calculator</h3>
                <p className="text-[11.5px] text-gray-500 font-medium">Find travel time to any destination</p>
              </div>

              <div className="space-y-3 text-[12px]">
                <div className="p-3 bg-white dark:bg-white/10 rounded-xl border border-gray-200/60 dark:border-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-200 font-extrabold">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="truncate">{d?.sector ? `Sector ${d.sector}, ${d.city}` : 'Project Origin'}</span>
                </div>

                <div className="space-y-1">
                  <div className="p-3 bg-white dark:bg-white/10 rounded-xl border border-gray-200/60 dark:border-white/5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Enter destination (e.g. Office)"
                      value={destInput}
                      onChange={(e) => setDestInput(e.target.value)}
                      className="w-full bg-transparent text-[12px] font-extrabold text-gray-900 dark:text-white outline-none placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleCommuteCalc(destInput || 'Office')}
                  className="w-full py-3 bg-[#111827] text-white dark:bg-white dark:text-gray-900 font-black rounded-xl text-[12.5px] shadow-sm hover:opacity-95 transition-all"
                >
                  Get Commute
                </button>

                {calculatedTime && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 rounded-xl text-[11.5px] font-extrabold text-blue-900 dark:text-blue-200">
                    ⏱️ {calculatedTime}
                  </div>
                )}
              </div>

              {/* Quick Suggestions Chips */}
              <div className="space-y-2 pt-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Quick Suggestions</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickSuggestions.map((sugg) => (
                    <button
                      key={sugg}
                      onClick={() => handleCommuteCalc(sugg)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-gray-200/70 dark:border-white/5 text-[11px] font-extrabold text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                    >
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── 2.5. KEY EMPLOYMENT HUBS & COMMUTE CORRIDORS ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5">
        <div>
          <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Key Employment Hubs &amp; Commute Matrix</h2>
          <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Average driving and transit travel times to major NCR commercial centers.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {((detail as any)?.commute_matrix && Array.isArray((detail as any).commute_matrix)
            ? (detail as any).commute_matrix
            : []
          ).map((c: any, i: number) => (
            <div key={i} className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2.5 hover:border-gray-200 transition-all shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center text-[12px] font-black">
                  <Car size={15} />
                </div>
                <span className="text-[9.5px] sm:text-[10.5px] font-black text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                  {c.mode || 'Drive'}
                </span>
              </div>

              <div>
                <h4 className="text-[12px] sm:text-[13px] font-black text-gray-900 dark:text-white leading-snug line-clamp-2">{c.destination}</h4>
                <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-bold text-gray-400 mt-2 pt-1.5 border-t border-gray-100 dark:border-white/5">
                  <span className="truncate">{c.distance_km ? `${c.distance_km} km` : 'Direct'}</span>
                  <span className="text-gray-900 dark:text-white font-black text-[11.5px] sm:text-[12px] shrink-0">{c.travel_time_min} mins</span>
                </div>
                {c.peak_time_min && (
                  <p className="text-[9px] text-gray-400 font-medium mt-0.5 truncate">Peak: ~{c.peak_time_min}m</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. NEARBY PLACES (Modern 2-Column Responsive Card Grid) ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Nearby Places &amp; Transit</h2>
            <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Explore key landmarks, transit hubs, and daily essentials.</p>
          </div>
          {connectivity.length > 6 && (
            <button
              onClick={() => setShowAllNearby(!showAllNearby)}
              className="text-[12px] font-extrabold text-blue-600 hover:text-blue-700 hidden sm:flex items-center gap-1"
            >
              {showAllNearby ? 'Show Less' : `View All (${connectivity.length})`}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {(showAllNearby ? connectivity : connectivity.slice(0, 4)).map((place: any, idx: number) => {
            const distanceStr =
              place.distance_km != null
                ? `${place.distance_km} km`
                : place.distance
                ? typeof place.distance === 'number'
                  ? `${place.distance} km`
                  : place.distance
                : '—'

            const travelTimeMin =
              place.travel_time_min != null
                ? place.travel_time_min
                : place.time
                ? parseInt(String(place.time))
                : place.distance_km
                ? Math.max(2, Math.round(place.distance_km * 2.5))
                : null

            const timeStr = travelTimeMin != null ? `${travelTimeMin}m` : (place.time || '—')
            const isWalk = (place.travel_mode === 'walk' || place.mode === 'walk') || (place.distance_km && place.distance_km <= 1.0)
            const Icon = isWalk ? Footprints : Car

            const typeStr = place.type
              ? String(place.type).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              : 'Transit Hub'

            const bgs = [
              'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
              'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
              'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
              'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
              'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
            ]
            const bg = bgs[idx % bgs.length]

            return (
              <div
                key={idx}
                className="p-3 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2 hover:bg-gray-100/60 dark:hover:bg-white/10 transition-colors min-h-[96px]"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                    <Bus size={15} />
                  </div>
                  <div className="text-right">
                    <span className="text-[11.5px] sm:text-[12.5px] font-black text-gray-900 dark:text-white block leading-none">{distanceStr}</span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center justify-end gap-0.5 mt-0.5">
                      <Icon size={10} /> {timeStr}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[12px] sm:text-[13px] font-black text-gray-900 dark:text-white leading-tight line-clamp-2">{place.name}</h4>
                  <p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5 truncate">{typeStr}</p>
                </div>
              </div>
            )
          })}
        </div>

        {connectivity.length > 4 && (
          <div className="flex justify-center pt-1">
            <button
              onClick={() => setShowAllNearby(!showAllNearby)}
              className="px-5 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[11.5px] font-extrabold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-all shadow-2xs cursor-pointer"
            >
              {showAllNearby ? 'Show Less' : `View All (${connectivity.length}) Nearby Places`}
            </button>
          </div>
        )}
      </div>

      {/* ── 3.5. SAFETY & ENVIRONMENT INSIGHTS (2x2 Grid on Mobile) ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div>
          <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Safety &amp; Environmental Quality</h2>
          <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Key livability signals for this micro-market corridor.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <Shield size={16} />
            </div>
            <div>
              <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider leading-none">Women Safety</p>
              <p className="text-[16px] sm:text-[18px] font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {(detail as any)?.women_safety_score ?? (project as any)?.women_safety_score ? `${(detail as any)?.women_safety_score ?? (project as any)?.women_safety_score}/100` : 'Verified Safe'}
              </p>
              <p className="text-[9.5px] sm:text-[10.5px] text-gray-400 font-semibold mt-0.5">CCTV &amp; Patrol Zone</p>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <Wind size={16} />
            </div>
            <div>
              <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider leading-none">Annual AQI</p>
              <p className="text-[16px] sm:text-[18px] font-black text-gray-900 dark:text-white mt-1">
                {(detail as any)?.air_quality_index_avg ?? (project as any)?.air_quality_index_avg ?? 'Moderate'}
              </p>
              <p className="text-[9.5px] sm:text-[10.5px] text-emerald-600 font-bold mt-0.5">Moderate Air Zone</p>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Leaf size={16} />
            </div>
            <div>
              <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider leading-none">Green Cover</p>
              <p className="text-[16px] sm:text-[18px] font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {(detail as any)?.green_cover_percent ?? (project as any)?.green_cover_percent ? `${(detail as any)?.green_cover_percent ?? (project as any)?.green_cover_percent}%` : '65%+'}
              </p>
              <p className="text-[9.5px] sm:text-[10.5px] text-gray-400 font-semibold mt-0.5">Landscaped Corridor</p>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Volume2 size={16} />
            </div>
            <div>
              <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider leading-none">Ambient Noise</p>
              <p className="text-[16px] sm:text-[18px] font-black text-gray-900 dark:text-white mt-1">
                {(detail as any)?.noise_level_db ?? (project as any)?.noise_level_db ? `${(detail as any)?.noise_level_db ?? (project as any)?.noise_level_db} dB` : '< 52 dB'}
              </p>
              <p className="text-[9.5px] sm:text-[10.5px] text-emerald-600 font-bold mt-0.5">Quiet Residential</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. WHY PEOPLE CHOOSE THIS LOCATION (2-Column Grid on Mobile) ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5">
        <div>
          <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Why People Choose This Location</h2>
          <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Key reasons why this neighborhood stands out.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
          {[
            { icon: Compass, title: 'Connectivity', desc: 'Fast access to expressways & metro lines.', color: 'bg-blue-50 text-blue-600' },
            { icon: Building2, title: 'Infrastructure', desc: 'Commercial & social hubs expanding rapidly.', color: 'bg-purple-50 text-purple-600' },
            { icon: ShoppingBag, title: 'Essentials', desc: 'Schools, hospitals & retail minutes away.', color: 'bg-emerald-50 text-emerald-600' },
            { icon: TrendingUp, title: 'High Growth', desc: 'Strong rental yield and capital appreciation.', color: 'bg-amber-50 text-amber-600' },
            { icon: Trees, title: 'Peaceful Living', desc: 'Green spaces & planned urban density.', color: 'bg-cyan-50 text-cyan-600' }
          ].map((card, i) => {
            const Icon = card.icon
            return (
              <div key={i} className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-2.5 hover:scale-[1.02] transition-transform">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${card.color}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <h4 className="text-[12.5px] sm:text-[13.5px] font-black text-gray-900 dark:text-white leading-tight">{card.title}</h4>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold mt-0.5 leading-snug">{card.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 5. NEIGHBORHOOD ADVANTAGES (2-Column Grid) ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5">
        <div>
          <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Neighborhood Advantages</h2>
          <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Enjoy the perfect balance of convenience, comfort &amp; lifestyle.</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          {[
            { icon: GraduationCap, title: 'Educational Hub', desc: 'Top schools & colleges nearby for quality education.', color: 'bg-blue-50 text-blue-600' },
            { icon: Trees, title: 'Green & Open Spaces', desc: 'Parks, jogging tracks & open areas for healthy living.', color: 'bg-emerald-50 text-emerald-600' },
            { icon: Stethoscope, title: 'Healthcare Access', desc: 'Multi-specialty hospitals & clinics in close proximity.', color: 'bg-rose-50 text-rose-600' },
            { icon: Briefcase, title: 'Business & IT Parks', desc: 'Close to business parks, IT hubs & corporate offices.', color: 'bg-purple-50 text-purple-600' },
            { icon: ShoppingBag, title: 'Retail & Entertainment', desc: 'Shopping malls, multiplexes & entertainment zones nearby.', color: 'bg-amber-50 text-amber-600' },
            { icon: ShieldCheck, title: 'Safe & Secure Community', desc: 'Well-planned area with 24/7 security & surveillance.', color: 'bg-cyan-50 text-cyan-600' }
          ].map((adv, i) => {
            const Icon = adv.icon
            return (
              <div key={i} className="p-3 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col justify-between space-y-2">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${adv.color}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <h4 className="text-[12px] sm:text-[13.5px] font-black text-gray-900 dark:text-white leading-tight">{adv.title}</h4>
                  <p className="text-[10px] sm:text-[11.5px] text-gray-500 dark:text-gray-400 font-semibold mt-0.5 leading-snug line-clamp-2">{adv.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 6. DARK BLUE BOTTOM CTA FOOTER BANNER ── */}
      <div className="relative overflow-hidden bg-[#1E293B] dark:bg-black rounded-[24px] p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1 text-center sm:text-left z-10">
          <h3 className="text-[20px] font-black text-white tracking-tight">Love the Location?</h3>
          <p className="text-[12.5px] text-slate-300 font-medium">Schedule a site visit to experience the surroundings and neighborhood yourself.</p>
        </div>
        <a
          href={waUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppHandoff(d, 'location')}
          className="px-6 py-3 bg-white text-gray-900 font-black rounded-xl text-[13px] shadow-md hover:bg-gray-100 transition-all flex items-center gap-2 flex-shrink-0 z-10"
        >
          <CalendarDays size={16} /> Book Site Visit
        </a>
      </div>

      <p className="text-center text-[10.5px] text-gray-400 font-bold">
        Map data © 2026 Google &bull; Travel times are approximate and may vary based on traffic conditions.
      </p>

    </div>
  )
}
