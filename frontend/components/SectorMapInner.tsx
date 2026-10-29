'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { ProjectCard } from '@/types/project'
import { SECTOR_CENTROIDS, NOIDA_CENTER } from './SectorMap'

/**
 * Leaflet measures its box once, at creation. Created inside a shelf that is
 * still expanding, it measured nothing and drew grey tiles until the window was
 * resized (tester report, 29 Oct). Re-measure whenever the box changes.
 */
function KeepSized() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    const t = setTimeout(() => map.invalidateSize(), 400)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [map])
  return null
}

interface ExtraMarker {
  name: string
  pos: [number, number]
  category: string
}

interface Props {
  properties: ProjectCard[]
  extraMarkers?: ExtraMarker[]

}

const statusLabel = (s: string) =>
  s === 'ready_to_move' ? 'Ready to Move' : s === 'new_launch' ? 'New Launch' : 'Under Construction'

const CATEGORY_COLORS: Record<string, string> = {
  Transport: '#3B82F6',   // blue
  Education: '#8B5CF6',   // purple
  Healthcare: '#EF4444',  // red
  Lifestyle: '#EC4899',   // pink
  Work: '#14B8A6',        // teal
}

export default function SectorMapInner({ properties, extraMarkers = [] }: Props) {
  // Every <Marker> below passes its own divIcon, so Leaflet's default PNG
  // marker (and the usual bundler fix for it) is never used.

  // Each property gets a position

  const pins = properties.map((p) => ({
    project: p,
    pos: (p.lat && p.lng)
      ? [p.lat, p.lng] as [number, number]
      : SECTOR_CENTROIDS[p.sector] ?? NOIDA_CENTER,
  }))

  const centerLat = pins.reduce((s, p) => s + p.pos[0], 0) / pins.length
  const centerLng = pins.reduce((s, p) => s + p.pos[1], 0) / pins.length

  const mainPin = useMemo(() => L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;background:#1F2937;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.35);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -26],
  }), [])

  // Function to create color-coded pins for extra markers
  const getCategoryPin = (category: string) => {
    const color = CATEGORY_COLORS[category] || '#6B7280'
    return L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 16],
      popupAnchor: [0, -18],
    })
  }

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={14}
      style={{ height: '400px', width: '100%', borderRadius: '16px', zIndex: 0 }}

      scrollWheelZoom={false}
    >
      <KeepSized />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map(({ project: p, pos }) => (
        <Marker key={p.id} position={pos} icon={mainPin}>

          <Popup>
            <div style={{ minWidth: '150px', fontFamily: 'sans-serif' }}>
              <p style={{ fontWeight: 700, fontSize: '13px', margin: '0 0 3px', color: '#111' }}>{p.name}</p>
              <p style={{ color: '#2563EB', fontWeight: 700, fontSize: '12px', margin: '0 0 2px' }}>{p.price_range_label}</p>
              <p style={{ color: '#666', fontSize: '11px', margin: 0 }}>{p.sector} · {statusLabel(p.status)}</p>
              <div className="pt-2 pb-1">
                <a href={`/property/${p.slug}`} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full h-8 text-xs font-semibold bg-black text-white rounded-md hover:bg-gray-800 transition-colors">
                  View Property
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      {extraMarkers.map((marker, idx) => (
        <Marker key={`extra-${idx}`} position={marker.pos} icon={getCategoryPin(marker.category)}>
          <Popup>
            <div style={{ fontFamily: 'sans-serif' }}>
              <p style={{ fontWeight: 700, fontSize: '12px', margin: '0 0 2px', color: '#111' }}>{marker.name}</p>
              <p style={{ color: CATEGORY_COLORS[marker.category] || '#6B7280', fontWeight: 600, fontSize: '10px', margin: 0 }}>{marker.category}</p>
            </div>
          </Popup>
        </Marker>
      ))}

    </MapContainer>
  )
}
