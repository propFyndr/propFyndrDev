import { prisma } from '../db'

export interface TaxRateResult {
  ratePct: number
  sourceUrl?: string
}

interface CacheEntry {
  rates: Array<{
    kind: string
    rate_pct: number
    condition: any
    effective_from: Date
    source_url: string
  }>
  timestamp: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const taxCache = new Map<string, CacheEntry>()

// Fallback constants for UP in case DB is unreachable
const UP_FALLBACK_RATES = [
  { kind: 'stamp_duty', rate_pct: 7.0, condition: { gender: 'male' }, effective_from: new Date('2024-01-01'), source_url: 'https://igrsup.gov.in' },
  { kind: 'stamp_duty', rate_pct: 6.0, condition: { gender: 'female' }, effective_from: new Date('2024-01-01'), source_url: 'https://igrsup.gov.in' },
  { kind: 'stamp_duty', rate_pct: 6.5, condition: { gender: 'joint' }, effective_from: new Date('2024-01-01'), source_url: 'https://igrsup.gov.in' },
  { kind: 'registration', rate_pct: 1.0, condition: null, effective_from: new Date('2024-01-01'), source_url: 'https://igrsup.gov.in' },
  { kind: 'gst', rate_pct: 5.0, condition: { category: 'standard', status: 'under_construction' }, effective_from: new Date('2024-01-01'), source_url: 'https://cbic.gov.in' },
  { kind: 'gst', rate_pct: 1.0, condition: { category: 'affordable_housing', status: 'under_construction' }, effective_from: new Date('2024-01-01'), source_url: 'https://cbic.gov.in' },
  { kind: 'gst', rate_pct: 0.0, condition: { status: 'ready_to_move' }, effective_from: new Date('2024-01-01'), source_url: 'https://cbic.gov.in' },
]

export async function loadStatutoryRatesForState(stateCode: string = 'UP') {
  const code = stateCode.toUpperCase().trim()
  const now = Date.now()
  const cached = taxCache.get(code)

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.rates
  }

  try {
    const dbRates = await prisma.statutoryRate.findMany({
      where: {
        state_code: code,
        status: 'PUBLISHED',
      },
      orderBy: { effective_from: 'desc' },
    })

    if (dbRates.length > 0) {
      const parsed = dbRates.map((r) => ({
        kind: r.kind,
        rate_pct: r.rate_pct,
        condition: r.condition,
        effective_from: r.effective_from,
        source_url: r.source_url,
      }))
      taxCache.set(code, { rates: parsed, timestamp: now })
      return parsed
    }
  } catch (err) {
    console.warn(`[TaxEngine] DB rate lookup failed for state ${code}, using fallback:`, (err as Error).message)
  }

  // Fallback to UP default baseline if state is UP or unknown
  taxCache.set(code, { rates: UP_FALLBACK_RATES, timestamp: now })
  return UP_FALLBACK_RATES
}

export function clearTaxEngineCache() {
  taxCache.clear()
}

// ponytail: sync getters can't await the DB read, so a cache miss triggers a
// fire-and-forget warm-up — this call still returns the fallback rate, later
// calls get the DB-backed one once it lands.
function warmCacheIfMissing(code: string) {
  if (!taxCache.has(code)) {
    loadStatutoryRatesForState(code).catch(() => {})
  }
}

/**
 * Synchronous cached rate lookup for stamp duty
 */
export function getSyncStampDutyRate(
  gender: 'male' | 'female' | 'joint' = 'male',
  stateCode: string = 'UP'
): number {
  const code = stateCode.toUpperCase().trim()
  const cached = taxCache.get(code)
  warmCacheIfMissing(code)
  const rates = cached ? cached.rates : UP_FALLBACK_RATES

  const match = rates.find((r) => r.kind === 'stamp_duty' && r.condition?.gender === gender)
  if (match) return match.rate_pct
  return gender === 'female' ? 6 : 7
}

/**
 * Synchronous cached rate lookup for GST
 */
export function getSyncGstRate(
  status: 'under_construction' | 'ready_to_move',
  isAffordable: boolean = false,
  stateCode: string = 'UP'
): number {
  if (status === 'ready_to_move') return 0
  const code = stateCode.toUpperCase().trim()
  const cached = taxCache.get(code)
  warmCacheIfMissing(code)
  const rates = cached ? cached.rates : UP_FALLBACK_RATES

  const targetCategory = isAffordable ? 'affordable_housing' : 'standard'
  const match = rates.find(
    (r) => r.kind === 'gst' && r.condition?.category === targetCategory
  )
  if (match) return match.rate_pct
  return isAffordable ? 1 : 5
}
