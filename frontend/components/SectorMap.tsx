'use client'

import dynamic from 'next/dynamic'
import type { ProjectCard } from '@/types/project'
import MapErrorBoundary from './MapErrorBoundary'

export const SECTOR_CENTROIDS: Record<string, [number, number]> = {
  'Sector 18':  [28.569, 77.321],
  'Sector 44':  [28.561, 77.356],
  'Sector 50':  [28.572, 77.368],
  'Sector 62':  [28.627, 77.366],
  'Sector 63':  [28.618, 77.374],
  'Sector 70':  [28.575, 77.380],
  'Sector 75':  [28.575, 77.388],
  'Sector 76':  [28.581, 77.388],
  'Sector 77':  [28.574, 77.392],
  'Sector 78':  [28.565, 77.392],
  'Sector 79':  [28.558, 77.391],
  'Sector 93A': [28.527, 77.398],
  'Sector 93B': [28.524, 77.406],
  'Sector 100': [28.530, 77.415],
  'Sector 107': [28.524, 77.419],
  'Sector 108': [28.517, 77.425],
  'Sector 117': [28.529, 77.390],
  'Sector 118': [28.518, 77.397],
  'Sector 119': [28.511, 77.407],
  'Sector 120': [28.530, 77.436],
  'Sector 121': [28.527, 77.448],
  'Sector 128': [28.509, 77.390],
  'Sector 129': [28.503, 77.397],
  'Sector 130': [28.497, 77.402],
  'Sector 131': [28.491, 77.408],
  'Sector 132': [28.484, 77.414],
  'Sector 133': [28.477, 77.420],
  'Sector 134': [28.470, 77.426],
  'Sector 135': [28.476, 77.433],
  'Sector 137': [28.506, 77.417],
  'Sector 143': [28.489, 77.432],
  'Sector 143B': [28.486, 77.447],
  'Sector 144': [28.480, 77.452],
  'Sector 150': [28.473, 77.444],
  'Sector 151': [28.466, 77.450],
  'Sector 152': [28.459, 77.456],
  'Sector 153': [28.452, 77.462],
  'Sector 168': [28.492, 77.420],
}

export const NOIDA_CENTER: [number, number] = [28.535, 77.391]

export interface ExtraMarker {
  name: string
  pos: [number, number]
  category: string
}

/**
 * A pin for where the buyer works, from a stated workplace like "Sector 63".
 *
 * Only a sector we hold coordinates for gets a pin. A workplace we cannot place
 * ("Okhla", "DLF Cyber Hub") returns nothing: a pin at a guessed spot would be worse
 * than none.
 */
export function officeMarkers(workplace: unknown): ExtraMarker[] {
  if (typeof workplace !== 'string') return []
  const m = /\bsector\s*(\d{1,3})\s*([a-d])?\b/i.exec(workplace)
  if (!m) return []
  const key = `Sector ${m[1]}${(m[2] ?? '').toUpperCase()}`
  const pos = SECTOR_CENTROIDS[key]
  return pos ? [{ name: `Your office (${key})`, pos, category: 'Work' }] : []
}

interface Props {
  properties: ProjectCard[]
  extraMarkers?: ExtraMarker[]

}

const MapInner = dynamic(() => import('./SectorMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">

      <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
    </div>
  ),
})

export default function SectorMap({ properties, extraMarkers }: Props) {
  if (!properties.length) return null
  return (
    <MapErrorBoundary>
      <MapInner properties={properties} extraMarkers={extraMarkers} />

    </MapErrorBoundary>
  )
}
