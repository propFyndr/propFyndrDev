// backend/src/lib/discovery/requirementState.ts
//
// Authoritative 38-parameter RequirementState engine.
// Governs normalization, linguistic hard vs soft classification,
// multi-turn state mutation, and exploratory intent detection.
// Compliant with Section 1 of RealtyPals_Beta_RedTeam_Processing_Spec.md.

import { z } from 'zod'
import { detectCommuteAnchor, beltFor } from './commuteAnchor'
import { normalizeSectorName } from '../ai/intent'
import type { Intent } from './types'

export const INTENT_MODES = [
  'DISCOVER',
  'SEARCH',
  'REFINE',
  'COMPARE',
  'EXPLAIN',
  'DUE_DILIGENCE',
  'FINANCE',
  'MARKET_RESEARCH',
  'EVIDENCE',
  'SECURITY_ADVERSARIAL',
  'REFERENCE',
] as const

export type IntentMode = (typeof INTENT_MODES)[number]

export const CommuteTargetSchema = z.object({
  destination: z.string(),
  role: z.string().default('workplace'),
  maxTimeMinutes: z.number().optional(),
  trafficContext: z.enum(['normal', 'peak', 'bad_traffic', 'live']).default('peak'),
  belt: z.array(z.string()).default([]),
})

export const LocationRequirementSchema = z.object({
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  softPreferences: z.array(z.string()).default([]),
})

export const BudgetRequirementSchema = z.object({
  minCr: z.number().min(0).optional(),
  maxCr: z.number().min(0).optional(),
  isHardCeiling: z.boolean().default(false),
  costType: z.enum(['base_price', 'all_in']).default('base_price'),
  cashInHandLakhs: z.number().min(0).optional(),
  maxEmiMonthly: z.number().min(0).optional(),
  downPaymentLakhs: z.number().min(0).optional(),
  loanTenureYears: z.number().min(1).max(30).optional(),
  interestRatePct: z.number().min(1).max(20).optional(),
})

export const UnitRequirementSchema = z.object({
  propertyType: z.enum(['apartment', 'villa', 'plot', 'commercial', 'any']).default('apartment'),
  bhk: z.array(z.number().int().min(1).max(10)).default([]),
  isBhkHard: z.boolean().default(false),
  minCarpetSqft: z.number().min(0).optional(),
  maxCarpetSqft: z.number().min(0).optional(),
  isCarpetHard: z.boolean().default(false),
  status: z.enum(['ready_to_move', 'under_construction', 'possession_window', 'any']).default('any'),
  isStatusHard: z.boolean().default(false),
  possessionDeadlineYears: z.number().min(0).max(10).optional(),
  maxAgeYears: z.number().min(0).max(50).optional(),
  floorPreference: z.enum(['low', 'mid', 'high', 'ground', 'top', 'any']).default('any'),
  excludedFloors: z.array(z.string()).default([]),
})

export const PreferencesRequirementSchema = z.object({
  isLuxuryPreferred: z.boolean().default(false),
  requiredAmenities: z.array(z.string()).default([]),
  preferredAmenities: z.array(z.string()).default([]),
  negativePreferences: z.array(z.string()).default([]),
  densityTolerance: z.enum(['low_density', 'medium_density', 'any']).default('any'),
  useCase: z.enum(['self_use', 'investment', 'mixed', 'unknown']).default('unknown'),
  investmentGoal: z.array(z.string()).default([]),
  familyContext: z.array(z.string()).default([]),
})

export const ControlRequirementSchema = z.object({
  hasExploratoryQuestion: z.boolean().default(false),
  requiresClarification: z.boolean().default(false),
  clarificationPrompt: z.string().optional(),
  unknowns: z.array(z.string()).default([]),
  ambiguities: z.array(z.string()).default([]),
  referenceEntities: z.array(z.string()).default([]),
})

export const RequirementStateSchema = z.object({
  intentModes: z.array(z.enum(INTENT_MODES)).default(['SEARCH']),
  location: LocationRequirementSchema.default({}),
  commute: z.array(CommuteTargetSchema).default([]),
  budget: BudgetRequirementSchema.default({}),
  unit: UnitRequirementSchema.default({}),
  preferences: PreferencesRequirementSchema.default({}),
  control: ControlRequirementSchema.default({}),
})

export type RequirementState = z.infer<typeof RequirementStateSchema>

// Linguistic indicator regexes
const HARD_BUDGET_INDICATORS = /\b(?:under|max|maximum|absolute\s+max(?:imum)?|cannot\s+exceed|not\s+more\s+than|within|cap\s+at)\b/i
const SOFT_BUDGET_INDICATORS = /\b(?:around|approx(?:imately)?|roughly|maybe|target|about|flexible)\b/i

const HARD_BHK_INDICATORS = /\b(?:must\s+be|strictly|only|need\s+a|require\s+a)\s+(\d)\s*bhk\b/i
const SOFT_BHK_INDICATORS = /\b(?:maybe|preferably|or|not\s+sure|thinking\s+of|considering)\s+(?:a\s+)?(\d)\s*bhk\b/i

const EXPLORATORY_PHRASES = [
  /what\s+should\s+i\s+(?:actually\s+)?(?:be\s+)?looking\s+for/i,
  /what\s+do\s+you\s+suggest/i,
  /where\s+should\s+i\s+start/i,
  /guide\s+me/i,
  /help\s+me\s+decide/i,
  /how\s+should\s+i\s+plan/i,
  /confused\s+between/i,
  /what\s+would\s+you\s+recommend/i,
]

const ALL_IN_COST_PHRASES = /\b(?:all[- ]?in|total\s+(?:cost|outflow|budget)|including\s+everything|inclusive\s+of\s+taxes|registration\s+included)\b/i

const READY_TO_MOVE_PHRASES = /\b(?:ready\s+to\s+move|rtm|immediate\s+possession|no\s+construction\s+delay|already\s+built)\b/i
const UNDER_CONSTRUCTION_PHRASES = /\b(?:under\s+construction|new\s+launch|upcoming|possession\s+in\s+\d+\s+years?)\b/i

const EXCLUSION_PATTERNS = [
  /\b(?:avoid|exclude|no|not|except|stay\s+away\s+from)\s+(?:in\s+)?(sector\s*\d{1,3}[a-d]?|expressway|central\s+noida)/gi,
]

/**
 * Normalizes user text and existing partial Intent into an immutable RequirementState.
 */
export function normalizeRequirementState(
  rawText: string,
  intent: Partial<Intent> = {},
  prevState?: Partial<RequirementState>,
): RequirementState {
  const text = (rawText || '').trim()

  // 1. Detect Intent Modes
  const modes: IntentMode[] = []
  if (/compare|vs|versus|difference\s+between/i.test(text)) modes.push('COMPARE')
  if (/rera|legal|litigation|complaint|delay|builder\s+track\s+record|oc|cc/i.test(text)) modes.push('DUE_DILIGENCE')
  if (/emi|loan|interest|stamp\s+duty|tax|all[- ]?in|cost\s+sheet|possession\s+charges/i.test(text)) modes.push('FINANCE')
  if (/why\s+is|why\s+did|explain|trend|market|master\s+plan/i.test(text)) modes.push('EXPLAIN')
  if (/how\s+do\s+you\s+know|source|proof|evidence|verify/i.test(text)) modes.push('EVIDENCE')
  if (/ignore\s+(?:all\s+)?previous|system\s+prompt|dan\s+mode|override\s+rule/i.test(text)) modes.push('SECURITY_ADVERSARIAL')

  // Check exploratory inquiry
  const hasExploratory = EXPLORATORY_PHRASES.some((rx) => rx.test(text))
  if (hasExploratory || /\b(?:don't\s+necessarily\s+need\s+to\s+spend|not\s+sure)\b/i.test(text)) {
    modes.push('DISCOVER')
  } else if (modes.length === 0) {
    modes.push('SEARCH')
  }

  // 2. Commute Anchor Detection
  const commuteTargets: z.infer<typeof CommuteTargetSchema>[] = []
  const detectedAnchor = detectCommuteAnchor(text)
  if (detectedAnchor) {
    commuteTargets.push({
      destination: detectedAnchor.place,
      role: 'workplace',
      trafficContext: 'peak',
      belt: detectedAnchor.belt || beltFor(detectedAnchor.place),
    })
  } else if (prevState?.commute && prevState.commute.length > 0) {
    commuteTargets.push(...prevState.commute)
  }

  // 3. Location Requirements
  const includeLocations: string[] = []
  const excludeLocations: string[] = []
  const softLocationPreferences: string[] = []

  // Check exclusions
  for (const rx of EXCLUSION_PATTERNS) {
    let match: RegExpExecArray | null
    while ((match = rx.exec(text)) !== null) {
      if (match[1]) {
        const norm = normalizeSectorName(match[1]) || match[1]
        excludeLocations.push(norm)
      }
    }
  }

  // If a sector was identified in intent or text, check if it's the workplace
  let targetSector = intent.sector
  if (!targetSector) {
    const secMatch = /\bsector\s*[-\s]?(\d{1,3}\s*[a-d]?)\b/i.exec(text)
    if (secMatch) {
      targetSector = `Sector ${secMatch[1].replace(/\s+/g, '').toUpperCase()}`
    } else if (/\bcentral\s+noida\b/i.test(text)) {
      targetSector = 'Central Noida'
    } else if (/\bexpressway\b/i.test(text)) {
      targetSector = 'Noida Expressway'
    }
  }

  if (targetSector) {
    const normTarget = normalizeSectorName(targetSector) || targetSector
    // CRITICAL: A workplace destination is NEVER a home living location!
    const isWorkplace = commuteTargets.some((c) => c.destination === normTarget)
    const isExcluded = excludeLocations.includes(normTarget)

    if (!isWorkplace && !isExcluded) {
      if (/\b(?:preferably|ideally|first\s+preference|around)\b/i.test(text)) {
        softLocationPreferences.push(normTarget)
      } else {
        includeLocations.push(normTarget)
      }
    }
  } else if (prevState?.location) {
    includeLocations.push(...prevState.location.include)
    excludeLocations.push(...prevState.location.exclude)
    softLocationPreferences.push(...prevState.location.softPreferences)
  }

  // 4. Budget Requirements
  let maxCr = typeof intent.budgetMax === 'number' ? intent.budgetMax : undefined
  let minCr = typeof intent.budgetMin === 'number' ? intent.budgetMin : undefined

  // Parse ₹ numbers if missing from intent
  if (maxCr === undefined) {
    const crMatch = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)\b/i.exec(text)
    if (crMatch) {
      maxCr = parseFloat(crMatch[1])
    } else {
      const lakhMatch = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh?s?|lac?s?)\b/i.exec(text)
      if (lakhMatch) {
        maxCr = parseFloat(lakhMatch[1]) / 100
      }
    }
  }

  // Hard vs Soft Budget Classification
  let isHardCeiling = false
  if (maxCr !== undefined) {
    if (HARD_BUDGET_INDICATORS.test(text)) {
      isHardCeiling = true
    } else if (SOFT_BUDGET_INDICATORS.test(text)) {
      isHardCeiling = false
    } else {
      // Default: If stated as a plain ceiling without qualifiers, treat as hard ceiling
      isHardCeiling = !/\b(?:around|maybe|not\s+necessarily)\b/i.test(text)
    }
  }

  const isAllIn = ALL_IN_COST_PHRASES.test(text)

  // 5. Unit Requirements (BHK, Carpet Area, Status)
  let bhkList: number[] = Array.isArray(intent.bhk) ? [...intent.bhk] : []
  if (bhkList.length === 0) {
    const bhkMatch = /\b(\d)\s*bhk\b/i.exec(text)
    if (bhkMatch) {
      bhkList = [parseInt(bhkMatch[1], 10)]
    }
  }

  let isBhkHard = true
  if (SOFT_BHK_INDICATORS.test(text) || /\b(?:maybe|not\s+sure|considering)\b/i.test(text)) {
    isBhkHard = false
  } else if (HARD_BHK_INDICATORS.test(text)) {
    isBhkHard = true
  }

  // Carpet area
  let minCarpetSqft: number | undefined
  let isCarpetHard = false
  const carpetMatch = /\b(?:min(?:imum)?\s+)?([\d,]{3,7})\s*(?:sq\.?\s*ft\.?|sqft|square\s+feet)\s*(?:carpet)?\b/i.exec(text)
  if (carpetMatch) {
    minCarpetSqft = parseInt(carpetMatch[1].replace(/,/g, ''), 10)
    isCarpetHard = /\b(?:min(?:imum)?|at\s+least|cannot\s+be\s+less)\b/i.test(text)
  }

  // Status
  let status: 'ready_to_move' | 'under_construction' | 'possession_window' | 'any' = 'any'
  let isStatusHard = false
  if (READY_TO_MOVE_PHRASES.test(text)) {
    status = 'ready_to_move'
    isStatusHard = true
  } else if (UNDER_CONSTRUCTION_PHRASES.test(text)) {
    status = 'under_construction'
    isStatusHard = true
  }

  // 6. Clarification & Control Requirements
  let requiresClarification = false
  let clarificationPrompt: string | undefined

  if (/\b(?:noida\s+or\s+greater\s+noida|expressway\s+or\s+central)\b/i.test(text)) {
    requiresClarification = true
    clarificationPrompt = 'Would you prefer Central Noida for closer metro and established connectivity, or the Expressway for larger gated townships and direct connectivity?'
  }

  const result: RequirementState = {
    intentModes: modes,
    location: {
      include: includeLocations,
      exclude: excludeLocations,
      softPreferences: softLocationPreferences,
    },
    commute: commuteTargets,
    budget: {
      minCr,
      maxCr,
      isHardCeiling,
      costType: isAllIn ? 'all_in' : 'base_price',
    },
    unit: {
      propertyType: 'apartment',
      bhk: bhkList,
      isBhkHard,
      minCarpetSqft,
      isCarpetHard,
      status,
      isStatusHard,
      floorPreference: 'any',
      excludedFloors: [],
    },
    preferences: {
      isLuxuryPreferred: /\b(?:luxury|premium|high-end)\b/i.test(text),
      requiredAmenities: [],
      preferredAmenities: [],
      negativePreferences: [],
      densityTolerance: 'any',
      useCase: /\bparents\b/i.test(text) ? 'self_use' : 'unknown',
      investmentGoal: [],
      familyContext: /\bparents\b/i.test(text) ? ['parents'] : [],
    },
    control: {
      hasExploratoryQuestion: hasExploratory,
      requiresClarification,
      clarificationPrompt,
      unknowns: [],
      ambiguities: [],
      referenceEntities: [],
    },
  }

  return RequirementStateSchema.parse(result)
}
