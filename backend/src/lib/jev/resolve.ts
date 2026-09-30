// backend/src/lib/jev/resolve.ts
//
// Authoritative JEV Entity Resolver.
// Stricter than discovery-layer fuzzy matching:
// Rejection threshold: confidence < 0.75 returns null (eliminates hallucinations).

import { projectCatalog } from '../projectCatalog'
import { prisma } from '../db'

export interface ResolvedEntity {
  kind: 'project' | 'sector' | 'builder'
  id: string
  canonicalName: string
  confidence: number
  matchedOn: 'exact' | 'alias' | 'fuzzy'
}

export function levenshtein(a: string, b: string): number {
  const al = a.length
  const bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al

  const matrix: number[][] = []
  for (let i = 0; i <= al; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      )
    }
  }

  return matrix[al][bl]
}

export function toConfidence(dist: number, len: number): number {
  return parseFloat(Math.max(0, 1 - dist / Math.max(len, 4)).toFixed(3))
}

let sectorCache: Array<{ id: string; name: string }> | null = null
let builderCache: Array<{ id: string; name: string }> | null = null

export async function resolveEntity(
  candidateText: string,
  kind: 'project' | 'sector' | 'builder' | 'auto' = 'auto',
): Promise<ResolvedEntity | null> {
  const c = candidateText.trim().toLowerCase()
  if (!c || c.length < 2) return null

  // 1. Project Resolution (via in-memory projectCatalog)
  if (kind === 'project' || kind === 'auto') {
    const catalog = await projectCatalog()

    // 1a. Exact name or slug match
    for (const e of catalog) {
      const name = (e.name || '').toLowerCase()
      const slug = (e.slug || '').toLowerCase()
      if (name === c || slug === c) {
        return {
          kind: 'project',
          id: e.id,
          canonicalName: e.name,
          confidence: 1.0,
          matchedOn: 'exact',
        }
      }
    }

    // 1b. Fuzzy match
    let bestProject: { e: (typeof catalog)[0]; dist: number } | null = null
    for (const e of catalog) {
      const target = (e.name || '').toLowerCase()
      // Skip comparing if length difference is huge
      if (Math.abs(target.length - c.length) > 8) continue
      const dist = levenshtein(c, target)
      if (!bestProject || dist < bestProject.dist) {
        bestProject = { e, dist }
      }
    }

    if (bestProject) {
      const targetLen = Math.max(c.length, bestProject.e.name?.length ?? 10)
      const conf = toConfidence(bestProject.dist, targetLen)
      if (conf >= 0.75) {
        return {
          kind: 'project',
          id: bestProject.e.id,
          canonicalName: bestProject.e.name,
          confidence: conf,
          matchedOn: 'fuzzy',
        }
      }
    }
  }

  // 2. Sector Resolution
  if (kind === 'sector' || kind === 'auto') {
    if (!sectorCache) {
      try {
        const rows = await prisma.sectorIntelligence.findMany({
          select: { id: true, sector: true },
        })
        sectorCache = rows.map((r) => ({ id: r.id, name: r.sector }))
      } catch (e) {
        console.warn('[RESOLVE:SECTOR_CACHE_ERROR]', (e as Error).message)
        sectorCache = []
      }
    }

    // 2a. Exact match
    const exact = sectorCache.find((s) => s.name.toLowerCase() === c)
    if (exact) {
      return {
        kind: 'sector',
        id: exact.id,
        canonicalName: exact.name,
        confidence: 1.0,
        matchedOn: 'exact',
      }
    }

    // 2b. Fuzzy match for sector
    let bestSector: { s: (typeof sectorCache)[0]; dist: number } | null = null
    for (const s of sectorCache) {
      const target = s.name.toLowerCase()
      const dist = levenshtein(c, target)
      if (!bestSector || dist < bestSector.dist) {
        bestSector = { s, dist }
      }
    }
    if (bestSector) {
      const targetLen = Math.max(c.length, bestSector.s.name.length)
      const conf = toConfidence(bestSector.dist, targetLen)
      if (conf >= 0.75) {
        return {
          kind: 'sector',
          id: bestSector.s.id,
          canonicalName: bestSector.s.name,
          confidence: conf,
          matchedOn: 'fuzzy',
        }
      }
    }
  }

  // 3. Builder Resolution
  if (kind === 'builder' || kind === 'auto') {
    if (!builderCache) {
      try {
        const rows = await prisma.builder.findMany({
          select: { id: true, name: true },
        })
        builderCache = rows.map((r) => ({ id: r.id, name: r.name }))
      } catch (e) {
        console.warn('[RESOLVE:BUILDER_CACHE_ERROR]', (e as Error).message)
        builderCache = []
      }
    }

    // 3a. Exact match
    const exact = builderCache.find((b) => b.name.toLowerCase() === c)
    if (exact) {
      return {
        kind: 'builder',
        id: exact.id,
        canonicalName: exact.name,
        confidence: 1.0,
        matchedOn: 'exact',
      }
    }

    // 3b. Fuzzy match for builder
    let bestBuilder: { b: (typeof builderCache)[0]; dist: number } | null = null
    for (const b of builderCache) {
      const target = b.name.toLowerCase()
      const dist = levenshtein(c, target)
      if (!bestBuilder || dist < bestBuilder.dist) {
        bestBuilder = { b, dist }
      }
    }
    if (bestBuilder) {
      const targetLen = Math.max(c.length, bestBuilder.b.name.length)
      const conf = toConfidence(bestBuilder.dist, targetLen)
      if (conf >= 0.75) {
        return {
          kind: 'builder',
          id: bestBuilder.b.id,
          canonicalName: bestBuilder.b.name,
          confidence: conf,
          matchedOn: 'fuzzy',
        }
      }
    }
  }

  return null
}
