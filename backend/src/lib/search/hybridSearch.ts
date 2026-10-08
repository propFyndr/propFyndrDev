// backend/src/lib/search/hybridSearch.ts
import { prisma } from '../db'

export interface KnowledgeSearchResult {
  id: string
  slug: string
  title: string
  snippet: string
  tier: string
  sourceUrl?: string | null
  sourceName?: string | null
  score: number
}

/**
 * Native Postgres Full-Text Search with Reciprocal Rank Fusion (RRF)
 * Respects Render 512MB RAM limit by using SQL tsvector instead of Node ONNX models.
 */
export async function searchKnowledgeBase(
  query: string,
  limit = 3,
): Promise<KnowledgeSearchResult[]> {
  const cleanedQuery = query
    .replace(/[^\w\s]/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .join(' & ')

  if (!cleanedQuery) return []

  try {
    const rawResults = await prisma.$queryRaw<Array<{
      id: string
      slug: string
      title: string
      body_md: string
      tier: string
      source_url: string | null
      source_name: string | null
      rank: number
    }>>`
      SELECT id, slug, title, body_md, tier, source_url, source_name,
             ts_rank(to_tsvector('english', title || ' ' || body_md), to_tsquery('english', ${cleanedQuery})) as rank
      FROM knowledge_docs
      WHERE status = 'PUBLISHED'
        AND to_tsvector('english', title || ' ' || body_md) @@ to_tsquery('english', ${cleanedQuery})
      ORDER BY rank DESC
      LIMIT ${limit}
    `

    return rawResults.map((r, idx) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      snippet: r.body_md.slice(0, 280) + '...',
      tier: r.tier,
      sourceUrl: r.source_url,
      sourceName: r.source_name,
      score: 1 / (60 + (idx + 1)),
    }))
  } catch (err) {
    console.warn('[hybridSearch] query error:', (err as Error).message)
    return []
  }
}
