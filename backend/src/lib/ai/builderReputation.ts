/**
 * Builder Reputation Engine
 * Searches web for builder news, RERA violations, delivery track record, and buyer sentiment.
 * Uses Tavily (primary) + Serper (fallback) — no new API keys needed.
 */
import { tavilySearch } from '../web'

export interface ReputationSignal {
  type: 'positive' | 'negative' | 'neutral'
  category: 'delivery' | 'legal' | 'quality' | 'financial' | 'awards' | 'news'
  title: string
  source?: string
  snippet: string
}

export interface BuilderReputationReport {
  builder_name: string
  summary: string
  score: number          // 0–100, higher = better
  score_label: string    // "Excellent" | "Good" | "Average" | "Poor" | "Unknown"
  signals: ReputationSignal[]
  rera_status: string    // "Registered" | "Violations found" | "Unknown"
  delivery_track: string
  last_checked: string   // ISO date
}

const SEARCH_QUERIES = (name: string) => [
  `"${name}" builder RERA complaints delay India`,
  `"${name}" builder reviews delivery track record`,
  `"${name}" builder news 2024 2025`,
]

function scoreFromSignals(signals: ReputationSignal[]): number {
  let score = 60 // neutral baseline
  for (const s of signals) {
    if (s.type === 'positive') score += s.category === 'delivery' ? 8 : 5
    if (s.type === 'negative') score -= s.category === 'legal' ? 12 : s.category === 'delivery' ? 10 : 6
  }
  return Math.min(100, Math.max(0, score))
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Good'
  if (score >= 45) return 'Average'
  if (score >= 25) return 'Poor'
  return 'Unknown'
}

function extractSignals(
  results: Array<{ title: string; url: string; content: string }>,
): ReputationSignal[] {
  const signals: ReputationSignal[] = []

  const positiveKeywords = [
    'awarded', 'award', 'recognized', 'on time', 'delivered on', 'completed',
    'credai', 'quality', 'trusted', 'excellent', 'certified',
  ]
  const negativeKeywords = [
    'delay', 'complaint', 'fraud', 'cheating', 'rera violation', 'penalty',
    'stalled', 'slow', 'stuck', 'money stuck', 'scam', 'defaulter', 'fir',
    'legal notice', 'consumer court', 'ngt',
  ]
  const deliveryKeywords = ['possession', 'handover', 'deliver', 'completed project', 'ready']
  const legalKeywords = ['rera', 'court', 'legal', 'penalty', 'notice', 'fir', 'consumer forum']
  const awardKeywords = ['award', 'recognized', 'credai', 'certified']

  for (const r of results.slice(0, 6)) {
    const text = (r.title + ' ' + r.content).toLowerCase()

    const isPositive = positiveKeywords.some((k) => text.includes(k))
    const isNegative = negativeKeywords.some((k) => text.includes(k))
    if (!isPositive && !isNegative) continue

    let category: ReputationSignal['category'] = 'news'
    if (deliveryKeywords.some((k) => text.includes(k))) category = 'delivery'
    else if (legalKeywords.some((k) => text.includes(k))) category = 'legal'
    else if (awardKeywords.some((k) => text.includes(k))) category = 'awards'

    signals.push({
      type: isNegative ? 'negative' : 'positive',
      category,
      title: r.title.slice(0, 120),
      source: r.url,
      snippet: r.content.slice(0, 200),
    })
  }

  return signals
}

function extractReraStatus(results: Array<{ content: string }>): string {
  const combined = results.map((r) => r.content.toLowerCase()).join(' ')
  if (combined.includes('rera violation') || combined.includes('rera penalty') || combined.includes('rera complaint')) {
    return 'Violations found'
  }
  if (combined.includes('rera registered') || combined.includes('rera no.') || combined.includes('rera number')) {
    return 'Registered'
  }
  return 'Unknown'
}

function extractDeliveryTrack(results: Array<{ content: string }>): string {
  const combined = results.map((r) => r.content.toLowerCase()).join(' ')
  const hasDelay = combined.includes('delay') || combined.includes('stalled') || combined.includes('stuck')
  const hasOnTime = combined.includes('on time') || combined.includes('delivered on') || combined.includes('completed on')
  if (hasDelay && !hasOnTime) return 'Delays reported'
  if (hasOnTime && !hasDelay) return 'Generally on time'
  if (hasDelay && hasOnTime) return 'Mixed record'
  return 'Insufficient data'
}

export async function getBuilderReputation(
  builderName: string,
): Promise<BuilderReputationReport> {
  const queries = SEARCH_QUERIES(builderName)

  const settled = await Promise.all(
    queries.map((q) =>
      tavilySearch(q, 3).then(({ results }) => results).catch(() => [] as Array<{ title: string; url: string; content: string }>),
    ),
  )
  const allResults = settled.flat()

  const signals = extractSignals(allResults)
  const score = allResults.length === 0 ? 50 : scoreFromSignals(signals)
  const reraStatus = extractReraStatus(allResults)
  const deliveryTrack = extractDeliveryTrack(allResults)

  const positiveCount = signals.filter((s) => s.type === 'positive').length
  const negativeCount = signals.filter((s) => s.type === 'negative').length

  let summary: string
  if (allResults.length === 0) {
    summary = `No recent public information found for ${builderName}. Verify independently via UP-RERA portal.`
  } else if (negativeCount > positiveCount) {
    summary = `${builderName} has some concerning signals online — delivery delays or legal issues reported. Review independently.`
  } else if (positiveCount > negativeCount) {
    summary = `${builderName} has a generally positive online presence. No major complaints found in recent search.`
  } else {
    summary = `Mixed signals found for ${builderName}. Some positives and some concerns. Verify via RERA portal before committing.`
  }

  return {
    builder_name: builderName,
    summary,
    score,
    score_label: scoreLabel(score),
    signals: signals.slice(0, 8),
    rera_status: reraStatus,
    delivery_track: deliveryTrack,
    last_checked: new Date().toISOString(),
  }
}
