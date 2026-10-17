// backend/src/lib/discovery/airports.ts
//
// How far a project is from each airport a Noida buyer actually uses.
//
// `Project.airport_distance_km` holds ONE number, and which airport it means
// is not written down anywhere. Checked against our own coordinates it is
// Jewar: median error 5.5km against Noida International, 23.7km against Delhi
// IGI. That is a real measurement — but it silently answers "how far is the
// airport" with the wrong airport for anyone flying today, because Jewar is
// new and Delhi is where the flights are.
//
// Both distances are computed here from `lat`/`lng`, the only geo signal in the
// database we trust (the connectivity rows are synthetic — see MEMORY.md, 28 Aug),
// except a round-number placeholder point, which is treated as missing (geo.ts).
//
// Computed, not stored: a derived number in a column drifts from the
// coordinates it came from the moment either is edited, and this costs
// microseconds.

import { calculateHaversineDistanceKm, isPlaceholderCoordinate } from './geo'

export interface Airport {
  key: 'delhi' | 'jewar'
  name: string
  /** How a buyer refers to it, for matching against their question. */
  aliases: RegExp
  lat: number
  lng: number
}

export const AIRPORTS: readonly Airport[] = [
  {
    key: 'delhi',
    name: 'Indira Gandhi International (Delhi)',
    aliases: /\b(igi|indira gandhi|delhi airport|del\b)/i,
    lat: 28.5562,
    lng: 77.1000,
  },
  {
    key: 'jewar',
    name: 'Noida International (Jewar)',
    aliases: /\b(jewar|noida international|noida airport|nia\b)/i,
    lat: 28.1667,
    lng: 77.6000,
  },
] as const

export interface AirportDistance {
  airport: string
  km: number
}

/**
 * Straight-line distance to each airport, nearest first.
 *
 * Straight-line, not driving: we have no routing data, and presenting a
 * road distance we did not measure is the kind of confident wrong number this
 * codebase keeps having to remove. The label says "straight line" so the
 * buyer can read it for what it is.
 */
export function airportDistances(lat: number | null, lng: number | null): AirportDistance[] {
  if (isPlaceholderCoordinate(lat, lng)) return []
  return AIRPORTS
    .map((a) => ({
      airport: a.name,
      km: Math.round(calculateHaversineDistanceKm(lat!, lng!, a.lat, a.lng) * 10) / 10,
    }))
    .sort((x, y) => x.km - y.km)
}

/**
 * Which airport the buyer meant, if they named one.
 *
 * Returns null for a bare "how far is the airport" — that question wants both,
 * because the honest answer in Noida right now is "depends which one".
 */
export function airportAskedAbout(message: string): Airport | null {
  return AIRPORTS.find((a) => a.aliases.test(message ?? '')) ?? null
}
