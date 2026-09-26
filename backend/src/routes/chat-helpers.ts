// backend/src/routes/chat-helpers.ts
import { isOutageNotice } from '../lib/ai/outageNotice'
import { Response } from 'express'
import { Prisma } from '@prisma/client'
import type { Intent, ScoredProject } from '../lib/discovery'
import { matchesProjectName, isCityLevel, getIntentState } from '../lib/discovery'
import { estimateTokensReal } from '../lib/ai/tokenizer'
import { CONTEXT_TOKEN_CEILING } from '../lib/ai/adaptiveMessaging'
import { DEFAULT_CITY } from '../lib/config/cities'
import { getChipInventory } from '../lib/discovery/chipInventory'
import { computeConversationState } from '../lib/discovery/conversationEngine'
import { hydrateFromDb } from '../lib/discovery/chipDedup'

// ── Fix 8: order-independent array comparison
export function sameSet(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].map(String).sort()
  const sb = [...b].map(String).sort()
  return sa.every((v, i) => v === sb[i])
}

// ── Fix 12: structured routing observability
export function logRouting(
  event:
    | 'CACHE_REUSED' | 'CACHE_REJECTED' | 'CACHE_PROJECT_MISS'
    | 'CACHE_SECTOR_MISS' | 'DISCOVERY_TRIGGERED' | 'DISCOVERY_SKIPPED'
    | 'SHORTLISTED_ENTERED',
  detail: Record<string, unknown>,
): void {
  console.log(`[ROUTING:${event}]`, detail)
}

// Honest fallback when LLM pipeline fails entirely
export function generateHighTrafficFallback(): string {
  return "We're experiencing high traffic right now. Please try again in a moment — your query should go through shortly. Feel free to ask about any properties, builders, or specific project details."
}

/**
 * True when a reply is an outage notice rather than an answer.
 *
 * There are two of these strings in two files — this one, and
 * `fallbackChain.ts`'s "Our AI services are currently experiencing high
 * traffic…" — and the answer-cache write guard knew only the first, matching it
 * with `startsWith("We're experiencing high traffic")`. So the OTHER one was
 * cached, and cached under `is_verified: true`: measured live, "which is the
 * best project in Noida" returned in 1.6 seconds with
 * `[CHAT:CACHE_HIT] Serving verified advisory response from cache` and an outage
 * message as the body. Every buyer asking that question got the outage for the
 * whole TTL, long after the chain recovered.
 *
 * A predicate here rather than a longer string comparison at the call site: the
 * next variant of this message will be written next to the others, and this is
 * where it has to be added. Substring, not prefix — `fallbackChain` also embeds
 * the notice as a parenthetical after a real database fact.
 */
export function isServiceFailureReply(text: string): boolean {
  if (!text) return true
  // `isOutageNotice` is the fingerprint of the notice `fallbackChain` actually
  // sends. The two legacy phrasings stayed here after the notice was reworded,
  // so the current notice passed as an answer and could be written to the
  // answer cache and replayed to the next buyer.
  return isOutageNotice(text) || /experiencing high traffic|are out of service/i.test(text)
}

export type CacheDecision = {
  reuse: boolean
  reason: 'CACHE_REUSED' | 'CACHE_REJECTED' | 'CACHE_PROJECT_MISS' | 'CACHE_SECTOR_MISS'
  budgetOnly: boolean
}

// ── Fix 9: centralized cache validation — priority: project > sector > builder > BHK > budget > reuse
export function canReuseCache(
  intent: Intent,
  prevIntent: Record<string, unknown>,
  cached: ScoredProject[],
): CacheDecision {
  const prev = prevIntent as Partial<Intent>

  // Fix 1/3: project named but absent from cache → must discover (uses shared matchesProjectName)
  if ((intent.projectNames?.length ?? 0) > 0) {
    const missing = (intent.projectNames ?? []).filter(
      (n) => !cached.some((p) => matchesProjectName(n, p.name)),
    )
    if (missing.length > 0) {
      return { reuse: false, reason: 'CACHE_PROJECT_MISS', budgetOnly: false }
    }
  }

  // Fix 2: search-signal changes evaluated in priority order — sector first.
  // City-level terms ("Noida", "Greater Noida") are not search signals — do not invalidate cache.
  if (
    intent.sector !== undefined &&
    intent.sector !== prev.sector &&
    !isCityLevel(intent.sector)
  ) {
    return { reuse: false, reason: 'CACHE_SECTOR_MISS', budgetOnly: false }
  }
  if (intent.builderName !== undefined && intent.builderName !== prev.builderName) {
    return { reuse: false, reason: 'CACHE_REJECTED', budgetOnly: false }
  }
  // Fix 8: order-independent BHK comparison
  if ((intent.bhk?.length ?? 0) > 0 && !sameSet(intent.bhk!, (prev.bhk as number[] | undefined) ?? [])) {
    return { reuse: false, reason: 'CACHE_REJECTED', budgetOnly: false }
  }

  // Budget changed → filter existing set, no re-discovery
  const budgetChanged = intent.budgetMax !== prev.budgetMax || intent.budgetMin !== prev.budgetMin
  if (budgetChanged) return { reuse: true, reason: 'CACHE_REUSED', budgetOnly: true }

  // No search-signal change → safe to reuse (reasoning, follow-ups, etc.)
  return { reuse: true, reason: 'CACHE_REUSED', budgetOnly: false }
}

// ── Issue 4: Token budget protection — prevent OpenAI 413 ────────────────────

// Single source of truth for the input context ceiling. Note DISCOVERY.SAFE_TOKEN_CEILING
// in lib/config.ts is an OUTPUT cap despite the name — unrelated to this.
const SAFE_TOKEN_CEILING = CONTEXT_TOKEN_CEILING
export const estimateTokens = estimateTokensReal

export function trimMessagesToBudget(
  systemPrompt: string,
  msgs: Array<{ role: 'user' | 'assistant'; content: string }>,
  intent?: Record<string, unknown>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const systemTokens = estimateTokens(systemPrompt)
  const remaining = SAFE_TOKEN_CEILING - systemTokens - 2000 // Reserve 2K for response

  if (remaining <= 0) return msgs.slice(-2)

  // Intent-based window: search needs less context, advisory needs more
  const queryKind = (intent as any)?.queryKind || 'DISCOVERY'
  const windowMap: Record<string, number> = {
    'DISCOVERY': 3,
    'DRILLDOWN': 4,
    'RANKING': 3,
    'COMPARISON': 5,
    'SUMMARY': 6,
    'ADVISORY': 8,
    'CLARIFY': 4,
  }
  const maxWindow = windowMap[queryKind] || 4
  let windowed = msgs.slice(-maxWindow)

  // Then trim to token budget
  let trimmed = [...windowed]
  while (
    trimmed.length > 1 &&
    estimateTokens(trimmed.map((m) => m.content).join(' ')) > remaining
  ) {
    trimmed = trimmed.slice(1)
  }

  return trimmed.length === 0 ? msgs.slice(-1) : trimmed
}

export function sseWrite(res: Response, event: string, data: Record<string, unknown>): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function formatSessionList(sessions: Array<{ id: string; title: string | null; last_active: Date }>) {
  return sessions.map((s) => ({
    id: s.id,
    label:
      s.title ??
      `Chat ${new Date(s.last_active).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
    last_active: s.last_active,
  }))
}

export function formatMessages(
  messages: Array<{
    id: string
    role: string
    content: string
    created_at: Date
    artifacts?: Prisma.JsonValue | null
  }>
) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at,
    artifacts: Array.isArray(m.artifacts) ? m.artifacts : [],
  }))
}

// Session restore (GET /chat/session) never runs the Conversation Engine, so
// without this the progressive suggestion chips only exist after the user
// sends a fresh message — a restored session with a shortlist and history
// shows no chips at all until then. Recompute the same ui_state a live POST
// /chat turn would emit, from the restored intent/projects/history.
export async function buildRestoreUiState(
  lastIntent: Prisma.JsonValue | null,
  lastProjects: Prisma.JsonValue | null,
  messages: Array<{ role: string; content: string }>,
  currentSessionId?: string,
  rlKey?: string
) {
  // computeConversationState and hydrateFromDb imported at top of file
  const intent = (lastIntent ?? {}) as Intent
  const projects = (lastProjects as unknown as ScoredProject[]) ?? []
  const chatHistory = messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  const intentState = getIntentState(intent, projects.length > 0)
  const chipInventory = await getChipInventory(DEFAULT_CITY)

  if (currentSessionId) {
    await hydrateFromDb(currentSessionId)
  }

  // Session restore is a page load, not a turn — never spend an LLM call on it.
  const uiState = await computeConversationState(intent, intentState, projects, intent.is_comparison_query ?? false, chatHistory, undefined, undefined, undefined, chipInventory, true, undefined, { allowLlmChips: false })

  if (currentSessionId) {
    const { filterNewChips } = await import('../lib/discovery/chipDedup')
    uiState.chips = filterNewChips(currentSessionId, uiState.chips)
  }

  return uiState
}
