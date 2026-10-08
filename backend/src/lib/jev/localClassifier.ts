/**
 * Fast In-Process Local Classifier (Task 2.3)
 * Provides ultra-fast (<2ms) token-free intent resolution for routine buyer queries.
 */

export interface FastClassifierResult {
  matched: boolean
  confidence: number // 0.0 to 1.0
  intent: 'educational_query' | 'financial_calc' | 'direct_search' | 'unknown'
  suggestedTask?: string
}

const DEFINITION_PATTERNS = [
  /\bwhat\s+is\s+(carpet\s+area|super\s+area|built\s*up\s+area|rera|occupancy\s+certificate|oc|commute|tds)\b/i,
  /\bdifference\s+between\s+(carpet|super|built\s*up)\b/i,
  /\bexplain\s+(rera|stamp\s+duty|gst|possession)\b/i,
]

const FINANCIAL_CALC_PATTERNS = [
  /\b(calculate|compute|check)\s+(emi|loan|stamp\s+duty|gst|landed\s+cost)\b/i,
  /\bemi\s+for\s+[\d\.]+\s*(cr|crore|lakh|l)\b/i,
  /\bstamp\s+duty\s+for\s+(male|female|joint)\b/i,
]

const DIRECT_SEARCH_PATTERNS = [
  /\b(show|find|list|get)\s+(me\s+)?(projects|flats|apartments|units)\s+in\s+[a-z0-9\s]+\b/i,
  /\b(details|overview|pricing)\s+of\s+[a-z0-9\s]+\b/i,
]

export function classifyQueryLocal(queryText: string): FastClassifierResult {
  const text = queryText.trim()
  if (!text) {
    return { matched: false, confidence: 0, intent: 'unknown' }
  }

  // 1. Test Educational / Definition Patterns
  for (const pattern of DEFINITION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        matched: true,
        confidence: 0.98,
        intent: 'educational_query',
        suggestedTask: 'knowledge_doc_search',
      }
    }
  }

  // 2. Test Financial Calculator Patterns
  for (const pattern of FINANCIAL_CALC_PATTERNS) {
    if (pattern.test(text)) {
      return {
        matched: true,
        confidence: 0.96,
        intent: 'financial_calc',
        suggestedTask: 'calculator_interactive',
      }
    }
  }

  // 3. Test Direct Search Patterns
  for (const pattern of DIRECT_SEARCH_PATTERNS) {
    if (pattern.test(text)) {
      return {
        matched: true,
        confidence: 0.95,
        intent: 'direct_search',
        suggestedTask: 'catalog_search',
      }
    }
  }

  return { matched: false, confidence: 0.2, intent: 'unknown' }
}
