/**
 * Lead Objection Detection
 * Parse buyer concerns from chat without naming competitors
 * Categories: PRICE | POSSESSION | BUILDER_HISTORY | LOCATION | OTHER
 */

export type ObjectionType = 'PRICE' | 'POSSESSION' | 'BUILDER_HISTORY' | 'LOCATION' | 'OTHER'

export interface DetectedObjection {
  type: ObjectionType
  reason: string
  competitor_pressure: boolean
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

const pricePatterns = [
  /(\d+\s*(cr|lakh|rupees?).*(?:expensive|costly|high|above budget))/gi,
  /(price.*concern|budget|afford)/gi,
  /(too expensive|out of reach|can't pay)/gi,
]

const possessionPatterns = [
  /(\d+\s*(?:months?|years?|quarters?).*(?:possession|handover|delivery))/gi,
  /(possession.*(?:delay|late|slow|concern))/gi,
  /(when.*deliver|when.*possession|handover timeline)/gi,
]

const builderPatterns = [
  /(builder.*(?:track record|reputation|history|delay|quality))/gi,
  /(concern.*builder|builder.*concern)/gi,
  /(delayed projects?|late delivery|poor quality)/gi,
]

const locationPatterns = [
  /(location.*(?:concern|issue|problem|far|remote))/gi,
  /(metro.*(?:distance|far|close))/gi,
  /(connectivity|commute|traffic)/gi,
]

export function detectObjections(text: string): DetectedObjection[] {
  if (!text || text.length === 0) return []

  const objections: DetectedObjection[] = []

  // Price objections
  if (matchPatterns(text, pricePatterns)) {
    objections.push({
      type: 'PRICE',
      reason: 'Price or affordability concern',
      competitor_pressure: mentionsPriceComparison(text),
      confidence: 'MEDIUM',
    })
  }

  // Possession objections
  if (matchPatterns(text, possessionPatterns)) {
    objections.push({
      type: 'POSSESSION',
      reason: 'Possession timeline or delivery concern',
      competitor_pressure: false,
      confidence: 'MEDIUM',
    })
  }

  // Builder history objections
  if (matchPatterns(text, builderPatterns)) {
    objections.push({
      type: 'BUILDER_HISTORY',
      reason: 'Concerns about builder track record',
      competitor_pressure: true,
      confidence: 'MEDIUM',
    })
  }

  // Location objections
  if (matchPatterns(text, locationPatterns)) {
    objections.push({
      type: 'LOCATION',
      reason: 'Location or connectivity concern',
      competitor_pressure: false,
      confidence: 'MEDIUM',
    })
  }

  return objections
}

function matchPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text))
}

function mentionsPriceComparison(text: string): boolean {
  const comparisonPatterns = [
    /cheaper|less expensive|better value|compared to/gi,
    /(\w+)\s+(costs?|priced|charges)/gi,
  ]
  return comparisonPatterns.some(p => p.test(text))
}

/**
 * Format objection for Lead Brief
 * Never expose specific competitor or exact details
 */
export function formatObjectionForBrief(objection: DetectedObjection): string {
  switch (objection.type) {
    case 'PRICE':
      return 'Price or affordability concern'
    case 'POSSESSION':
      return 'Possession timeline concern'
    case 'BUILDER_HISTORY':
      return 'Builder track record concerns'
    case 'LOCATION':
      return 'Location or connectivity concern'
    case 'OTHER':
    default:
      return 'Other concern'
  }
}
