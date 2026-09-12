/** Explicit context caching for the stable half of the system prompt. */

import { createHash } from 'node:crypto'
import type { GoogleGenAI } from '@google/genai'

/** How long a freshly created or refreshed entry lives. */
const TTL_SECONDS = 3600

/** Refresh when this much of the TTL remains, rather than on every call. */
const REFRESH_WHEN_REMAINING_MS = 10 * 60 * 1000

/** Below this, Gemini rejects the create call outright. */
const MIN_CACHEABLE_TOKENS = 1024

/** Rough token estimate. Only used to skip a create that would certainly fail. */
const estimateTokens = (text: string) => Math.ceil(text.length / 4)

interface Entry {
  /** Resource name Gemini returns, e.g. "cachedContents/abc123". */
  name: string
  /** Local clock estimate of expiry, used to decide on refresh. */
  expiresAt: number
}

const entries = new Map<string, Entry>()

/** Set when a create fails, so we try once per prompt/model and not per turn. */
const failed = new Set<string>()

/**
 * The tool declarations are part of the cached resource, so two heads that are
 * byte-identical but carry different catalogues are different caches. Folding
 * them into the key is what stops a tool-less leg reusing a tool-carrying entry
 * (which would silently re-enable tools on a leg that cannot handle them).
 */
function keyFor(model: string, apiKey: string, head: string, tools?: unknown): string {
  const h = createHash('sha256').update(head).digest('hex').slice(0, 16)
  const k = createHash('sha256').update(apiKey).digest('hex').slice(0, 8)
  const t = tools
    ? createHash('sha256').update(JSON.stringify(tools)).digest('hex').slice(0, 8)
    : 'notools'
  return `${model}:${k}:${h}:${t}`
}

/** Off unless explicitly asked for. */
export function explicitCacheEnabled(): boolean {
  return process.env.GEMINI_EXPLICIT_CACHE === 'true'
}

/**
 * The cached-content resource name for this prompt head, or null.
 *
 * `tools` is stored IN the cache rather than sent per request. Gemini refuses a
 * request that sets `tools` or `systemInstruction` alongside `cachedContent`,
 * so a tool-carrying leg could not cache at all while the declarations
 * travelled on the request — which meant the whole tool-capable tier, the only
 * tier that can read our own rows, paid full rate for an identical prompt every
 * single turn. `CreateCachedContentConfig` accepts both, so both move here.
 */
export async function getCachedPrefix(
  client: GoogleGenAI,
  model: string,
  apiKey: string,
  head: string,
  tools?: unknown[],
): Promise<string | null> {
  if (!explicitCacheEnabled()) return null
  if (!head) return null
  if (estimateTokens(head) < MIN_CACHEABLE_TOKENS) return null

  const key = keyFor(model, apiKey, head, tools)
  if (failed.has(key)) return null

  const now = Date.now()
  const existing = entries.get(key)

  if (existing) {
    if (existing.expiresAt > now + REFRESH_WHEN_REMAINING_MS) return existing.name
    // Close to expiry and still in use: extend rather than recreate, which
    // keeps the same entry (and the same stored tokens) alive.
    try {
      await client.caches.update({ name: existing.name, config: { ttl: `${TTL_SECONDS}s` } })
      existing.expiresAt = now + TTL_SECONDS * 1000
      return existing.name
    } catch {
      // Expired server-side already, or gone. Drop it and fall through to create.
      entries.delete(key)
    }
  }

  try {
    const created = await client.caches.create({
      model,
      config: {
        systemInstruction: head,
        ...(tools && tools.length > 0 ? { tools: tools as never } : {}),
        ttl: `${TTL_SECONDS}s`,
        displayName: 'propfyndr-system-prompt',
      },
    })
    if (!created?.name) return null
    entries.set(key, { name: created.name, expiresAt: now + TTL_SECONDS * 1000 })
    console.log(
      `[gemini:cache] created ${created.name} for ${model} (~${estimateTokens(head)} tokens, ttl ${TTL_SECONDS}s)`,
    )
    return created.name
  } catch (err) {
    // One line, once per prompt/model — not on every turn.
    failed.add(key)
    console.warn(
      `[gemini:cache] explicit cache unavailable for ${model}; continuing uncached:`,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/** Test seam. Also useful if a deploy needs to force fresh entries. */
export function resetGeminiCacheState(): void {
  entries.clear()
  failed.clear()
}

/** Introspection for the health check and tests. */
export function cachedPrefixCount(): number {
  return entries.size
}
