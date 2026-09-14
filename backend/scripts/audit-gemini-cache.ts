// backend/scripts/audit-gemini-cache.ts
//
//   npx tsx scripts/audit-gemini-cache.ts
//
// Is Gemini prompt caching working, and if not, why?
//
// This existed as a half-day of manual probing. The answer was not what the
// logs suggested: `[gemini:cache] no cache hit — 14800 prompt tokens billed at
// full rate`, on every turn, reads like a prefix-stability bug, and the prefix
// was the first thing suspected. It is not the cause. The prompt head is
// byte-identical across turns (DEBUG_PROMPT_STABILITY=1 confirms it), and the
// explicit-cache path memoises its own refusal and is off by default, so
// neither is costing anything.
//
// The cause is the billing tier. On Gemini's free tier:
//   - explicit caching is refused outright — `TotalCachedContentStorageTokens
//     PerModelFreeTier ... limit=0`
//   - implicit caching reports `cachedContentTokenCount: 0` on every call, even
//     for three consecutive identical 7,930-token prefixes
//
// No code change makes caching engage on that tier. The machinery is already
// correct and starts paying the moment billing is enabled — which is what this
// script is for: run it after enabling billing to confirm, rather than
// inferring it from a log line that says the same thing either way.

import 'dotenv/config'
import { GoogleGenAI } from '@google/genai'
import { MODELS } from '../src/lib/config'
import { explicitCacheEnabled } from '../src/lib/ai/geminiCache'

const MODEL = process.argv[2] || MODELS.GEMINI_LITE

/** Comfortably past every documented implicit-cache minimum. */
const PREFIX = (
  'You are RealtyPal, a candid expert real estate advisor for Noida. ' +
  'Rule: never invent data. Rule: show trade-offs. Rule: cite the tier of every fact. '
).repeat(220)

function keyFor(): { key: string; label: string } {
  for (const label of ['GEMINI_API_KEY1', 'GEMINI_API_KEY2', 'GEMINI_API_KEY']) {
    const key = process.env[label]
    if (key) return { key, label }
  }
  throw new Error('No Gemini API key configured')
}

async function implicitProbe(client: GoogleGenAI): Promise<number[]> {
  const cached: number[] = []
  for (let i = 0; i < 3; i++) {
    const r = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
      config: { systemInstruction: PREFIX, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 128 } },
    })
    const u = (r as unknown as { usageMetadata?: Record<string, number> }).usageMetadata ?? {}
    const hit = u.cachedContentTokenCount ?? 0
    cached.push(hit)
    console.log(`  call ${i + 1}: prompt=${u.promptTokenCount} cached=${hit}`)
    await new Promise((s) => setTimeout(s, 2500))
  }
  return cached
}

async function explicitProbe(client: GoogleGenAI): Promise<string> {
  try {
    const c = await client.caches.create({
      model: MODEL,
      config: { systemInstruction: PREFIX, ttl: '120s', displayName: 'propfyndr-cache-audit' },
    })
    if (c?.name) {
      await client.caches.delete({ name: c.name }).catch(() => {})
      return 'ALLOWED'
    }
    return 'NO_NAME_RETURNED'
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

async function main(): Promise<void> {
  const { key, label } = keyFor()
  const client = new GoogleGenAI({ apiKey: key })
  console.log(`\nGemini cache audit — model ${MODEL}, key ${label}\n${'='.repeat(66)}`)
  console.log(`GEMINI_EXPLICIT_CACHE: ${explicitCacheEnabled() ? 'on' : 'off (getCachedPrefix returns null, no API call)'}`)

  console.log('\nImplicit caching — same 7.9k-token prefix, three times:')
  const cached = await implicitProbe(client)
  const implicitWorks = cached.slice(1).some((n) => n > 0)

  console.log('\nExplicit caching — can this key create a cached content resource?')
  const explicit = await explicitProbe(client)
  const freeTier = /FreeTier|limit=0/.test(explicit)
  console.log(`  ${explicit.slice(0, 180)}`)

  console.log(`\n${'='.repeat(66)}`)
  if (implicitWorks) {
    console.log('IMPLICIT CACHING IS WORKING — the prompt head is being discounted.')
  } else if (freeTier) {
    console.log('FREE TIER. Caching cannot engage, and no code change will make it.')
    console.log('Enable billing on the Google Cloud project behind this key. The head')
    console.log('is already byte-stable, so implicit caching starts applying by itself;')
    console.log('set GEMINI_EXPLICIT_CACHE=true to also use the explicit path.')
  } else {
    console.log('NO CACHE HITS, and the tier is not obviously the reason. Check that the')
    console.log('prompt head is byte-stable first: DEBUG_PROMPT_STABILITY=1 and compare')
    console.log('[PROMPT_HEAD_HASH] across turns — one repeated hash means the prefix is fine.')
  }
  if (!implicitWorks) process.exitCode = 1
}

main()
