// backend/src/lib/ai/geminiMeter.ts

import { GoogleGenAI } from '@google/genai'
import { recordUsage, spentTodayUsd, priceFor } from './cost'

/** Refresh interval for the spend figure. A DB read per call would be absurd. */
const SPEND_TTL_MS = 30_000

let cachedSpend = 0
let cachedAt = 0

export class GeminiBudgetExceededError extends Error {
  constructor(spent: number, budget: number) {
    super(
      `Gemini daily budget exhausted: $${spent.toFixed(4)} of $${budget.toFixed(2)} spent today. ` +
        `Raise GEMINI_DAILY_BUDGET_USD or wait for the UTC day to roll over.`,
    )
    this.name = 'GeminiBudgetExceededError'
  }
}

function getDailyBudgetUsd(): number {
  return Number(process.env.GEMINI_DAILY_BUDGET_USD ?? '10')
}

/** Throws once the day's Gemini spend is over budget. */
export async function assertWithinGeminiBudget(): Promise<void> {
  const budget = getDailyBudgetUsd()
  if (budget <= 0) return

  const now = Date.now()
  if (now - cachedAt > SPEND_TTL_MS) {
    cachedSpend = await spentTodayUsd('gemini')
    cachedAt = now
  }
  if (cachedSpend >= budget) {
    throw new GeminiBudgetExceededError(cachedSpend, budget)
  }
}

/** Spend recorded so far today, for the health check and for logging. */
export function geminiBudgetStatus(): { spentUsd: number; budgetUsd: number; staleMs: number } {
  const budget = getDailyBudgetUsd()
  return { spentUsd: cachedSpend, budgetUsd: budget, staleMs: Date.now() - cachedAt }
}

/** Test seam, and a way to force a fresh read after a manual budget change. */
export function resetGeminiBudgetCache(): void {
  cachedSpend = 0
  cachedAt = 0
}

export interface MeteredClientOptions {
  apiKey?: string
  /** Where these calls come from, e.g. "intent" or "chips". Stored on the row. */
  endpoint: string
  userId?: string | null
  sessionId?: string | null
  /** Milliseconds before a call is abandoned. */
  timeoutMs?: number
}

/** A GoogleGenAI client whose generateContent is budgeted and billed. */
export function meteredClient(opts: MeteredClientOptions) {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error(`No GEMINI_API_KEY configured (endpoint: ${opts.endpoint})`)

  const client = new GoogleGenAI({
    apiKey,
    ...(opts.timeoutMs ? { httpOptions: { timeout: opts.timeoutMs } } : {}),
  })

  type GenerateArgs = Parameters<typeof client.models.generateContent>[0]

  return {
    models: {
      generateContent: async (args: GenerateArgs) => {
        await assertWithinGeminiBudget()
        const res = await client.models.generateContent(args)
        meter(res, String(args.model), opts)
        return res
      },
    },
    /** The unwrapped client, for the few APIs the wrapper does not cover. */
    raw: client,
  }
}

interface UsageMetadataLike {
  promptTokenCount?: number
  candidatesTokenCount?: number
  cachedContentTokenCount?: number
  thoughtsTokenCount?: number
}

function meter(
  res: { usageMetadata?: UsageMetadataLike },
  model: string,
  opts: MeteredClientOptions,
): void {
  const um = res.usageMetadata
  if (um) {
    const cached = um.cachedContentTokenCount ?? 0
    void recordUsage({
      provider: 'gemini',
      model,
      // Raw counts. The cached discount is applied by priceFor, not folded in
      // here — a stored token count has to match what the provider reports or
      // it can never be reconciled against a bill.
      promptTokens: um.promptTokenCount ?? 0,
      cachedTokens: cached,
      // Thoughts bill at the output rate and are reported separately.
      completionTokens: (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0),
      endpoint: opts.endpoint,
      userId: opts.userId,
      sessionId: opts.sessionId,
    })
    // Keep the in-process figure moving between DB refreshes, so a burst inside
    // one TTL window cannot run far past the ceiling before the next read.
    cachedSpend += estimateCostUsd(model, um.promptTokenCount ?? 0, um.candidatesTokenCount ?? 0)
  }
}

/** Rough local cost, used only to keep the cached spend figure moving between */
function estimateCostUsd(model: string, inTokens: number, outTokens: number): number {
  return priceFor(model, inTokens, outTokens)
}
