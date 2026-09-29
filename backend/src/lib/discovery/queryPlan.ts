// backend/src/lib/discovery/queryPlan.ts
//
// Immutable QueryPlan compiler from RequirementState into Prisma search filters.
// Enforces zero silent fallback and guarantees strict separation of hard vs soft constraints.

import { Prisma } from '@prisma/client'
import type { RequirementState } from './requirementState'
import { SECTOR_ADJACENCY } from './constants'
import { normalizeSectorName } from '../ai/intent'

export interface QueryPlan {
  where: Prisma.ProjectWhereInput
  hardConstraints: {
    includedSectors: string[]
    excludedSectors: string[]
    budgetMaxCr?: number
    isHardBudget: boolean
    minCarpetSqft?: number
    isHardCarpet: boolean
    bhk: number[]
    isHardBhk: boolean
    status: string
    isHardStatus: boolean
  }
  softPreferences: {
    preferredSectors: string[]
    luxuryPreferred: boolean
  }
  relaxationPolicy: {
    allowLocationExpansion: boolean
    allowBudgetExpansion: boolean
    budgetRelaxationPct: number
  }
}

export const CENTRAL_NOIDA_SECTORS = [
  'Sector 50',
  'Sector 51',
  'Sector 52',
  'Sector 61',
  'Sector 70',
  'Sector 74',
  'Sector 75',
  'Sector 76',
  'Sector 77',
  'Sector 78',
  'Sector 79',
]

/**
 * Resolves a region label (e.g. "Central Noida") into constituent residential sectors.
 */
export function expandRegionToSectors(regionOrSector: string): string[] {
  const norm = regionOrSector.trim().toLowerCase()
  if (norm.includes('central noida') || norm === 'central') {
    return [...CENTRAL_NOIDA_SECTORS]
  }
  const clean = normalizeSectorName(regionOrSector) || regionOrSector
  return [clean]
}

/**
 * Compiles a strict, immutable QueryPlan from RequirementState.
 */
export function compileQueryPlan(state: RequirementState): QueryPlan {
  const andConditions: Prisma.ProjectWhereInput[] = []

  // 1. Resolve Location Constraints
  const includedSectors: string[] = []
  for (const loc of state.location.include) {
    includedSectors.push(...expandRegionToSectors(loc))
  }

  const excludedSectors: string[] = []
  for (const exc of state.location.exclude) {
    excludedSectors.push(...expandRegionToSectors(exc))
  }

  if (includedSectors.length > 0) {
    andConditions.push({
      sector: {
        in: includedSectors,
        mode: 'insensitive',
      },
    })
  }

  if (excludedSectors.length > 0) {
    andConditions.push({
      sector: {
        notIn: excludedSectors,
        mode: 'insensitive',
      },
    })
  }

  // 2. Budget Constraints
  if (state.budget.maxCr !== undefined && state.budget.isHardCeiling) {
    andConditions.push({
      price_min_cr: {
        lte: state.budget.maxCr,
      },
    })
  }

  if (state.budget.minCr !== undefined) {
    andConditions.push({
      price_min_cr: {
        gte: state.budget.minCr,
      },
    })
  }

  // 3. Status Constraints
  if (state.unit.isStatusHard && state.unit.status !== 'any') {
    if (state.unit.status === 'ready_to_move') {
      andConditions.push({
        status: { equals: 'ready_to_move' },
      })
    } else if (state.unit.status === 'under_construction') {
      andConditions.push({
        status: { in: ['under_construction', 'new_launch'] },
      })
    }
  }

  // 4. BHK Constraints (matches unit_types relation if hard)
  if (state.unit.isBhkHard && state.unit.bhk.length > 0) {
    andConditions.push({
      unit_types: {
        some: {
          bhk: { in: state.unit.bhk },
        },
      },
    })
  }

  const where: Prisma.ProjectWhereInput = andConditions.length > 0 ? { AND: andConditions } : {}

  return {
    where,
    hardConstraints: {
      includedSectors,
      excludedSectors,
      budgetMaxCr: state.budget.maxCr,
      isHardBudget: state.budget.isHardCeiling,
      minCarpetSqft: state.unit.minCarpetSqft,
      isHardCarpet: state.unit.isCarpetHard,
      bhk: state.unit.bhk,
      isHardBhk: state.unit.isBhkHard,
      status: state.unit.status,
      isHardStatus: state.unit.isStatusHard,
    },
    softPreferences: {
      preferredSectors: state.location.softPreferences,
      luxuryPreferred: state.preferences.isLuxuryPreferred,
    },
    relaxationPolicy: {
      allowLocationExpansion: state.location.softPreferences.length > 0 || includedSectors.length === 0,
      allowBudgetExpansion: !state.budget.isHardCeiling,
      budgetRelaxationPct: state.budget.isHardCeiling ? 0 : 15,
    },
  }
}
