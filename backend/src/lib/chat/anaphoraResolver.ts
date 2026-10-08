// backend/src/lib/chat/anaphoraResolver.ts

export interface AnaphoraResolution {
  isDemonstrativeComparison: boolean
  targetCount: number
  projectIds: string[]
  metricsRequested: ('price' | 'builder' | 'location')[]
}

const DEMONSTRATIVE_COMPARE_REGEX = /\b(?:compare|show|details?\s+for|break\s+down)\s+(?:these|those|the)\s+(\d+)?\s*(?:projects?|properties?|options?|ones?)?\b/i
const BARE_COMPARE_THESE_REGEX = /\bcompare\s+these\s+(\d+)?\b/i
const SHORTLIST_COUNT_REGEX = /\b(?:which|show)\s+(\d+)\s+(?:would\s+you\s+shortlist|top\s+options|best\s+options)\b/i

/**
 * Parses user text for demonstrative references ("compare these 3")
 * and extracts project IDs from the recent turn context.
 */
export function resolveDemonstrativeAnaphora(
  text: string,
  recentProjectIds: string[] = [],
  recentProjectNames: string[] = [],
): AnaphoraResolution | null {
  const matchCompare = text.match(DEMONSTRATIVE_COMPARE_REGEX) || text.match(BARE_COMPARE_THESE_REGEX)
  if (!matchCompare) return null

  const parsedCount = matchCompare[1] ? parseInt(matchCompare[1], 10) : 3
  const targetCount = isNaN(parsedCount) || parsedCount <= 0 ? 3 : parsedCount

  const metricsRequested: ('price' | 'builder' | 'location')[] = []
  if (/\b(?:price|rate|cost|budget|cr|lakh|sqft)\b/i.test(text)) metricsRequested.push('price')
  if (/\b(?:builder|developer|promoter|track\s+record|delivery)\b/i.test(text)) metricsRequested.push('builder')
  if (/\b(?:location|sector|connectivity|metro|distance|address)\b/i.test(text)) metricsRequested.push('location')

  const projectIds = recentProjectIds.slice(0, targetCount)

  return {
    isDemonstrativeComparison: true,
    targetCount,
    projectIds,
    metricsRequested: metricsRequested.length > 0 ? metricsRequested : ['price', 'builder', 'location'],
  }
}

/**
 * Detects explicit count constraint in user query ("which 3 would you shortlist?")
 */
export function extractRequestedShortlistCount(text: string): number | null {
  const match = text.match(SHORTLIST_COUNT_REGEX)
  if (!match) return null
  const num = parseInt(match[1], 10)
  return isNaN(num) || num <= 0 ? null : num
}
