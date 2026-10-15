// backend/src/lib/discovery/intent.ts
import { z } from 'zod'
import { Intent, IntentState } from './types'
import { CITY_LEVEL_TERMS } from './constants'

export const IntentSchema = z.object({
  bhk: z.number().array().nullable().optional(),
  budgetMin: z.number().nullable().optional(),
  budgetMax: z.number().nullable().optional(),
  possession: z.enum(['immediate', '1year', '2year', '3year+']).nullable().optional(),
  sector: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  areaMin: z.number().nullable().optional(),
  areaMax: z.number().nullable().optional(),
  purpose: z.enum(['endUse', 'investment']).nullable().optional(),
  builderName: z.string().nullable().optional(),
  lifestyleKeywords: z.string().array().nullable().optional(),
  facing: z.string().array().nullable().optional(),
  projectNames: z.string().array().nullable().optional(),
  riskProfile: z.enum(['nri', 'retiree', 'risk_averse', 'first_time_buyer']).nullable().optional(),
  is_comparison_query: z.boolean().nullable().optional(),
  gathering_loop_count: z.number().nullable().optional(),
  legal_check: z.boolean().nullable().optional(),

  // Phase 0: Query classification
  queryKind: z.enum(['DISCOVERY', 'DRILLDOWN', 'RANKING', 'COMPARISON', 'SUMMARY', 'ADVISORY', 'CLARIFY', 'OPEN']).nullable().optional(),

  // Spatial scope: "in Sector X" (EXACT) vs "near Sector X" (PROXIMITY) vs "Noida" (BROAD)
  spatialScope: z.enum(['EXACT', 'PROXIMITY', 'BROAD']).nullable().optional(),
  radiusKm: z.number().nullable().optional(),

  // Where the buyer works — the point to measure commute FROM, never a filter.
  // `.passthrough()` below already let these survive the client echo; declared
  // because they are first-class Intent fields, not incidental extras.
  workplace: z.string().nullable().optional(),
  workplace_belt: z.string().array().nullable().optional(),
}).partial().passthrough()

export function isCityLevel(sector: string): boolean {
  return CITY_LEVEL_TERMS.includes(sector.toLowerCase().trim())
}

export function getIntentState(intent: Intent, hasExistingResults = false): IntentState {
  const hasBhk = (intent.bhk?.length ?? 0) > 0
  const hasBudget = !!intent.budgetMax
  // City-level (e.g. "Noida") and sector-level both count as location signals
  const hasSector = !!intent.sector
  const hasBuilder = !!intent.builderName
  const hasProjectNames = (intent.projectNames?.length ?? 0) > 0
  // Explicit timeline/possession intent (e.g. "ready to move", "possession in 1 year")
  const hasPossession = !!intent.possession

  if (!hasBhk && !hasBudget && !hasSector && !hasBuilder && !hasProjectNames && !hasPossession) return 'COLD'

  // Project names (comparison query) → fetch those specific projects.
  // Any TWO of {BHK, budget, sector} is enough to search (e.g. "3BHK in Sector 150",
  // "under 1.5Cr in Sector 150") — or an explicit builder/project. Asking for a 3rd
  // signal before showing anything feels like an interrogation, not advice.
  const signals = [hasBhk, hasBudget, hasSector].filter(Boolean).length
  const hasLifestyleKeywords = (intent.lifestyleKeywords?.length ?? 0) > 0
  if (
    hasProjectNames ||
    hasBuilder ||
    signals >= 2 ||
    (hasSector && hasLifestyleKeywords) ||
    (hasSector && hasPossession) ||     // "RTM Sector 137" → search immediately
    (hasBhk && hasLifestyleKeywords) || // "3BHK near metro" → search immediately!
    (hasBhk && hasPossession) ||        // "3BHK ready to move" → search immediately!
    (hasBudget && hasPossession) ||     // "under 2Cr ready to move" → enough signal
    (hasBudget && hasLifestyleKeywords) // "under 2Cr near metro" → search immediately!
  ) {
    return hasExistingResults ? 'SHORTLISTED' : 'READY_TO_SEARCH'
  }

  return 'GATHERING'
}
