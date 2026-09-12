import { prisma } from '../db'

/**
 * Bump when any rate below changes, or when the meaning of a stored token
 * count changes. Written to every row so historical spend stays re-computable
 * and a rate change does not silently rewrite the past.
 *
 * 1 — implicit. Rows have pricing_version null and a prompt_tokens that was
 *     already discounted for cached input.
 * 2 — prompt_tokens is the raw input count, cached_tokens is separate, and the
 *     discount is applied here at read time.
 */
export const PRICING_VERSION = 2

/**
 * USD per 1M tokens. Update when provider pricing changes.
 *
 * `free: true` is not the same as a missing row, and the difference matters:
 * a missing row bills at $0 because nobody has priced the model, which reads
 * as free traffic in every dashboard and in isOverDailyBudget. An explicit
 * free row says someone checked. Anything absent from this table is a bug the
 * moment it appears in the chain.
 */
type PriceRow = { in: number; out: number; free?: true }
const PRICE: Record<string, PriceRow> = {
  'llama-3.1-8b-instant': { in: 0.05, out: 0.08 }, // deprecated by Groq June 2026, kept for historical usage rows
  'llama-3.3-70b-versatile': { in: 0.59, out: 0.79 }, // deprecated by Groq June 2026, kept for historical usage rows
  'openai/gpt-oss-20b': { in: 0.075, out: 0.3 }, // Groq — replaces llama-3.1-8b-instant
  'openai/gpt-oss-120b': { in: 0.15, out: 0.6 }, // Groq — replaces llama-3.3-70b-versatile
  'gpt-4o': { in: 2.5, out: 10.0 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'claude-3-5-sonnet-20241022': { in: 3.0, out: 15.0 },
  // Verified against ai.google.dev/gemini-api/docs/pricing, paid tier, Aug 2026.
  'gemini-3.6-flash': { in: 0.75, out: 3.75 }, // → 1.50 / 7.50 from 2027-01-01
  'gemini-3.7-flash': { in: 0.75, out: 3.75 }, // → 1.50 / 7.50 from 2027-01-01
  'gemini-3.5-flash': { in: 1.5, out: 9.0 },
  'gemini-3.5-flash-lite': { in: 0.3, out: 2.5 },
  'gemini-3.1-flash-lite': { in: 0.25, out: 1.5 },
  'gemini-2.0-flash': { in: 0.3, out: 2.5 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
  'gemini-2.5-flash-lite': { in: 0.1, out: 0.4 },
  'gemini-flash-latest': { in: 0.75, out: 3.75 },
  'mistral-small-latest': { in: 0.14, out: 0.42 },
  'llama3.3-70b': { in: 0.5, out: 1.5 },
  // Cerebras serves gpt-oss-120b under the bare id; the 'openai/'-prefixed row
  'gpt-oss-120b': { in: 0.25, out: 0.69 },

  // TIER 2 of FALLBACK_CHAIN. Both were absent from this table entirely, so
  // every call through the Cohere and NVIDIA legs — the tool-capable tier that
  // answers whenever Gemini's quota is spent — recorded $0 and was invisible
  // in cost reporting. Marked free rather than priced: these keys are trial /
  // NIM allowances, not billed usage. The day either becomes a paid account,
  // replace the marker with real rates.
  'command-a-03-2025': { in: 0, out: 0, free: true },
  'nvidia/nemotron-3.5-lightning-30b-a3b': { in: 0, out: 0, free: true },
  // Cloudflare Workers AI, on the free daily neuron allowance rather than
  // per-token billing. Priced at zero because it is zero, not because it was
  // overlooked — the day this moves to a paid plan the rate goes here.
  '@cf/meta/llama-4-scout-17b-16e-instruct': { in: 0, out: 0, free: true },
}

/** Cached input as a fraction of the standard input rate. */
export const CACHED_INPUT_RATIO = 0.1

/**
 * USD for a given token count on a given model, from the one PRICE table.
 *
 * `promptTokens` is the FULL input count; `cachedTokens` is the part of it the
 * provider served from cache, which bills at CACHED_INPUT_RATIO. Passing the
 * cached figure separately — rather than pre-discounting the count upstream —
 * is what keeps the stored token numbers reconcilable against a provider
 * report, and lets a rate change re-price history.
 */
export function priceFor(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens = 0,
): number {
  const p = PRICE[model] ?? { in: 0, out: 0 }
  const cached = Math.min(Math.max(cachedTokens, 0), Math.max(promptTokens, 0))
  const uncached = Math.max(promptTokens, 0) - cached
  const inputUnits = uncached + cached * CACHED_INPUT_RATIO
  return (inputUnits * p.in + completionTokens * p.out) / 1_000_000
}

/** Whether a model is deliberately free, as opposed to simply unpriced. */
export function isFreeModel(model: string): boolean {
  return PRICE[model]?.free === true
}

/** Models in use that nobody has priced. Surfaced by the health check. */
export function unpricedModels(): string[] {
  return [...warnedUnpriced]
}

const warnedUnpriced = new Set<string>()

export async function recordUsage(args: {
  provider: string
  model: string
  /** FULL input count, cached portion included. Never pre-discounted. */
  promptTokens: number
  completionTokens: number
  /** Part of promptTokens the provider served from cache, where it reports one. */
  cachedTokens?: number
  endpoint: string
  userId?: string | null
  sessionId?: string | null
  /** Provider-side request id, where the SDK exposes one. */
  requestId?: string | null
}): Promise<void> {
  // An unpriced model bills $0 forever and looks like free traffic in every
  // dashboard and in isOverDailyBudget. Say so once per model rather than
  // letting a chain entry quietly go free after a provider renames a model.
  if (!PRICE[args.model] && !warnedUnpriced.has(args.model)) {
    warnedUnpriced.add(args.model)
    console.warn(`[cost] no price row for model "${args.model}" (${args.provider}) — recording it at $0`)
  }
  const cost = priceFor(args.model, args.promptTokens, args.completionTokens, args.cachedTokens ?? 0)
  try {
    const aiUsageEventModel = (prisma as any).aiUsageEvent
    if (!aiUsageEventModel) return
    await aiUsageEventModel.create({
      data: {
        user_id: args.userId ?? null,
        session_id: args.sessionId ?? null,
        provider: args.provider,
        model: args.model,
        prompt_tokens: args.promptTokens,
        cached_tokens: args.cachedTokens ?? 0,
        completion_tokens: args.completionTokens,
        cost_usd: cost,
        pricing_version: PRICING_VERSION,
        request_id: args.requestId ?? null,
        endpoint: args.endpoint,
      },
    })
  } catch (err) {
    // Never let telemetry break a chat response.
    console.error('[cost] recordUsage failed:', err instanceof Error ? err.message : err)
  }
}

/** Everything spent today on one provider, across all users and all routes. */
export async function spentTodayUsd(provider?: string): Promise<number> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  try {
    const aiUsageEventModel = (prisma as any).aiUsageEvent
    if (!aiUsageEventModel) return 0
    const agg = await aiUsageEventModel.aggregate({
      _sum: { cost_usd: true },
      where: { created_at: { gte: since }, ...(provider ? { provider } : {}) },
    })
    return Number(agg?._sum?.cost_usd ?? 0)
  } catch (err) {
    // A failed read must not open the gate — report the budget as spent so the
    // caller backs off, rather than reporting zero and spending freely.
    console.error('[cost] spentTodayUsd failed:', err instanceof Error ? err.message : err)
    return Number.POSITIVE_INFINITY
  }
}

const DAILY_USER_LIMIT_USD = Number(process.env.DAILY_USER_LIMIT_USD ?? '0.50')

export async function isOverDailyBudget(userId: string | null): Promise<boolean> {
  if (!userId) return false // anonymous users are already IP-rate-limited globally
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  try {
    const aiUsageEventModel = (prisma as any).aiUsageEvent
    if (!aiUsageEventModel) return false
    const agg = await aiUsageEventModel.aggregate({
      _sum: { cost_usd: true },
      where: { user_id: userId, created_at: { gte: since } },
    })
    const spent = Number(agg?._sum?.cost_usd ?? 0)
    return spent >= DAILY_USER_LIMIT_USD
  } catch (err) {
    console.error('[cost] isOverDailyBudget failed:', err instanceof Error ? err.message : err)
    return false
  }
}
