import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mergeIntent, parseIntentJson, extractIntent } from '../intent'
import type { Intent } from '../../discovery'

describe('Intent: mergeIntent', () => {
  it('empty previous + update with BHK', () => {
    const result = mergeIntent({}, { bhk: [3] })
    assert.deepEqual(result.bhk, [3])
    assert.equal(result.projectNames, undefined)
    assert.equal(result.is_comparison_query, undefined)
  })

  it('resets projectNames on sector update (per-turn signal)', () => {
    const previous: Intent = { projectNames: ['X'], is_comparison_query: true }
    const result = mergeIntent(previous, { sector: 'Sector 150' })
    assert.equal(result.projectNames, undefined, 'projectNames should reset')
    assert.equal(result.is_comparison_query, undefined, 'is_comparison_query should reset')
    assert.equal(result.sector, 'Sector 150')
  })

  it('sector switch clears filters (BHK, budget, area, lifestyle)', () => {
    const previous: Intent = { sector: 'Sector 150', bhk: [3], budgetMax: 2, lifestyleKeywords: ['gym'] }
    const result = mergeIntent(previous, { sector: 'Sector 75' })
    assert.equal(result.sector, 'Sector 75')
    assert.equal(result.bhk, undefined, 'BHK cleared on sector switch')
    assert.equal(result.budgetMax, undefined, 'budget cleared on sector switch')
    assert.equal(result.lifestyleKeywords, undefined, 'lifestyle cleared on sector switch')
  })

  it('same sector preserves filters', () => {
    const previous: Intent = { sector: 'Sector 150', bhk: [3] }
    const result = mergeIntent(previous, { sector: 'Sector 150', budgetMax: 2 })
    assert.deepEqual(result.bhk, [3], 'BHK preserved when sector unchanged')
    assert.equal(result.budgetMax, 2)
  })

  it('freshProjectLookup clears lifestyle (no prior sector)', () => {
    const previous: Intent = { lifestyleKeywords: ['gym'] }
    const result = mergeIntent(previous, { projectNames: ['Godrej'] })
    assert.equal(result.lifestyleKeywords, undefined, 'lifestyle cleared on fresh project lookup')
    assert.deepEqual(result.projectNames, ['Godrej'])
  })

  it('freshProjectLookup preserves lifestyle (prior sector exists)', () => {
    const previous: Intent = { sector: 'Sector 150', lifestyleKeywords: ['gym'] }
    const result = mergeIntent(previous, { projectNames: ['Godrej'] })
    assert.deepEqual(result.lifestyleKeywords, ['gym'], 'lifestyle preserved when prior sector exists')
  })

  it('undefined values in update never overwrite previous', () => {
    const previous: Intent = { bhk: [3] }
    const result = mergeIntent(previous, { bhk: undefined, budgetMax: 2 })
    assert.deepEqual(result.bhk, [3], 'undefined should not overwrite')
    assert.equal(result.budgetMax, 2)
  })

  it('all optional fields round-trip', () => {
    const update = {
      bhk: [2, 3],
      budgetMin: 1,
      budgetMax: 2,
      possession: 'immediate' as const,
      sector: 'Sector 10',
      areaMin: 1000,
      areaMax: 2000,
      purpose: 'endUse' as const,
      builderName: 'Godrej',
      lifestyleKeywords: ['gym', 'pool'],
      projectNames: ['Project X'],
      riskProfile: 'first_time_buyer' as const,
      is_comparison_query: true,
      legal_check: true,
    }
    const result = mergeIntent({}, update)
    assert.deepEqual(result.bhk, [2, 3])
    assert.equal(result.budgetMin, 1)
    assert.equal(result.budgetMax, 2)
    assert.equal(result.possession, 'immediate')
    assert.equal(result.sector, 'Sector 10')
  })
})

describe('Intent: parseIntentJson', () => {
  it('extracts JSON from prose around it', () => {
    const raw = 'Sure! Here is the intent: {"bhk":[2]} hope that helps'
    const result = parseIntentJson(raw, {})
    assert.deepEqual(result.bhk, [2])
  })

  it('handles empty string (returns previous unchanged)', () => {
    const previous: Intent = { bhk: [3] }
    const result = parseIntentJson('', previous)
    assert.deepEqual(result, previous)
  })

  it('handles whitespace only (returns previous)', () => {
    const previous: Intent = { sector: 'Sector 10' }
    const result = parseIntentJson('   \n  ', previous)
    // Empty match results in '{}' which merges with previous
    assert.equal(result.sector, 'Sector 10')
  })

  it('schema validation fails on wrong types', () => {
    const previous: Intent = { bhk: [3] }
    const result = parseIntentJson('{"budgetMax":"cheap"}', previous)
    assert.deepEqual(result, previous, 'Should return previous on schema error')
  })

  it('null fields are rejected by schema', () => {
    const previous: Intent = { bhk: [2] }
    const result = parseIntentJson('{"sector":null}', previous)
    assert.deepEqual(result, previous, 'null should not be accepted')
  })

  it('large raw string completes without hang', () => {
    const junk = 'x'.repeat(10000)
    const raw = `${junk} {"bhk":[1]}`
    const start = Date.now()
    const result = parseIntentJson(raw, {})
    const elapsed = Date.now() - start
    assert(elapsed < 100, `Should complete in <100ms, took ${elapsed}ms`)
    assert.deepEqual(result.bhk, [1])
  })

  it('Hinglish extracted via mocked LLM JSON', () => {
    // This would be the output of the LLM when given Hinglish input
    const raw = '{"bhk":[2],"sector":"Sector 150"}'
    const result = parseIntentJson(raw, {})
    assert.deepEqual(result.bhk, [2])
    assert.equal(result.sector, 'Sector 150')
  })
})

describe('Intent: extractIntent (with SDK mocking)', () => {
  // Every provider key, not two of them.
  //
  // This block removed OPENAI_API_KEY and GROQ_API_KEY and called that "no keys
  // set". Gemini, Mistral and Cerebras stayed configured, so the "no keys"
  // case reached a live provider over the network — the suite passed or failed
  // on whichever key happened to be reachable that day, and took two seconds
  // doing it.
  // Every envKey in FALLBACK_CHAIN — see the note in
  // intent-extraction-fallback.test.ts. A key added to the chain and missed
  // here stays live through the "no keys set" setup and the test reaches a
  // real provider over the network.
  const PROVIDER_KEYS = [
    'GEMINI_API_KEY', 'GEMINI_API_KEY1', 'GEMINI_API_KEY2', 'GEMINI_API_KEY3',
    'MISTRAL_API_KEY', 'MISTRAL_API_KEY1',
    'GROQ_API_KEY', 'GROQ_API_KEY1', 'GROQ_API_KEY2', 'GROQ_API_KEY3',
    'CEREBRAS_API_KEY', 'CEREBRAS_API_KEY1',
    'OPENAI_API_KEY', 'OPENAI_API_KEY1', 'OPENAI_API_KEY2', 'OPENAI_API_KEY3',
    // These three were already missing before 7 Sep 2026, coincidentally
    // masked: COHERE_API_KEY and NVIDIA_API_KEY are only in the chain for the
    // main chat path's tier 2, and this suite happened to run while both were
    // exhausted for unrelated reasons (Cohere's trial monthly cap, NVIDIA's
    // dry test credits). CLOUDFLARE_API_KEY is the one that actually broke
    // this test — see intent-extraction-fallback.test.ts's longer comment on
    // the same fix for why fixing extractWithOpenAIKey's host-selection bug
    // is what surfaced this rather than something in that fix being wrong.
    'COHERE_API_KEY', 'NVIDIA_API_KEY', 'CLOUDFLARE_API_KEY',
  ]
  const saved: Record<string, string | undefined> = {}
  let savedFastPath: string | undefined

  before(() => {
    for (const k of PROVIDER_KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
    // The regex fast path answers short single-clause messages without ever
    // entering the chain, so it has to be off for these to describe the chain.
    savedFastPath = process.env.INTENT_FAST_PATH
    process.env.INTENT_FAST_PATH = 'false'
  })

  after(() => {
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v
    if (savedFastPath === undefined) delete process.env.INTENT_FAST_PATH
    else process.env.INTENT_FAST_PATH = savedFastPath
  })

  it('no keys set returns degraded (previous intent)', async () => {
    const previous: Intent = { bhk: [3] }
    const result = await extractIntent('test message', previous)
    assert.deepEqual(result.intent, previous)
    assert.equal(result.degraded, true)
  })

  it('returns valid IntentResult with intent and degraded fields', async () => {
    const previous: Intent = {}
    const result = await extractIntent('test', previous)
    assert(result.intent !== undefined)
    assert(typeof result.degraded === 'boolean')
  })
})
