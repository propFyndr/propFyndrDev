import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { extractIntent } from './intent'

describe('intent extraction resilience', () => {
  // These cases are about the outage path: every provider is gone and the
  // heuristic is all that is left, which is why they assert `degraded`. The
  // regex fast path answers the same short messages without ever entering the
  // chain, so it has to be off here or the tests stop describing an outage.
  let previousFastPath: string | undefined
  before(() => {
    previousFastPath = process.env.INTENT_FAST_PATH
    process.env.INTENT_FAST_PATH = 'false'
  })
  after(() => {
    if (previousFastPath === undefined) delete process.env.INTENT_FAST_PATH
    else process.env.INTENT_FAST_PATH = previousFastPath
  })

  it('should extract BHK from heuristic pattern', async () => {
    // Disable OpenAI to force fallback
    // Every provider removed, not just two — otherwise the "all providers
    // failed" path these tests describe is only reached when the remaining
    // providers happen to be unreachable, and the suite passes or fails on
    // whichever key is live that day.
    const restoreKeys = removeAllProviderKeys()

    try {
      const result = await extractIntent('Show me 3BHK properties', {})
      assert(result.degraded === true)
      assert.deepStrictEqual(result.intent.bhk, [3])
    } finally {
      restoreKeys()
    }
  })

  it('should extract budget from heuristic pattern', async () => {
    // Every provider removed, not just two — otherwise the "all providers
    // failed" path these tests describe is only reached when the remaining
    // providers happen to be unreachable, and the suite passes or fails on
    // whichever key is live that day.
    const restoreKeys = removeAllProviderKeys()

    try {
      const result = await extractIntent('Properties under 2.5 crore', {})
      assert(result.degraded === true)
      assert.equal(result.intent.budgetMax, 2.5)
    } finally {
      restoreKeys()
    }
  })

  it('should extract sector from heuristic pattern', async () => {
    // Every provider removed, not just two — otherwise the "all providers
    // failed" path these tests describe is only reached when the remaining
    // providers happen to be unreachable, and the suite passes or fails on
    // whichever key is live that day.
    const restoreKeys = removeAllProviderKeys()

    try {
      const result = await extractIntent('Properties in Sector 150', {})
      assert(result.degraded === true)
      assert.equal(result.intent.sector, 'Sector 150')
    } finally {
      restoreKeys()
    }
  })

  it('should preserve previous intent when heuristic matches nothing', async () => {
    // Every provider removed, not just two — otherwise the "all providers
    // failed" path these tests describe is only reached when the remaining
    // providers happen to be unreachable, and the suite passes or fails on
    // whichever key is live that day.
    const restoreKeys = removeAllProviderKeys()

    try {
      const previousIntent = { sector: 'Sector 75', bhk: [2] }
      const result = await extractIntent('Tell me more', previousIntent)
      assert(result.degraded === true)
      // Should preserve previous intent
      assert.deepStrictEqual(result.intent.sector, previousIntent.sector)
      assert.deepStrictEqual(result.intent.bhk, previousIntent.bhk)
    } finally {
      restoreKeys()
    }
  })
})

describe('intent extraction fast path', () => {
  // Extraction runs to completion before the answering call starts, so every
  // millisecond here is in front of the buyer. Measured p50 was 3.4s and p90
  // 6.7s for messages the regexes parse exactly.

  it('answers a simple keyword query without calling a provider', async () => {
    const result = await extractIntent('2 bhk in sector 75 noida', {})
    assert.equal(result.degraded, false, 'a deliberate fast path is not a degraded one')
    assert.deepStrictEqual(result.intent.bhk, [2])
    assert.equal(result.intent.sector, 'Sector 75')
  })

  it('defers to the model when the message carries a second clause', async () => {
    // If this took the fast path it would silently drop the school and metro
    // constraints, which are the difference between a good answer and a list.
    const message = 'I have 80 lakh, need a 2 BHK near a metro with good schools'
    const heuristicOnly = await raceAgainstProvider(message)
    assert.equal(heuristicOnly, false, 'multi-constraint message must not take the fast path')
  })

  it('defers to the model on a follow-up, which needs previous intent', async () => {
    const heuristicOnly = await raceAgainstProvider('make that 2 crore', { sector: 'Sector 75' })
    assert.equal(heuristicOnly, false, 'a refinement must not take the fast path')
  })
})

/**
 * True when the fast path handled the message alone. Detected by the absence of
 * any provider key: with the chain unreachable, a non-degraded result can only
 * have come from the fast path, and a degraded one can only have come from the
 * chain giving up.
 */
async function raceAgainstProvider(message: string, previous = {}): Promise<boolean> {
  // Uses the same full key list as `removeAllProviderKeys`. This used to carry
  // its own shorter list of seven, which held while the intent path had its own
  // hand-written chain of six legs. Now that the chain is derived from
  // FALLBACK_CHAIN, GROQ_API_KEY2 stayed in the environment, answered, and the
  // test read a real provider call as the fast path.
  const restore = removeAllProviderKeys()
  try {
    const result = await extractIntent(message, previous)
    return result.degraded === false
  } finally {
    restore()
  }
}

/** Removes every provider key, returning a function that puts them all back. */
function removeAllProviderKeys(): () => void {
  // Must list EVERY envKey in FALLBACK_CHAIN. Adding GEMINI_API_KEY2 and
  // MISTRAL_API_KEY1 to the chain on 30 Aug left them off this list, so two
  // live keys survived the "all providers gone" setup, a provider answered,
  // and the outage these tests describe never happened.
  //
  // Not derived from FALLBACK_CHAIN programmatically: extractIntent keeps a
  // per-key circuit breaker, and deriving the list changed which keys were
  // cleared and restored across the describes, which broke the later tests in
  // a different way. An explicit list that beta-critical.test.ts can check
  // against the chain is the safer shape here.
  const keys = [
    'GEMINI_API_KEY', 'GEMINI_API_KEY1', 'GEMINI_API_KEY2', 'GEMINI_API_KEY3',
    'MISTRAL_API_KEY', 'MISTRAL_API_KEY1',
    'GROQ_API_KEY', 'GROQ_API_KEY1', 'GROQ_API_KEY2', 'GROQ_API_KEY3',
    'CEREBRAS_API_KEY', 'CEREBRAS_API_KEY1',
    'COHERE_API_KEY', 'NVIDIA_API_KEY',
    // Added 7 Sep 2026, same drift the comment above already warns about:
    // extractWithOpenAIKey used to hardcode the dead Azure host regardless of
    // which 'openai'-provider leg called it, so the Cloudflare leg landed on
    // a non-resolving host and failed the same way whether or not this key
    // was cleared — coincidentally masking its absence from this list. Once
    // extractWithOpenAIKey started respecting each leg's real baseUrl (so
    // intent extraction could actually use Cloudflare/Cohere/NVIDIA the same
    // way the main chat chain already could), the Cloudflare leg started
    // reaching the real host and answering, and "all providers gone" stopped
    // being true. CLOUDFLARE_ACCOUNT_ID does not need clearing alongside it:
    // CLOUDFLARE_OPENAI_BASE is computed once at config.ts's module load, so
    // FALLBACK_CHAIN already has the leg either way — only the bearer key
    // controls whether the loop's `if (!apiKey) continue` skips it.
    'CLOUDFLARE_API_KEY',
    // No longer chain legs — GitHub Models retired 30 Jul 2026 — but still in
    // .env, and extractIntent reads OPENAI_API_KEY directly. Left in the list
    // so "all providers gone" stays true rather than nearly true.
    'OPENAI_API_KEY', 'OPENAI_API_KEY1', 'OPENAI_API_KEY2', 'OPENAI_API_KEY3',
  ]
  const saved: Record<string, string | undefined> = {}
  for (const k of keys) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
  return () => {
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v
  }
}
