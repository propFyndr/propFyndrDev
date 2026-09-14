// backend/src/lib/discovery/constants.ts

export const SCORE_THRESHOLD = 20
export const BUILDER_ONLY_THRESHOLD = 0
export const MAX_RESULTS = 6
export const SECTORS_OVERVIEW_MAX = 6

// Budget tolerance thresholds.
// price_min_cr > budgetMax * BUDGET_TOLERANCE_MAX → excluded at DB level.
// price_min_cr > budgetMax AND <= budgetMax * BUDGET_TOLERANCE_WARN → 'slightly_over'
// price_min_cr > budgetMax * BUDGET_TOLERANCE_WARN AND <= budgetMax * BUDGET_TOLERANCE_MAX → 'over'
export const BUDGET_TOLERANCE_WARN = 1.05
export const BUDGET_TOLERANCE_MAX  = 1.10

// Cap value-headroom contribution so projects dramatically below budget
// (e.g. ₹1.3Cr project for ₹4Cr buyer) cannot earn excessive ranking advantage.
// At 0.5: max headroom bonus is +8 pts instead of +15.
export const HEADROOM_CAP = 0.5

export const CITY_LEVEL_TERMS = [
  'noida',
  'greater noida',
  'greater noida west',
  'noida extension', // buyer-colloquial name for Greater Noida West — same place
  'gurgaon',
  'gurugram',
  'delhi',
  'mumbai',
  'bangalore',
  'hyderabad',
  'pune',
  'chennai',
]

// Canonical region a city-level term resolves to, for sector-text-based filtering.
// The DB `city` column is inconsistent (some Greater Noida West projects are
// mistagged city="Greater Noida"), so region matching is done against the
// `sector` string instead, which reliably carries "Greater Noida West" when true.
export const CITY_LEVEL_ALIASES: Record<string, 'noida' | 'greater_noida' | 'greater_noida_west'> = {
  'noida': 'noida',
  'greater noida': 'greater_noida',
  'greater noida west': 'greater_noida_west',
  'noida extension': 'greater_noida_west',
}

/**
 * The city the buyer actually named, if any.
 *
 * "Sector 107" is a real sector in BOTH Noida and Greater Noida West, so the
 * search asks which one was meant. That question is right when the buyer said
 * only "sector 107" — and wrong when they wrote "best properties in sector 107
 * NOIDA", which is what the corpus measured: 50 of 103 sector queries came back
 * as a clarifying question, and the commonest was asking a buyer to pick a city
 * they had already named.
 *
 * The city was never extracted at all, so "sector 107 noida" and "sector 107
 * greater noida west" reached the search as the same query.
 *
 * Longest match wins, which is the whole difficulty: every alias here contains
 * "noida" as a substring, so a naive scan reports three cities for a message
 * naming one. "greater noida west" is checked before "greater noida", and both
 * before "noida".
 */
const CITY_ALIAS_BY_LENGTH = Object.keys(CITY_LEVEL_ALIASES).sort((a, b) => b.length - a.length)

/** Canonical DB city names, keyed by the region an alias resolves to. */
const REGION_TO_CITY: Record<string, string> = {
  noida: 'Noida',
  greater_noida: 'Greater Noida',
  greater_noida_west: 'Greater Noida West',
}

export function cityNamedIn(message: string): string | undefined {
  const text = ` ${(message ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ')} `
  for (const alias of CITY_ALIAS_BY_LENGTH) {
    if (text.includes(` ${alias} `)) return REGION_TO_CITY[CITY_LEVEL_ALIASES[alias]]
  }
  return undefined
}

// Noida / Greater Noida sector adjacency map.
// Keys are canonical sector strings as stored in the DB.
// Values are ordered by geographic proximity (closest first).
// Used for nearby sector expansion when the requested sector returns zero results.
// TODO: Restructure to Record<city, Record<sector, string[]>> when scaling to city #2.
// Currently hardcoded to Noida/Greater Noida; extraction logic in discovery/index.ts assumes this shape.
export const SECTOR_ADJACENCY: Record<string, string[]> = {
  // Noida Expressway corridor (Sectors 128–158)
  'Sector 150': ['Sector 151', 'Sector 148', 'Sector 143', 'Sector 137'],
  'Sector 151': ['Sector 150', 'Sector 152', 'Sector 148', 'Sector 143'],
  'Sector 152': ['Sector 151', 'Sector 150', 'Sector 148'],
  'Sector 148': ['Sector 150', 'Sector 149', 'Sector 151', 'Sector 143'],
  'Sector 149': ['Sector 148', 'Sector 150', 'Sector 143'],
  'Sector 143': ['Sector 144', 'Sector 142', 'Sector 148', 'Sector 150', 'Sector 137'],
  'Sector 144': ['Sector 143', 'Sector 145', 'Sector 137'],
  'Sector 142': ['Sector 143', 'Sector 141', 'Sector 137'],
  'Sector 137': ['Sector 136', 'Sector 138', 'Sector 143', 'Sector 150'],
  'Sector 138': ['Sector 137', 'Sector 139', 'Sector 136'],
  'Sector 136': ['Sector 137', 'Sector 135', 'Sector 138'],
  'Sector 135': ['Sector 136', 'Sector 134', 'Sector 137'],
  'Sector 134': ['Sector 135', 'Sector 128', 'Sector 136'],
  'Sector 128': ['Sector 127', 'Sector 129', 'Sector 134', 'Sector 135'],
  'Sector 129': ['Sector 128', 'Sector 130', 'Sector 134'],

  // Central Noida (Sectors 75–100)
  'Sector 100': ['Sector 99', 'Sector 104', 'Sector 96', 'Sector 97'],
  'Sector 104': ['Sector 100', 'Sector 105', 'Sector 96', 'Sector 99'],
  'Sector 96':  ['Sector 97', 'Sector 100', 'Sector 104'],
  'Sector 97':  ['Sector 96', 'Sector 98', 'Sector 100'],
  'Sector 78':  ['Sector 79', 'Sector 76', 'Sector 77', 'Sector 82'],
  'Sector 79':  ['Sector 78', 'Sector 82', 'Sector 76'],
  'Sector 77':  ['Sector 76', 'Sector 78', 'Sector 75'],
  'Sector 76':  ['Sector 75', 'Sector 77', 'Sector 78', 'Sector 79'],
  'Sector 75':  ['Sector 76', 'Sector 74', 'Sector 77'],
  'Sector 82':  ['Sector 78', 'Sector 79', 'Sector 83'],

  // Older sectors (44–62)
  'Sector 45':  ['Sector 44', 'Sector 46', 'Sector 50', 'Sector 62'],
  'Sector 44':  ['Sector 45', 'Sector 43', 'Sector 50'],
  'Sector 46':  ['Sector 45', 'Sector 47', 'Sector 50'],
  'Sector 50':  ['Sector 49', 'Sector 51', 'Sector 44', 'Sector 45'],
  'Sector 62':  ['Sector 61', 'Sector 63', 'Sector 45', 'Sector 50'],
  'Sector 61':  ['Sector 62', 'Sector 60', 'Sector 63'],

  // Greater Noida sectors
  'Alpha I':    ['Alpha II', 'Omega I', 'Zeta I'],
  'Alpha II':   ['Alpha I', 'Beta I', 'Omega II'],
  'Beta I':     ['Alpha II', 'Beta II', 'Gamma I'],
  'Beta II':    ['Beta I', 'Gamma I', 'Gamma II'],
  'Gamma I':    ['Beta I', 'Gamma II', 'Omega II'],
  'Gamma II':   ['Gamma I', 'Delta I', 'Beta II'],
  'Delta I':    ['Gamma II', 'Delta II', 'Zeta I'],
  'Omega I':    ['Omega II', 'Alpha I', 'Zeta I'],
  'Omega II':   ['Omega I', 'Alpha II', 'Gamma I'],
  'Zeta I':     ['Zeta II', 'Alpha I', 'Delta I', 'Omega I'],
  'Zeta II':    ['Zeta I', 'Delta I'],

  // Greater Noida West / Noida Extension sectors
  'Sector 10':  ['Sector 12', 'Sector 1', 'Techzone 4', 'Sector 16C'],
  'Sector 1':   ['Sector 10', 'Sector 4', 'Techzone 4', 'Sector 12'],
  'Sector 12':  ['Sector 10', 'Sector 16C', 'Techzone 4'],
  'Techzone 4': ['Sector 1', 'Sector 4', 'Sector 10', 'Sector 12'],
  'Sector 16C': ['Sector 12', 'Sector 10', 'Techzone 4'],
}
