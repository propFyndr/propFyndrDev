/**
 * Post-process extracted intent to:
 * 1. Qualify sectors with their cities
 * 2. Detect project context switches
 * 3. Enrich intent with project location data
 */

import { prisma } from '../db'
import type { Intent } from './types'
import { getQualifiedSector } from './sectorToCity'

export interface IntentPostProcessResult {
  intent: Intent
  projectContext?: {
    projectId: string
    projectName: string
    sector: string
    city: string
  }
  contextSwitched: boolean
}

/**
 * Post-process intent: qualify sectors, resolve projects.
 * When a new project is mentioned, pull its sector and city to populate intent.
 */
export async function postProcessIntent(
  rawIntent: Intent,
  previousProjectIds: string[] = [],
  city: string = 'Noida',
): Promise<IntentPostProcessResult> {
  const result: IntentPostProcessResult = {
    intent: { ...rawIntent },
    contextSwitched: false,
  }

  // Qualify sector with city if present
  if (rawIntent.sector) {
    // The city the buyer named settles shared numbers: "Noida sector 1" is not GNW's Sector 1.
    const qualified = getQualifiedSector(rawIntent.sector, rawIntent.city)
    if (qualified) {
      result.intent.sector = qualified
    }
  }

  // If projects mentioned, fetch their details and potentially update intent
  if (rawIntent.projectNames && rawIntent.projectNames.length > 0) {
    const primaryProjectName = rawIntent.projectNames[0]
    const project = await prisma.project.findFirst({
      where: {
        name: { contains: primaryProjectName, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        sector: true,
        city: true,
      },
    })

    if (project) {
      result.projectContext = {
        projectId: project.id,
        projectName: project.name,
        sector: project.sector,
        city: project.city,
      }

      // Detect context switch: new project mentioned that's different from previous context
      const isNewProject = !previousProjectIds.includes(project.id)
      if (isNewProject && previousProjectIds.length > 0) {
        result.contextSwitched = true
        // When switching projects, the sector should come from the project itself
        result.intent.sector = project.sector
        // Reset BHK/budget to allow search from the new project context
        // Keep other parameters but let them refine for the new project
      } else if (isNewProject) {
        // First mention of a project in this conversation
        // Populate sector from project if not explicitly set by user
        if (!rawIntent.sector) {
          result.intent.sector = project.sector
        }
      }
    }
  }

  return result
}

/**
 * Detect if user is asking about a different project than before.
 * Used to determine if intent context needs to reset.
 */
export function hasProjectContextChange(
  currentProjectIds: string[],
  previousProjectIds: string[],
): boolean {
  if (previousProjectIds.length === 0) return false
  if (currentProjectIds.length === 0) return false

  // If the primary project (first in list) changed, context switched
  return currentProjectIds[0] !== previousProjectIds[0]
}
