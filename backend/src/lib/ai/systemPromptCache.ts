// Phase 2: System prompt caching layer
// Separates static base prompt (cached) from dynamic rules (injected per request)
// Reduces token overhead ~30-40% by reusing cached static content across requests

import { getBaseSystemPrompt, splitSystemPrompt, SYSTEM_PROMPT_BOUNDARY } from './prompts/base'
import type { Intent, ScoredProject } from '../discovery'
import type { TopicSummaries } from '../chat/summaryCompression'

interface CachedSystemPrompt {
  static: string // Cached once, reused
  timestamp: number
  version: number // Bump on base prompt changes
}

const CACHE_VERSION = 2
let cachedBasePrompt: CachedSystemPrompt | null = null
const CACHE_TTL = 3600000 // 1 hour

/**
 * Sentinel marking the end of the provider-independent static prefix.
 * The no-tools block is spliced in here (see fallbackChain.applyNoToolsBlock)
 * instead of being appended after the per-request project/memory data — that
 * keeps ~1.8k tokens of stable text inside the prefix that Gemini can cache,
 * rather than re-billing it as a fresh tail on every single request.
 */
export const STATIC_PREFIX_MARKER = '<!--rp:static-prefix-end-->'

/**
 * Get cached base prompt OR generate + cache it.
 * Returns static prompt string once every hour.
 */
const baseVariants = new Map<string, CachedSystemPrompt>()

/**
 * Variant-keyed base prompt — the cacheable HEAD only (everything up to
 * SYSTEM_PROMPT_BOUNDARY).
 *
 * This used to call getBaseSystemPrompt() with NO arguments, silently discarding
 * intent (so `verbose: true` never widened the word budget), blockedBuilders (so
 * the legal do-not-recommend list was empty in the rules section), city, intentState
 * and queryKind (so dynamic tool filtering never ran on the live path).
 *
 * userMessage was also never threaded through here, on the theory that doing so
 * would make the whole prompt prefix unique per request and forfeit provider-side
 * prefix caching. That traded away real behaviour (outputContract,
 * outOfScopeDirective, filterToolsByIntent, selectPlaybooks all silently no-op
 * without it) for a caching win the head/tail split below gets without the
 * tradeoff: userMessage only ever reaches the TAIL (see getPromptTail), which was
 * always variable per turn anyway. The head — the ~85% shared-prefix bulk this
 * function caches — never sees userMessage and stays exactly as cacheable as
 * before.
 *
 * Note this is a JS string memo — it saves CPU, not tokens. Token savings come from
 * the prefix being byte-stable enough for the provider to cache it.
 */
function getCachedBasePrompt(
  intent?: Record<string, unknown>,
  blockedBuilders?: Array<{ name: string; legal_flag?: string }>,
  city?: string,
  intentState?: string,
  queryKind?: string,
  toolsEnabled: boolean = true,
): string {
  const now = Date.now()
  const key = [
    intent?.verbose === true ? 'verbose' : 'terse',
    city ?? 'default',
    intentState ?? 'none',
    queryKind ?? 'none',
    blockedBuilders?.length ?? 0,
    toolsEnabled ? 'tools' : 'notools',
  ].join('|')

  const hit = baseVariants.get(key)
  if (hit && hit.version === CACHE_VERSION && now - hit.timestamp < CACHE_TTL) {
    return hit.static
  }

  // userMessage is intentionally undefined here — this call exists only to
  // produce the cacheable head, and the head never depends on it.
  const full = getBaseSystemPrompt(
    intent as never,
    blockedBuilders,
    city as never,
    intentState,
    queryKind as never,
    undefined,
    toolsEnabled,
  )
  const head = splitSystemPrompt(full).head
  baseVariants.set(key, { static: head, timestamp: now, version: CACHE_VERSION })
  return head
}

/**
 * The per-turn tail: playbooks, behaviour rules, budget rules, the filtered
 * tool catalogue, the out-of-scope directive and the output contract — every
 * piece of getBaseSystemPrompt that reads userMessage. Recomputed fresh on
 * every call, never cached: it is pure string assembly with no I/O, so the
 * cost is CPU, not tokens or latency.
 */
function getPromptTail(
  userMessage: string | undefined,
  intent?: Record<string, unknown>,
  blockedBuilders?: Array<{ name: string; legal_flag?: string }>,
  city?: string,
  intentState?: string,
  queryKind?: string,
  toolsEnabled: boolean = true,
): string {
  const full = getBaseSystemPrompt(
    intent as never,
    blockedBuilders,
    city as never,
    intentState,
    queryKind as never,
    userMessage,
    toolsEnabled,
  )
  return splitSystemPrompt(full).tail
}

/**
 * Build complete system prompt with cache hit.
 * Static part: cached, reused
 * Dynamic part: injected per request
 */
export function buildSystemPromptWithCache(
  intent: any,
  projects: ScoredProject[],
  memory: any,
  sectorCtx: any,
  sectorsOverview: any,
  discoveryExpansion: any,
  nearbyProjects: any,
  notFoundNames: string[],
  blockedBuilders: any,
  intentState: string,
  city: string,
  multiDimContext?: string,
  /** False for providers that cannot call tools — drops the tool catalogue entirely. */
  toolsEnabled: boolean = true,
  /**
   * False when retrieval was gated this turn rather than run and empty.
   *
   * Threaded because "searched and found nothing" and "never searched" arrive
   * at buildProjectsBlock as the same empty array, and it used to answer both
   * with SECTOR_NOT_COVERED — a claim about the world made from a fact about
   * our own control flow.
   */
  discoveryRan: boolean = true,
  /**
   * The buyer's message this turn, resolved for pointers ("the second one" →
   * the actual project name) — pass `modelMessage`, not the raw `message`.
   *
   * Threaded to the TAIL only (see getPromptTail), so outputContract,
   * outOfScopeDirective, filterToolsByIntent and selectPlaybooks all actually
   * run on the live path, without the cached head becoming per-request.
   */
  userMessage?: string,
): string {
  const queryKind = (intent?.queryKind as string | undefined) ?? 'DISCOVERY'

  // Get cached static head — now actually parameterised (see getCachedBasePrompt).
  const staticHead = getCachedBasePrompt(
    intent,
    blockedBuilders,
    city,
    intentState,
    queryKind,
    toolsEnabled,
  )

  // The per-turn tail — never cached, always built from the real message.
  const tail = getPromptTail(
    userMessage,
    intent,
    blockedBuilders,
    city,
    intentState,
    queryKind,
    toolsEnabled,
  )

  // Build dynamic-only suffix (intent-specific, project-specific, memory)
  // These vary per request, so we don't cache them
  const dynamicRules = buildDynamicRules(
    intent,
    projects,
    memory,
    sectorCtx,
    sectorsOverview,
    discoveryExpansion,
    nearbyProjects,
    notFoundNames,
    blockedBuilders,
    intentState,
    discoveryRan,
  )

  // Combine: static head (cached) + boundary + tail (per-request, userMessage-aware)
  // + marker + dynamic (per-request)
  return staticHead + `\n\n${SYSTEM_PROMPT_BOUNDARY}\n\n` + tail + `\n${STATIC_PREFIX_MARKER}\n` + dynamicRules + (multiDimContext ? `\n\n${multiDimContext}` : '')
}

/**
 * Build only the dynamic parts of the system prompt.
 * These vary per request and cannot be cached.
 */
function buildDynamicRules(
  intent: any,
  projects: ScoredProject[],
  memory: any,
  sectorCtx: any,
  sectorsOverview: any,
  discoveryExpansion: any,
  nearbyProjects: any,
  notFoundNames: string[],
  blockedBuilders: any,
  intentState: string,
  discoveryRan: boolean = true,
): string {
  let dynamic = ''

  // "We searched and found nothing" and "we never searched" arrive here as the
  // same empty array, and the prompt's coverage rules turn both into a claim
  // that the sector is not in our database.
  //
  // Measured 31 Aug: "best society in sector 137" was gated before retrieval —
  // `[DISCOVERY:GATE] ran: false, reason: needsClarification`, because bhk,
  // budget and purpose were unset — and the buyer was told "Sector 137 is not
  // currently in our verified database" while ten projects sat in it. That is
  // a statement about the world derived from a fact about our own control flow.
  if (!discoveryRan && (!projects || projects.length === 0)) {
    dynamic +=
      `\n\n## ⛔ NO SEARCH WAS RUN THIS TURN\n` +
      `You have NOT been given search results, because no search was performed — not because nothing exists.\n` +
      `You therefore know NOTHING about what we do or do not hold in any sector, project or builder.\n\n` +
      `- You MUST NOT say a sector, project or builder is absent from our database, is "not covered", or is "not tracked".\n` +
      `- You MUST NOT list or name projects as if they were results.\n` +
      `- If the buyer asked for inventory, ask the ONE question you need to search properly, and say why you are asking.\n`
  }

  // Ground truth matched projects from database (Pruned for high efficiency)
  if (projects && projects.length > 0) {
    // 12, not 5. This is a SECOND cap on how many projects reach the model,
    // downstream of the one in chat-router — so raising that one to 12 for a
    // browse still left the prompt seeing five. "best society in sector 137"
    // has eight matches; the model could describe five of them and the
    // prose-card renderer could only draw cards for the ones it named.
    const optimizedProjects = projects.slice(0, 12).map((p: any) => ({
      id: p.id,
      name: p.name,
      sector: p.sector,
      city: p.city,
      status: p.status,
      possession_label: p.possession_label,
      price_range_label: p.price_range_label,
      price_min_cr: p.price_min_cr,
      price_max_cr: p.price_max_cr,
      price_per_sqft_all_inclusive: p.price_per_sqft_all_inclusive,
      open_space_pct: p.open_space_pct,
      rera_number: p.rera_number,
      builder: p.builder ? (typeof p.builder === 'string' ? p.builder : p.builder.name) : null,
      unit_types: (p.unit_types || []).map((u: any) => ({
        bhk: u.bhk,
        name: u.name,
        super_area_sqft: u.super_area_sqft,
        carpet_area_sqft: u.carpet_area_sqft,
        balconies_count: u.balconies_count || (u.bhk >= 3 ? 3 : 2),
        price_min_cr: u.price_min_cr,
        price_max_cr: u.price_max_cr
      })),
      amenities: (p.amenities || []).slice(0, 15).map((a: any) => typeof a === 'string' ? a : a.name)
    }))
    dynamic += `\n\n## MATCHED PROJECTS IN DATABASE (GROUND TRUTH - FULLY TRACKED & VERIFIED):\n${JSON.stringify(optimizedProjects, null, 2)}`
  }

  // Memory block (if any)
  if (memory) {
    const memoryStr = typeof memory === 'string' ? memory : JSON.stringify(memory)
    dynamic += `\n\n## MEMORY\n${memoryStr}`
  }

  // Sector context (if any)
  if (sectorCtx) {
    dynamic += `\n\n## SECTOR\n${sectorCtx}`
  }

  // Sectors overview (if any)
  if (sectorsOverview) {
    dynamic += `\n\n## SECTORS\n${sectorsOverview}`
  }

  // Discovery expansion (if any)
  if (discoveryExpansion && Object.keys(discoveryExpansion).length > 0) {
    dynamic += `\n\n## EXPANSION\n${JSON.stringify(discoveryExpansion)}`
  }

  // Nearby projects (if any)
  if (nearbyProjects && nearbyProjects.length > 0) {
    dynamic += `\n\n## NEARBY\n${JSON.stringify(nearbyProjects.slice(0, 3))}`
  }

  // Not found sentinel (if any)
  if (notFoundNames.length > 0) {
    dynamic += `\n\n## NOT_FOUND\n${notFoundNames.map(n => `- "${n}"`).join(',')}`
  }

  // Blocked builders (legal/compliance flags)
  if (blockedBuilders && blockedBuilders.length > 0) {
    dynamic += `\n\n## LEGAL_FLAGS\n`
    dynamic += blockedBuilders.map((b: any) => `- ${b.name}${b.legal_flag ? `(${b.legal_flag})` : ''}`).join(',')
  }

  // Intent state (for routing)
  if (intentState) {
    dynamic += `\n\n## INTENT\n${intentState}`
  }

  return dynamic
}

/**
 * Clear cache (for testing or after base prompt changes).
 */
export function clearSystemPromptCache(): void {
  cachedBasePrompt = null
  baseVariants.clear()
}
