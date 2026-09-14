// backend/src/lib/ai/extendedIntent.ts
// Phase 1: Extended Intent Extraction for PropFyndr
// Captures all 11 buyer decision dimensions from natural language

import Groq from 'groq-sdk'
import { meteredClient } from './geminiMeter'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { MODELS } from '../config'
import type { Intent } from '../discovery'

// ============================================================================
// ENUMS: Buyer decision dimensions
// ============================================================================

export enum FamilyStage {
  SINGLE = 'single',
  COUPLE = 'couple',
  YOUNG_FAMILY = 'young_family', // young kids
  GROWING_FAMILY = 'growing_family', // school-age kids
  ESTABLISHED_FAMILY = 'established_family', // teenagers/adults
  ELDERLY_SUPPORT = 'elderly_support', // caring for parents
  MULTIGENERATIONAL = 'multigenerational', // multiple generations
}

export enum RiskTolerance {
  VERY_CONSERVATIVE = 'very_conservative', // no legal issues, only RERA, no disputes
  CONSERVATIVE = 'conservative', // prefers safe, RERA preferred, minimal risk
  MODERATE = 'moderate', // willing to accept some legal complexity if upside is clear
  AGGRESSIVE = 'aggressive', // willing to work through legal issues for value
}

export enum LifestylePriority {
  SUSTAINABILITY = 'sustainability',
  COMMUNITY = 'community',
  WELLNESS = 'wellness',
  LUXURY = 'luxury',
  PRACTICALITY = 'practicality',
  FAMILY = 'family',
}

export enum AirQualityPriority {
  CRITICAL = 'critical', // willing to pay premium for green zones
  HIGH = 'high', // prefers green areas
  MODERATE = 'moderate', // no strong preference
  LOW = 'low', // not a concern
}

export enum ParkingNeed {
  NOT_NEEDED = 'not_needed',
  ONE_SPACE = 'one_space',
  TWO_SPACES = 'two_spaces',
  MULTIPLE_SPACES = 'multiple_spaces',
  FLEX = 'flex', // doesn't care
}

export enum BalconyPreference {
  MUST_HAVE = 'must_have',
  PREFERRED = 'preferred',
  NICE_TO_HAVE = 'nice_to_have',
  NOT_NEEDED = 'not_needed',
}

export enum OrientationPreference {
  NORTH = 'north',
  SOUTH = 'south',
  EAST = 'east',
  WEST = 'west',
  SOUTHEAST = 'southeast',
  SOUTHWEST = 'southwest',
  NORTHEAST = 'northeast',
  NORTHWEST = 'northwest',
  FLEXIBLE = 'flexible',
}

export enum ConstructionStagePreference {
  PRE_LAUNCH = 'pre_launch',
  UNDER_CONSTRUCTION = 'under_construction',
  NEARING_COMPLETION = 'nearing_completion',
  READY_TO_MOVE = 'ready_to_move',
  ANY = 'any',
}

export enum PrimaryMotivation {
  LIVE_IN = 'live_in',
  INVESTMENT = 'investment',
  WEALTH_PRESERVATION = 'wealth_preservation',
  RESALE_POTENTIAL = 'resale_potential',
  RENTAL_INCOME = 'rental_income',
  TAX_BENEFITS = 'tax_benefits',
  FAMILY_OBLIGATION = 'family_obligation',
}

// ============================================================================
// ZODS: Schema validation
// ============================================================================

const ExtendedIntentSchema = z.object({
  // FINANCIAL DIMENSION
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  emiCapacity: z.number().optional(), // monthly EMI capacity in lakhs
  investmentVsPersonal: z.enum(['100_investment', '80_20', '60_40', '40_60', '20_80', '100_personal']).optional(),
  expectedROI: z.number().optional(), // annual ROI % expected

  // LOCATION DIMENSION
  sectorPreference: z.union([z.string(), z.array(z.string())]).optional().transform(v => Array.isArray(v) ? v[0] : v),
  metroDistance: z.number().optional(), // km
  commuteTo: z.string().optional(),
  schoolPriority: z.boolean().optional(),
  hospitalNeed: z.boolean().optional(),
  shopNeed: z.boolean().optional(),
  parkNeed: z.boolean().optional(),
  airQualityPriority: z.nativeEnum(AirQualityPriority).optional(),
  noiseTolerance: z.enum(['very_low', 'low', 'moderate', 'high']).optional(),

  // TIMELINE DIMENSION
  possessionUrgency: z.enum(['immediate', 'flexible', '6months', '1year', '18months', '2years', '3years']).optional(),
  constructionStagePreference: z.nativeEnum(ConstructionStagePreference).optional(),
  delayTolerance: z.enum(['none', 'low', 'moderate', 'high']).optional(),

  // SPECS DIMENSION
  bhk: z.array(z.number()).optional(),
  carpetAreaMin: z.number().optional(), // sqft
  carpetAreaMax: z.number().optional(),
  superAreaMin: z.number().optional(), // sqft
  superAreaMax: z.number().optional(),
  balconyPreference: z.nativeEnum(BalconyPreference).optional(),
  parkingNeeded: z.nativeEnum(ParkingNeed).optional(),
  orientationPreference: z.nativeEnum(OrientationPreference).optional(),

  // BUILDER DIMENSION
  builderReputationImportance: z.enum(['critical', 'high', 'moderate', 'low']).optional(),
  onTimeDeliveryRequired: z.boolean().optional(),
  litigationTolerance: z.enum(['zero', 'minimal', 'some', 'flexible']).optional(),

  // LEGAL DIMENSION
  reraComplianceMust: z.boolean().optional(),
  litigationMustBe0: z.boolean().optional(),
  nriEligible: z.boolean().optional(),

  // AMENITIES DIMENSION
  poolWanted: z.boolean().optional(),
  gymWanted: z.boolean().optional(),
  clubhouseWanted: z.boolean().optional(),
  gatedPreference: z.enum(['must_have', 'preferred', 'neutral', 'not_needed']).optional(),
  maintenanceCostTolerance: z.enum(['minimal', 'moderate', 'high', 'any']).optional(),

  // PRICING DIMENSION
  pricePerSqftMin: z.number().optional(),
  pricePerSqftMax: z.number().optional(),
  competitionAwareness: z.boolean().optional(),

  // PERSONAL DIMENSION
  familyStage: z.nativeEnum(FamilyStage).optional(),
  workLocation: z.string().optional(),
  lifestylePriority: z.nativeEnum(LifestylePriority).optional(),

  // DECISION DIMENSION
  primaryMotivation: z.nativeEnum(PrimaryMotivation).optional(),
  dealBreakers: z.array(z.string()).optional(),
  riskTolerance: z.nativeEnum(RiskTolerance).optional(),
  decisionTimeline: z.enum(['urgent', '1month', '3months', '6months', 'flexible']).optional(),

  // GAPS DIMENSION
  resaleLockInTolerance: z.number().optional(), // years
  rentalRestrictionTolerance: z.boolean().optional(),
  vastuPreference: z.boolean().optional(),
})

export type ExtendedIntentType = z.infer<typeof ExtendedIntentSchema>

// ============================================================================
// INTERFACE: ExtendedIntent with confidence scores
// ============================================================================

export interface ExtendedIntentWithConfidence extends ExtendedIntentType {
  _meta?: {
    // Confidence scores: 0-100 for each dimension
    // 0 = not mentioned/guessed, 100 = explicitly stated
    budgetConfidence?: number
    locationConfidence?: number
    timelineConfidence?: number
    specsConfidence?: number
    builderConfidence?: number
    legalConfidence?: number
    amenitiesConfidence?: number
    pricingConfidence?: number
    personalConfidence?: number
    decisionConfidence?: number
    gapConfidence?: number

    // Flags
    isInferredBudget?: boolean
    isInferredFamily?: boolean
    isInferredPurpose?: boolean
    extractionModel?: string
    extractionTimestampMs?: number
  }
}

export type ExtendedIntent = ExtendedIntentWithConfidence;

// ============================================================================
// PROMPT TEMPLATE
// ============================================================================

const EXTENDED_INTENT_EXTRACTION_PROMPT = `You are an expert real estate advisor analyzing buyer intent. Extract ALL available information about the buyer's decision criteria from their message.

IMPORTANT RULES:
1. For EVERY field: return the value ONLY if explicitly mentioned or strongly inferred. Use null for fields not mentioned.
2. Return ONLY valid JSON. No markdown, no explanation.
3. Confidence scores indicate how certain you are (0 = not mentioned, 100 = explicitly stated).
4. When multiple values are possible (e.g., "2 or 3 BHK"), include all options.
5. familyStage: Infer from: kids mention, parents mention, retirement, "first-time buyer", household size hints.
6. dealBreakers: List any must-avoid conditions mentioned (e.g., "no disputes", "no construction delays", "only RERA").
7. possessionUrgency: "immediate" = ready-to-move/ready-possession, "flexible" = no timeline mentioned.
8. investmentVsPersonal: 100_investment = buying only for investment, 100_personal = buying to live in.
9. For city queries: DO NOT force sector/location details if user hasn't specified them.
10. Return empty {} if the message is off-topic (stamp duty, how to get loan, general advice).

OUTPUT SCHEMA (all fields optional, use null if not mentioned):
{
  "budgetMin": number|null,
  "budgetMax": number|null,
  "emiCapacity": number|null,
  "investmentVsPersonal": "100_investment"|"80_20"|"60_40"|"40_60"|"20_80"|"100_personal"|null,
  "expectedROI": number|null,

  "sectorPreference": string|null,
  "metroDistance": number|null,
  "commuteTo": string|null,
  "schoolPriority": boolean|null,
  "hospitalNeed": boolean|null,
  "shopNeed": boolean|null,
  "parkNeed": boolean|null,
  "airQualityPriority": "critical"|"high"|"moderate"|"low"|null,
  "noiseTolerance": "very_low"|"low"|"moderate"|"high"|null,

  "possessionUrgency": "immediate"|"flexible"|"6months"|"1year"|"18months"|"2years"|"3years"|null,
  "constructionStagePreference": "pre_launch"|"under_construction"|"nearing_completion"|"ready_to_move"|"any"|null,
  "delayTolerance": "none"|"low"|"moderate"|"high"|null,

  "bhk": number[]|null,
  "carpetAreaMin": number|null,
  "carpetAreaMax": number|null,
  "superAreaMin": number|null,
  "superAreaMax": number|null,
  "balconyPreference": "must_have"|"preferred"|"nice_to_have"|"not_needed"|null,
  "parkingNeeded": "not_needed"|"one_space"|"two_spaces"|"multiple_spaces"|"flex"|null,
  "orientationPreference": "north"|"south"|"east"|"west"|"flexible"|null,

  "builderReputationImportance": "critical"|"high"|"moderate"|"low"|null,
  "onTimeDeliveryRequired": boolean|null,
  "litigationTolerance": "zero"|"minimal"|"some"|"flexible"|null,

  "reraComplianceMust": boolean|null,
  "litigationMustBe0": boolean|null,
  "nriEligible": boolean|null,

  "poolWanted": boolean|null,
  "gymWanted": boolean|null,
  "clubhouseWanted": boolean|null,
  "gatedPreference": "must_have"|"preferred"|"neutral"|"not_needed"|null,
  "maintenanceCostTolerance": "minimal"|"moderate"|"high"|"any"|null,

  "pricePerSqftMin": number|null,
  "pricePerSqftMax": number|null,
  "competitionAwareness": boolean|null,

  "familyStage": "single"|"couple"|"young_family"|"growing_family"|"established_family"|"elderly_support"|"multigenerational"|null,
  "workLocation": string|null,
  "lifestylePriority": "sustainability"|"community"|"wellness"|"luxury"|"practicality"|"family"|null,

  "primaryMotivation": "live_in"|"investment"|"wealth_preservation"|"resale_potential"|"rental_income"|"tax_benefits"|"family_obligation"|null,
  "dealBreakers": string[]|null,
  "riskTolerance": "very_conservative"|"conservative"|"moderate"|"aggressive"|null,
  "decisionTimeline": "urgent"|"1month"|"3months"|"6months"|"flexible"|null,

  "resaleLockInTolerance": number|null,
  "rentalRestrictionTolerance": boolean|null,
  "vastuPreference": boolean|null
}

EXAMPLES:

Input: "show me 2BHK in sector 150 under 1.5 crore"
Output: {
  "bhk": [2],
  "sectorPreference": "Sector 150",
  "budgetMax": 1.5,
  "possessionUrgency": null,
  "familyStage": null
}

Input: "3BHK for my family near metro, budget 2 crore, immediate possession needed"
Output: {
  "bhk": [3],
  "budgetMax": 2,
  "possessionUrgency": "immediate",
  "metroDistance": 0,
  "familyStage": "young_family",
  "schoolPriority": true,
  "parkNeed": true,
  "investmentVsPersonal": "100_personal"
}

Input: "NRI investor looking for 2-3 BHK investment in Noida, 1.5-2 crore, minimum 8% annual returns"
Output: {
  "bhk": [2, 3],
  "budgetMin": 1.5,
  "budgetMax": 2,
  "investmentVsPersonal": "100_investment",
  "expectedROI": 8,
  "nriEligible": true,
  "primaryMotivation": "rental_income"
}

Input: "retired, want peaceful 2BHK ready to move, no legal issues, only RERA compliant projects"
Output: {
  "bhk": [2],
  "possessionUrgency": "immediate",
  "familyStage": null,
  "reraComplianceMust": true,
  "litigationMustBe0": true,
  "riskTolerance": "very_conservative",
  "noiseTolerance": "low",
  "investmentVsPersonal": "100_personal"
}

Input: "what is stamp duty"
Output: {}
`

// ============================================================================
// EXTRACTION FUNCTION: Main entry point
// ============================================================================

export interface ExtendedIntentExtractionOptions {
  userMessage: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  previousIntent?: ExtendedIntentWithConfidence
}

async function extractWithGroq(
  message: string,
  previousIntent: ExtendedIntentWithConfidence | undefined,
): Promise<ExtendedIntentWithConfidence> {
  console.log('[EXTENDED_INTENT] START extractWithGroq', Date.now())
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY!, timeout: 15000 })

  const userContent = previousIntent
    ? `Previous intent: ${JSON.stringify(previousIntent)}\n\nNew user message: ${message}`
    : `User message: ${message}`

  let completion
  try {
    completion = await groq.chat.completions.create({
      model: MODELS.GROQ_SMART,
      messages: [
        { role: 'system', content: EXTENDED_INTENT_EXTRACTION_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 512,
      temperature: 0.1,
    })
  } catch (err: any) {
    if (err?.status === 404 || err?.message?.includes('does not exist') || err?.message?.includes('model_not_found')) {
      console.log('[EXTENDED_INTENT] GROQ_SMART 404, falling back to GROQ_FAST:', MODELS.GROQ_FAST)
      completion = await groq.chat.completions.create({
        model: MODELS.GROQ_FAST,
        messages: [
          { role: 'system', content: EXTENDED_INTENT_EXTRACTION_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 512,
        temperature: 0.1,
      })
    } else {
      throw err
    }
  }

  console.log('[EXTENDED_INTENT] END extractWithGroq', Date.now())
  const raw = completion.choices[0]?.message?.content ?? '{}'
  return parseExtendedIntentJson(raw, previousIntent, 'groq')
}



async function extractWithGemini(
  message: string,
  previousIntent: ExtendedIntentWithConfidence | undefined,
): Promise<ExtendedIntentWithConfidence> {
  console.log('[EXTENDED_INTENT] START extractWithGemini', Date.now())
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('No GEMINI_API_KEY')
  const client = meteredClient({ apiKey, endpoint: 'extended-intent' })

  const userContent = previousIntent
    ? `Previous intent: ${JSON.stringify(previousIntent)}\n\nNew user message: ${message}`
    : `User message: ${message}`

  const response = await client.models.generateContent({
    model: MODELS.GEMINI_MAIN || 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    config: {
      systemInstruction: EXTENDED_INTENT_EXTRACTION_PROMPT,
      responseMimeType: 'application/json',
      maxOutputTokens: 512,
      temperature: 0.1,
    } as any,
  })

  console.log('[EXTENDED_INTENT] END extractWithGemini', Date.now())
  const raw = response.text || '{}'
  return parseExtendedIntentJson(raw, previousIntent, 'gemini')
}



async function extractWithMistral(
  message: string,
  previousIntent: ExtendedIntentWithConfidence | undefined,
): Promise<ExtendedIntentWithConfidence> {
  console.log('[EXTENDED_INTENT] START extractWithMistral', Date.now())
  const client = new OpenAI({
    apiKey: process.env.MISTRAL_API_KEY,
    baseURL: 'https://api.mistral.ai/v1',
    timeout: 10000,
  })

  const userContent = previousIntent
    ? `Previous intent: ${JSON.stringify(previousIntent)}\n\nNew user message: ${message}`
    : `User message: ${message}`

  const completion = await client.chat.completions.create({
    model: 'mistral-small-latest',
    messages: [
      { role: 'system', content: EXTENDED_INTENT_EXTRACTION_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 512,
    temperature: 0.1,
  })

  console.log('[EXTENDED_INTENT] END extractWithMistral', Date.now())
  const raw = completion.choices[0]?.message?.content ?? '{}'
  return parseExtendedIntentJson(raw, previousIntent, 'mistral')
}

/** Parse raw LLM JSON output into ExtendedIntentWithConfidence. */
function parseExtendedIntentJson(
  raw: string,
  previousIntent: ExtendedIntentWithConfidence | undefined,
  model: string,
): ExtendedIntentWithConfidence {
  if (!raw || !raw.trim()) {
    return mergeExtendedIntent(previousIntent, {})
  }

  const match = raw.match(/\{[\s\S]*\}/)
  const str = match ? match[0] : '{}'

  try {
    const parsed = JSON.parse(str)

    // Models emit `"field": null` to mean "not specified", but ExtendedIntentSchema
    // uses bare enums with no .nullable(). A single null therefore failed the WHOLE
    // parse and dropped all 11 dimensions to the regex fallback — which is why
    // sectorPreference and friends were always undefined in practice. Null means
    // absent; strip before validating. (Same defect class as the legacy
    // IntentSchema null handling in ai/intent.ts.)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const k of Object.keys(parsed)) {
        if (parsed[k] === null) delete parsed[k]
      }
    }

    const result = ExtendedIntentSchema.safeParse(parsed)

    if (!result.success) {
      console.warn('[extended_intent] schema validation failed:', result.error.message)
      return mergeExtendedIntent(previousIntent, {})
    }

    const intent = result.data as ExtendedIntentWithConfidence

    // Compute confidence scores
    intent._meta = {
      budgetConfidence: computed(intent.budgetMin !== undefined || intent.budgetMax !== undefined),
      locationConfidence: computed(
        intent.sectorPreference !== undefined ||
          intent.metroDistance !== undefined ||
          intent.commuteTo !== undefined,
      ),
      timelineConfidence: computed(intent.possessionUrgency !== undefined),
      specsConfidence: computed(intent.bhk !== undefined || intent.carpetAreaMin !== undefined),
      builderConfidence: computed(intent.builderReputationImportance !== undefined),
      legalConfidence: computed(intent.reraComplianceMust !== undefined),
      amenitiesConfidence: computed(
        intent.poolWanted !== undefined ||
          intent.gymWanted !== undefined ||
          intent.clubhouseWanted !== undefined,
      ),
      pricingConfidence: computed(intent.pricePerSqftMin !== undefined),
      personalConfidence: computed(intent.familyStage !== undefined || intent.workLocation !== undefined),
      decisionConfidence: computed(intent.primaryMotivation !== undefined || intent.dealBreakers !== undefined),
      gapConfidence: computed(intent.resaleLockInTolerance !== undefined),
      extractionModel: model,
      extractionTimestampMs: Date.now(),
    }

    return mergeExtendedIntent(previousIntent, intent)
  } catch (err) {
    console.warn('[extended_intent] JSON parse failed:', (err as Error).message)
    return mergeExtendedIntent(previousIntent, {})
  }
}

/** Merge extracted intent with previous intent. */
function mergeExtendedIntent(
  previous: ExtendedIntentWithConfidence | undefined,
  update: Partial<ExtendedIntentWithConfidence>,
): ExtendedIntentWithConfidence {
  if (!previous) {
    return update as ExtendedIntentWithConfidence
  }

  const result = {
    ...previous,
    ...Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)),
  } as ExtendedIntentWithConfidence

  console.log('[EXTENDED_INTENT:MERGE]', JSON.stringify({ previous, update, result }))
  return result
}

/** Compute confidence: boolean true (field was provided) -> 100, false -> 0. */
function computed(provided: boolean): number {
  return provided ? 100 : 0
}

export interface ExtendedIntentResult {
  intent: ExtendedIntentWithConfidence
  /** True when all providers failed and previousIntent was returned as fallback. */
  degraded: boolean
}

import { isKeyFailed, markKeyFailed } from './providerStatus'

/** Main entry point for extended intent extraction. */
export async function extractExtendedIntent(
  options: ExtendedIntentExtractionOptions,
): Promise<ExtendedIntentResult> {
  const { userMessage, previousIntent } = options

  // 1. PRIMARY: Google Gemini 2.0 Flash (Paid, high throughput, zero rate limits)
  if (process.env.GEMINI_API_KEY && !isKeyFailed('GEMINI_API_KEY')) {
    try {
      console.log('[EXTENDED_INTENT] trying Gemini path', Date.now())
      const result = await extractWithGemini(userMessage, previousIntent)
      console.log('[EXTENDED_INTENT] Gemini path succeeded', Date.now(), { result })
      return { intent: result, degraded: false }
    } catch (err) {
      console.warn('[extended_intent] Gemini failed, trying Mistral:', (err as Error).message)
    }
  }

  // The Cerebras step that used to be 2 is gone with its keys. Both returned
  // 402 on every probe across three days, and it sat between Gemini and
  // Mistral — so every extraction that got past Gemini paid a round-trip to a
  // provider with no balance before reaching one that works. It also pinned
  // `llama-3.3-70b`, which Cerebras had already retired.

  // 3. Mistral
  if (process.env.MISTRAL_API_KEY) {
    try {
      console.log('[EXTENDED_INTENT] trying Mistral path', Date.now())
      const result = await extractWithMistral(userMessage, previousIntent)
      console.log('[EXTENDED_INTENT] Mistral path succeeded', Date.now(), { result })
      return { intent: result, degraded: false }
    } catch (err) {
      console.warn('[extended_intent] Mistral failed, trying Groq:', (err as Error).message)
    }
  }

  // 4. Groq
  if (process.env.GROQ_API_KEY) {
    try {
      console.log('[EXTENDED_INTENT] trying Groq path', Date.now())
      const result = await extractWithGroq(userMessage, previousIntent)
      console.log('[EXTENDED_INTENT] Groq path succeeded', Date.now(), { result })
      return { intent: result, degraded: false }
    } catch (err) {
      console.warn('[extended_intent] Groq failed:', (err as Error).message)
    }
  }

  // The OpenAI step that used to be 5 is gone, along with extractWithOpenAI.
  // It was hardwired to `models.inference.ai.azure.com` — a host that no
  // longer resolves — with a GitHub Models PAT, for a service retired on
  // 30 Jul 2026. It could only fail, and it sat on the last hop before the
  // deterministic fallback, so every fully-degraded turn paid a DNS timeout
  // to learn what was already known at boot.

  // All providers failed — return rule-based fallback
  console.error('[extended_intent] all providers failed, returning degraded fallback')
  const fallback = extractDeterministicFallback(userMessage, previousIntent)
  return { intent: fallback, degraded: true }
}

/** Lightweight regex fallback when all LLM providers fail or rate-limit. */
function extractDeterministicFallback(
  userMessage: string,
  previousIntent?: ExtendedIntentWithConfidence
): ExtendedIntentWithConfidence {
  const msg = userMessage.toLowerCase()
  const base: ExtendedIntentWithConfidence = previousIntent
    ? JSON.parse(JSON.stringify(previousIntent))
    : ({ _meta: { budgetConfidence: 50, locationConfidence: 50, specsConfidence: 50, timelineConfidence: 50 } } as ExtendedIntentWithConfidence)

  // Budget
  const budgetMatch = msg.match(/(?:under|below|max|budget)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(cr|crore|lakh|lakhs)?/i)
  if (budgetMatch) {
    const val = parseFloat(budgetMatch[1])
    const unit = (budgetMatch[2] || '').toLowerCase()
    const inCr = unit.startsWith('lakh') ? val / 100 : val
    base.budgetMax = inCr
    if (!base._meta) base._meta = {}
    base._meta.budgetConfidence = 75
  }

  // BHK
  const bhkMatch = msg.match(/(\d+)\s*bhk/i)
  if (bhkMatch) {
    base.bhk = [parseInt(bhkMatch[1], 10)]
    if (!base._meta) base._meta = {}
    base._meta.specsConfidence = 80
  }

  // Location / School / Metro
  if (msg.includes('school')) {
    base.schoolPriority = true
    if (!base._meta) base._meta = {}
    base._meta.locationConfidence = 75
  }
  if (msg.includes('metro')) {
    base.metroDistance = 1.0
    if (!base._meta) base._meta = {}
    base._meta.locationConfidence = 75
  }

  // Timeline
  if (msg.includes('ready') || msg.includes('month') || msg.includes('possession')) {
    base.possessionUrgency = 'immediate'
    if (!base._meta) base._meta = {}
    base._meta.timelineConfidence = 75
  }

  return base
}

// ============================================================================
// UTILITY: Convert ExtendedIntent to legacy Intent for backward compatibility
// ============================================================================

/** Map ExtendedIntentWithConfidence back to legacy Intent shape for existing search code. */
export function mapExtendedIntentToLegacy(extended: ExtendedIntentWithConfidence): Intent {
  return {
    bhk: extended.bhk,
    budgetMin: extended.budgetMin,
    budgetMax: extended.budgetMax,
    possession: extended.possessionUrgency === 'immediate' ? 'immediate' : undefined,
    sector: extended.sectorPreference,
    areaMin: extended.carpetAreaMin,
    areaMax: extended.carpetAreaMax,
    purpose: extended.investmentVsPersonal?.startsWith('100_investment') ? 'investment' : 'endUse',
    builderName: undefined, // Not in extended intent directly
    lifestyleKeywords: buildLifestyleKeywords(extended),
    projectNames: undefined, // Not in extended intent
    riskProfile: mapRiskTolerance(extended.riskTolerance),
    is_comparison_query: undefined, // Not in extended intent
    legal_check: extended._meta?.legalConfidence !== undefined ? extended._meta.legalConfidence > 0 : undefined,
  }
}

/** Build lifestyle keywords from extended intent amenities and preferences. */
function buildLifestyleKeywords(extended: ExtendedIntentWithConfidence): string[] | undefined {
  const keywords: string[] = []

  if (extended.schoolPriority) keywords.push('school')
  if (extended.parkNeed) keywords.push('park', 'playground', 'sports')
  if (extended.familyStage === FamilyStage.YOUNG_FAMILY) keywords.push('playground', 'pool', 'park')
  if (extended.metroDistance !== undefined && extended.metroDistance < 2) keywords.push('metro')
  if (extended.gymWanted) keywords.push('gym', 'fitness')
  if (extended.poolWanted) keywords.push('pool')
  if (extended.clubhouseWanted) keywords.push('clubhouse')
  if (extended.noiseTolerance === 'very_low' || extended.noiseTolerance === 'low') {
    keywords.push('gated', 'low_density')
  }
  if (extended.lifestylePriority === LifestylePriority.WELLNESS) keywords.push('gym', 'park', 'pool')
  if (extended.lifestylePriority === LifestylePriority.FAMILY) {
    keywords.push('playground', 'school', 'park', 'pool')
  }

  return keywords.length > 0 ? keywords : undefined
}

/** Map extended RiskTolerance to legacy riskProfile. */
function mapRiskTolerance(risk: RiskTolerance | undefined): Intent['riskProfile'] {
  switch (risk) {
    case RiskTolerance.VERY_CONSERVATIVE:
      return 'risk_averse'
    case RiskTolerance.CONSERVATIVE:
      return 'risk_averse'
    default:
      return undefined
  }
}
