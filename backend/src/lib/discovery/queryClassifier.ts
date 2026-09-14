/**
 * Phase 0: Query Classification Taxonomy
 *
 * Deterministic + LLM fallback approach to classify user queries into:
 * - DISCOVERY: User wants recommendations (default fallback)
 * - DRILLDOWN: User wants details on specific project/attribute
 * - RANKING: User wants comparison/ranking of options
 * - COMPARISON: User wants to compare 2+ named projects
 * - SUMMARY: User wants overview/summary
 * - ADVISORY: User wants advice/opinion
 * - CLARIFY: Bot needs clarification before proceeding
 *
 * Deterministic pre-pass evaluates before LLM fallback.
 * LLM fallback folds queryKind into intent extraction (no extra round-trip).
 */

import type { Intent } from './types'
import { extractSectorMentions } from './sectorMentions'
import { inferRankingProfile, type RankingProfile } from './rankingProfiles'
import { detectOpenQuery, hasPropertySearchSignal } from './openQuery'

export type QueryKind =
  | 'DISCOVERY'   // User searching for properties
  | 'DRILLDOWN'   // Detail-focused on specific project
  | 'RANKING'     // Comparative/ranking query
  | 'COMPARISON'  // Compare 2+ projects
  | 'SUMMARY'     // High-level overview
  | 'ADVISORY'    // Ask for advice/opinion
  | 'CLARIFY'     // Need clarification
  | 'OPEN'        // General real-estate question, not a property search

export type RenderTarget = 'cards' | 'text' | 'both'

export interface QueryClassification {
  queryKind: QueryKind
  renderTarget: RenderTarget
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  reason: string
  rankingProfile?: RankingProfile // Phase 5: inferred from phrasing when queryKind=RANKING
}

/**
 * Render target mapping from queryKind.
 * Tells frontend how to render the response.
 */
function getRenderTarget(queryKind: QueryKind): RenderTarget {
  switch (queryKind) {
    case 'DISCOVERY':
      return 'cards'
    case 'DRILLDOWN':
    case 'SUMMARY':
    case 'ADVISORY':
    case 'CLARIFY':
    case 'OPEN':
      return 'text'
    case 'COMPARISON':
    case 'RANKING':
      return 'both'
    default:
      return 'text'
  }
}

/**
 * Deterministic pre-pass: keyword + pattern matching.
 * Returns classification if pattern is clear, otherwise returns null for LLM fallback.
 */
export interface ClassifyOptions {
  /**
   * Whether `intent.projectNames` was checked against the database and matched.
   *
   * The extractor puts any capitalised noun phrase in `projectNames` — a brokerage,
   * a bank, a person. When the caller has not verified them, an unmatched guess must
   * not keep a question out of the open lane, or it routes into the project detail
   * pipeline and comes back as "no record, want properties in Sector 79 instead?".
   * Defaults to trusting the list, which preserves existing callers.
   */
  hasVerifiedProjectNames?: boolean
}

export function classifyQueryDeterministic(
  userMessage: string,
  intent: Record<string, unknown>,
  opts: ClassifyOptions = {},
): QueryClassification | null {
  const msg = userMessage.toLowerCase().trim()
  const intentObj = intent as Partial<Intent>

  // COMPARISON: User explicitly asks to compare 2+ named projects
  // "Compare X vs Y", "Compare X and Y", "Compare X with Y"
  const comparePattern = /(?:compare|vs|versus|which.*better|which.*more suitable)\s+([^?]+)\s+(?:vs|versus|with|and|or)\s+([^?]+)/i
  const compareMatch = userMessage.match(comparePattern)
  if (compareMatch && intentObj.projectNames?.length && intentObj.projectNames.length >= 2) {
    return {
      queryKind: 'COMPARISON',
      renderTarget: 'both',
      confidence: 'HIGH',
      reason: 'Explicit comparison request with 2+ project names',
    }
  }

  /**
   * Two sectors named outright is a comparison too.
   *
   * The rule above requires two PROJECT names, and a sector comparison has
   * none — so "Compare Sector 150 and Sector 137" matched nothing here, fell
   * through every later branch, and landed on `queryKind: 'OPEN'` with the
   * reason "No property-search signal". Measured 5 Sep: the open lane answered
   * it from general knowledge with no rendered table and not one figure from
   * our own rows, and `sectorComparisonHandler` — which exists precisely for
   * this question, and renders inventory counts, price bands and the landmark
   * societies in each — never ran at all.
   *
   * Read off the message rather than the extracted intent, because on this turn
   * extraction returned `{}`: the classifier cannot depend on a field that is
   * empty exactly when the question is hardest to place.
   */
  // Its own trigger, not `comparePattern`. That pattern needs a keyword, then
  // content, then a joiner — so it matches "compare A with B" but not
  // "Sector 150 vs Sector 137", where the keyword IS the joiner. Two sectors
  // plus any comparison word is the whole test here; the sector extractor
  // already refuses to read "between 1 and 2 crore" as two sectors.
  const sectorCompareWord = /\b(compare|vs\.?|versus|better|difference|between|which\s+sector)\b/i
  if (sectorCompareWord.test(userMessage) && extractSectorMentions(userMessage, []).length >= 2) {
    return {
      queryKind: 'COMPARISON',
      renderTarget: 'both',
      confidence: 'HIGH',
      reason: 'Explicit comparison request naming two sectors',
    }
  }

  // OPEN: general real-estate question with no property-search shape.
  // Runs before the attribute/DRILLDOWN checks because those match on words like
  // "reputation" and "details" that also appear in "what is X's track record" —
  // and DRILLDOWN routes into the project pipeline, which has no row to answer from.
  const namesAreRealProjects =
    (intentObj.projectNames?.length ?? 0) > 0 && (opts.hasVerifiedProjectNames ?? true)
  const openDetection = detectOpenQuery(userMessage, namesAreRealProjects)
  if (openDetection) {
    return {
      queryKind: 'OPEN',
      renderTarget: 'text',
      confidence: 'HIGH',
      reason: openDetection.reason,
    }
  }

  // 1. DRILLDOWN: User asks specific property attributes of a project (payment plan, cost sheet, rera, floor plan, amenities, etc.)
  const attributeKeywords = /\b(payment\s+plans?|cost\s+sheets?|price\s+breakdown|carpet|carpet\s+area|super\s+area|emi|maintenance|parking|amenities|facilities|layout|configuration|timeline|possession|construction|status|builder|reputation|trust|verification|rera|floor\s+plans?|floors|top\s+floor|height|tower|towers|address|full\s+address|complete\s+address|location|where|vastu|facing|orientation|security|safety|cctv|aqi|green|architect|designer|theme|tagline|specs)\b/i

  /**
   * DRILLDOWN is a question about ONE project, so it needs a project in scope.
   *
   * Without this the gate fired on the keyword alone, and the keyword list holds
   * `maintenance`, `security`, `location`, `where`, `parking`, `possession`,
   * `builder`, `aqi`, `green`, `safety`, `status` and `height` — words that
   * appear in ordinary Noida-wide questions naming no project at all. Those
   * reached the project-detail lane with an empty `projectIds`, which answered
   * with "I need a project name to answer that." Being the FIRST gate after the
   * open-query check, it also shadowed the advisory, ranking and summary gates
   * below it, so a whole class of general questions could never reach them.
   *
   * A project is in scope when the message named one we verified, when the
   * session is focused on one, or when the message refers back to one.
   */
  const refersBackToAProject = /\b(it|its|it's|this|that|the\s+project|there|they|their)\b/i.test(msg)
  const hasProjectInScope =
    ((intentObj.projectNames?.length ?? 0) > 0 && (opts.hasVerifiedProjectNames ?? true)) ||
    Boolean((intent as { focus_project_id?: string | null }).focus_project_id) ||
    Boolean((intent as { targetProjectId?: string | null }).targetProjectId) ||
    refersBackToAProject

  if (attributeKeywords.test(msg) && hasProjectInScope) {
    return {
      queryKind: 'DRILLDOWN',
      renderTarget: 'text',
      confidence: 'HIGH',
      reason: 'Attribute question about a project in scope -> DRILLDOWN (text)',
    }
  }

  // 2. Property SEARCH Action: "show me flats", "find properties", "search", "list", "looking for", "available", "2 BHK in Sector 76"
  // An inventory noun on its own is not a search. `flats|apartments|homes` used
  // to be alternatives in the verb group, so "Is parking usually included in
  // Noida apartments?" — a question about a charge — was read as a property
  // search and answered with cards. The noun counts only alongside a filter or
  // a scope, which is what an actual search carries ("flats in Sector 150",
  // "apartments under 1.5 cr").
  const inventoryNoun = /\b(flats?|apartments?|homes?|properties|societ(?:y|ies))\b/i
  const searchFilter = /\b(sector|under|below|within|upto|up\s+to|budget|crore|cr|lakh|lac|near|nearby|\d\s*bhk)\b/i
  const isSearchAction = /\b(show\s+me|find\s+me|search|list\s+(all|the)?|looking\s+for|available\s+in)\b/i.test(msg) ||
    (inventoryNoun.test(msg) && searchFilter.test(msg)) ||
    (/\b(\d\s*bhk)\b/i.test(msg) && /\b(sector|in|under|budget|crore|lakh)\b/i.test(msg))
  const isSpecificAttributeQuestion = /\b(what is|where is|give me|explain|how many|what are|details of|about)\b/i.test(msg)

  if (isSearchAction && !isSpecificAttributeQuestion) {
    const superlativePattern = /\b(best|top|most|least|cheapest|fastest|largest|highest|lowest|fewest|value|budget-friendly|affordable|safest|trusted|premium|luxury|rank)\b/i
    if (superlativePattern.test(msg)) {
      return {
        queryKind: 'RANKING',
        renderTarget: 'both',
        confidence: 'HIGH',
        reason: 'Property search with ranking terms -> RANKING (both)',
      }
    }
    return {
      queryKind: 'DISCOVERY',
      renderTarget: 'both',
      confidence: 'HIGH',
      reason: 'Property search query -> DISCOVERY (both)',
    }
  }

  // GENERAL REAL ESTATE ADVISORY / BUYING STRATEGY & MARKET GUIDES:
  // "how to save money", "best way to negotiate", "hidden charges", "tax benefits", "checklist", "average price in noida"
  const generalAdvisoryPattern = /\b(how\s+to|best\s+way\s+to|tips\s+(for|on|to)|advice\s+(on|for)|guide\s+(to|for)|save\s+money|saving\s+money|negotiat|hidden\s+cost|hidden\s+charge|due\s+diligence|checklist|mistakes?\s+to\s+avoid|things?\s+to\s+(check|know|verify)|step\s+by\s+step|process\s+of\s+buying|tax\s+benefit|tax\s+saving|stamp\s+duty|circle\s+rate|average\s+price|market\s+rate|price\s+per\s+sqft|price\s+trends?)\b/i
  if (generalAdvisoryPattern.test(msg)) {
    return {
      queryKind: 'ADVISORY',
      renderTarget: 'text',
      confidence: 'HIGH',
      reason: 'Buyer advisory / strategy / market metric question -> ADVISORY (text)',
    }
  }

  // BUILDER / GENERAL ADVISORY: User asks about builders or general market
  const builderGeneralPattern = /\b(which builders|famous builders|top builders|reputed builders|builder list|builder track record|builder reputation|about builder)\b/i
  if (builderGeneralPattern.test(msg)) {
    return {
      queryKind: 'ADVISORY',
      renderTarget: 'text',
      confidence: 'HIGH',
      reason: 'General builder query -> render text only',
    }
  }

  // RANKING: Superlative + scope (Phase 5: extended with value/trust/speed/family phrasing)
  // "best projects under 1.5cr", "top 3 options in sector 62", "which is cheapest"
  // "best value", "safest builders", "fastest possession", "best for families"
  const superlativePattern = /\b(best|top|most|least|cheapest|fastest|largest|highest|lowest|fewest|which.*best|which.*most|which.*least|value|budget-friendly|affordable|safest|trusted|quick|families|family|premium|luxury|rank)\b/i
  const scopePattern = /\b(in|near|under|over|within|around|sector|area|range)\b/i
  if (superlativePattern.test(msg) && scopePattern.test(msg)) {
    const rankingProfile = inferRankingProfile(msg)
    return {
      queryKind: 'RANKING',
      renderTarget: 'both',
      confidence: 'HIGH',
      reason: 'Superlative + scope pattern (best, top, etc.)',
      rankingProfile: rankingProfile ?? undefined,
    }
  }

  // SUMMARY: User asks for overview/summary
  // "Summary of", "overview of", "quick summary", "what's available"
  const summaryPattern = /\b(summary|overview|quick summary|brief overview|gist|summary of|overview of)\b/i
  if (summaryPattern.test(msg)) {
    return {
      queryKind: 'SUMMARY',
      renderTarget: 'text',
      confidence: 'HIGH',
      reason: 'Summary/overview keywords',
    }
  }

  // ADVISORY: Asking for advice/opinion without comparison
  // "Should I buy X?", "Is X good for investment?", "What do you think of X?"
  const advisoryPattern = /\b(should|should i|would you|is.*good|is.*worth|is.*right|do you think|what do you think|recommendation|advice|your opinion|opinion on)\b/i
  const projectRef = /\b(for|about|on|of)\s+\w+$/
  if (advisoryPattern.test(msg) && projectRef.test(msg)) {
    return {
      queryKind: 'ADVISORY',
      renderTarget: 'text',
      confidence: 'MEDIUM',
      reason: 'Advisory keywords + project reference',
    }
  }

  // Fallback: return null to signal LLM fallback
  return null
}

/**
 * Determine if a query needs explicit LLM classification.
 * Returns true if deterministic pre-pass couldn't classify.
 */
export function needsLLMFallback(classification: QueryClassification | null): boolean {
  return classification === null
}

/**
 * Parse queryKind from LLM intent extraction.
 * Called INSIDE extractIntent to fold queryKind into the response schema.
 * The LLM includes queryKind in its intent JSON output.
 *
 * Default to DISCOVERY if not specified (fail-open).
 */
export function parseQueryKindFromIntent(rawIntent: Record<string, unknown>): QueryKind {
  const queryKind = rawIntent.queryKind as string | undefined

  const valid: QueryKind[] = ['DISCOVERY', 'DRILLDOWN', 'RANKING', 'COMPARISON', 'SUMMARY', 'ADVISORY', 'CLARIFY', 'OPEN']

  if (queryKind && valid.includes(queryKind as QueryKind)) {
    return queryKind as QueryKind
  }

  // Fail-open: unknown → DISCOVERY
  return 'DISCOVERY'
}

/**
 * Complete classification: combine deterministic + LLM fallback.
 * Called from chat.ts after intent extraction.
 */
export function classifyQuery(
  userMessage: string,
  intent: Record<string, unknown>,
  opts: ClassifyOptions = {},
): QueryClassification {
  // Try deterministic first
  const deterministic = classifyQueryDeterministic(userMessage, intent, opts)
  if (deterministic) {
    return deterministic
  }

  // Fallback to LLM-provided queryKind (already in intent from extractIntent)
  let queryKind = parseQueryKindFromIntent(intent)
  let reason = 'LLM classification'

  // parseQueryKindFromIntent fails open to DISCOVERY. That is right when the user
  // is shopping and wrong when they are asking — an unclassifiable question with no
  // BHK, budget, sector or project name in it used to come back as property cards.
  // With no search signal, OPEN is the safer default: it answers or admits a gap,
  // where DISCOVERY answers a question the user did not ask.
  // An unverified project name is not a search signal — it is usually the extractor
  // mistaking a company for a project, which is exactly the case that must reach the
  // open lane rather than the property pipeline.
  const searchSignalIntent = opts.hasVerifiedProjectNames === false
    ? { ...intent, projectNames: [] }
    : intent

  // The sentence-shape half of this condition used to be a required list of
  // opening words plus a question mark, and everything outside it still came
  // back as property cards: "hi", "explain capital gains tax on property sale",
  // "should i buy now or wait for rates to drop" — three turns of a demo, all
  // answered with a shortlist nobody asked for.
  //
  // Shape is the wrong test. The property that matters is whether the user is
  // shopping, and `hasPropertySearchSignal` already answers that from the
  // extracted BHK, budget, sector and project name. With no such signal there is
  // nothing to search for, so OPEN is right whatever the sentence looks like —
  // and the open lane hands inventory questions back to retrieval anyway.
  if (queryKind === 'DISCOVERY' && !hasPropertySearchSignal(searchSignalIntent, userMessage)) {
    queryKind = 'OPEN'
    reason = 'No property-search signal — fail open to OPEN, not DISCOVERY'
  }

  return {
    queryKind,
    renderTarget: getRenderTarget(queryKind),
    confidence: 'MEDIUM', // LLM-derived, less confident than deterministic
    reason,
  }
}

/**
 * Export render target resolver for use in chat.ts
 */
export { getRenderTarget }
