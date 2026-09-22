/**
 * Map sectors to their canonical cities, authorities, and administrative regions.
 * Ensures strict, unambiguous geographical separation across:
 * 1. NOIDA (NOIDA Authority - Sectors 1 to 168)
 * 2. GREATER NOIDA WEST / NOIDA EXTENSION (GNIDA Authority - Sectors 1, 2, 3, 4, 10, 12, 16, 16B, 16C, Techzone 4, KP 5)
 * 3. GREATER NOIDA CORE (GNIDA Authority - Alpha, Beta, Gamma, Delta, Chi, Pi, Zeta, Eta, Omicron, Pari Chowk, Jaypee Greens, etc.)
 * 4. YAMUNA EXPRESSWAY (YEIDA Authority - Sectors 17A to 29, Jewar Airport zone)
 */

export type CityRegion = 'noida' | 'greater_noida' | 'greater_noida_west' | 'yamuna_expressway'
export type CivicAuthority = 'NOIDA' | 'GNIDA' | 'YEIDA'

export interface SectorLocation {
  sector: string
  city: string        // e.g. "Noida", "Greater Noida", "Greater Noida West", "Yamuna Expressway"
  region: CityRegion  // canonical internal key
  authority: CivicAuthority
  subCorridor?: string // e.g. "Expressway", "Central Noida", "Greater Noida West", "YEIDA"
}

// ── Complete Master Sector Mapping ──────────────────────────────────────────
const SECTOR_CITY_MAP: Record<string, SectorLocation> = {
  // ─── 1. NOIDA (NOIDA Authority) ──────────────────────────────────────────
  // Noida Expressway Corridor
  'Sector 124': { sector: 'Sector 124', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 125': { sector: 'Sector 125', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 126': { sector: 'Sector 126', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 127': { sector: 'Sector 127', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 128': { sector: 'Sector 128', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 129': { sector: 'Sector 129', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 130': { sector: 'Sector 130', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 131': { sector: 'Sector 131', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 132': { sector: 'Sector 132', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 133': { sector: 'Sector 133', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 134': { sector: 'Sector 134', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 135': { sector: 'Sector 135', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 136': { sector: 'Sector 136', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 137': { sector: 'Sector 137', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 138': { sector: 'Sector 138', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 140': { sector: 'Sector 140', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 140A': { sector: 'Sector 140A', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 141': { sector: 'Sector 141', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 142': { sector: 'Sector 142', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 143': { sector: 'Sector 143', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 143B': { sector: 'Sector 143B', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 144': { sector: 'Sector 144', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 145': { sector: 'Sector 145', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 146': { sector: 'Sector 146', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 147': { sector: 'Sector 147', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 148': { sector: 'Sector 148', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 149': { sector: 'Sector 149', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  // Sector 150: Strictly Noida Authority (Southernmost Noida Expressway sector)
  'Sector 150': { sector: 'Sector 150', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 151': { sector: 'Sector 151', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 152': { sector: 'Sector 152', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 153': { sector: 'Sector 153', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 154': { sector: 'Sector 154', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 158': { sector: 'Sector 158', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 168': { sector: 'Sector 168', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },

  // Central Noida Corridor (7X & 11X/12X)
  'Sector 70': { sector: 'Sector 70', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 71': { sector: 'Sector 71', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 72': { sector: 'Sector 72', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 73': { sector: 'Sector 73', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 74': { sector: 'Sector 74', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 75': { sector: 'Sector 75', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 76': { sector: 'Sector 76', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 77': { sector: 'Sector 77', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 78': { sector: 'Sector 78', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 79': { sector: 'Sector 79', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 115': { sector: 'Sector 115', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 116': { sector: 'Sector 116', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 117': { sector: 'Sector 117', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 118': { sector: 'Sector 118', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 119': { sector: 'Sector 119', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 120': { sector: 'Sector 120', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 121': { sector: 'Sector 121', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 122': { sector: 'Sector 122', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },

  // Golf Course & South Noida Corridor
  'Sector 43': { sector: 'Sector 43', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Golf Course' },
  'Sector 44': { sector: 'Sector 44', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Golf Course' },
  'Sector 45': { sector: 'Sector 45', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Golf Course' },
  'Sector 46': { sector: 'Sector 46', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Golf Course' },
  'Sector 50': { sector: 'Sector 50', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 51': { sector: 'Sector 51', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 52': { sector: 'Sector 52', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 61': { sector: 'Sector 61', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 62': { sector: 'Sector 62', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Institutional' },
  'Sector 82': { sector: 'Sector 82', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway Link' },
  'Sector 93': { sector: 'Sector 93', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway Link' },
  'Sector 93A': { sector: 'Sector 93A', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway Link' },
  'Sector 93B': { sector: 'Sector 93B', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway Link' },
  'Sector 94': { sector: 'Sector 94', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 96': { sector: 'Sector 96', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 97': { sector: 'Sector 97', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 98': { sector: 'Sector 98', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway' },
  'Sector 100': { sector: 'Sector 100', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Central Noida' },
  'Sector 104': { sector: 'Sector 104', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway Link' },
  'Sector 105': { sector: 'Sector 105', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway Link' },
  'Sector 107': { sector: 'Sector 107', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway Link' },
  'Sector 108': { sector: 'Sector 108', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway Link' },
  'Sector 110': { sector: 'Sector 110', city: 'Noida', region: 'noida', authority: 'NOIDA', subCorridor: 'Expressway Link' },

  // ─── 2. GREATER NOIDA WEST / NOIDA EXTENSION (GNIDA Authority) ───────────
  'Sector 1': { sector: 'Sector 1', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Sector 2': { sector: 'Sector 2', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Sector 3': { sector: 'Sector 3', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Sector 4': { sector: 'Sector 4', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Sector 10': { sector: 'Sector 10', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Sector 12': { sector: 'Sector 12', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Sector 16': { sector: 'Sector 16', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Sector 16B': { sector: 'Sector 16B', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Sector 16C': { sector: 'Sector 16C', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Techzone 4': { sector: 'Techzone 4', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'Knowledge Park V': { sector: 'Knowledge Park V', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },
  'EcoTech 12': { sector: 'EcoTech 12', city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' },

  // ─── 3. GREATER NOIDA CORE (GNIDA Authority) ─────────────────────────────
  'Alpha 1': { sector: 'Alpha 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Alpha 2': { sector: 'Alpha 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Beta 1': { sector: 'Beta 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Beta 2': { sector: 'Beta 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Gamma 1': { sector: 'Gamma 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Gamma 2': { sector: 'Gamma 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Delta 1': { sector: 'Delta 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Delta 2': { sector: 'Delta 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Delta 3': { sector: 'Delta 3', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Chi 1': { sector: 'Chi 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Chi 2': { sector: 'Chi 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Chi 3': { sector: 'Chi 3', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Chi 4': { sector: 'Chi 4', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Chi 5': { sector: 'Chi 5', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Phi 1': { sector: 'Phi 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Phi 2': { sector: 'Phi 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Phi 3': { sector: 'Phi 3', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Phi 4': { sector: 'Phi 4', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Pi 1': { sector: 'Pi 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Pi 2': { sector: 'Pi 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Omicron 1': { sector: 'Omicron 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Omicron 1A': { sector: 'Omicron 1A', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Omicron 2': { sector: 'Omicron 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Omicron 3': { sector: 'Omicron 3', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Zeta 1': { sector: 'Zeta 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Zeta 2': { sector: 'Zeta 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Eta 1': { sector: 'Eta 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Eta 2': { sector: 'Eta 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Theta': { sector: 'Theta', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Mu 1': { sector: 'Mu 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Mu 2': { sector: 'Mu 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Sigma 1': { sector: 'Sigma 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Sigma 2': { sector: 'Sigma 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Sigma 3': { sector: 'Sigma 3', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Sigma 4': { sector: 'Sigma 4', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Xu 1': { sector: 'Xu 1', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Xu 2': { sector: 'Xu 2', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Xu 3': { sector: 'Xu 3', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Swarn Nagari': { sector: 'Swarn Nagari', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Pari Chowk': { sector: 'Pari Chowk', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida Landmark' },
  'Jaypee Greens': { sector: 'Jaypee Greens', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida Township' },
  'Knowledge Park I': { sector: 'Knowledge Park I', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Knowledge Park II': { sector: 'Knowledge Park II', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Knowledge Park III': { sector: 'Knowledge Park III', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Knowledge Park IV': { sector: 'Knowledge Park IV', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Surajpur': { sector: 'Surajpur', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Sector 27': { sector: 'Sector 27', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Sector 31': { sector: 'Sector 31', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Sector 36': { sector: 'Sector 36', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },
  'Sector 37': { sector: 'Sector 37', city: 'Greater Noida', region: 'greater_noida', authority: 'GNIDA', subCorridor: 'Core Greater Noida' },

  // ─── 4. YAMUNA EXPRESSWAY (YEIDA Authority) ──────────────────────────────
  'Sector 17A': { sector: 'Sector 17A', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA' },
  'Sector 18': { sector: 'Sector 18', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA' },
  'Sector 19': { sector: 'Sector 19', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA' },
  'Sector 20': { sector: 'Sector 20', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA' },
  'Sector 21': { sector: 'Sector 21', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA Film City' },
  'Sector 22D': { sector: 'Sector 22D', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA' },
  'Sector 22E': { sector: 'Sector 22E', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA' },
  'Sector 24': { sector: 'Sector 24', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA' },
  'Sector 25': { sector: 'Sector 25', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA F1 Circuit' },
  'Sector 26': { sector: 'Sector 26', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA' },
  'Sector 28': { sector: 'Sector 28', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA Medical Device Park' },
  'Sector 29': { sector: 'Sector 29', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA Apparel Park' },
  'Yamuna Expressway': { sector: 'Yamuna Expressway', city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA Corridor' },
}

// Aliases for Roman numerals (e.g. "Alpha 2" vs "Alpha II", "Chi 5" vs "Chi V")
const ROMAN_ALIASES: Record<string, string> = {
  'alpha i': 'Alpha 1', 'alpha ii': 'Alpha 2',
  'beta i': 'Beta 1', 'beta ii': 'Beta 2',
  'gamma i': 'Gamma 1', 'gamma ii': 'Gamma 2',
  'delta i': 'Delta 1', 'delta ii': 'Delta 2', 'delta iii': 'Delta 3',
  'chi i': 'Chi 1', 'chi ii': 'Chi 2', 'chi iii': 'Chi 3', 'chi iv': 'Chi 4', 'chi v': 'Chi 5',
  'phi i': 'Phi 1', 'phi ii': 'Phi 2', 'phi iii': 'Phi 3', 'phi iv': 'Phi 4',
  'pi i': 'Pi 1', 'pi ii': 'Pi 2',
  'omicron i': 'Omicron 1', 'omicron ia': 'Omicron 1A', 'omicron ii': 'Omicron 2', 'omicron iii': 'Omicron 3',
  'zeta i': 'Zeta 1', 'zeta ii': 'Zeta 2',
  'eta i': 'Eta 1', 'eta ii': 'Eta 2',
  'mu i': 'Mu 1', 'mu ii': 'Mu 2',
  'sigma i': 'Sigma 1', 'sigma ii': 'Sigma 2', 'sigma iii': 'Sigma 3', 'sigma iv': 'Sigma 4',
  'xu i': 'Xu 1', 'xu ii': 'Xu 2', 'xu iii': 'Xu 3',
  'kp 1': 'Knowledge Park I', 'kp 2': 'Knowledge Park II', 'kp 3': 'Knowledge Park III', 'kp 4': 'Knowledge Park IV', 'kp 5': 'Knowledge Park V',
  'knowledge park 1': 'Knowledge Park I', 'knowledge park 2': 'Knowledge Park II', 'knowledge park 3': 'Knowledge Park III', 'knowledge park 4': 'Knowledge Park IV', 'knowledge park 5': 'Knowledge Park V',
}

/**
 * Normalizes raw input sector strings.
 * Handles "Sector Alpha 2" -> "Alpha 2", "Sector 150, Noida" -> "Sector 150", etc.
 */
export function normalizeSectorLookupKey(raw: string): string {
  let s = raw.trim()
    .replace(/,\s*(greater noida west|greater noida|noida extension|yamuna expressway|noida|up|uttar pradesh)$/i, '')
    .replace(/\s+(greater noida west|greater noida|noida extension|yamuna expressway|noida|up|uttar pradesh)$/i, '')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim()

  const lower = s.toLowerCase()
  if (ROMAN_ALIASES[lower]) {
    return ROMAN_ALIASES[lower]
  }

  // Remove redundant "Sector " prefix if it is followed by Greek name or special landmark
  const greekMatch = s.match(/^Sector\s+(Alpha|Beta|Gamma|Delta|Chi|Phi|Pi|Omicron|Zeta|Eta|Theta|Mu|Sigma|Xu|Techzone|Pari Chowk|Jaypee Greens)\b(.*)$/i)
  if (greekMatch) {
    const candidate = `${greekMatch[1]} ${greekMatch[2]}`.trim()
    const candLower = candidate.toLowerCase()
    if (ROMAN_ALIASES[candLower]) return ROMAN_ALIASES[candLower]
    return candidate
  }

  return s
}

/**
 * Resolves a sector to its canonical SectorLocation.
 */
export function getSectorLocation(sectorName: string | null | undefined): SectorLocation | null {
  if (!sectorName) return null
  const key = normalizeSectorLookupKey(sectorName)
  
  if (SECTOR_CITY_MAP[key]) {
    return SECTOR_CITY_MAP[key]
  }

  // Fallback pattern: Any numbered sector not explicitly in GNW or YEIDA is Noida
  const numMatch = key.match(/^Sector\s+(\d+)([a-z]?)$/i)
  if (numMatch) {
    const num = parseInt(numMatch[1], 10)
    // Greater Noida West numbered sectors: 1, 2, 3, 4, 10, 12, 16, 16B, 16C
    const gnwNumbers = [1, 2, 3, 4, 10, 12, 16]
    const isExplicitGnw = gnwNumbers.includes(num) && /greater noida west|noida extension|greno west/i.test(sectorName)
    const isExplicitYeida = (num === 22 || num === 17 || num === 18 || num === 19 || num === 20 || num === 21 || num === 24 || num === 25) && /yamuna expressway|yeida/i.test(sectorName)

    if (isExplicitGnw) {
      const suffix = numMatch[2] ? numMatch[2].toUpperCase() : ''
      return { sector: `Sector ${num}${suffix}`, city: 'Greater Noida West', region: 'greater_noida_west', authority: 'GNIDA', subCorridor: 'Noida Extension' }
    }
    if (isExplicitYeida) {
      return { sector: `Sector ${num}`, city: 'Yamuna Expressway', region: 'yamuna_expressway', authority: 'YEIDA', subCorridor: 'YEIDA' }
    }

    // Default: Sector 1 to 168 belongs to NOIDA (NOIDA Authority)
    // Note: Sector 150 strictly maps here!
    return {
      sector: key,
      city: 'Noida',
      region: 'noida',
      authority: 'NOIDA',
      subCorridor: num >= 124 && num <= 168 ? 'Expressway' : (num >= 70 && num <= 122 ? 'Central Noida' : 'Established Noida')
    }
  }

  return null
}

/**
 * Returns whether a sector is valid for a given target city/region.
 * CRITICAL RULE: Sector 150 is NEVER valid for Greater Noida or Greater Noida West!
 */
export function isSectorInCity(sectorName: string | null | undefined, targetCity: string | null | undefined): boolean {
  if (!sectorName || !targetCity) return true
  const loc = getSectorLocation(sectorName)
  if (!loc) return true // Unknown sector, pass through

  const tc = targetCity.toLowerCase().trim()
  const locCity = loc.city.toLowerCase()

  if (tc === 'noida extension' || tc === 'greater noida west' || tc === 'greno west') {
    return loc.region === 'greater_noida_west'
  }
  if (tc === 'greater noida' || tc === 'greno') {
    return loc.region === 'greater_noida' || loc.region === 'greater_noida_west'
  }
  if (tc === 'noida') {
    return loc.region === 'noida'
  }
  if (tc === 'yamuna expressway' || tc === 'yeida') {
    return loc.region === 'yamuna_expressway'
  }

  return locCity.includes(tc) || tc.includes(locCity)
}

/**
 * Qualified display string: "Sector 150, Noida" or "Sector 1, Greater Noida West"
 */
export function getQualifiedSector(sectorName: string | null | undefined): string | null {
  const loc = getSectorLocation(sectorName)
  return loc ? `${loc.sector}, ${loc.city}` : null
}

/**
 * Internal region key: 'noida' | 'greater_noida' | 'greater_noida_west' | 'yamuna_expressway'
 */
export function getSectorRegion(sectorName: string | null | undefined): CityRegion | null {
  const loc = getSectorLocation(sectorName)
  return loc?.region || null
}

/**
 * Extracts base sector from qualified string: "Sector 10, Greater Noida West" -> "Sector 10"
 */
export function extractSectorFromQualified(qualified: string | null | undefined): string | null {
  if (!qualified) return null
  const match = qualified.match(/^([^,]+)/)
  return match ? match[1].trim() : null
}

/**
 * Returns all canonical sectors registered for a specific city.
 */
export function listSectorsForCity(city: 'Noida' | 'Greater Noida' | 'Greater Noida West' | 'Yamuna Expressway'): SectorLocation[] {
  const cLower = city.toLowerCase()
  return Object.values(SECTOR_CITY_MAP).filter(loc => loc.city.toLowerCase() === cLower)
}
