// City configuration — centralized source of truth for supported cities
// Post-pilot: migrate to a DB table for dynamic city management

export const SUPPORTED_CITIES = ['Noida', 'Greater Noida', 'Greater Noida West', 'Yamuna Expressway'] as const
export const DEFAULT_CITY = 'Noida'
export const PILOT_SCOPE_LABEL = 'Noida & Greater Noida'

export type SupportedCity = typeof SUPPORTED_CITIES[number]

export function isValidCity(city: string | undefined): city is SupportedCity {
  return city !== undefined && SUPPORTED_CITIES.includes(city as any)
}

/**
 * Cities we do not cover, named so a sector in one is never read as ours.
 *
 * Noida and Gurgaon both have a Sector 62. Measured: "Find me apartments in
 * Sector 62 Gurgaon vs Sector 79 Noida" resolved to `sector: "Sector 62,
 * Noida"` — `normalizeSectorName` keeps only "Sector N" and drops the city —
 * and the buyer was then answered with Noida's Sector 62 inventory. A different
 * city's stock presented as the one they asked about is the "never recommend
 * unsupported cities as available inventory" rule failing silently.
 *
 * Delhi is deliberately absent: it is the reference point for half the commute
 * questions we get ("30 minutes from South Delhi"), and blocking it would break
 * answers that are legitimately about Noida.
 */
const OUT_OF_SCOPE_CITY =
  /\b(gurgaon|gurugram|bangalore|bengaluru|mumbai|pune|hyderabad|chennai|kolkata|ahmedabad|jaipur|lucknow|dehradun|chandigarh|mohali|faridabad|ghaziabad|sonipat|meerut)\b/i

/** The out-of-scope city this message names, if any. */
export function outOfScopeCity(message: string): string | null {
  const m = OUT_OF_SCOPE_CITY.exec(message ?? '')
  if (!m) return null
  return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()
}
