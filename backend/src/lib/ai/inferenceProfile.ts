// backend/src/lib/ai/inferenceProfile.ts

import { MODELS } from '../config'
import type { InferenceConfig } from './openai'

/** The shapes measured across the 321-query corpus, which is what real Noida */
export type QueryShape =
  | 'lookup' // head term, typo, brand probe: retrieval, no judgement
  | 'factual' // "which sectors have metro" — a fact plus a little context
  | 'advisory' // "is sector 150 good for investment" — judgement required
  | 'reasoning' // comparisons, multi-constraint budgets: the expensive ones

export interface InferenceProfile extends InferenceConfig {
  shape: QueryShape
  /** Tokens the model may spend thinking. 0 disables thinking entirely. */
  thinkingBudget: number
}

/** Deliberately coarse. */
const PROFILES: Record<QueryShape, Omit<InferenceProfile, 'shape'>> = {
  // No thinking at all. "2 bhk in noida" and "propertiesinnoida_extaion" are
  // resolved by retrieval; a reasoning budget here buys nothing and costs more
  // than the rest of the turn combined.
  lookup: { model: MODELS.GEMINI_LITE, thinkingBudget: 0, maxTokens: 700 },

  // Enough to organise three facts and a trade-off, on the cheap tier.
  factual: { model: MODELS.GEMINI_LITE, thinkingBudget: 256, maxTokens: 1200 },

  // Judgement questions get the smart model but a modest reasoning budget:
  // "is X good for Y" needs a position, not a plan.
  advisory: { model: MODELS.GEMINI_MAIN, thinkingBudget: 512, maxTokens: 1600 },

  // The queries the product exists for. Four sectors, six constraints, a
  // five-year horizon. Spend here; this is what a buyer came for.
  reasoning: { model: MODELS.GEMINI_MAIN, thinkingBudget: 1024, maxTokens: 2600 },
}

// Raised from 1000 / 1200 / 1800 on 30 Aug 2026, because roughly two answers
// per corpus run ended mid-sentence — one mid-table-row — and the cut always
// landed on a table-heavy reply. Markdown tables tokenize far denser than
// prose (pipes, separators, digits), so a ceiling set by eyeballing character
// counts is set too low for exactly the answers this product cares most about.
//
// This is close to free. maxTokens is a CEILING, not a target: an answer that
// finishes on its own bills what it generated, so the 97% of turns that were
// never truncated cost the same as before. Only the answers that were being
// cut off pay more, and paying for the rest of a comparison a buyer asked for
// is the trade this file exists to make.

/** Anything that turns a question into a comparison or a multi-constraint brief. */
const REASONING_RE =
  /\bvs\b|\bversus\b|\bcompare\b|\bbetter (than|for)\b|\bwhich (one|is better)\b|\btrade[- ]?offs?\b|\brank\b|\bshortlist\b|\bsafest bet\b|\bmost returns\b|\bwhere to (?:put money|invest)\b/i

/** A stated life situation: every clause is a constraint to be answered. */
const SITUATION_RE = /\bi (have|earn|want|need|work|am|would)\b|\bmy (wife|husband|family|budget|office|child)\b/i

/** Judgement vocabulary — asks for a position, not a fact. */
const ADVISORY_RE =
  /^(is|are|should|would|do you|does it|can i|will)\b|\bworth (it|buying)\b|\bgood (for|place|idea|option|choice|bet|investment|project)\b|\brisk|\bavoid\b|\brecommend/i

/** A question word, or a superlative. Wants a fact and a little framing. */
const FACTUAL_RE = /^(what|which|where|when|who|how)\b|\bbest\b|\btop\b|\bcheapest\b|\bhighest\b|\baverage\b/i

/** The shape of one message. */
export function classifyShape(message: string): QueryShape {
  const m = (message || '').trim()
  if (!m) return 'lookup'

  // A long message is doing something a short one is not, whatever its words.
  const words = m.split(/\s+/).length
  if (REASONING_RE.test(m) || SITUATION_RE.test(m) || words > 25) return 'reasoning'
  if (ADVISORY_RE.test(m)) return 'advisory'
  if (FACTUAL_RE.test(m)) return 'factual'
  return 'lookup'
}

/** The inference settings for a message. */
export function profileFor(message: string, force?: QueryShape): InferenceProfile {
  const shape = force ?? classifyShape(message)
  return { shape, ...PROFILES[shape] }
}

/** What this profile costs per turn at current Gemini pricing, in USD. */
export function estimateTurnCostUsd(
  profile: InferenceProfile,
  promptTokens: number,
  cachedTokens: number,
): number {
  const lite = /lite/.test(profile.model ?? '')
  const inRate = lite ? 0.3 : 0.75
  const outRate = lite ? 2.5 : 3.75
  const uncached = Math.max(0, promptTokens - cachedTokens)
  // Assume the reply uses its whole budget: the honest worst case, and the one
  // a capacity plan should be built on.
  const out = profile.thinkingBudget + (profile.maxTokens ?? 0)
  return (uncached * inRate + cachedTokens * inRate * 0.1 + out * outRate) / 1_000_000
}
