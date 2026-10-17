// backend/src/lib/builderNames.ts
//
// The builder-name list, cached, because two places on the hot path were each
// doing their own unbounded `prisma.builder.findMany` on every turn:
//
//   groundedAnswer.findBuilderMentioned  — runs for every GENERAL open query,
//                                          including "hi"
//   coverageAnswer.builderCoverage       — runs whenever its regex fires
//
// Neither needs anything but the names, and the names change when an admin
// onboards a builder, not per request. Same 300s window and the same
// non-fatal-on-Redis-failure contract as `chat:projectCatalog`.

import { prisma } from './db'
import { getCached, setCached } from './cache'

const CACHE_KEY = 'chat:builderNames'

/** Every builder name we hold. Empty on a database failure, never throws. */
export async function builderNames(): Promise<string[]> {
  const hit = await getCached<string[]>(CACHE_KEY)
  if (hit) return hit
  try {
    const rows = await prisma.builder.findMany({ select: { name: true } })
    const names = rows.map((r) => r.name).filter((n): n is string => Boolean(n))
    await setCached(CACHE_KEY, names, 300)
    return names
  } catch (e) {
    console.warn('[BUILDER_NAMES:DB_ERROR]', (e as Error).message)
    return []
  }
}

/**
 * The longest builder name the message contains, or null.
 *
 * Longest wins so "Gaur City" does not shadow "Gaurs Group" when both match.
 * Four characters minimum: shorter names are almost all generic words that
 * appear inside ordinary sentences.
 */
export async function builderMentionedIn(message: string): Promise<string | null> {
  const haystack = (message ?? '').toLowerCase()
  if (haystack.length < 4) return null
  const names = await builderNames()
  return (
    names
      .filter((n) => n.length >= 4 && haystack.includes(n.toLowerCase()))
      .sort((a, b) => b.length - a.length)[0] ?? null
  )
}

/**
 * Words an extractor returns as a "builder name" that name no builder.
 *
 * Live transcript (17 Oct 2026): "banks … for these properties" left
 * `builderName: 'these'` in the intent; every later search filtered on a builder
 * called "these", returned nothing, and the buyer was told we hold no 3 BHK under
 * ₹1.5 Cr in Greater Noida for the rest of the session.
 */
const NOT_A_BUILDER = new Set([
  'these', 'this', 'those', 'them', 'that', 'it', 'its', 'each', 'all', 'any', 'every', 'same', 'their', 'the',
  'of', 'one', 'ones', 'other', 'others', 'builder', 'builders', 'developer', 'developers', 'project', 'projects',
  'property', 'properties', 'company', 'good', 'best', 'top', 'trusted', 'reputed', 'which', 'what', 'who',
])

/** False for a pronoun or generic word the extractor mistook for a builder name. */
export function isBuilderNameCandidate(name: string | null | undefined): boolean {
  const words = (name ?? '').toLowerCase().replace(/[^a-z0-9&\s]/g, ' ').split(/\s+/).filter(Boolean)
  return words.some((w) => w.length >= 3 && !NOT_A_BUILDER.has(w))
}
