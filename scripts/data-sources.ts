/**
 * Data Source Fetchers
 * Efficient, cached extraction from RERA, builder sites, project sites
 * Uses search APIs (Tavily) + deterministic HTML parsing
 */

import * as fs from 'fs'

interface SourceFetch {
  field_name: string
  value: any
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  source: string
  extracted_at: string
  url?: string
}

/**
 * RERA Lookup via Tavily Search (cost-efficient)
 * Searches: "{project_name} RERA registration" + "{rera_number}"
 * Extracts: status, possession_date, oc_status, compliance_score
 */
export async function fetchFromRERA(projectName: string, reraNumber?: string): Promise<SourceFetch[]> {
  const results: SourceFetch[] = []
  const now = new Date().toISOString()

  // Mock for now; real implementation calls Tavily API
  // const tavily = new Tavily({ apiKey: process.env.TAVILY_API_KEY })
  // const searchResult = await tavily.search(`${projectName} RERA ${reraNumber}`)
  // Parse HTML/text results

  // Placeholder extraction patterns
  const patterns = {
    rera_status: /status[:\s]*(registered|approved|pending|rejected)/i,
    possession: /possession[:\s]*([a-z0-9, ]+)/i,
    oc_status: /occupancy.*certificate[:\s]*(issued|pending|not issued)/i,
    compliance: /compliance.*score[:\s]*(\d+)/i,
  }

  // For MVP: return LOW confidence (no real fetch yet)
  results.push({
    field_name: 'rera_number',
    value: reraNumber || null,
    confidence: reraNumber ? 'HIGH' : 'LOW',
    source: 'rera_website',
    extracted_at: now,
  })

  return results
}

/**
 * Builder Website Extraction (targeted parsing)
 * Extracts: past projects, delivery count, average delay, track record
 * Uses: Puppeteer OR Google search for builder name + "delivered projects"
 */
export async function fetchFromBuilderSite(builderName: string, builderWebsite?: string): Promise<SourceFetch[]> {
  const results: SourceFetch[] = []
  const now = new Date().toISOString()

  // Real implementation: fetch builderWebsite, parse HTML for:
  // - Project list (count delivered / ongoing / delayed)
  // - Company awards, credentials
  // - Press releases about completions

  // For MVP: search for builder track record via news/google
  // const searchResult = await googleSearch(`${builderName} delivered projects`);
  // parseProjectCount(searchResult)

  // Placeholder
  results.push({
    field_name: 'projects_delivered_count',
    value: null,
    confidence: 'LOW',
    source: 'builder_site',
    extracted_at: now,
  })

  return results
}

/**
 * Project Website Extraction (targeted parsing)
 * Extracts: current pricing, available units, amenities, possession_date
 * Target pages: /pricing, /inventory, /specifications
 */
export async function fetchFromProjectSite(projectWebsite?: string): Promise<SourceFetch[]> {
  const results: SourceFetch[] = []
  const now = new Date().toISOString()

  // Real implementation: fetch projectWebsite pages, parse for:
  // - Price tables (₹1.5Cr, ₹85L per sqft)
  // - Inventory tables (Available: 12 units)
  // - Amenities list
  // - Possession label/date

  if (!projectWebsite) {
    return results
  }

  // Placeholder
  results.push({
    field_name: 'base_price_per_sqft',
    value: null,
    confidence: 'LOW',
    source: 'project_site',
    extracted_at: now,
    url: projectWebsite,
  })

  return results
}

/**
 * Google Maps Verification (if API key available)
 * Extracts: location verified, reviews count, rating, photos date
 */
export async function fetchFromGoogleMaps(lat?: number, lng?: number, projectName?: string): Promise<SourceFetch[]> {
  const results: SourceFetch[] = []
  const now = new Date().toISOString()

  // Requires: GOOGLE_MAPS_API_KEY + quota management
  // Real implementation:
  // const maps = new GoogleMapsAPI(apiKey);
  // const place = await maps.findPlace({ name: projectName, lat, lng });
  // const details = await maps.getPlaceDetails(place.place_id);
  // Extract: reviews, rating, photos (latest = possession proof)

  // For MVP: skip (requires API key)
  results.push({
    field_name: 'location_verified',
    value: false,
    confidence: 'LOW',
    source: 'google_maps',
    extracted_at: now,
  })

  return results
}

/**
 * News Archive Search (for red flags)
 * Searches: "{project_name} delayed", "{builder_name} litigation"
 * Extracts: litigation_count, average_delay_months, legal_flags
 */
export async function fetchFromNewsArchive(projectName: string, builderName: string): Promise<SourceFetch[]> {
  const results: SourceFetch[] = []
  const now = new Date().toISOString()

  // Real implementation: call Tavily/Perplexity for news search
  // Query: `${projectName} delayed | litigation | NCLT`
  // Count articles, extract dates, flag severity

  // Placeholder
  results.push({
    field_name: 'litigation_count',
    value: 0,
    confidence: 'LOW',
    source: 'news_archive',
    extracted_at: now,
  })

  return results
}

/**
 * Batch fetch all sources for a project
 * Priority: RERA > Builder > Project > Maps > News
 * Returns: all sources merged, conflicts noted
 */
export async function fetchAllSources(project: {
  name: string
  rera_number?: string
  builder_name: string
  builder_website?: string
  project_website?: string
  lat?: number
  lng?: number
}): Promise<{
  fields: SourceFetch[]
  conflicts: Array<{ field: string; sources: Record<string, any> }>
  quality_score: number
}> {
  const [rera, builder, projectSite, maps, news] = await Promise.all([
    fetchFromRERA(project.name, project.rera_number),
    fetchFromBuilderSite(project.builder_name, project.builder_website),
    fetchFromProjectSite(project.project_website),
    fetchFromGoogleMaps(project.lat, project.lng, project.name),
    fetchFromNewsArchive(project.name, project.builder_name),
  ])

  const allFields = [...rera, ...builder, ...projectSite, ...maps, ...news]
  const conflicts: Array<{ field: string; sources: Record<string, any> }> = []

  // Detect conflicts (same field, different value)
  const fieldMap = new Map<string, SourceFetch[]>()
  for (const field of allFields) {
    if (!fieldMap.has(field.field_name)) {
      fieldMap.set(field.field_name, [])
    }
    fieldMap.get(field.field_name)!.push(field)
  }

  for (const [fieldName, sources] of fieldMap) {
    const values = new Set(sources.map((s) => JSON.stringify(s.value)))
    if (values.size > 1 && sources.every((s) => s.value !== null && s.value !== undefined)) {
      conflicts.push({
        field: fieldName,
        sources: Object.fromEntries(sources.map((s) => [s.source, s.value])),
      })
    }
  }

  // Quality score: HIGH = +20, MEDIUM = +10, LOW = +5, max 100
  const qualityScore = Math.min(
    100,
    allFields.reduce((sum, f) => sum + (f.confidence === 'HIGH' ? 20 : f.confidence === 'MEDIUM' ? 10 : 5), 0) /
      Math.max(1, allFields.length)
  )

  return {
    fields: allFields,
    conflicts,
    quality_score: Math.round(qualityScore),
  }
}

/**
 * Cache layer (in-memory for this session)
 */
const cache = new Map<string, any>()

export function cacheKey(type: string, id: string): string {
  return `${type}:${id}`
}

export function getFromCache(key: string): any {
  return cache.get(key)
}

export function saveToCache(key: string, value: any): void {
  cache.set(key, value)
}

export function clearCache(): void {
  cache.clear()
}
