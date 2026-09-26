'use client'

import { useState } from 'react'
import { Save, MapPin, Map } from 'lucide-react'
import { API_BASE } from '@/lib/env'
import { adminAuthHeaders } from '@/lib/authedFetch'
import { toast } from 'sonner'
import JsonEditor from './JsonEditor'

interface LocationIntelligenceData {
  schools_nearby_count?: number | string
  hospitals_nearby_count?: number | string
  shopping_nearby_count?: number | string
  it_parks_nearby_count?: number | string
  banks_nearby_count?: number | string
  restaurants_nearby_count?: number | string
  walkability_score?: number | string
  green_cover_percent?: number | string
  air_quality_index_avg?: number | string
  aqi_annual_avg?: number | string
  women_safety_score?: number | string
  noise_level_db?: number | string
  top_school_distance_km?: number | string
  hospital_distance_km?: number | string
  airport_distance_km?: number | string
  flood_waterlogging_risk?: string
  flood_zone?: string
  location_concerns?: string[]
  litigation_count?: number | string
  interior_designer?: string
  market_intelligence?: {
    location_data?: Record<string, unknown>
  }
  decision_profile?: {
    market_intelligence?: {
      location_data?: Record<string, unknown>
    }
    intelligence_data?: {
      location_data?: Record<string, unknown>
    }
  }
}

export default function LocationIntelligenceEditor({ projectId, initialData }: { projectId: string, initialData?: LocationIntelligenceData }) {
  const [schools, setSchools] = useState(String(initialData?.schools_nearby_count ?? ''))
  const [hospitals, setHospitals] = useState(String(initialData?.hospitals_nearby_count ?? ''))
  const [shopping, setShopping] = useState(String(initialData?.shopping_nearby_count ?? ''))
  const [itParks, setItParks] = useState(String(initialData?.it_parks_nearby_count ?? ''))
  const [banks, setBanks] = useState(String(initialData?.banks_nearby_count ?? ''))
  const [restaurants, setRestaurants] = useState(String(initialData?.restaurants_nearby_count ?? ''))
  const [walkability, setWalkability] = useState(String(initialData?.walkability_score ?? ''))
  const [greenCover, setGreenCover] = useState(String(initialData?.green_cover_percent ?? ''))
  const [aqi, setAqi] = useState(String(initialData?.air_quality_index_avg ?? initialData?.aqi_annual_avg ?? ''))
  const [safetyScore, setSafetyScore] = useState(String(initialData?.women_safety_score ?? ''))
  const [noiseLevel, setNoiseLevel] = useState(String(initialData?.noise_level_db ?? ''))
  
  const [schoolDist, setSchoolDist] = useState(String(initialData?.top_school_distance_km ?? ''))
  const [hospitalDist, setHospitalDist] = useState(String(initialData?.hospital_distance_km ?? ''))
  const [airportDist, setAirportDist] = useState(String(initialData?.airport_distance_km ?? ''))
  // Empty, not 'LOW'. A default of LOW meant every project an admin never
  // opened this section for was saved claiming low flood risk — which is how
  // all 280 rows ended up LOW, in a city with documented waterlogging. The
  // select carries an explicit "Not assessed" option instead.
  const [floodRisk, setFloodRisk] = useState(initialData?.flood_waterlogging_risk || '')
  const [floodZone, setFloodZone] = useState(initialData?.flood_zone || '')
  const [concerns, setConcerns] = useState(Array.isArray(initialData?.location_concerns) ? initialData.location_concerns.join('\n') : '')
  // Blank, not '0'. "0 litigation" is a verified-clean claim; blank is "not
  // checked". Seeding the box with 0 published the strong claim for every
  // project nobody reviewed, including builders with public NCLT proceedings.
  const [litigationCount, setLitigationCount] = useState(
    initialData?.litigation_count === null || initialData?.litigation_count === undefined
      ? ''
      : String(initialData.litigation_count),
  )
  const [interiorDesigner, setInteriorDesigner] = useState(initialData?.interior_designer || '')

  const [locationData, setLocationData] = useState<Record<string, unknown>>(
    initialData?.market_intelligence?.location_data ||
    initialData?.decision_profile?.market_intelligence?.location_data ||
    initialData?.decision_profile?.intelligence_data?.location_data ||
    {
      connectivity: [
        `Direct access to Metro Station within 1.5 km`,
        `Seamless connectivity to Noida-Greater Noida Expressway & main sector road`
      ],
      essentials: [
        'Top IB & CBSE schools (DPS, Lotus Valley) within 3 km',
        'Multi-specialty hospitals (Yatharth, Fortis) under 10 mins drive'
      ],
      neighborhood_advantages: [
        `Established residential cluster with 80%+ occupancy`,
        'Surrounded by green belts, sports complexes, and retail centers'
      ]
    }
  )

  const handleSave = async () => {
    try {
      const walkabilityNum = walkability ? parseInt(String(walkability), 10) : null
      const greenCoverNum = greenCover ? parseInt(String(greenCover), 10) : null
      const aqiNum = aqi ? parseFloat(String(aqi)) : null
      const safetyNum = safetyScore ? parseInt(String(safetyScore), 10) : null
      const noiseLevelNum = noiseLevel ? parseInt(String(noiseLevel), 10) : null

      if (walkabilityNum !== null && (walkabilityNum < 0 || walkabilityNum > 100)) {
        toast.error('Walkability score must be 0-100')
        return
      }
      if (greenCoverNum !== null && (greenCoverNum < 0 || greenCoverNum > 100)) {
        toast.error('Green cover must be 0-100%')
        return
      }

      const parsedConcerns = concerns.split('\n').map(s => s.trim()).filter(Boolean)

      const res = await fetch(`${API_BASE}/admin/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({
          schools_nearby_count: schools ? String(parseInt(schools)) : null,
          hospitals_nearby_count: hospitals ? String(parseInt(hospitals)) : null,
          shopping_nearby_count: shopping ? String(parseInt(shopping)) : null,
          it_parks_nearby_count: itParks ? String(parseInt(itParks)) : null,
          banks_nearby_count: banks ? String(parseInt(banks)) : null,
          restaurants_nearby_count: restaurants ? String(parseInt(restaurants)) : null,
          walkability_score: walkabilityNum ? String(walkabilityNum) : null,
          green_cover_percent: greenCoverNum ? String(greenCoverNum) : null,
          air_quality_index_avg: aqiNum ? String(Math.round(aqiNum)) : null,
          aqi_annual_avg: aqiNum,
          women_safety_score: safetyNum,
          noise_level_db: noiseLevelNum ? String(noiseLevelNum) : null,
          top_school_distance_km: schoolDist ? parseFloat(schoolDist) : null,
          hospital_distance_km: hospitalDist ? parseFloat(hospitalDist) : null,
          airport_distance_km: airportDist ? parseFloat(airportDist) : null,
          // All four send null when blank rather than a substituted value, so
          // an unreviewed field stays unreviewed instead of becoming a claim.
          flood_waterlogging_risk: floodRisk || null,
          flood_zone: floodZone || null,
          location_concerns: parsedConcerns,
          litigation_count: litigationCount.trim() === '' ? null : Number(litigationCount),
          interior_designer: interiorDesigner || null,
        })
      })
      if (!res.ok) throw new Error('Failed to save location attributes')

      const existingIntelligence = initialData?.decision_profile?.intelligence_data ?? {}
      const decisionRes = await fetch(`${API_BASE}/admin/projects/${projectId}/decision-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({
          intelligence_data: {
            ...existingIntelligence,
            location_data: locationData
          }
        })
      })
      if (!decisionRes.ok) throw new Error('Failed to save location intelligence data')

      toast.success('Location intelligence & decision factors saved successfully')
    } catch (e) {
      console.error('[LocationIntelligenceEditor] Save failed:', e)
      toast.error(e instanceof Error ? e.message : 'Error saving location intelligence')
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xs border border-zinc-200/90 dark:border-zinc-800 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-100 dark:border-orange-900/40">
            <MapPin size={17} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Area Livability & Decision Factors</h3>
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">Configure walkability, environmental quality, safety, distances, flood risk, and honest location concerns.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="bg-[#0066cc] hover:bg-[#0055b3] text-white px-4 py-2 rounded-xl text-[13px] font-medium flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
        >
          <Save size={14} /> Save Factors
        </button>
      </div>

      {/* Decision Factors Distance Grid */}
      <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 space-y-3">
        <h4 className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Strategic Distances & Key Benchmarks</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Top School (km)</label>
            <input value={schoolDist} onChange={(e) => setSchoolDist(e.target.value)} type="number" step="0.1" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2 text-[13px] font-mono font-medium text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs" placeholder="1.5" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Hospital (km)</label>
            <input value={hospitalDist} onChange={(e) => setHospitalDist(e.target.value)} type="number" step="0.1" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2 text-[13px] font-mono font-medium text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs" placeholder="2.0" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Airport (km)</label>
            <input value={airportDist} onChange={(e) => setAirportDist(e.target.value)} type="number" step="0.1" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2 text-[13px] font-mono font-medium text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs" placeholder="42.0" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Flood / Waterlogging</label>
            <select value={floodRisk} onChange={(e) => setFloodRisk(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2 text-[13px] font-medium text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs cursor-pointer">
              <option value="">Not assessed</option>
              <option value="LOW">LOW</option>
              <option value="MODERATE">MODERATE</option>
              <option value="HIGH">HIGH</option>
              <option value="BUFFER_ZONE">BUFFER_ZONE</option>
            </select>
          </div>
        </div>
      </div>

      {/* Environmental & Quality Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-zinc-50/70 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/70 dark:border-zinc-800">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Walkability (0-100)</label>
          <input value={walkability} onChange={(e) => setWalkability(e.target.value)} type="number" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3 py-2 text-[13px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs" placeholder="85" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Green Cover (%)</label>
          <input value={greenCover} onChange={(e) => setGreenCover(e.target.value)} type="number" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3 py-2 text-[13px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs" placeholder="75" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Air Quality (AQI)</label>
          <input value={aqi} onChange={(e) => setAqi(e.target.value)} type="number" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3 py-2 text-[13px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs" placeholder="178" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Safety Score (0-100)</label>
          <input value={safetyScore} onChange={(e) => setSafetyScore(e.target.value)} type="number" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3 py-2 text-[13px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs" placeholder="92" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Litigation Count</label>
          <input value={litigationCount} onChange={(e) => setLitigationCount(e.target.value)} type="number" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3 py-2 text-[13px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs" placeholder="0" />
        </div>
      </div>

      {/* Honest Location Concerns (Textarea per line) */}
      <div>
        <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Honest Location Concerns (One point per line)
        </label>
        <textarea
          rows={3}
          value={concerns}
          onChange={(e) => setConcerns(e.target.value)}
          placeholder="Peak hour traffic bottleneck around sector entrance...&#10;Social retail centers are currently maturing..."
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-[13px] text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none resize-none font-normal shadow-2xs leading-relaxed"
        />
      </div>

      {/* Interior Designer */}
      <div>
        <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Interior Designer / Architectural Studio
        </label>
        <input
          type="text"
          value={interiorDesigner}
          onChange={(e) => setInteriorDesigner(e.target.value)}
          placeholder="e.g. Hafeez Contractor / In-House Architectural & Design Studio"
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-[13px] text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none font-medium shadow-2xs"
        />
      </div>

      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/40">
            <Map size={16} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">Structured Micro-Market JSON</h3>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Structured highlights, essentials, and connectivity anchors.</p>
          </div>
        </div>
        <JsonEditor
          value={locationData}
          onChange={setLocationData}
          label="Location Intelligence JSON"
          description="Use valid JSON. This updates the frontend arrays directly."
        />
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <button onClick={handleSave} className="bg-[#0066cc] hover:bg-[#0055b3] text-white px-5 py-2.5 rounded-xl text-[13px] font-medium flex items-center gap-2 transition-colors cursor-pointer shadow-2xs">
          <Save size={14} /> Save All Changes
        </button>
      </div>
    </div>
  )
}
