// Tool registry with intent-based filtering for Phase 2 dynamic tool injection.
// Maps tools to queryKinds and keyword triggers so only relevant tools appear in the prompt.

import type { Intent } from '../discovery'

export type QueryKind = 'DISCOVERY' | 'DRILLDOWN' | 'RANKING' | 'COMPARISON' | 'ADVISORY'

export interface ToolIntentConfig {
  name: string
  intentKeywords: QueryKind[]
  keywordTriggers?: string[] // Optional: tool enabled if ANY of these keywords appear in query
}

// Core tools are ALWAYS included — they don't have intent routing
export const CORE_TOOLS: string[] = [
  'builder_lookup',
  'web_search',
  'project_intelligence',
  'sector_projects',
  'calculate_emi',
  'calculate_stamp_duty',
  'calculate_gst',
  'select_property',
]

// Intent-routed tools are only included if queryKind matches
export const INTENT_ROUTED_TOOLS: ToolIntentConfig[] = [
  {
    name: 'floor_plans_lookup',
    intentKeywords: ['DISCOVERY', 'DRILLDOWN', 'RANKING'],
    keywordTriggers: ['floor plan', 'layout', 'configuration', 'bhk options', 'carpet area', 'size', 'sqft'],
  },
  {
    name: 'cost_sheet_lookup',
    intentKeywords: ['DRILLDOWN', 'COMPARISON'],
    keywordTriggers: ['cost', 'price', 'charge', 'payment', 'total cost', 'hidden charge', 'psc'],
  },
  {
    name: 'payment_plan_lookup',
    intentKeywords: ['DRILLDOWN', 'COMPARISON'],
    keywordTriggers: ['payment plan', 'payment schedule', 'milestone', 'clp', 'down payment', 'subvention', 'offer'],
  },
  {
    // Has a real schema in tools.ts and is always callable via toOpenAITools()/
    // toGeminiTools(), but was never in this registry — so filterToolsByIntent
    // never selected it and the model never saw prose telling it this exists,
    // even though its description explicitly says it "replaces three separate
    // lookups (cost_sheet_lookup, payment_plan_lookup, price_history_lookup)".
    // Same trigger set as those three combined, since that is the whole point.
    name: 'project_financial_details',
    intentKeywords: ['DRILLDOWN', 'COMPARISON'],
    keywordTriggers: ['cost', 'price', 'charge', 'payment', 'total cost', 'hidden charge', 'psc', 'payment plan', 'payment schedule', 'milestone', 'clp', 'down payment', 'subvention', 'offer', 'price history', 'price trend', 'appreciation', 'past price'],
  },
  {
    name: 'amenities_lookup',
    intentKeywords: ['DRILLDOWN', 'RANKING'],
    keywordTriggers: ['amenity', 'facility', 'feature', 'club', 'gym', 'pool', 'what is nearby'],
  },
  {
    name: 'project_nearby',
    intentKeywords: ['DRILLDOWN', 'ADVISORY'],
    keywordTriggers: ['nearby', 'connectivity', 'metro', 'school', 'hospital', 'commute', 'distance', 'location'],
  },
  {
    name: 'commute',
    intentKeywords: ['ADVISORY'],
    keywordTriggers: ['commute', 'driving time', 'how far', 'distance to'],
  },
  {
    name: 'builder_news',
    intentKeywords: ['ADVISORY', 'COMPARISON'],
    keywordTriggers: ['builder news', 'builder activity', 'completion', 'launch', 'builder track record'],
  },
  {
    name: 'buyer_fit_analysis',
    intentKeywords: ['DRILLDOWN', 'ADVISORY'],
    keywordTriggers: ['fit for', 'right for', 'income', 'family', 'lifestyle', 'target buyer'],
  },
  {
    name: 'price_history_lookup',
    intentKeywords: ['ADVISORY', 'COMPARISON'],
    keywordTriggers: ['price history', 'price trend', 'appreciation', 'past price'],
  },
  {
    name: 'construction_status',
    intentKeywords: ['DRILLDOWN', 'ADVISORY'],
    keywordTriggers: ['construction progress', 'construction stage', 'how far along', 'completion date'],
  },
  {
    name: 'project_documents',
    intentKeywords: ['DRILLDOWN', 'ADVISORY'],
    keywordTriggers: ['document', 'brochure', 'floor plan', 'specification'],
  },
  {
    name: 'project_images',
    intentKeywords: ['DRILLDOWN', 'DISCOVERY'],
    keywordTriggers: ['image', 'photo', 'picture', 'show me', 'visual', 'construction progress'],
  },
  {
    name: 'project_competitors',
    intentKeywords: ['COMPARISON', 'RANKING'],
    keywordTriggers: ['compare', 'competitor', 'alternative', 'similar', 'versus', 'vs'],
  },
  // "Phase 5: Ranking helper tools" — best_value_projects, fastest_possession_projects
  // and best_for_families_projects were removed from here on 7 Sep 2026. All three
  // were selectable by filterToolsByIntent and had descriptions ready to render, but
  // no NEUTRAL_TOOLS schema and no handler ever existed for any of them — the exact
  // bug toolCatalogue.test.ts's first test was written to catch, just in the
  // opposite direction (advertised-in-prose rather than advertised-as-a-schema), so
  // it went uncaught. A buyer asking "best value in Sector 150" got "temporarily
  // unavailable" from a tool that had never existed, on every turn RANKING matched.
  //
  // Not reintroduced as aliases to `sector_projects`: that tool ranks only by
  // verified score then entry price, with no sort-by-value / by-possession-date /
  // by-school-proximity mode, so mapping these three onto it would silently change
  // what "best value" or "fastest possession" means without anyone deciding that on
  // purpose. Building the three properly — a real value-for-money metric, a
  // possession-date sort, a school-proximity weighting — is real feature work, not a
  // catalogue fix; tracked in PLAN.md rather than guessed at here.
  {
    name: 'area_info',
    intentKeywords: ['ADVISORY', 'DISCOVERY'],
    keywordTriggers: ['sector info', 'area guide', 'tell me about', 'sector overview'],
  },
  {
    name: 'rera_check',
    intentKeywords: ['ADVISORY', 'DRILLDOWN'],
    keywordTriggers: ['rera', 'registration', 'legal status', 'compliance'],
  },
  {
    name: 'user_saved_state',
    intentKeywords: ['DISCOVERY', 'COMPARISON'],
    keywordTriggers: ['shortlist', 'saved', 'my alerts', 'price drop'],
  },
]

// Escape hatch tool — always available, lets model ask for full tool list if needed
const ESCAPE_HATCH = 'list_available_tools'

/**
 * Determines which tools to inject based on queryKind and message content.
 * @param queryKind The determined query kind (DISCOVERY, DRILLDOWN, etc.)
 * @param message The user's message (checked for keyword triggers)
 * @returns Array of tool names to include in the system prompt
 */
export function filterToolsByIntent(queryKind: QueryKind, message: string): string[] {
  const tools = new Set(CORE_TOOLS)

  // Check intent-routed tools
  const messageLower = message.toLowerCase()
  for (const tool of INTENT_ROUTED_TOOLS) {
    // Match if queryKind is in intentKeywords OR if any keyword trigger is found
    const intentMatches = tool.intentKeywords.includes(queryKind)
    const keywordMatches = tool.keywordTriggers?.some(kw => messageLower.includes(kw))

    if (intentMatches || keywordMatches) {
      tools.add(tool.name)
    }
  }

  // Always add escape hatch to let model request full tool list if needed
  tools.add(ESCAPE_HATCH)

  return Array.from(tools).sort()
}

/**
 * Gets the intent from a query kind for display/debugging.
 */
export function getIntentLabel(queryKind: QueryKind): string {
  return {
    DISCOVERY: 'Property Discovery',
    DRILLDOWN: 'Project Deep-Dive',
    RANKING: 'Property Ranking',
    COMPARISON: 'Comparison',
    ADVISORY: 'Real Estate Advice',
  }[queryKind] ?? queryKind
}
