/**
 * Multi-Dimensional Intent & Ranking Integration Layer
 * Orchestrates Phases 1-4: Intent extraction → Scoring → Query → Ranking
 *
 * Call this single function instead of individual phase functions.
 * It handles the complete pipeline end-to-end.
 */

import { extractExtendedIntent, ExtendedIntent, mapExtendedIntentToLegacy } from '../ai/extendedIntent'
import { rankProject, rankProjects } from './scoringEngine'
import { queryAndScoreProjects, type RankedProject } from './multiDimQuery'
import { formatRankedResults, generateRecommendationSummary } from './rankingFormatter'
import type { Intent } from './types'
import type { FormattedRecommendation } from './rankingFormatter'

export interface MultiDimensionalResult {
  intent: ExtendedIntent
  legacyIntent: Intent // For backward compatibility with existing code
  recommendations: FormattedRecommendation[]
  topRecommendation: FormattedRecommendation | null
  summaryForChat: string // 1-2 line summary suitable for chat display
  dealBreakersDetected: boolean
  confidence: {
    intentConfidence: number // 0-100, avg confidence across dimensions
    rankingConfidence: number // 0-100, based on data freshness + match quality
    overallConfidence: number // Final combined confidence
  }
}

/**
 * Main integration function: One call to get complete multi-dimensional recommendations
 *
 * Usage:
 * const result = await getMultiDimensionalRecommendations(userMessage, conversationHistory, previousIntent)
 * const chatResponse = {
 *   message: result.summaryForChat,
 *   recommendations: result.recommendations,
 *   memory_context: result.intent,
 *   confidence: result.confidence
 * }
 */
export async function getMultiDimensionalRecommendations(
  userMessage: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  previousIntent?: ExtendedIntent,
  options?: {
    limit?: number // Default 3, max 10
    prioritizeInvestment?: boolean // Boost investment-focused recommendations
    prioritizeEndUse?: boolean // Boost end-use recommendations
  }
): Promise<MultiDimensionalResult> {
  console.log('[MULTI_DIM] Starting multi-dimensional pipeline', { messageLength: userMessage.length })

  // Phase 1: Extract extended intent (all 11 dimensions)
  const { intent: extendedIntent, degraded: intentDegraded } = await extractExtendedIntent({
    userMessage,
    previousIntent
  })

  console.log('[MULTI_DIM:PHASE1] Intent extraction complete', {
    degraded: intentDegraded,
    sector: extendedIntent.sectorPreference
  })

  // Calculate intent confidence (avg confidence across all extracted dimensions)
  const meta = extendedIntent._meta || {}
  const dimensionConfidences = [
    meta.budgetConfidence ?? 50,
    meta.locationConfidence ?? 50,
    meta.timelineConfidence ?? 50,
    meta.specsConfidence ?? 50,
    meta.builderConfidence ?? 50,
    meta.legalConfidence ?? 50,
    meta.amenitiesConfidence ?? 50,
    meta.pricingConfidence ?? 50,
    meta.personalConfidence ?? 50,
    meta.decisionConfidence ?? 50,
    meta.gapConfidence ?? 50
  ]
  const intentConfidence = Math.round(dimensionConfidences.reduce((a, b) => a + b, 0) / dimensionConfidences.length)

  // Phase 2 & 3 combined: Query projects + score on all 11 dimensions
  console.log('[MULTI_DIM:PHASE2-3] Starting query and scoring')
  const rankedProjects = await queryAndScoreProjects(extendedIntent, {
    limit: options?.limit ?? 10,
    offset: 0
  })

  if (rankedProjects.length === 0) {
    console.log('[MULTI_DIM] No projects match criteria')
    return {
      intent: extendedIntent,
      legacyIntent: mapExtendedIntentToLegacy(extendedIntent),
      recommendations: [],
      topRecommendation: null,
      summaryForChat: 'No projects match your criteria. Would you like to adjust your budget, location, or timeline?',
      dealBreakersDetected: false,
      confidence: {
        intentConfidence,
        rankingConfidence: 0,
        overallConfidence: 0
      }
    }
  }

  console.log('[MULTI_DIM:PHASE2-3] Query complete', { projectCount: rankedProjects.length })

  // Phase 4: Format results with human-readable explanations
  console.log('[MULTI_DIM:PHASE4] Starting ranking formatter')
  const legacyIntent = mapExtendedIntentToLegacy(extendedIntent)

  // Convert RankedProject[] to RankingResult[] format for formatRankedResults
  const rankingResults = rankedProjects.map(rp => {
    const dimensionScoresMap = rp.dimensionScores.reduce((acc, ds) => {
      const dimKey = ds.dimension as keyof typeof acc
      return { ...acc, [dimKey]: ds }
    }, {} as Record<string, any>)

    return {
      finalScore: rp.finalScore,
      dimensionScores: dimensionScoresMap,
      dealBreakers: rp.dimensionScores.filter((ds: any) => ds.dealBreaker === true),
      projectId: rp.projectId,
      projectName: rp.projectName
    }
  })

  const recommendations = formatRankedResults(
    rankingResults as any,
    rankedProjects.map(r => r.metadata) as any,
    legacyIntent,
    Math.min(options?.limit ?? 3, 10)
  )

  console.log('[MULTI_DIM:PHASE4] Formatting complete', { recommendationCount: recommendations.length })

  // Calculate ranking confidence based on:
  // - Data freshness (newer = higher confidence)
  // - Score spread (high spread = clearer winner = higher confidence)
  // - Deal-breaker presence (reduces confidence)
  const rankingConfidence = calculateRankingConfidence(rankedProjects, recommendations)

  const topRecommendation = recommendations[0] || null
  const dealBreakersDetected = recommendations.some(r => (r.dealBreakers?.length ?? 0) > 0)

  // Generate concise summary for chat display
  const summaryForChat = topRecommendation
    ? generateRecommendationSummary([topRecommendation])
    : 'No projects match your exact criteria. Try adjusting your budget or preferred location.'

  const result: MultiDimensionalResult = {
    intent: extendedIntent,
    legacyIntent: mapExtendedIntentToLegacy(extendedIntent),
    recommendations,
    topRecommendation,
    summaryForChat,
    dealBreakersDetected,
    confidence: {
      intentConfidence,
      rankingConfidence,
      overallConfidence: Math.round((intentConfidence + rankingConfidence) / 2)
    }
  }

  console.log('[MULTI_DIM] Complete', {
    recommendationCount: recommendations.length,
    confidenceScore: result.confidence.overallConfidence,
    dealBreakers: dealBreakersDetected
  })

  return result
}

/**
 * Calculate ranking confidence based on data quality signals
 */
function calculateRankingConfidence(
  rankedProjects: RankedProject[],
  recommendations: FormattedRecommendation[]
): number {
  if (recommendations.length === 0) return 0

  let score = 50 // Base score

  // Bonus: Clear winner (top score significantly higher than second)
  if (recommendations.length >= 2) {
    const scoreDiff = recommendations[0].finalScore - recommendations[1].finalScore
    if (scoreDiff >= 15) score += 20 // Clear winner
    else if (scoreDiff >= 8) score += 10 // Moderate separation
  } else if (recommendations.length === 1) {
    score += 10 // Single recommendation still gets small bonus
  }

  // Penalty: Deal-breakers present
  if (recommendations.some(r => (r.dealBreakers?.length ?? 0) > 0)) {
    score -= 15
  }

  // Penalty: Low score on all recommendations
  if (recommendations.every(r => r.finalScore < 70)) {
    score -= 20
  }

  // Bonus: High scores indicate good data
  if (recommendations.some(r => r.finalScore >= 85)) {
    score += 15
  }

  return Math.max(30, Math.min(100, score))
}

/**
 * Fallback for backward compatibility: Call the legacy discoverProjects-style pipeline
 * Returns traditional ScoredProject[] format
 */
export async function getLegacyStyleResults(
  extendedIntent: ExtendedIntent,
  limit?: number
) {
  const results = await queryAndScoreProjects(extendedIntent, { limit: limit ?? 10, offset: 0 })
  return results
}

/**
 * Export for direct access to any phase if needed
 */
export {
  extractExtendedIntent,
  queryAndScoreProjects,
  formatRankedResults,
  generateRecommendationSummary
}
