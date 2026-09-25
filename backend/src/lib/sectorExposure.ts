// backend/src/lib/sectorExposure.ts
//
// What a `SectorIntelligence` row may say to a buyer.
//
// Same rule as `projectExposure.ts`, for the same reason: adding a column to
// the model must not publish it. The select below is an allowlist, so a new
// column is absent from the sector page until somebody decides it belongs
// there — and `sectorExposure.test.ts` fails on anything left unclassified.
//
// The classification is per-field rather than per-table because this row mixes
// three audiences: figures a buyer should see, an analyst's own notes about who
// verified what, and one field that is advice about NOT buying.

/**
 * Fields a buyer sees on a sector page.
 *
 * `who_should_avoid` is deliberately included. § Trust First in CLAUDE.md is
 * explicit that we show negatives, and a sector page that lists only who a
 * place suits is a brochure. It is the most useful sentence on the page for a
 * buyer about to waste a Saturday on the wrong micro-market.
 */
export const SECTOR_PUBLIC_SELECT = {
  city: true,
  sector: true,
  micro_market: true,
  sector_overview: true,
  sector_stage: true,
  dominant_segment: true,
  avg_price_per_sqft: true,
  price_5yr_cagr_pct: true,
  rental_yield_pct: true,
  avg_rent_3bhk_monthly: true,
  lifestyle_tags: true,
  sector_strengths: true,
  sector_weaknesses: true,
  who_should_buy: true,
  who_should_avoid: true,
  commute_anchors: true,
  utilities_profile: true,
  statutory_rates: true,
  infrastructure_pipeline: true,
  aqi_annual_avg: true,
  aqi_winter_peak: true,
  aqi_monsoon_low: true,
  monitoring_station_name: true,
  flood_waterlogging_risk: true,
  flood_zone_description: true,
  drainage_network_quality: true,
  airport_distance_km: true,
  nearest_metro_station: true,
  metro_distance_km: true,
  expressway_proximity_km: true,
  // The date, not the person. A buyer is entitled to know how fresh a figure
  // is; who on our side signed it off is an internal audit trail.
  last_verified_at: true,
} as const

/**
 * Columns that exist and must never reach a buyer, with the reason.
 *
 * Present so the test can assert that every column in the model is either
 * published or deliberately withheld — a column in neither list is an
 * unreviewed disclosure decision, which is the failure this file prevents.
 */
export const SECTOR_INTERNAL_ONLY: Record<string, string> = {
  id: 'Primary key. Never a buyer-facing fact.',
  verified_by: 'Names the analyst who signed the row off. Internal audit trail.',
  created_at: 'Row bookkeeping. `last_verified_at` is the date a buyer cares about.',
  updated_at: 'Row bookkeeping — changes when we fix a typo, which says nothing about the sector.',
}

/** Every column on the model, as `sectorExposure.test.ts` reads it from schema.prisma. */
export function isClassified(column: string): boolean {
  return column in SECTOR_PUBLIC_SELECT || column in SECTOR_INTERNAL_ONLY
}

/**
 * "Sector 150" + "Noida" -> "sector-150-noida".
 *
 * One function, used by the route, the sitemap and the frontend link builder,
 * so a slug cannot be generated one way and parsed another.
 */
export function sectorSlug(sector: string, city: string): string {
  return `${sector}-${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
