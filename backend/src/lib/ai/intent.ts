// backend/src/lib/ai/intent.ts
import Groq from 'groq-sdk'
import { meteredClient } from './geminiMeter'
import OpenAI from 'openai'
import { z } from 'zod'
import { INTENT_EXTRACTION_PROMPT } from './prompts/index'
import type { Intent } from '../discovery'
import { MODELS, FALLBACK_CHAIN } from '../config'
import { IntentSchema } from '../discovery/intent'
import { extractDeterministic, type DeterministicIntent } from './intentDeterministic'
import { prisma } from '../db'

/**
 * Bare sector numbers we hold, for the extractor's anchored bare-number rule.
 *
 * Read synchronously so extraction stays a pure, testable function, and
 * refreshed in the background so it never blocks a turn. Empty until the first
 * load lands, which costs only that one rule — every explicit "Sector N"
 * resolves without it. A failed load leaves it empty rather than throwing: a
 * missing sector list must not take intent extraction down with it.
 */
let KNOWN_SECTOR_NUMBERS: string[] = []
let sectorsLoadedAt = 0
const SECTOR_CACHE_TTL_MS = 10 * 60 * 1000

function refreshKnownSectors(): void {
  if (sectorsLoadedAt !== 0 && Date.now() - sectorsLoadedAt < SECTOR_CACHE_TTL_MS) return
  sectorsLoadedAt = Date.now()
  void prisma.project
    .findMany({ select: { sector: true }, distinct: ['sector'] })
    .then((rows) => {
      KNOWN_SECTOR_NUMBERS = rows
        .map((r) => String(r.sector ?? '').replace(/^Sector\s*/i, '').trim())
        .filter(Boolean)
    })
    .catch((e) => console.warn('[INTENT] sector list unavailable:', (e as Error).message))
}

export function normalizeSectorName(rawSector?: string): string | undefined {
  if (!rawSector) return undefined
  const cleaned = rawSector.trim()

  const secNumMatch = cleaned.match(/Sector\s*(\d+[A-Za-z]?)/i)
  if (secNumMatch) {
    return `Sector ${secNumMatch[1]}`
  }

  if (/sports\s*city/i.test(cleaned)) return 'Sector 79'
  if (/yamuna\s*expressway/i.test(cleaned)) return 'Yamuna Expressway'
  if (/noida\s*expressway/i.test(cleaned)) return 'Noida Expressway'
  if (/greater\s*noida\s*west|noida\s*extension/i.test(cleaned)) return 'Greater Noida West'

  return cleaned
}

export function mergeIntent(previous: Intent, update: z.infer<typeof IntentSchema>): Intent {
  if (update.sector) {
    update.sector = normalizeSectorName(update.sector)
  }
  if (previous.sector) {
    previous.sector = normalizeSectorName(previous.sector)
  }

  // projectNames and is_comparison_query are per-turn signals — they reflect the
  // CURRENT message only. Never inherit from previous turns: a search query after a
  // comparison would otherwise see stale projectNames and wrongly enter comparison mode.
  const freshProjectLookup =
    (update.projectNames?.length ?? 0) > 0 && update.sector === undefined

  // If the user specifies a brand new sector and nothing else (e.g. "what about sector 75?")
  // we want to ensure we don't accidentally constrain it to highly specific previous filters
  // unless explicitly provided in the new query.
  const isSectorSwitch = update.sector && previous.sector && update.sector !== previous.sector

  // Default spatialScope to EXACT when sector is present and not explicitly PROXIMITY
  let spatialScope = update.spatialScope || previous.spatialScope
  if (update.sector && !update.spatialScope) {
    spatialScope = 'EXACT'
  }

  // A query is ONLY a follow-up about a previous project if:
  // 1. A previous project exists, AND
  // 2. The new query is NOT an open/advisory/market/comparison question, AND
  // 3. No new sector was specified.
  // A comparison of NAMED projects is not a general market question.
  //
  // `is_comparison_query` was an unconditional arm of this, and the flag drives
  // `sector: undefined` below — so "compare ATS Homekraft and Arihant Abode",
  // asked while the buyer was looking at Sector 10, dropped Sector 10 from
  // intent. Every later turn then had no locality, and the sticky-sector work
  // that this flag was added to support was undone by the comparison itself.
  //
  // A comparison with no project names IS vague enough to clear the sector —
  // "which is better?" alone should not stay pinned to wherever the buyer last
  // looked — so the flag still counts in that case.
  const isVagueComparison =
    Boolean((update as { is_comparison_query?: boolean }).is_comparison_query) &&
    (update.projectNames?.length ?? 0) === 0
  const isGeneralOrAdvisory = update.queryKind === 'ADVISORY' || update.queryKind === 'OPEN' || update.queryKind === 'RANKING' || isVagueComparison;
  const isFollowUpQuery = Boolean(
    previous.projectNames &&
    previous.projectNames.length === 1 &&
    !isSectorSwitch &&
    !update.sector &&
    !isGeneralOrAdvisory &&
    (!update.projectNames || update.projectNames.length === 0)
  );

  const result = {
    ...previous,
    // Reset previous sector if the new query is a general advisory/market question with no sector
    ...(isGeneralOrAdvisory && !update.sector ? { sector: undefined } : {}),
    projectNames: isFollowUpQuery ? previous.projectNames : (update.projectNames && update.projectNames.length > 0 ? update.projectNames : undefined),
    targetProjectId: isFollowUpQuery ? (previous as any).targetProjectId : undefined,
    is_comparison_query: undefined, // reset comparison flag per turn
    // Only clear sector/lifestyle if this is a TRULY fresh lookup (no prior context)
    ...(freshProjectLookup && !previous.sector ? { lifestyleKeywords: undefined } : {}),
    ...(isSectorSwitch || isGeneralOrAdvisory ? { 
        projectNames: undefined,
        targetProjectId: undefined,
        ...(isSectorSwitch ? {
          bhk: undefined, 
          budgetMin: undefined, 
          budgetMax: undefined, 
          lifestyleKeywords: undefined,
          areaMin: undefined,
          areaMax: undefined
        } : {})
    } : {}),
    // Drop nulls as well as undefined. IntentSchema is deliberately `.nullable()`
    // because models emit `"sector": null` for "not specified", but letting that
    // through put a literal null into Intent — and downstream isCityLevel(sector)
    // calls .toLowerCase() on it. Null means "not specified", same as absent.
    ...Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined && v !== null)),
    ...(spatialScope ? { spatialScope } : {}),
  } as Intent

  // Drop keys whose value is undefined. The per-turn resets above (projectNames,
  // is_comparison_query) left the keys present-but-undefined, which is semantically
  // identical to absent but makes Intent objects non-canonical — it broke deep
  // equality and padded anything that enumerates keys.
  for (const k of Object.keys(result)) {
    if ((result as Record<string, unknown>)[k] === undefined) {
      delete (result as Record<string, unknown>)[k]
    }
  }

  return result
}

// Fields the extraction prompt actually reasons about. Serialising the whole
// merged Intent sent internal bookkeeping (targetProjectId, queryKind, radiusKm,
// scoring residue) to the model on every single turn for no benefit.
const PROMPT_INTENT_FIELDS = [
  'bhk', 'budgetMin', 'budgetMax', 'possession', 'sector', 'areaMin', 'areaMax',
  'purpose', 'builderName', 'lifestyleKeywords', 'projectNames', 'riskProfile',
] as const

/** Compact previous-intent payload for the extraction prompt. */
export function slimIntentForPrompt(prev: Intent): string {
  const out: Record<string, unknown> = {}
  for (const k of PROMPT_INTENT_FIELDS) {
    const v = (prev as Record<string, unknown>)[k]
    if (v === undefined || v === null) continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return JSON.stringify(out)
}

/**
 * Strict parse: returns null when the provider's output was unusable (empty,
 * non-JSON, or schema-invalid) so the caller can roll over to the next provider.
 * A valid-but-empty `{}` is a legitimate result ("hello" → no constraints) and
 * returns a merged Intent, not null.
 */
export function tryParseIntentJson(raw: string, previous: Intent): Intent | null {
  if (!raw || !raw.trim()) return null

  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    const result = IntentSchema.safeParse(JSON.parse(match[0]))
    if (!result.success) {
      console.warn('[intent] schema mismatch:', result.error.message)
      return null
    }
    return mergeIntent(previous, result.data)
  } catch {
    return null
  }
}

/** Exported for unit testing only. Parses raw LLM JSON output into a merged Intent. */
export function parseIntentJson(raw: string, previous: Intent): Intent {
  return tryParseIntentJson(raw, previous) ?? previous
}

async function extractWithMistral(msg: string, prev: Intent, apiKey: string): Promise<Intent | null> {
  const { completeWithMistral } = await import('./mistral')
  const raw = await completeWithMistral(
    INTENT_EXTRACTION_PROMPT,
    `Previous intent: ${slimIntentForPrompt(prev)}\n\nUser message: ${msg}`,
    apiKey
  )
  return tryParseIntentJson(raw, prev)
}

async function extractWithGroqKey(msg: string, prev: Intent, apiKey: string, timeout = 8000): Promise<Intent | null> {
  const groq = new Groq({ apiKey, timeout })
  let raw = '{}'
  try {
    const completion = await groq.chat.completions.create({
      model: MODELS.GROQ_SMART,
      messages: [
        { role: 'system', content: INTENT_EXTRACTION_PROMPT },
        { role: 'user', content: `Previous intent: ${slimIntentForPrompt(prev)}\n\nUser message: ${msg}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 256,
      temperature: 0.1,
    })
    raw = completion.choices[0]?.message?.content ?? '{}'
  } catch (err) {
    const e = err as { status?: number; message?: string }
    if (e?.status === 429 || e?.message?.includes('rate_limit_exceeded') || e?.message?.includes('Rate limit reached')) {
      console.warn('[INTENT:GROQ] 70B rate limited, retrying intent with 8B instant model')
      const fallbackCompletion = await groq.chat.completions.create({
        model: MODELS.GROQ_FAST,
        messages: [
          { role: 'system', content: INTENT_EXTRACTION_PROMPT },
          { role: 'user', content: `Previous intent: ${slimIntentForPrompt(prev)}\n\nUser message: ${msg}` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 256,
        temperature: 0.1,
      })
      const fallbackRaw = fallbackCompletion.choices[0]?.message?.content
      if (!fallbackRaw || !fallbackRaw.trim()) {
        console.error('[INTENT:GROQ] Both GROQ models failed after rate limit')
        throw new Error('Both GROQ models failed after rate limit exceeded')
      }
      raw = fallbackRaw
    } else {
      throw err
    }
  }
  return tryParseIntentJson(raw, prev)
}

async function extractWithOpenAIKey(msg: string, prev: Intent, apiKey: string, signal: AbortSignal): Promise<Intent | null> {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://models.inference.ai.azure.com',
    maxRetries: 0,
  })
  const completion = await client.chat.completions.create(
    {
      model: MODELS.MAIN,
      messages: [
        { role: 'system', content: INTENT_EXTRACTION_PROMPT },
        { role: 'user', content: `Previous intent: ${slimIntentForPrompt(prev)}\n\nUser message: ${msg}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 256,
      temperature: 0.1,
    },
    { signal },
  )
  const raw = completion.choices[0]?.message?.content ?? '{}'
  return tryParseIntentJson(raw, prev)
}

export interface IntentResult {
  intent: Intent
  /** True when all providers failed and previousIntent was returned as fallback. */
  degraded: boolean
}

import { isKeyFailed, markKeyFailed } from './providerStatus'

import { GoogleGenAI } from '@google/genai'


/**
 * Words that are capitalised in a buyer's message but carry no intent.
 *
 * A capitalised token is the only cheap signal that a project or builder may be
 * named, since the heuristic above extracts no names. These are the ones that
 * appear constantly and mean nothing — the default city, the statute, the
 * acronyms — so they must not keep a no-signal message on the slow path.
 */
const CAPITALISED_NOISE = new Set([
  'i', 'noida', 'greater', 'delhi', 'ncr', 'india', 'up', 'rera', 'gst', 'emi',
  'bhk', 'sqft', 'rtm', 'nri', 'oc', 'cc', 'propfyndr', 'ai', 'okay', 'ok',
  'hi', 'hello', 'hey', 'thanks', 'thank', 'you', 'yes', 'no', 'what', 'why',
  'how', 'when', 'where', 'which', 'who', 'is', 'are', 'do', 'does', 'can',
  'should', 'the', 'a', 'an', 'my', 'me', 'we', 'it', 'and', 'or', 'but',
])

/**
 * Vocabulary that means the message carries something worth extracting.
 *
 * Money, size, place, timeline, purpose — plus the comparative and corrective
 * language that only makes sense against previous intent ("make that 2 crore",
 * "something bigger", "actually 3 BHK instead").
 */
const INTENT_SIGNAL_RE =
  /\d|₹|\b(crore|cr|lakh|lac|budget|price|priced|cost|afford|emi|loan|under|below|within|upto|up\s*to|over|above|between|bhk|bedroom|sqft|sq\.?\s*ft|square\s*feet|carpet|super\s*area|sector|expressway|extension|metro|near|nearby|around|possession|ready\s*to\s*move|rtm|immediate|asap|handover|invest|investment|rental|resale|bigger|smaller|larger|cheaper|costlier|pricier|closer|instead|actually|rather|more|less|other|another|different|else|change|make\s*that|update)\b/i

/**
 * Is there anything in this message for the extractor to find?
 *
 * `heuristicIsSufficient` asks "did the regexes GAIN a constraint", which is the
 * wrong question for a message that has no constraint in it. Measured: "hi" cost
 * 3,115ms of intent extraction, "explain capital gains tax on property sale"
 * 1,442ms and "what maintenance should I expect in Noida?" 1,345ms — every one
 * of them a full model round-trip that returned nothing, paid IN FRONT of the
 * answer call, so the buyer waited for it twice over.
 *
 * A message with no signal vocabulary, no digits and no meaningful capitalised
 * token cannot yield an intent, so the empty heuristic result is already the
 * right answer. This is safe for project names specifically because the router
 * matches those itself against the project catalogue after extraction and
 * overwrites `projectNames` — extraction is not what finds them.
 *
 * Long messages stay on the slow path: past ~12 words a buyer is describing a
 * situation, and the cost of missing a constraint there outweighs the latency.
 */
export function nothingToExtract(message: string): boolean {
  const text = (message ?? '').trim()
  if (!text) return true
  if (text.split(/\s+/).length > 12) return false
  if (INTENT_SIGNAL_RE.test(text)) return false

  // A capitalised token past the first word may be a project or builder we hold.
  const tokens = text.split(/\s+/).slice(1)
  const namesSomething = tokens.some((t) => {
    const bare = t.replace(/[^\p{L}\p{N}]/gu, '')
    return bare.length > 1 && /^\p{Lu}/u.test(bare) && !CAPITALISED_NOISE.has(bare.toLowerCase())
  })
  return !namesSomething
}

/**
 * Constraints the message states outright, applied over whatever the model said.
 *
 * The model may add — a purpose read from tone, a workplace, a correction like
 * "make that 2 crore" — but it may not contradict or erase a fact written in
 * the message. That is not a stylistic preference: measured live, "Compare
 * Sector 150 and Sector 137" came back from extraction as `{}`, the sticky
 * `intent.sector` from four turns earlier survived, and the buyer was answered
 * with a Sector 2 coverage reply. A sector the buyer typed in full is not the
 * model's to drop.
 *
 * Applied at every exit from `extractIntent`, including the degraded one, so no
 * provider path can bypass it.
 */
function applyLiterals(intent: Intent, deterministic: DeterministicIntent): Intent {
  const out = { ...intent } as Intent & Record<string, unknown>
  const lit = deterministic.literal

  if (lit.has('sector')) {
    out.sector = deterministic.sectors[0]
    // Both halves of a comparison, for the lanes that need the pair.
    ;(out as { sectorsMentioned?: string[] }).sectorsMentioned = deterministic.sectors
  }
  if (lit.has('bhk')) out.bhk = deterministic.bhk
  if (lit.has('budgetMin')) out.budgetMin = deterministic.budgetMin
  if (lit.has('budgetMax')) out.budgetMax = deterministic.budgetMax
  if (lit.has('possession')) out.possession = deterministic.possession as Intent['possession']
  if (lit.has('areaMin')) out.areaMin = deterministic.areaMin
  if (lit.has('areaMax')) out.areaMax = deterministic.areaMax

  return out
}

/**
 * Is there anything left for the model to find?
 *
 * Everything the deterministic pass reads is already read. What remains is
 * inference: a correction against previous intent, a purpose, a workplace, a
 * lifestyle preference, a named project or builder. When none of that
 * vocabulary is present, the round-trip buys nothing — and it is paid IN FRONT
 * of the answer call, so the buyer waits for it twice.
 */
const NEEDS_INFERENCE =
  /\b(instead|actually|rather|change|make\s+that|update|bigger|smaller|larger|cheaper|costlier|pricier|closer|nearer|other|another|different|else|prefer|want|need|work|office|commute|school|metro|park|gym|invest|investment|rental|yield|resale|end[- ]use|family|kids|children|parents|elderly|pet)\b/i

function deterministicCoversMessage(message: string, d: DeterministicIntent, previous: Intent): boolean {
  // A correction only means something against previous intent, and the model
  // is the only thing that can read one.
  if (Object.keys(previous ?? {}).length > 0 && NEEDS_INFERENCE.test(message)) return false
  if (NEEDS_INFERENCE.test(message)) return false
  // A capitalised run may be a project or builder; the model resolves those.
  if (/\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}/.test(message)) return false
  return d.literal.size > 0
}

export async function extractIntent(message: string, previousIntent: Intent): Promise<IntentResult> {
  /**
   * The deterministic pass runs on every turn, whatever happens next.
   *
   * It used to run only as a "fast path" that a long or comma-bearing message
   * disqualified, and `heuristicIsSufficient` gave up unconditionally once
   * previous intent existed — so from turn two onward every turn paid a model
   * round-trip AND lost the regex result. Now it always runs, and its findings
   * are re-applied over the model's answer at every exit below.
   */
  refreshKnownSectors()
  const deterministic = extractDeterministic(message, KNOWN_SECTOR_NUMBERS)

  if (process.env.INTENT_FAST_PATH !== 'false') {
    const heuristic = applyLiterals(extractIntentHeuristic(message, previousIntent), deterministic)
    if (deterministicCoversMessage(message, deterministic, previousIntent)) {
      console.log(`[INTENT:DETERMINISTIC] read outright, no model call — "${message.slice(0, 60)}"`)
      return { intent: heuristic, degraded: false }
    }
    // `heuristicIsSufficient` used to sit here. It asked "did the regexes gain
    // a constraint, and is the message simple enough to trust them" — two
    // guesses stacked, and it answered no for any message with a comma, "and"
    // or previous intent, which is most of them. `deterministicCoversMessage`
    // above answers the question that actually matters: is anything left that
    // only the model can read. Removed rather than left dormant; a dead gate
    // reads like a live one to whoever edits this next.
    if (nothingToExtract(message)) {
      console.log(`[INTENT:NO_SIGNAL] skipped extraction for "${message.slice(0, 60)}"`)
      return { intent: heuristic, degraded: false }
    }
  }

  /**
   * Intent extraction walks the same chain the answer does.
   *
   * This used to be a second, hand-written copy of the provider order, and it
   * had already drifted: it omitted `GEMINI_API_KEY1` entirely, so when the
   * billed Gemini key ran out of credits — which is its state today — intent
   * extraction skipped the working free-tier key and jumped to Mistral. It also
   * asked Cerebras for `llama3.3-70b` while the answer chain asked for
   * `gpt-oss-120b`, so the two could fail for different reasons on the same
   * outage. CLAUDE.md says the chain lives in one place; this derives from it.
   *
   * Only the timeout is intent-specific: extraction sits in front of the
   * answer, so a slow leg costs the buyer twice and is worth abandoning sooner.
   */
  const intentChain = FALLBACK_CHAIN.map((leg) => ({
    provider: leg.provider,
    envKey: leg.envKey,
    model: leg.model,
    timeout: leg.provider === 'gemini' ? 10_000 : 3_000,
  }))

  for (const config of intentChain) {
    if (isKeyFailed(config.envKey)) {
      console.log(`[INTENT:SKIP] ${config.provider}/${config.envKey} — blacklisted circuit breaker active`)
      continue
    }
    const apiKey = process.env[config.envKey]
    if (!apiKey) continue

    try {
      if (config.provider === 'gemini') {
        console.log(`[INTENT] Trying Gemini (${config.model}) via ${config.envKey}`)
        const client = meteredClient({ apiKey, endpoint: 'intent', timeoutMs: config.timeout })
        const res = await client.models.generateContent({
          model: config.model || 'gemini-3.6-flash',
          contents: [{ role: 'user', parts: [{ text: `Previous intent: ${slimIntentForPrompt(previousIntent)}\n\nUser message: ${message}` }] }],
          config: {
            systemInstruction: INTENT_EXTRACTION_PROMPT,
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        })
        const raw = res.text?.trim() ?? '{}'
        const result = tryParseIntentJson(raw, previousIntent)
        if (result) return { intent: applyLiterals(result, deterministic), degraded: false }
      }
      if (config.provider === 'groq') {
        console.log(`[INTENT] Trying Groq (${config.model}) via ${config.envKey}`)
        const result = await extractWithGroqKey(message, previousIntent, apiKey, config.timeout)
        if (result) return { intent: applyLiterals(result, deterministic), degraded: false }
      }
      if (config.provider === 'mistral') {
        console.log(`[INTENT] Trying Mistral via ${config.envKey}`)
        const result = await extractWithMistral(message, previousIntent, apiKey)
        if (result) return { intent: applyLiterals(result, deterministic), degraded: false }
      }
      if (config.provider === 'openai') {
        console.log(`[INTENT] Trying OpenAI via ${config.envKey}`)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), config.timeout)
        try {
          const result = await extractWithOpenAIKey(message, previousIntent, apiKey, controller.signal)
          clearTimeout(timer)
          if (result) return { intent: applyLiterals(result, deterministic), degraded: false }
        } catch (err) {
          clearTimeout(timer)
          const e = err as { status?: number; name?: string; message?: string }
          if (e?.status === 404 || e?.status === 401 || e?.status === 403 || e?.name === 'AbortError' || (e?.message || '').includes('404')) {
            markKeyFailed(config.envKey)
          }
          throw err
        }
      }
    } catch (err) {
      console.warn(`[INTENT] ${config.provider}/${config.envKey} failed:`, (err as Error)?.message || String(err))
    }
  }

  // All providers failed. Use heuristic pattern matching as last resort
  console.warn('[INTENT] All LLM providers failed or unconfigured — executing heuristic fallback')
  // Literals apply here too, and matter most here: this is the path where no
  // model ran at all, so the regex result is the entire answer.
  const heuristicIntent = applyLiterals(extractIntentHeuristic(message, previousIntent), deterministic)
  return { intent: heuristicIntent, degraded: true }
}

/**
 * Last-resort extraction when every LLM provider has failed. Exported so the
 * degraded path is directly testable — it is what buyers hit during an outage.
 */
export function extractIntentHeuristic(message: string, previousIntent: Intent): Intent {
  const fallback = { ...previousIntent }

  // BHK extraction
  const bhkMatch = message.match(/(\d)\s*(?:bhk|bed\s*room)/i)
  if (bhkMatch) {
    fallback.bhk = [parseInt(bhkMatch[1])]
  }

  // Budget extraction (handles crore, cr, lakh, lac)
  const budgetMatch = message.match(/(?:under|within|upto|up\s*to)?[\s]*₹?(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lac)/i)
  if (budgetMatch) {
    let value = parseFloat(budgetMatch[1])
    const unit = budgetMatch[2].toLowerCase()
    if (unit === 'lakh' || unit === 'lac') {
      value = value / 100 // Convert lakh to crore
    }
    fallback.budgetMax = value
  }

  // Sector extraction
  const sectorMatch = message.match(/sector\s+(\d+[a-z]*)/i)
  if (sectorMatch) {
    fallback.sector = normalizeSectorName(`Sector ${sectorMatch[1]}`)
  }

  // Possession/timeline extraction
  if (/ready\s*to\s*move|rtm|immediate|asap/i.test(message)) {
    fallback.possession = 'immediate'
  } else if (/within\s*1\s*year|1\s*year|next\s*year/i.test(message)) {
    fallback.possession = '1year'
  } else if (/within\s*2\s*year|2\s*year|in\s*2\s*year/i.test(message)) {
    fallback.possession = '2year'
  } else if (/within\s*3\s*year|3\s*year|in\s*3\s*year|long\s*term/i.test(message)) {
    fallback.possession = '3year+'
  }

  // Purpose extraction
  if (/invest|investment|appreciation|roi|returns|income/i.test(message)) {
    fallback.purpose = 'investment'
  } else if (/live|stay|own|occupy|home/i.test(message)) {
    fallback.purpose = 'endUse'
  }

  // Area range extraction
  const areaMatch = message.match(/(\d+)\s*(?:to|—|-)\s*(\d+)\s*(?:sq|sqft|sq\.\s*ft|square\s*feet)/i)
  if (areaMatch) {
    fallback.areaMin = parseInt(areaMatch[1])
    fallback.areaMax = parseInt(areaMatch[2])
  } else {
    const singleAreaMatch = message.match(/(?:about|around|approximately)\s*(\d+)\s*(?:sq|sqft|sq\.\s*ft|square\s*feet)/i)
    if (singleAreaMatch) {
      fallback.areaMin = parseInt(singleAreaMatch[1]) * 0.9
      fallback.areaMax = parseInt(singleAreaMatch[1]) * 1.1
    }
  }

  // Builder name extraction (basic pattern)
  const builderMatch = message.match(/(?:by|from|builder|developer)\s+([A-Z][a-zA-Z\s&]+?)(?:\s+(?:project|in|at|sector)|$)/i)
  if (builderMatch) {
    fallback.builderName = builderMatch[1].trim()
  }

  // Spatial scope detection: distinguish "in Sector X" (EXACT) vs "near Sector X" (PROXIMITY) vs "Noida" (BROAD)
  if (fallback.sector) {
    // Check for proximity keywords before the sector mention
    const proximityMatch = /\b(near|around|close\s+to|nearby|vicinity|adjacent\s+to)\s+/i.test(message)

    // For exact match, look around sector mention (before and after)
    const sectorIndex = message.toLowerCase().indexOf(fallback.sector.toLowerCase())
    const contextStart = Math.max(0, sectorIndex - 50)
    const contextEnd = Math.min(message.length, sectorIndex + fallback.sector.length + 30)
    const context = message.substring(contextStart, contextEnd)
    const exactMatch = /\b(in|at|inside)\s+/i.test(context)

    if (proximityMatch) {
      fallback.spatialScope = 'PROXIMITY'
      fallback.radiusKm = 3.5
    } else if (exactMatch) {
      fallback.spatialScope = 'EXACT'
    }
  } else if (/\b(noida|greater\s+noida|yamuna\s+expressway)\b/i.test(message)) {
    // City-level query without sector
    fallback.spatialScope = 'BROAD'
  }

  return fallback
}
