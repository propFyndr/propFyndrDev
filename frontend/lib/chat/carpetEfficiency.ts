export interface CarpetEfficiencyMetrics {
  superAreaSqft: number
  carpetAreaSqft: number
  commonAreaSqft: number
  loadingPercentage: number
  carpetEfficiencyPercentage: number
  advertisedRatePerSqft: number
  effectiveCarpetRatePerSqft: number
  eciScore: number
  eciRating: 'Low Wait' | 'Standard' | 'High Congestion'
}

/**
 * Calculates RERA loading ratio, usable area efficiency, effective carpet rate,
 * and Elevator Congestion Index (ECI).
 */
export function computeCarpetEfficiency(
  superAreaSqft: number,
  carpetAreaSqft: number,
  totalPriceCr = 0,
  options?: { totalFlats?: number; totalLifts?: number; advertisedRatePerSqft?: number }
): CarpetEfficiencyMetrics {
  const superArea = Math.max(1, superAreaSqft)
  const carpetArea = Math.min(superArea, Math.max(1, carpetAreaSqft))
  const commonAreaSqft = Math.max(0, superArea - carpetArea)
  const loadingPercentage = Number(((commonAreaSqft / superArea) * 100).toFixed(1))
  const carpetEfficiencyPercentage = Number(((carpetArea / superArea) * 100).toFixed(1))

  let advertisedRatePerSqft = options?.advertisedRatePerSqft || 0
  if (!advertisedRatePerSqft && totalPriceCr > 0) {
    advertisedRatePerSqft = Math.round((totalPriceCr * 1e7) / superArea)
  }
  const effectiveCarpetRatePerSqft = advertisedRatePerSqft > 0
    ? Math.round(advertisedRatePerSqft * (superArea / carpetArea))
    : 0

  const totalFlats = options?.totalFlats ?? 0
  const totalLifts = options?.totalLifts ?? 0
  const eciScore = totalLifts > 0 ? Number((totalFlats / totalLifts).toFixed(1)) : 0

  let eciRating: 'Low Wait' | 'Standard' | 'High Congestion' = 'Standard'
  if (eciScore > 0) {
    if (eciScore <= 35) eciRating = 'Low Wait'
    else if (eciScore > 50) eciRating = 'High Congestion'
  }

  return {
    superAreaSqft: superArea,
    carpetAreaSqft: carpetArea,
    commonAreaSqft,
    loadingPercentage,
    carpetEfficiencyPercentage,
    advertisedRatePerSqft,
    effectiveCarpetRatePerSqft,
    eciScore,
    eciRating,
  }
}
