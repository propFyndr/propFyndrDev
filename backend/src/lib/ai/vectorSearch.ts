/**
 * PropFyndr - pgvector semantic and hybrid search.
 *
 * 1. Embedding generation via Cohere embed-english-light-v3.0 (384-dim), cached
 *    in-process and in Redis.
 * 2. Cosine similarity search (the `<=>` operator) over `builder_news`.
 * 3. Hybrid search: Reciprocal Rank Fusion over a keyword leg and a vector leg.
 *
 * `projects.embedding` is populated and indexed but has no reader: semantic
 * project search was removed when the news answer stopped appending a
 * cross-builder project list, because a paid placement in the rail could reach
 * it. The column stays seeded so a future project search does not need a
 * migration to come back.
 *
 * There is no embedding fallback provider. The header used to claim "fallbacks
 * to Mistral / deterministic projection"; neither exists. When Cohere is
 * unavailable `getEmbedding` returns null, the vector leg returns nothing, and
 * every caller degrades to keyword matching — `searchNewsHybrid` still answers
 * and `searchNewsSemantic` returns empty. That is the intended degraded mode,
 * and nothing throws.
 */

import { createHash } from 'node:crypto'
import { prisma } from '../db'
import { getCached, setCached } from '../cache'

const EMBEDDING_CACHE_TTL = 86400 * 7 // 7 days cache for embeddings

/**
 * Which side of an asymmetric embedding a text sits on.
 *
 * Cohere v3 embeds a corpus document and a search query into deliberately
 * different places, and the pairing is what makes retrieval work. Passing
 * `search_query` for both — which is what this file did, including from the
 * seed script — puts every stored vector in the wrong subspace relative to the
 * queries run against it. There is no default: each call site says which side
 * it is on, because getting it wrong is silent and only shows up as mediocre
 * ranking.
 */
export type EmbeddingInputType = 'search_query' | 'search_document'

/**
 * Process-local embedding cache.
 *
 * Bounded, because it was not: an unevicted Map keyed on arbitrary user text
 * grows for the life of the process. The bound is generous relative to the
 * distinct-query volume of a single instance, and Redis is the durable tier
 * behind it, so an eviction costs one cache lookup rather than an API call.
 */
const IN_MEMORY_CACHE_MAX = 500
const IN_MEMORY_CACHE = new Map<string, number[]>()

function memoize(key: string, vector: number[]): void {
  // Map iterates in insertion order, so the first key is the oldest.
  if (IN_MEMORY_CACHE.size >= IN_MEMORY_CACHE_MAX) {
    const oldest = IN_MEMORY_CACHE.keys().next().value
    if (oldest !== undefined) IN_MEMORY_CACHE.delete(oldest)
  }
  IN_MEMORY_CACHE.set(key, vector)
}

/**
 * Cache key for one embedding.
 *
 * Hashes the whole text. The previous key was the first 48 base64 characters of
 * it, which is the first 36 bytes of input — so any two texts agreeing on their
 * first 36 characters shared a cache entry and were handed the same vector. The
 * seed script's own text template, `"<Project> by <Builder> in <Sector> Noida"`,
 * collides inside 36 characters across sibling projects of one builder.
 *
 * `inputType` is part of the key: the same sentence embedded as a document and
 * as a query are different vectors and must not share an entry.
 */
function cacheKeyFor(text: string, inputType: EmbeddingInputType): string {
  const digest = createHash('sha256').update(text).digest('base64url')
  return `embed:v2:${inputType}:${digest}`
}

export interface SemanticNewsResult {
  id: string
  title: string
  description: string
  /**
   * Cosine similarity, present only on results that came through the vector
   * leg. A keyword-only match has no similarity and carries none: it used to be
   * handed a flat 0.8, which then reached the prompt as "Semantic Relevance:
   * 80.0%" — a confidence figure measuring nothing. Ranking uses `rrfScore`,
   * which never read this field.
   */
  similarity?: number
  builder_id: string
  builder_name?: string
  link_target?: string | null
}


/** The dimension every stored vector and every column is constrained to. */
export const EMBEDDING_DIMENSIONS = 384

/**
 * A 384-dimension embedding for one text, or null if we could not produce one.
 *
 * `inputType` is required — see EmbeddingInputType. Corpus text passes
 * 'search_document', a buyer's question passes 'search_query'.
 */
export async function getEmbedding(
  text: string,
  inputType: EmbeddingInputType
): Promise<number[] | null> {
  const cleanText = text.trim().slice(0, 1000)
  if (!cleanText) return null

  const cacheKey = cacheKeyFor(cleanText, inputType)

  // 1. In-process, keyed identically to Redis so the two tiers cannot disagree.
  const memCached = IN_MEMORY_CACHE.get(cacheKey)
  if (memCached) return memCached

  // 2. Redis.
  try {
    const redisCached = await getCached<number[]>(cacheKey)
    if (redisCached && Array.isArray(redisCached)) {
      memoize(cacheKey, redisCached)
      return redisCached
    }
  } catch {
    // Non-blocking
  }

  // 3. Cohere.
  const cohereKey = process.env.COHERE_API_KEY
  if (cohereKey) {
    try {
      const res = await fetch('https://api.cohere.com/v1/embed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cohereKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: [cleanText],
          model: 'embed-english-light-v3.0',
          input_type: inputType,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const vector: number[] = data.embeddings?.[0]
        if (vector && vector.length === EMBEDDING_DIMENSIONS) {
          memoize(cacheKey, vector)
          void setCached(cacheKey, vector, EMBEDDING_CACHE_TTL).catch(() => {})
          return vector
        }
        console.warn('[vectorSearch] Cohere returned no usable vector')
      } else {
        // A non-ok response used to fall straight through to `return null`,
        // logging nothing. A seed run then reported hundreds of failures with
        // no cause attached — the status is the whole diagnosis, and 429 in
        // particular is a retry, not a failure.
        console.warn(
          `[vectorSearch] Cohere embed HTTP ${res.status}:`,
          (await res.text().catch(() => '')).slice(0, 200)
        )
      }
    } catch (err: any) {
      // No fallback provider exists; the caller degrades to keyword matching.
      console.warn('[vectorSearch] Cohere embed failed:', err.message)
    }
  }

  return null
}

/** Cohere accepts up to 96 texts per embed call. */
const EMBED_BATCH_MAX = 96

/**
 * Embeddings for many texts, in as few API calls as possible.
 *
 * For corpus work, not for the request path. Seeding one text per call meant
 * roughly 290 calls for the catalogue, against a Cohere trial key capped at 40
 * calls per minute — so a seed run embedded the first 109 rows and then took
 * HTTP 429 for every one of the remaining 273. Batched, the same run is four
 * calls.
 *
 * Returns one entry per input, positionally aligned, null where the batch
 * failed. Uncached deliberately: the result is about to be written to a column,
 * and filling Redis with the whole corpus to serve a one-shot script is waste.
 */
export async function getEmbeddingsBatch(
  texts: string[],
  inputType: EmbeddingInputType
): Promise<Array<number[] | null>> {
  const cohereKey = process.env.COHERE_API_KEY
  if (!cohereKey) return texts.map(() => null)

  const out: Array<number[] | null> = []

  for (let i = 0; i < texts.length; i += EMBED_BATCH_MAX) {
    const chunk = texts.slice(i, i + EMBED_BATCH_MAX).map((t) => t.trim().slice(0, 1000))
    try {
      const res = await fetch('https://api.cohere.com/v1/embed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cohereKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: chunk,
          model: 'embed-english-light-v3.0',
          input_type: inputType,
        }),
      })

      if (!res.ok) {
        console.warn(
          `[vectorSearch] batch embed HTTP ${res.status}:`,
          (await res.text().catch(() => '')).slice(0, 200)
        )
        out.push(...chunk.map(() => null))
        continue
      }

      const data = await res.json()
      const vectors: number[][] = data.embeddings ?? []
      for (let j = 0; j < chunk.length; j++) {
        const v = vectors[j]
        out.push(v && v.length === EMBEDDING_DIMENSIONS ? v : null)
      }
    } catch (err: any) {
      console.warn('[vectorSearch] batch embed failed:', err.message)
      out.push(...chunk.map(() => null))
    }
  }

  return out
}

/**
 * Perform pgvector cosine similarity search on builder news and milestones.
 */
export async function searchNewsSemantic(
  query: string,
  limit = 5,
  minSimilarity = 0.35
): Promise<SemanticNewsResult[]> {
  const vector = await getEmbedding(query, 'search_query')
  if (!vector) return []

  const vectorStr = `[${vector.join(',')}]`

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 
        bn.id, 
        bn.title, 
        bn.description, 
        bn.builder_id,
        bn.link_target,
        b.name as builder_name,
        (1 - (bn.embedding <=> $1::vector)) as similarity
      FROM builder_news bn
      LEFT JOIN builders b ON bn.builder_id = b.id
      WHERE bn.embedding IS NOT NULL
        AND bn.status = 'published'
        AND bn.archived_at IS NULL
      ORDER BY bn.embedding <=> $1::vector ASC
      LIMIT $2;`,
      vectorStr,
      limit
    )

    return rows
      .filter((r) => Number(r.similarity) >= minSimilarity)
      .map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        builder_id: r.builder_id,
        builder_name: r.builder_name || undefined,
        link_target: r.link_target,
        similarity: Number(r.similarity),
      }))
  } catch (err: any) {
    console.error('[vectorSearch] searchNewsSemantic failed:', err.message)
    return []
  }
}

/**
 * Hybrid Search for News (Reciprocal Rank Fusion):
 * Combines full-text / ILIKE keyword matches with pgvector semantic similarity.
 */
export async function searchNewsHybrid(query: string, limit = 5): Promise<SemanticNewsResult[]> {
  // 1. Vector Search
  const vectorResults = await searchNewsSemantic(query, limit * 2)

  // 2. Keyword Search (ILIKE)
  const textMatches = await prisma.builderNews.findMany({
    where: {
      status: 'published',
      archived_at: null,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { builder: { name: { contains: query, mode: 'insensitive' } } },
      ],
    },
    include: { builder: { select: { name: true } } },
    take: limit * 2,
  })

  // 3. Reciprocal Rank Fusion (RRF)
  const k = 60
  const scores = new Map<string, { item: SemanticNewsResult; rrfScore: number }>()

  // Rank vector results
  vectorResults.forEach((res, rank) => {
    const rrfScore = 1 / (k + (rank + 1))
    scores.set(res.id, { item: res, rrfScore })
  })

  // Rank text results
  textMatches.forEach((item, rank) => {
    const textScore = 1 / (k + (rank + 1))
    const existing = scores.get(item.id)
    if (existing) {
      existing.rrfScore += textScore
    } else {
      scores.set(item.id, {
        item: {
          id: item.id,
          title: item.title,
          description: item.description,
          builder_id: item.builder_id,
          builder_name: item.builder?.name,
          link_target: item.link_target,
          // No similarity: this row matched on keywords, not on distance.
        },
        rrfScore: textScore,
      })
    }
  })

  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit)
    .map((s) => s.item)
}
