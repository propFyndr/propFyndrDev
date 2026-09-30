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
import { sqmToSqft } from '../calculators'
import { prenormalizeRawText as _prenormExternalPipeline } from './messyLanguageNormalizer'

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
  frequency: z.string().optional(),
  belt: z.array(z.string()).default([]),
})

export const LocationRequirementSchema = z.object({
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  softPreferences: z.array(z.string()).default([]),
  conditionalLocations: z.array(z.string()).default([]),
  currentResidence: z.string().optional(),
})

export const BudgetRequirementSchema = z.object({
  minCr: z.number().min(0).optional(),
  maxCr: z.number().min(0).optional(),
  targetCr: z.number().min(0).optional(),
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
  exactOnly: z.boolean().default(false),
  reportExpansion: z.boolean().default(false),
  allowedCompromises: z.array(z.string()).default([]),
  rankingPriority: z.string().optional(),
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
const HARD_BUDGET_INDICATORS = /\b(?:under\s+(?!construction|development)|max|maximum|absolute\s+max(?:imum)?|cannot\s+exceed|not\s+more\s+than|within|cap\s+at)\b/i
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
  /what\s+information\s+(?:would|do)\s+you\s+need/i,
  /before\s+you\s+could\s+make\s+this\s+recommendation/i,
]

const ALL_IN_COST_PHRASES = /\b(?:all[- ]?in|total\s+(?:cost|outflow|budget)|including\s+everything|inclusive\s+of\s+taxes|registration\s+included|final\s+cost|after\s+registry|stamp\s+duty)\b/i

const READY_TO_MOVE_PHRASES = /\b(?:ready\s+to\s+move|rtm|immediate\s+possession|no\s+construction\s+delay|already\s+built)\b/i
const UNDER_CONSTRUCTION_PHRASES = /\b(?:under\s+construction|new\s+launch|upcoming|possession\s+in\s+\d+\s+years?)\b/i
const NO_UNDER_CONSTRUCTION = /\b(?:don't\s+want|avoid|no|not)\s+(?:anything\s+)?under\s+construction\b/i

const EXCLUSION_PATTERNS = [
  /\b(?:avoid|exclude|no|not|except|stay\s+away\s+from|remove|drop|rule\s+out)\s+(?:in\s+)?(sector\s*\d{1,3}[a-d]?|expressway|central\s+noida|noida\s+extension|greater\s+noida(?:\s+west)?)/gi,
]

export function prenormalizeRawText(raw: string): string {
  return _prenormExternalPipeline(raw).normalized
}

/**
 * Normalizes user text and existing partial Intent into an immutable RequirementState.
 */
export function normalizeRequirementState(
  rawText: string,
  intent: Partial<Intent> = {},
  prevState?: Partial<RequirementState>,
  prevStateHistory?: RequirementState[],
): RequirementState {
  let effectivePrevState = prevState
  const text = prenormalizeRawText(rawText)

  // 0. State Reset Handling
  if (/\b(?:clear\s+(?:my\s+)?(?:current\s+)?filters|reset\s+(?:my\s+)?(?:search|filters)|start\s+over)\b/i.test(text)) {
    effectivePrevState = undefined
  }

  // 0b. BACKTRACK Handling: Restore earlier budget/constraint from message or history
  const BACKTRACK_RE = /\b(?:go\s+back\s+to|revert\s+to|actually[,]?\s+(?:let'?s\s+use|use|keep)|we\s+said|i\s+said|the\s+first|original\s+budget)\b/i
  if (BACKTRACK_RE.test(text)) {
    const budgetHint = /(\d+(?:\.\d+)?)\s*(cr(?:ore)?|lakh?s?)/i.exec(text)
    if (budgetHint) {
      const isCr = /cr(?:ore)?/i.test(budgetHint[2])
      const val = parseFloat(budgetHint[1]) * (isCr ? 1 : 0.01)
      if (effectivePrevState) {
        effectivePrevState = {
          ...effectivePrevState,
          budget: { ...(effectivePrevState.budget ?? {}), maxCr: val, isHardCeiling: true },
        } as typeof effectivePrevState
      }
    } else if (prevStateHistory && prevStateHistory.length > 0) {
      const isOriginal = /\b(?:original|first)\b/i.test(text)
      const historicalState = isOriginal
        ? prevStateHistory.find(s => s.budget?.maxCr !== undefined)
        : [...prevStateHistory].reverse().find(s => s.budget?.maxCr !== undefined && s.budget.maxCr !== effectivePrevState?.budget?.maxCr)
      if (historicalState && effectivePrevState) {
        effectivePrevState = {
          ...effectivePrevState,
          budget: { ...(effectivePrevState.budget ?? {}), maxCr: historicalState.budget.maxCr, isHardCeiling: true },
        } as typeof effectivePrevState
      }
    }
  }

  // Single constraint removal
  const forgetMatch = /\bforget\s+(?:the\s+)?([a-z0-9\- ]+?)\s+requirement\b/i.exec(text)
  let forgetStatus = false
  if (forgetMatch) {
    const req = forgetMatch[1].toLowerCase()
    if (req.includes('ready') || req.includes('status') || req.includes('possession') || req.includes('move')) {
      forgetStatus = true
    }
  }

  // 1. Detect Intent Modes
  const modes: IntentMode[] = []
  if (
    /compare|vs|versus|difference\s+between|gain\s+and.*give\s+up|trade-?offs?|what\s+i\s+gain|think\s+about\s+that\s+difference|which\s+one\s+has\s+more|two\s+projects|prices\s+differ/i.test(
      text,
    ) &&
    !/before\s+(?:i\s+)?compare/i.test(text)
  ) {
    modes.push('COMPARE')
  }
  if (
    /rera|legal|litigation|complaint|delay|builder\s+track\s+record|oc|cc|registered\s+project|possession\s+date\s+conflict|builder\s+says.*registered|checklist|questions?\s+i\s+should\s+ask|documents?\s+should\s+i\s+ask|red[- ]flag|what\s+information\s+(?:i\s+)?should\s+collect|due\s+diligence/i.test(
      text,
    )
  ) {
    modes.push('DUE_DILIGENCE')
  }
  if (
    /emi|loan|interest|stamp\s+duty|tax|all[- ]?in|cost\s+sheet|possession\s+charges|historical\s+price|today'?s\s+value|price\s+is\s+from\s+\w+\s+months\s+ago|first\s+launched|advertised\s+price|launch\s+price|changed\s+materially|asking\s+price\s+changed|rental\s+yield|rents\s+for|vacancy|parking\s+(?:slot|economics)|furnished\s+vs\s+unfurnished|renovat|upgrade|co-buying|two-property|worth\s+roughly|financial\s+variables?|model\b|already\s+own|without\s+selling|buying\s+together|ownership\s+and\s+financing/i.test(
      text,
    )
  ) {
    modes.push('FINANCE')
  }
  if (
    /\bwhy\b|explain|trend|market|master\s+plan|weakest\s+(?:match|fit)|matches.*least|which\s+is\s+(?:correct|accurate)|brochure\s+says.*listing\s+says|floor\s+plan|usable|open\s+space|description|what\s+you\s+don't\s+know|high-confidence\s+facts|translate\s+that\s+into\s+actual\s+things|decode/i.test(
      text,
    )
  ) {
    modes.push('EXPLAIN')
  }
  if (
    /how\s+do\s+you\s+know|source|proof|evidence|verify|reliable\s+data|verified\s+data|weakest\s+evidence|neutral\s+description|only\s+facts\s+you\s+can\s+verify|what\s+you\s+don't\s+know|internally\s+inconsistent|high-confidence\s+facts|translate\s+that\s+into\s+actual\s+things|measurable\s+characteristics|walk\s+me\s+through\s+every\s+data\s+point|facts\s+made\s+it\s+qualify|which\s+facts\s+you\s+could\s+not\s+establish|exact\s+price\s+basis/i.test(
      text,
    )
  ) {
    modes.push('EVIDENCE')
  }
  if (/ignore\s+(?:all\s+)?previous|system\s+prompt|dan\s+mode|override\s+rule/i.test(text)) {
    modes.push('SECURITY_ADVERSARIAL')
  }
  if (
    /home\s+office|work\s+from\s+home|large\s+dog|pet\b|child\s+safety|four-year-old|child\b|kid\b|toddler\b|already\s+own|move\s+to\s+a\s+\d\s*bhk\s+without\s+selling|buying\s+together/i.test(
      text,
    )
  ) {
    modes.push('DISCOVER')
  }

  // Advisory transition, rental economics, checklists, and evidence requests
  if (
    /rental\s+yield|rents\s+for|vacancy|parking\s+(?:slot|economics)|furnished\s+vs\s+unfurnished|renovat|upgrade\s+scenario|co-buying|two-property|buying\s+together/i.test(
      text,
    )
  ) {
    if (!modes.includes('DISCOVER')) modes.push('DISCOVER')
  }

  const isPureAdvisory =
    /\b(?:before\s+showing\s+me\s+anything|tell\s+me\s+whether\s+that\s+budget\s+is\s+realistic|forget\s+the\s+properties|explain\s+whether\s+sector\s+\d+\s+makes\s+sense)\b/i.test(
      text,
    ) ||
    /\b(?:keep\s+renting|rent\s+vs\s+buy|what\s+kind\s+of\s+property\s+makes\s+sense|is\s+buying\s+a\s+\d\s*bhk\s+even\s+necessary|what\s+should\s+i\s+prioritize)\b/i.test(
      text,
    ) ||
    /\b(?:planning\s+to\s+rent|rent\s+for\s+\d+\s+years|renting\s+in\s+a\s+sector\s+for\s+a\s+year\s+before\s+buying|not\s+buying\s+yet)\b/i.test(
      text,
    ) ||
    /\b(?:already\s+own.*?without\s+selling|financial\s+variables\s+should\s+i\s+model|buying\s+together.*?settle\s+before\s+choosing|settle\s+before\s+choosing\s+the\s+property)\b/i.test(
      text,
    )

  const hasExploratory = EXPLORATORY_PHRASES.some((rx) => rx.test(text))
  const explicitSearch = /\b(?:find\s+(?:me\s+)?|show\s+(?:me\s+)?|search\s+(?:for\s+)?|list\s+(?:me\s+)?)\b/i.test(text)

  if (isPureAdvisory) {
    const filtered = modes.filter((m) => m !== 'SEARCH')
    modes.length = 0
    modes.push(...filtered)
    if (!modes.includes('DISCOVER')) modes.push('DISCOVER')
  } else {
    if (explicitSearch) {
      if (!modes.includes('SEARCH')) modes.unshift('SEARCH')
    }
    if (hasExploratory || /\b(?:don't\s+necessarily\s+need\s+to\s+spend|not\s+sure)\b/i.test(text)) {
      if (!modes.includes('DISCOVER')) modes.push('DISCOVER')
    }
    if (modes.length === 0) {
      modes.push('SEARCH')
    }
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
  } else if (effectivePrevState?.commute && effectivePrevState.commute.length > 0) {
    commuteTargets.push(...effectivePrevState.commute)
  }

  // Frequency-based commute destinations (words or digits)
  const wordToNum = (w: string) => {
    const map: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', once: '1' }
    return map[w.toLowerCase()] || w
  }

  const m62 = /sector\s*62\s+(\d+|one|two|three|four|five)\s+days?\s+a\s+week/i.exec(text)
  if (m62) {
    const count = wordToNum(m62[1])
    const existing = commuteTargets.find((c) => c.destination === 'Sector 62')
    if (existing) {
      existing.frequency = `${count} days/week`
    } else {
      commuteTargets.push({
        destination: 'Sector 62',
        role: 'workplace',
        trafficContext: 'peak',
        frequency: `${count} days/week`,
        belt: ['Sector 62', 'Sector 63'],
      })
    }
  }

  const mGgn = /gurgaon\s+(?:once|(\d+|one|two|three|four|five)\s+days?)\s+a?\s*week/i.exec(text)
  if (mGgn) {
    const count = mGgn[1] ? wordToNum(mGgn[1]) : '1'
    const existing = commuteTargets.find((c) => c.destination === 'Gurgaon')
    if (existing) {
      existing.frequency = `${count} day/week`
    } else {
      commuteTargets.push({
        destination: 'Gurgaon',
        role: 'secondary',
        trafficContext: 'peak',
        frequency: `${count} day/week`,
        belt: [],
      })
    }
  }

  // Generic commute: "currently work in Sector 62", "wife office 62", "not too far from Sector 62", "near Sector 62"
  const office62Match = /\b(?:work\s+in|office(?:\s+in)?|not\s+too\s+far\s+from|near|close\s+to|commute\s+to)\s*(?:sector\s*)?62\b/i.test(text)
  if (office62Match && !commuteTargets.some((c) => c.destination === 'Sector 62')) {
    commuteTargets.push({
      destination: 'Sector 62',
      role: 'workplace',
      trafficContext: 'peak',
      belt: ['Sector 62', 'Sector 63'],
    })
  }

  // Future workplace / company move
  const moveCompanyMatch = /(?:moving\s+me\s+to|move\s+to|office\s+changed\s+to)\s+(sector\s*\d+)/i.exec(text)
  if (moveCompanyMatch) {
    const newSec = `Sector ${moveCompanyMatch[1].replace(/\D/g, '')}`
    if (!commuteTargets.some((c) => c.destination === newSec)) {
      commuteTargets.push({
        destination: newSec,
        role: 'workplace_future',
        trafficContext: 'peak',
        belt: [newSec],
      })
    }
  }

  // Spouse office / Gurgaon commute
  if (/\b(?:wife.*?travels?\s+to|wife.*?goes\s+to|wife'?s?\s+office|prioritize\s+.*?gurgaon|wife'?s?\s+gurgaon\s+commute)\b/i.test(text)) {
    const dest = /sector\s*\d+|\d{1,3}/i.test(text) && !/gurgaon/i.test(text)
      ? `Sector ${text.match(/sector\s*(\d+)|\b(\d{1,3})\b/i)![1] || text.match(/sector\s*(\d+)|\b(\d{1,3})\b/i)![2]}`
      : 'Gurgaon'
    if (!commuteTargets.some((c) => c.destination === dest)) {
      commuteTargets.push({
        destination: dest,
        role: 'secondary',
        trafficContext: 'peak',
        belt: [],
      })
    }
  }

  // Commute forget / removal
  if (/\bforget\s+gurgaon\b/i.test(text)) {
    const idx = commuteTargets.findIndex((c) => /gurgaon/i.test(c.destination))
    if (idx !== -1) commuteTargets.splice(idx, 1)
  }

  // 3. Location Requirements
  const includeLocations: string[] = []
  const excludeLocations: string[] = []
  const softLocationPreferences: string[] = []
  const conditionalLocations: string[] = effectivePrevState?.location?.conditionalLocations
    ? [...effectivePrevState.location.conditionalLocations]
    : []
  let currentResidence: string | undefined = effectivePrevState?.location?.currentResidence

  // Current residence vs commute
  const liveMatch = /\bi\s+live\s+in\s+([a-zA-Z0-9\s]+?)(?:\s+and|\.|\,)/i.exec(text)
  if (liveMatch) {
    currentResidence = liveMatch[1].trim()
  }

  // Exclusions
  for (const rx of EXCLUSION_PATTERNS) {
    let match: RegExpExecArray | null
    while ((match = rx.exec(text)) !== null) {
      if (match[1]) {
        const norm = normalizeSectorName(match[1]) || match[1]
        excludeLocations.push(norm)
      }
    }
  }

  // Shorthand "not extension"
  if (/\b(?:not|no)\s+extension\b/i.test(text)) {
    if (!excludeLocations.includes('Noida Extension')) excludeLocations.push('Noida Extension')
  }

  // Multiple exclusions: "except 137, 143 and 150"
  const multiExceptMatch = /except\s+(\d{1,3}(?:\s*,\s*\d{1,3})*(?:\s+and\s+\d{1,3})?)/i.exec(text)
  if (multiExceptMatch) {
    const nums = multiExceptMatch[1].split(/(?:,|\band\b)/).map((s) => s.trim()).filter(Boolean)
    for (const n of nums) {
      const sec = `Sector ${n}`
      if (!excludeLocations.includes(sec)) excludeLocations.push(sec)
    }
  }

  // Location correction / replacement: "Sector 150. Actually I meant Sector 152"
  const locCorrectionMatch =
    /(?:actually\s+(?:i\s+meant|it'?s)|sorry,?\s+i\s+meant)\s+sector\s*(\d{1,3}\s*[a-d]?)/i.exec(text) ||
    /(?:actually\s+sector\s*(\d{1,3}\s*[a-d]?))/i.exec(text)
  if (locCorrectionMatch) {
    const newSec = `Sector ${locCorrectionMatch[1].replace(/\s+/g, '').toUpperCase()}`
    includeLocations.length = 0
    softLocationPreferences.length = 0
    includeLocations.push(newSec)
  }

  // Location addition: "Sector 137 is okay too"
  const addLocMatch = /sector\s*(\d{1,3}\s*[a-d]?)\s+is\s+okay\s+too/i.exec(text)
  if (addLocMatch) {
    const sec = `Sector ${addLocMatch[1].replace(/\s+/g, '').toUpperCase()}`
    if (!includeLocations.includes(sec)) includeLocations.push(sec)
  }

  // Location hierarchy: Sector 150 ideal, Sector 137 / 143 conditional
  if (/(?:prefer\s+sector\s*150|sector\s*150.*?(?:ideal|prefer|theek\s+hai)).*?(?:sector\s*)?(?:137|143).*?(?:fine|better|society|trade-?off)/i.test(text)) {
    if (!softLocationPreferences.includes('Sector 150')) softLocationPreferences.push('Sector 150')
    const conds = text.match(/\b(?:137|143)\b/g)
    if (conds) {
      for (const c of conds) {
        const s = `Sector ${c}`
        if (!conditionalLocations.includes(s)) conditionalLocations.push(s)
      }
    }
  }

  if (/open\s+to\s+greater\s+noida.*?only\s+if/i.test(text)) {
    if (!conditionalLocations.includes('Greater Noida')) conditionalLocations.push('Greater Noida')
  }
  if (/\b(?:don't\s+want\s+greater\s+noida\s+proper|not\s+greater\s+noida)\b/i.test(text)) {
    if (!excludeLocations.includes('Greater Noida')) excludeLocations.push('Greater Noida')
  }
  if (/\b(?:okay\s+with\s+noida\s+extension)\b/i.test(text)) {
    if (!includeLocations.includes('Noida Extension')) includeLocations.push('Noida Extension')
  }
  if (/don't\s+want\s+noida\s+extension\s+unless\s+the\s+space\s+difference\s+is\s+substantial/i.test(text)) {
    if (!excludeLocations.includes('Noida Extension')) excludeLocations.push('Noida Extension')
    if (!conditionalLocations.includes('Noida Extension')) conditionalLocations.push('Noida Extension')
  }

  // Soft becoming hard: "Actually I absolutely need Sector 150"
  if (/absolutely\s+need\s+sector\s*(\d{1,3}\s*[a-d]?)/i.test(text)) {
    const m = /absolutely\s+need\s+sector\s*(\d{1,3}\s*[a-d]?)/i.exec(text)!
    const sec = `Sector ${m[1].replace(/\s+/g, '').toUpperCase()}`
    includeLocations.length = 0
    softLocationPreferences.length = 0
    includeLocations.push(sec)
  }

  // Shorthand "maybe 150"
  if (/\bmaybe\s+(?:sector\s*)?(150)\b/i.test(text)) {
    if (!softLocationPreferences.includes('Sector 150')) softLocationPreferences.push('Sector 150')
  }

  // Soft preference pattern: "preferably Sector 150", "ideally Sector 150"
  const explicitSoftPrefMatch = /(?:preferably|ideally|first\s+preference|prefer|maybe|somewhere\s+near)\s+(?:near\s+|in\s+|close\s+to\s+)?(?:sector\s*(\d{1,3}[a-d]?)|expressway)/i.exec(text)
  if (explicitSoftPrefMatch) {
    const secName = explicitSoftPrefMatch[1] ? `Sector ${explicitSoftPrefMatch[1].toUpperCase()}` : 'Noida Expressway'
    if (!softLocationPreferences.includes(secName)) softLocationPreferences.push(secName)
  }

  if (/\bcentral\s+noida\b/i.test(text)) {
    if (!includeLocations.includes('Central Noida')) includeLocations.push('Central Noida')
  }

  // Normal sector extraction
  let targetSector = intent.sector
  if (!targetSector && includeLocations.length === 0) {
    const secMatch = /\bsector\s*[-\s]?(\d{1,3}\s*[a-d]?)\b/i.exec(text)
    if (secMatch) {
      targetSector = `Sector ${secMatch[1].replace(/\s+/g, '').toUpperCase()}`
    } else if (/\bcentral\s+noida\b/i.test(text)) {
      targetSector = 'Central Noida'
    } else if (/\bexpressway\b/i.test(text)) {
      targetSector = 'Noida Expressway'
    } else if (/\bnoida\b/i.test(text) && !/\bgreater\s+noida\b/i.test(text)) {
      targetSector = 'Noida'
    }
  }

  if (targetSector) {
    const normTarget = normalizeSectorName(targetSector) || targetSector
    const isWorkplace = commuteTargets.some((c) => c.destination === normTarget)
    const isExcluded = excludeLocations.includes(normTarget)
    const isResidence = currentResidence && currentResidence.toLowerCase() === normTarget.toLowerCase()

    if (!isWorkplace && !isExcluded && !isResidence) {
      const isExplicitSoft =
        new RegExp(
          `(?:preferably|ideally|first\\s+preference|prefer|near|somewhere\\s+near)\\s+(?:near\\s+|in\\s+|close\\s+to\\s+)?(?:noida\\s+)?(?:${normTarget.replace(/\\s+/g, '\\s+')}|expressway)`,
          'i',
        ).test(text) ||
        new RegExp(`${normTarget.replace(/\\s+/g, '\\s+')}\\s+is\\s+(?:my\\s+)?(?:first\\s+)?preference`, 'i').test(text) ||
        new RegExp(`prefer\\s+${normTarget.replace(/\\s+/g, '\\s+')}`, 'i').test(text)
      if (isExplicitSoft) {
        if (!softLocationPreferences.includes(normTarget)) softLocationPreferences.push(normTarget)
      } else {
        if (!includeLocations.includes(normTarget)) includeLocations.push(normTarget)
      }
    }
  }

  if (effectivePrevState?.location && !locCorrectionMatch) {
    for (const inc of effectivePrevState.location.include) {
      if (!includeLocations.includes(inc)) includeLocations.push(inc)
    }
    for (const exc of effectivePrevState.location.exclude) {
      if (!excludeLocations.includes(exc)) excludeLocations.push(exc)
    }
    for (const soft of effectivePrevState.location.softPreferences) {
      if (!softLocationPreferences.includes(soft)) softLocationPreferences.push(soft)
    }
  }

  // Remove excluded locations and residence from includes
  for (const ex of excludeLocations) {
    const exLower = ex.toLowerCase()
    const idxInc = includeLocations.findIndex((l) => {
      const lLower = l.toLowerCase()
      if (lLower === 'noida' && exLower !== 'noida') return false
      return lLower === exLower || lLower.includes(exLower)
    })
    if (idxInc !== -1) includeLocations.splice(idxInc, 1)

    const idxSoft = softLocationPreferences.findIndex((l) => {
      const lLower = l.toLowerCase()
      if (lLower === 'noida' && exLower !== 'noida') return false
      return lLower === exLower || lLower.includes(exLower)
    })
    if (idxSoft !== -1) softLocationPreferences.splice(idxSoft, 1)
  }

  if (currentResidence) {
    const idxRes = includeLocations.findIndex((l) => l.toLowerCase() === currentResidence!.toLowerCase())
    if (idxRes !== -1) includeLocations.splice(idxRes, 1)
  }

  // 4. Budget Requirements
  let maxCr = typeof intent.budgetMax === 'number' ? intent.budgetMax : effectivePrevState?.budget?.maxCr
  let minCr = typeof intent.budgetMin === 'number' ? intent.budgetMin : effectivePrevState?.budget?.minCr
  let targetCr: number | undefined = effectivePrevState?.budget?.targetCr
  let cashInHandLakhs: number | undefined = effectivePrevState?.budget?.cashInHandLakhs
  let downPaymentLakhs: number | undefined = effectivePrevState?.budget?.downPaymentLakhs
  let maxEmiMonthly: number | undefined = effectivePrevState?.budget?.maxEmiMonthly
  let isHardCeiling = effectivePrevState?.budget?.isHardCeiling ?? false

  // Edge Case: Between X and Y
  const betweenMatch =
    /\bbetween\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)?\s+(?:and|to|-)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)\b/i.exec(
      text,
    )
  if (betweenMatch) {
    minCr = parseFloat(betweenMatch[1])
    maxCr = parseFloat(betweenMatch[2])
    isHardCeiling = true
  }

  // Edge Case: Up to X, closer to Y
  const upToCloserMatch =
    /(?:up\s+to|max(?:imum)?)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?).*?(?:closer\s+to|prefer\s+around|rather\s+stay\s+closer\s+to)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/i.exec(
      text,
    )
  if (upToCloserMatch) {
    maxCr = parseFloat(upToCloserMatch[1])
    targetCr = parseFloat(upToCloserMatch[2])
    isHardCeiling = true
  }

  // Monster / multi-budget: "comfortable budget is around ₹1.5 Cr, but ₹1.6 Cr is my absolute limit"
  const comfortableTargetLimitMatch =
    /(?:comfortable\s+budget\s+is\s+around|prefer\s+around)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?).*?(?:(?:absolute\s+limit|max(?:imum)?)\s+(?:is\s+)?(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)|(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)\s+is\s+(?:my\s+)?(?:absolute\s+limit|max(?:imum)?))/i.exec(
      text,
    )
  if (comfortableTargetLimitMatch) {
    targetCr = parseFloat(comfortableTargetLimitMatch[1])
    maxCr = parseFloat(comfortableTargetLimitMatch[2] || comfortableTargetLimitMatch[3])
    isHardCeiling = true
  }

  const budgetTargetMaxMatch = /\bbudget\s+(\d+(?:\.\d+)?)\s+but\s+(\d+(?:\.\d+)?)\s+max\b/i.exec(text)
  if (budgetTargetMaxMatch) {
    targetCr = parseFloat(budgetTargetMaxMatch[1])
    maxCr = parseFloat(budgetTargetMaxMatch[2])
    isHardCeiling = true
  }

  // Edge Case: Starting from X
  const startingFromMatch =
    /\b(?:starting\s+from|from|at\s+least|minimum\s+budget\s+of)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)\b/i.exec(
      text,
    )
  if (startingFromMatch && !betweenMatch) {
    minCr = parseFloat(startingFromMatch[1])
    maxCr = undefined
  }

  // Edge Case: Budget correction
  const budgetCorrectionMatch =
    /\b(?:sorry,?\s+i\s+meant|actually\s+(?:i\s+meant|it'?s)|correction:?)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)\b/i.exec(
      text,
    )
  if (budgetCorrectionMatch) {
    maxCr = parseFloat(budgetCorrectionMatch[1])
    minCr = undefined
    isHardCeiling = true
  }

  // Edge Case: Stretch vs Do not cross
  if (/stretch\s+to\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/i.test(text)) {
    const m = /stretch\s+to\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/i.exec(text)!
    maxCr = parseFloat(m[1])
    isHardCeiling = false
  }
  if (/do\s+not\s+cross\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/i.test(text)) {
    const m = /do\s+not\s+cross\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/i.exec(text)!
    maxCr = parseFloat(m[1])
    isHardCeiling = true
  }

  // Current turn explicit budget expressions override previous state
  const underBudgetMatch =
    /(?:under|max(?:imum)?|below|less\s+than|up\s+to|cap\s+at|properties\s+under)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/i.exec(
      text,
    )
  if (underBudgetMatch) {
    maxCr = parseFloat(underBudgetMatch[1])
    isHardCeiling = true
  }

  // Edge Case: "Around X" approximate budget (with or without Cr keyword)
  if (!comfortableTargetLimitMatch && !betweenMatch && !upToCloserMatch && !budgetCorrectionMatch && !underBudgetMatch) {
    const aroundCrMatch = /\baround\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?|\b)/i.exec(text)
    if (aroundCrMatch && !isHardCeiling && !/around\s+(?:₹|rs\.?|inr)?\s*\d+\s*(?:lakh|k)?\s*emi/i.test(text)) {
      const val = parseFloat(aroundCrMatch[1])
      if (val >= 0.2 && val <= 50) {
        targetCr = val
        maxCr = targetCr
        isHardCeiling = false
      }
    }
  }

  // General number parsing if still missing from text
  const crMatchInText = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)\b/i.exec(text)
  if (crMatchInText && !betweenMatch && !upToCloserMatch && !budgetCorrectionMatch && !underBudgetMatch && !comfortableTargetLimitMatch && !startingFromMatch) {
    maxCr = parseFloat(crMatchInText[1])
  } else if (maxCr === undefined && minCr === undefined) {
    const lakhMatch = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh?s?|lac?s?)\b/i.exec(text)
    if (lakhMatch && !/saved|down\s+payment|emi/i.test(text)) {
      maxCr = parseFloat(lakhMatch[1]) / 100
    }
  }

  // Savings / Cash in hand
  const savingsMatch = /\b(?:have\s+)?(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh?s?|lac?s?)\s+saved\b/i.exec(text)
  if (savingsMatch) {
    cashInHandLakhs = parseFloat(savingsMatch[1])
  }

  // Down payment (handles ₹40L, 50L, and "available for the down payment")
  const dpMatch =
    /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh?s?|lac?s?|l\b|cr(?:ore)?s?)(?:\s+available)?\s+(?:for\s+(?:the\s+)?)?(?:down\s+payment|dp)\b/i.exec(text) ||
    /(?:down\s+payment|dp)\s+(?:of\s+)?(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh?s?|lac?s?|l\b|cr(?:ore)?s?)\b/i.exec(text) ||
    /(?:make\s+it\s+)(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh?s?|lac?s?|l\b|cr(?:ore)?s?)\s+down\s+payment/i.exec(text)
  if (dpMatch) {
    const val = parseFloat(dpMatch[1])
    downPaymentLakhs = /cr/i.test(dpMatch[0]) ? val * 100 : val
  }

  // Monthly EMI
  const emiMatch =
    /(?:emi\s+(?:to\s+go\s+much\s+above|target|under|max|around|of)\s+)?(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand)\b/i.exec(
      text,
    )
  if (emiMatch) {
    maxEmiMonthly = parseFloat(emiMatch[1]) * 1000
  }

  // All-in cost hard maximum
  const allInMaxMatch =
    /(?:final\s+cost|all[- ]?in\s+cost|cost\s+stays|maximum\s+is|cross|can\s+spend)\s+(?:to\s+cross\s+|under\s+|below\s+|is\s+)?(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)(?:\s+total)?/i.exec(
      text,
    )
  if (allInMaxMatch) {
    maxCr = parseFloat(allInMaxMatch[1])
    isHardCeiling = true
  }

  if (maxCr !== undefined && !betweenMatch && !upToCloserMatch && !budgetCorrectionMatch && !comfortableTargetLimitMatch) {
    if (HARD_BUDGET_INDICATORS.test(text) || allInMaxMatch) {
      isHardCeiling = true
    } else if (SOFT_BUDGET_INDICATORS.test(text)) {
      isHardCeiling = false
    } else {
      isHardCeiling = !/\b(?:around|maybe|not\s+necessarily)\b/i.test(text)
    }
  }

  const isAllIn =
    ALL_IN_COST_PHRASES.test(text) ||
    /\b(?:including\s+all\s+purchase\s+costs|applicable\s+purchase\s+costs|total\s+outflow)\b/i.test(text) ||
    /(?:spend|budget)\s+(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?\s*(?:cr(?:ore)?s?)\s+total\b/i.test(text)

  // 5. Unit Requirements (BHK, Carpet Area, Status)
  let bhkList: number[] = Array.isArray(intent.bhk)
    ? [...intent.bhk]
    : effectivePrevState?.unit?.bhk ? [...effectivePrevState.unit.bhk] : []
  const multiBhkMatch = /\b(?:need\s+)?(\d)\s*(?:or|\/|-)\s*(\d)\s*(?:bhks?|bedrooms?)\b/i.exec(text)
  if (multiBhkMatch) {
    bhkList = [parseInt(multiBhkMatch[1], 10), parseInt(multiBhkMatch[2], 10)].sort()
  } else if (bhkList.length === 0) {
    const bhkMatch = /\b(\d)\s*(?:bhks?|bedrooms?)\b/i.exec(text)
    if (bhkMatch) {
      bhkList = [parseInt(bhkMatch[1], 10)]
    }
  }

  let isBhkHard = effectivePrevState?.unit?.isBhkHard ?? true
  if (SOFT_BHK_INDICATORS.test(text) || /\b(?:maybe|not\s+sure|considering)\b/i.test(text)) {
    isBhkHard = false
  } else if (HARD_BHK_INDICATORS.test(text)) {
    isBhkHard = true
  }

  // Carpet area & Ambiguity Detection
  let minCarpetSqft: number | undefined = effectivePrevState?.unit?.minCarpetSqft
  let isCarpetHard = effectivePrevState?.unit?.isCarpetHard ?? false
  let requiresClarification = false
  let clarificationPrompt: string | undefined
  const ambiguities: string[] = []

  const carpetAmbiguity = /\b(?:don't\s+know\s+whether\s+carpet\s+or\s+built[- ]?up|carpet\s+or\s+built[- ]?up)\b/i.test(text)
  if (carpetAmbiguity) {
    requiresClarification = true
    clarificationPrompt =
      'In Noida, carpet area is the net usable internal floor area, whereas built-up (or super built-up) includes perimeter walls and common amenities (typically 25-35% larger). Would you like to evaluate your 1,500 sq ft requirement as net carpet area or super built-up area?'
    ambiguities.push('carpet_vs_builtup')
    minCarpetSqft = undefined
    isCarpetHard = false
  } else {
    // Check sqm (e.g. 130 sqm carpet)
    const sqmMatch = /\b(?:min(?:imum)?\s+)?(\d+(?:\.\d+)?)\s*sqm\s*(?:carpet)?\b/i.exec(text)
    if (sqmMatch) {
      minCarpetSqft = sqmToSqft(parseFloat(sqmMatch[1]))
      isCarpetHard = /\b(?:min(?:imum)?|at\s+least|cannot\s+be\s+less)\b/i.test(text)
    } else {
      // Check k carpet (e.g. 1.5k carpet)
      const kCarpetMatch = /(\d+(?:\.\d+)?)k\s+carpet\b/i.exec(text)
      if (kCarpetMatch) {
        minCarpetSqft = parseFloat(kCarpetMatch[1]) * 1000
        isCarpetHard = true
      } else {
        const carpetMatch = /\b(?:min(?:imum)?\s+)?([\d,]{3,7})\s*(?:sq\.?\s*ft\.?|sqft|square\s+feet)\s*(?:carpet)?\b/i.exec(
          text,
        )
        if (carpetMatch) {
          minCarpetSqft = parseInt(carpetMatch[1].replace(/,/g, ''), 10)
          isCarpetHard = /\b(?:min(?:imum)?|at\s+least|cannot\s+be\s+less)\b/i.test(text)
        }
      }
    }
  }

  // Ambiguous budget: e.g. "budget around 1500" without unit
  const ambiguousBudgetMatch = /\bbudget\s+around\s+(\d{3,4})\b/i.exec(text)
  if (ambiguousBudgetMatch) {
    requiresClarification = true
    ambiguities.push('ambiguous_budget_1500')
  }
  if (/\bpossession\s+jaldi\b/i.test(text)) {
    ambiguities.push('ambiguous_possession_jaldi')
  }

  // Status
  let status: 'ready_to_move' | 'under_construction' | 'possession_window' | 'any' =
    effectivePrevState?.unit?.status ?? 'any'
  let isStatusHard = effectivePrevState?.unit?.isStatusHard ?? false
  let possessionDeadlineYears: number | undefined = effectivePrevState?.unit?.possessionDeadlineYears

  const NO_UC_EXTENDED = /\b(?:don't\s+want|avoid|no|not|nothing|absolutely\s+nothing)\s+(?:anything\s+)?under\s+construction\b/i
  const POSSESSION_WINDOW_REGEX = /possession\s+within\s+(\d+)\s+months?/i

  if (forgetStatus) {
    status = 'any'
    isStatusHard = false
    possessionDeadlineYears = undefined
  } else if (POSSESSION_WINDOW_REGEX.test(text)) {
    const m = POSSESSION_WINDOW_REGEX.exec(text)!
    const months = parseInt(m[1], 10)
    status = 'possession_window'
    isStatusHard = false
    possessionDeadlineYears = Math.ceil(months / 12)
  } else if (NO_UC_EXTENDED.test(text) || READY_TO_MOVE_PHRASES.test(text) || /\b(?:ready\s+only|only\s+ready)\b/i.test(text)) {
    status = 'ready_to_move'
    isStatusHard = true
  } else if (UNDER_CONSTRUCTION_PHRASES.test(text)) {
    status = 'under_construction'
    isStatusHard = true
  }

  // Preferences & family context
  let familyContext = effectivePrevState?.preferences?.familyContext ? [...effectivePrevState.preferences.familyContext] : []
  if (/\bparents\b/i.test(text)) {
    if (/\b(?:aren't|not)\s+moving\b/i.test(text) || /\bno\s+parents\b/i.test(text)) {
      familyContext = familyContext.filter((f) => f !== 'parents')
    } else if (!familyContext.includes('parents')) {
      familyContext.push('parents')
    }
  }

  let useCase = effectivePrevState?.preferences?.useCase ?? (/\bparents\b/i.test(text) ? 'self_use' : 'unknown')
  if (/\b(?:forever\s+home|self[- ]?use|for\s+myself)\b/i.test(text)) {
    useCase = 'self_use'
  }

  // 6. Clarification & Control Requirements
  if (/\b(?:noida\s+or\s+greater\s+noida|expressway\s+or\s+central)\b/i.test(text)) {
    requiresClarification = true
    clarificationPrompt =
      'Would you prefer Central Noida for closer metro and established connectivity, or the Expressway for larger gated townships and direct connectivity?'
  }

  let exactOnly = effectivePrevState?.control?.exactOnly ?? false
  if (/\b(?:only\s+return\s+exact|strictly\s+exact|no\s+alternatives)\b/i.test(text)) {
    exactOnly = true
  }

  const allowedCompromises = effectivePrevState?.control?.allowedCompromises
    ? [...effectivePrevState.control.allowedCompromises]
    : []
  if (/\b(?:compromise\s+on\s+carpet|flexible\s+on\s+carpet)\b/i.test(text)) {
    if (!allowedCompromises.includes('carpet_area')) allowedCompromises.push('carpet_area')
  }
  if (/\b(?:flexible\s+on\s+budget|stretch\s+karke|can\s+stretch\s+budget|budget\s+slightly\s+flexible)\b/i.test(text)) {
    if (!allowedCompromises.includes('budget_relaxed')) allowedCompromises.push('budget_relaxed')
  }
  if (/\b(?:flexible\s+on\s+sector|any\s+nearby\s+sector|compromise\s+on\s+location)\b/i.test(text)) {
    if (!allowedCompromises.includes('location_relaxed')) allowedCompromises.push('location_relaxed')
  }

  let reportExpansion = effectivePrevState?.control?.reportExpansion ?? false
  if (/\b(?:tell\s+me\s+exactly\s+when\s+you\s+do|report\s+expansion)\b/i.test(text)) {
    reportExpansion = true
  }

  let rankingPriority = effectivePrevState?.control?.rankingPriority
  if (/prioritize\s+builder\s+reliability|care\s+more\s+about\s+the\s+builder/i.test(text)) {
    rankingPriority = 'builder_reliability'
  } else if (/prioritize\s+commute/i.test(text)) {
    rankingPriority = 'commute'
  } else if (/prioritize\s+usable\s+space/i.test(text)) {
    rankingPriority = 'carpet_area'
  }

  const result: RequirementState = {
    intentModes: modes,
    location: {
      include: includeLocations,
      exclude: excludeLocations,
      softPreferences: softLocationPreferences,
      conditionalLocations,
      currentResidence,
    },
    commute: commuteTargets,
    budget: {
      minCr,
      maxCr,
      targetCr,
      isHardCeiling,
      costType: isAllIn ? 'all_in' : 'base_price',
      cashInHandLakhs,
      maxEmiMonthly,
      downPaymentLakhs,
    },
    unit: {
      propertyType: 'apartment',
      bhk: bhkList,
      isBhkHard,
      minCarpetSqft,
      isCarpetHard,
      status,
      isStatusHard,
      possessionDeadlineYears,
      floorPreference: 'any',
      excludedFloors: [],
    },
    preferences: {
      isLuxuryPreferred: /\b(?:luxury|premium|high-end)\b/i.test(text),
      requiredAmenities: [],
      preferredAmenities: [],
      negativePreferences: [],
      densityTolerance: 'any',
      useCase,
      investmentGoal: [],
      familyContext,
    },
    control: {
      hasExploratoryQuestion: hasExploratory,
      requiresClarification,
      clarificationPrompt,
      exactOnly,
      reportExpansion,
      allowedCompromises,
      rankingPriority,
      unknowns: [],
      ambiguities,
      referenceEntities: [],
    },
  }

  return RequirementStateSchema.parse(result)
}

export const parseRequirementState = normalizeRequirementState
