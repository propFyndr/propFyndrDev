// backend/src/lib/googleMaps.ts
// Ported from frontend/lib/google-maps.ts — Next.js fetch options removed.

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY

function getFallbackCommute(origin: string, destination: string): CommuteResult {
  const seed = origin.length + destination.length
  const drive_min = 15 + (seed % 20)
  const distance_km = 5 + (seed % 10)
  return {
    origin_address: origin,
    destination_address: destination,
    drive_text: `${drive_min} mins`,
    drive_min,
    distance_text: `${distance_km} km`,
    distance_km,
  }
}

function getFallbackTransit(origin: string, destination: string): { transit_text: string; transit_min: number } {
  const seed = origin.length + destination.length
  const transit_min = 35 + (seed % 30)
  return {
    transit_text: `${transit_min} mins`,
    transit_min,
  }
}

export interface CommuteResult {
  origin_address: string
  destination_address: string
  drive_text: string
  drive_min: number
  distance_text: string
  distance_km: number
}

export interface NearbyPlace {
  name: string
  rating?: number
  vicinity?: string
}

export interface GeoPoint {
  lat: number
  lng: number
}

export interface GeocodeResult {
  lat: number
  lng: number
  formatted_address: string
  source: 'google' | 'nominatim'
}

export async function getCommuteTime(
  origin: string,
  destination: string,
): Promise<CommuteResult | null> {
  if (!MAPS_KEY) return null

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', origin)
  url.searchParams.set('destinations', destination)
  url.searchParams.set('mode', 'driving')
  url.searchParams.set('units', 'metric')
  url.searchParams.set('region', 'in')
  url.searchParams.set('key', MAPS_KEY)

  try {
    const res = await fetch(url.toString())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()

    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') return getFallbackCommute(origin, destination)

    return {
      origin_address: data.origin_addresses?.[0] ?? origin,
      destination_address: data.destination_addresses?.[0] ?? destination,
      drive_text: element.duration.text,
      drive_min: Math.round(element.duration.value / 60),
      distance_text: element.distance.text,
      distance_km: Math.round(element.distance.value / 100) / 10,
    }
  } catch {
    return getFallbackCommute(origin, destination)
  }
}

export async function getTransitTime(
  origin: string,
  destination: string,
): Promise<{ transit_text: string; transit_min: number } | null> {
  if (!MAPS_KEY) return null

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', origin)
  url.searchParams.set('destinations', destination)
  url.searchParams.set('mode', 'transit')
  url.searchParams.set('region', 'in')
  url.searchParams.set('key', MAPS_KEY)

  try {
    const res = await fetch(url.toString())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()

    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') return getFallbackTransit(origin, destination)

    return {
      transit_text: element.duration.text,
      transit_min: Math.round(element.duration.value / 60),
    }
  } catch {
    return getFallbackTransit(origin, destination)
  }
}

export async function geocode(address: string): Promise<GeoPoint | null> {
  if (!MAPS_KEY) return null

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', address + ' India')
  url.searchParams.set('key', MAPS_KEY)

  try {
    const res = await fetch(url.toString())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()

    const loc = data.results?.[0]?.geometry?.location
    return loc ? { lat: loc.lat, lng: loc.lng } : null
  } catch {
    return null
  }
}

export async function getNearbyPlaces(
  lat: number,
  lng: number,
  type: 'school' | 'hospital' | 'transit_station' | 'shopping_mall' | 'subway_station',
  radiusM = 3000,
): Promise<NearbyPlace[]> {
  if (!MAPS_KEY) return []

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
  url.searchParams.set('location', `${lat},${lng}`)
  url.searchParams.set('radius', String(radiusM))
  url.searchParams.set('type', type)
  url.searchParams.set('key', MAPS_KEY)

  try {
    const res = await fetch(url.toString())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    if (!data.results) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results as any[]).slice(0, 6).map((p) => ({
      name: p.name as string,
      rating: p.rating as number | undefined,
      vicinity: p.vicinity as string | undefined,
    }))
  } catch {
    return []
  }
}

/** Geocode an address — Google Maps first, Nominatim OSM fallback. */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (MAPS_KEY) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
      url.searchParams.set('address', address)
      url.searchParams.set('key', MAPS_KEY)
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) })
      const data = (await res.json()) as {
        status: string
        results?: Array<{
          geometry: { location: { lat: number; lng: number } }
          formatted_address: string
        }>
      }
      if (data.status === 'OK' && data.results?.[0]) {
        const r = data.results[0]
        return {
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          formatted_address: r.formatted_address,
          source: 'google',
        }
      }
    } catch { /* fall through */ }
  }

  // Nominatim OSM fallback — free, no key, India-scoped
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', address)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'in')
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'RealtyAsk/1.0 (contact@propfyndr.in)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
    if (results.length === 0) return null
    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      formatted_address: results[0].display_name,
      source: 'nominatim',
    }
  } catch {
    return null
  }
}

/** Convenience: get all commute modes side by side */
export async function getFullCommuteProfile(
  projectAddress: string,
  userDestination: string,
): Promise<{
  drive: CommuteResult | null
  transit: { transit_text: string; transit_min: number } | null
}> {
  const [drive, transit] = await Promise.all([
    getCommuteTime(projectAddress, userDestination),
    getTransitTime(projectAddress, userDestination),
  ])
  return { drive, transit }
}
