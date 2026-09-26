import { z } from 'zod'

/**
 * JEV — PropFyndr's own decision layer (CHAT_INTELLIGENCE_ROADMAP.md, Phase 3).
 *
 * One structured decision per turn: what the buyer wants, which data answers
 * it, and in what shape. It rides on the intent-extraction call the router
 * already pays for — the same JSON reply carries a `jev` block — so it costs a
 * few output tokens, not a request.
 *
 * Shadow mode only for now: the decision is recorded in `turn_traces.jev_shadow`
 * beside the lane the existing router actually used, and changes nothing a
 * buyer sees. Phase 4 lets it drive the turn, one task at a time.
 */

export const JEV_TASKS = [
  'discover', 'project_fact', 'compare', 'calculate', 'market_explain',
  'legal_process', 'meta', 'lead', 'smalltalk', 'out_of_scope',
] as const

/** Ordered: a plan is always consulted in this order, whatever the model wrote. */
export const JEV_SOURCES = ['db', 'statutory', 'knowledge', 'web', 'general'] as const

/**
 * Abstract topics, never column names.
 *
 * The executor (Phase 4) maps each to fields inside `PROJECT_PUBLIC_SELECT`, so
 * nothing the model writes here can name a forbidden relation or an internal
 * column — an unknown value is dropped at parse time.
 */
export const JEV_FIELDS = [
  'price', 'payment_plan', 'cost_sheet', 'possession', 'construction_status', 'rera',
  'amenities', 'floor_plans', 'builder', 'location', 'connectivity', 'legal', 'images',
] as const

export type JevTask = (typeof JEV_TASKS)[number]
export type JevSource = (typeof JEV_SOURCES)[number]

export interface JevDecision {
  task: JevTask
  sources: JevSource[]
  shape: 'lookup' | 'factual' | 'advisory' | 'reasoning'
  fields: string[]
  clarify: string | null
  via: 'llm'
}

const RawJev = z.object({
  task: z.enum(JEV_TASKS),
  source: z.array(z.string()).optional(),
  shape: z.enum(['lookup', 'factual', 'advisory', 'reasoning']).optional(),
  fields: z.array(z.string()).optional(),
  clarify: z.string().nullable().optional(),
})

/**
 * The `jev` block from the intent reply, or null when absent or malformed.
 * A bad block never costs the intent: the two are parsed independently.
 */
export function parseJevDecision(raw: string): JevDecision | null {
  const match = raw?.match(/\{[\s\S]*\}/)
  if (!match) return null
  let obj: unknown
  try {
    obj = JSON.parse(match[0])
  } catch {
    return null
  }
  const parsed = RawJev.safeParse((obj as { jev?: unknown })?.jev)
  if (!parsed.success) return null
  const j = parsed.data
  const wanted = new Set(j.source ?? [])
  return {
    task: j.task,
    sources: JEV_SOURCES.filter((s) => wanted.has(s)),
    shape: j.shape ?? 'factual',
    fields: (j.fields ?? []).filter((f) => (JEV_FIELDS as readonly string[]).includes(f)),
    clarify: j.clarify?.trim() ? j.clarify.trim() : null,
    via: 'llm',
  }
}

/** Appended to the intent-extraction prompt when JEV_MODE is not 'off'. */
export const JEV_PROMPT_SECTION = `

ALSO RETURN a "jev" object inside the same JSON — the routing decision for this message:
"jev": {
  "task": "discover"|"project_fact"|"compare"|"calculate"|"market_explain"|"legal_process"|"meta"|"lead"|"smalltalk"|"out_of_scope",
  "source": subset of ["db","statutory","knowledge","web","general"],
  "shape": "lookup"|"factual"|"advisory"|"reasoning",
  "fields": subset of ["price","payment_plan","cost_sheet","possession","construction_status","rera","amenities","floor_plans","builder","location","connectivity","legal","images"],
  "clarify": null or ONE short question, only when the message cannot be acted on at all
}
TASKS: discover = find/shortlist homes. project_fact = a fact about a named project or its builder. compare = two or more named projects/sectors side by side. calculate = EMI, stamp duty, GST, affordability math. market_explain = an area's or city's market, prices, infrastructure, liveability. legal_process = RERA rules, registry, tax, loans, how buying works. meta = about this conversation ("what have I told you"). lead = wants a callback, site visit or contact. smalltalk = greetings, thanks. out_of_scope = rent, resale, commercial, auction, or nothing to do with real estate.
We list homes only in Noida, Greater Noida and Greater Noida West. A market question about any other Indian city is market_explain with source ["web"], NOT out_of_scope. A Noida buyer mentioning a commute to another city is still discover.
SOURCE: db = our project/sector rows. statutory = stamp duty, GST, registration. knowledge = stable rules and concepts. web = live news or another city's market. general = chit-chat.

JEV EXAMPLES:
Input: "3bhk under 1.5cr near metro, possession in a year"
Output: {"bhk":[3],"budgetMax":1.5,"possession":"1year","lifestyleKeywords":["metro"],"jev":{"task":"discover","source":["db"],"shape":"advisory","fields":[],"clarify":null}}
Input: "godrej palm retreat ka payment plan kya hai"
Output: {"projectNames":["Godrej Palm Retreat"],"jev":{"task":"project_fact","source":["db"],"shape":"lookup","fields":["payment_plan"],"clarify":null}}
Input: "how is the whitefield market these days"
Output: {"jev":{"task":"market_explain","source":["web"],"shape":"factual","fields":[],"clarify":null}}
Input: "stamp duty on a 1.2 crore flat for a woman buyer"
Output: {"jev":{"task":"calculate","source":["statutory"],"shape":"lookup","fields":[],"clarify":null}}
Input: "sector 137 vs sector 150 noida"
Output: {"jev":{"task":"compare","source":["db"],"shape":"reasoning","fields":[],"clarify":null}}
Input: "what are the advantages and disadvantages of buying in sector 150"
Output: {"sector":"Sector 150","jev":{"task":"market_explain","source":["db","web"],"shape":"advisory","fields":[],"clarify":null}}
Input: "axis bank ifsc code sector 75 noida"
Output: {"jev":{"task":"out_of_scope","source":["general"],"shape":"lookup","fields":[],"clarify":null}}`
