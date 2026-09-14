// Routing + context-budget tests for the chat pipeline.
//
// This file previously imported only `vitest` and `express`, pulled in zero
// production code, and asserted things like `expect(window['DISCOVERY']).toBe(3)`
// against object literals declared two lines above. It also carried a `.tocontain`
// typo, so it had never executed under any runner. Rewritten to exercise the
// real units it was gesturing at — all of which were otherwise untested.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyIntent, routeToModel } from '../../lib/ai/intentClassifier'
import { trimMessagesToBudget } from '../chat-helpers'
import { FALLBACK_CHAIN, GEMINI_TOOLS_ENABLED } from '../../lib/config'
import type { Intent } from '../../lib/discovery'

describe('Chat routing: classifyIntent → routeToModel', () => {
  it('keeps an open discovery search out of the query planner', () => {
    // Cheap IS correct here: property cards carry the data and the prompt caps the
    // lead-in at 35 words, so the lite tier is the deliberate cost optimisation.
    // What must not happen is being mistaken for a single-project detail lookup.
    const intent: Intent = { sector: 'Sector 150', bhk: [2], budgetMax: 1.5 }
    const c = classifyIntent('show me 2BHK under 1.5 crore in Sector 150', intent)
    assert.notEqual(c.category, 'project_detail')
    assert.notEqual(routeToModel(c), 'query_planner')
  })

  it('routes a named-project detail question to the query planner', () => {
    const intent: Intent = { projectNames: ['Godrej Meridien'] }
    const c = classifyIntent('what is the payment plan for Godrej Meridien', intent)
    assert.equal(c.category, 'project_detail')
    assert.equal(routeToModel(c), 'query_planner')
  })

  it('never routes an advisory question to the cheap tier', () => {
    // "should I" questions need reasoning; sending them to the lite model was the
    // failure mode the cost-routing work had to avoid.
    for (const msg of [
      'should I invest in Sector 150 at current prices',
      'is this a good time to buy in Noida',
      'rent vs buy for a 2 crore budget',
    ]) {
      const c = classifyIntent(msg, {})
      assert.notEqual(routeToModel(c), 'cheap', `"${msg}" must not route cheap`)
    }
  })

  it('classification is deterministic for the same input', () => {
    const intent: Intent = { sector: 'Sector 79' }
    const a = classifyIntent('what is the possession date', intent)
    const b = classifyIntent('what is the possession date', intent)
    assert.deepEqual(routeToModel(a), routeToModel(b))
  })
})

describe('Context budget: trimMessagesToBudget', () => {
  const msgs = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn ${i}`,
    }))

  it('keeps a wider window for advisory than for discovery', () => {
    const advisory = trimMessagesToBudget('sys', msgs(12), { queryKind: 'ADVISORY' })
    const discovery = trimMessagesToBudget('sys', msgs(12), { queryKind: 'DISCOVERY' })
    assert.ok(
      advisory.length > discovery.length,
      `advisory (${advisory.length}) should exceed discovery (${discovery.length})`,
    )
  })

  it('always keeps the most recent turn', () => {
    const out = trimMessagesToBudget('sys', msgs(12), { queryKind: 'DISCOVERY' })
    assert.equal(out[out.length - 1].content, 'turn 11')
  })

  it('degrades to the last exchange when the system prompt is enormous', () => {
    const huge = 'x '.repeat(200_000)
    const out = trimMessagesToBudget(huge, msgs(12), { queryKind: 'ADVISORY' })
    assert.ok(out.length <= 2, `expected <=2 messages, got ${out.length}`)
    assert.ok(out.length >= 1, 'must never return an empty context')
  })

  it('never returns an empty message list', () => {
    for (const kind of ['DISCOVERY', 'DRILLDOWN', 'COMPARISON', 'ADVISORY', undefined]) {
      const out = trimMessagesToBudget('sys', msgs(3), kind ? { queryKind: kind } : undefined)
      assert.ok(out.length > 0, `empty context for queryKind=${kind}`)
    }
  })
})

describe('FALLBACK_CHAIN shape', () => {
  it('leads with Gemini — it is the paid primary', () => {
    assert.equal(FALLBACK_CHAIN[0].provider, 'gemini')
  })

  it('every entry has a distinct provider+key+model triple', () => {
    const seen = new Set<string>()
    for (const item of FALLBACK_CHAIN) {
      const k = `${item.provider}|${item.envKey}|${item.model}`
      assert.ok(!seen.has(k), `duplicate chain entry: ${k}`)
      seen.add(k)
    }
  })

  it('only tool-capable providers are flagged supportsTools', () => {
    // getBaseSystemPrompt(toolsEnabled) keys off this flag to decide whether to
    // emit the tool catalogue at all. A wrong flag silently ships ~310 tokens of
    // tool descriptions to a provider that cannot call them, or withholds them
    // from one that can.
    //
    // Gemini is the exception: it can call tools, gated by ENABLE_GEMINI_TOOLS.
    for (const item of FALLBACK_CHAIN) {
      if (item.supportsTools) {
        assert.ok(
          item.provider === 'openai' || item.provider === 'gemini',
          `${item.label} claims tool support`,
        )
      }
    }
  })

  it('Gemini tool support tracks ENABLE_GEMINI_TOOLS, never diverges from it', () => {
    // gemini.ts attaches the tool definitions from this same constant. If the two
    // ever disagree, Gemini receives a tool catalogue alongside a system prompt
    // that tells it "You cannot call tools here" — or the reverse.
    for (const item of FALLBACK_CHAIN.filter(i => i.provider === 'gemini')) {
      assert.equal(item.supportsTools, GEMINI_TOOLS_ENABLED, item.label)
    }
  })

  it('reads Gemini tool support from the environment, both ways', () => {
    // Tools are enabled in this project (render.yaml sets ENABLE_GEMINI_TOOLS=true).
    // The invariant that matters is that the flag is the single source of truth —
    // never a literal — so it can be turned off again without a code change.
    assert.equal(GEMINI_TOOLS_ENABLED, process.env.ENABLE_GEMINI_TOOLS === 'true')
  })

  it('gives every provider key in the chain its own entry so rotation works', () => {
    // GROQ_API_KEY2/3 and GEMINI_API_KEY1 were set in the environment but absent
    // from the chain, so a rate-limited key had nothing to fall through to.
    const envKeys = FALLBACK_CHAIN.map(i => i.envKey)
    for (const key of ['GEMINI_API_KEY1', 'GROQ_API_KEY2', 'GROQ_API_KEY3']) {
      assert.ok(envKeys.includes(key), `${key} is configured but never tried`)
    }
  })

  it('keeps a tool-capable backstop in the chain', () => {
    // This replaced "drops the OpenAI legs while OPENAI_BASE_URL points at
    // retired GitHub Models". That rule existed for a stated reason — keeping a
    // dead leg "costs a failed request each, on every turn, before reaching a
    // provider that answers" — and that reason no longer holds: a 410 brownout
    // is now classified as balance exhaustion and cools the leg for an hour, so
    // it costs one probe an hour per key rather than one per turn.
    //
    // What dropping them cost instead was the only tool-capable backstop.
    // Gemini's free keys are the only other legs that can call a lookup, and
    // when their daily quota is spent the chain has nothing left that can read
    // the database — which is exactly when fabrications appeared.
    assert.ok(
      FALLBACK_CHAIN.some(i => i.provider === 'openai'),
      'the chain has no OpenAI-compatible leg, so Gemini is the only tool-capable provider',
    )
    assert.ok(
      FALLBACK_CHAIN.filter(i => i.supportsTools).length >= 2,
      'fewer than two tool-capable legs: one provider outage leaves the chain unable to look anything up',
    )
  })

  /**
   * Keys that are in `.env` and deliberately have no leg.
   *
   * The four OPENAI_API_KEY* values are GitHub PATs for GitHub Models, which
   * retired on 30 Jul 2026 and answers 410. With the dead-host substitution
   * removed they would now be sent to api.openai.com, where a PAT is a 401 —
   * still a dead leg, just a different error. Exempting them by name keeps the
   * rule below strict for every key that CAN work, rather than softening it.
   *
   * MISTRAL_API_KEY and MISTRAL_API_KEY1 join them for the same reason. Both
   * answered when probed on 30 Aug; both now return 401 to `GET /v1/models`,
   * so the credentials are dead rather than rate-limited, and their two legs
   * were removed from the chain. A present-but-invalid key is worse than an
   * absent one — an absent key costs `[FALLBACK:SKIP]` and nothing else, while
   * a 401 costs a full round-trip in front of the buyer's answer.
   *
   * Delete an entry here the day a real key is put under that name.
   */
  const RETIRED_ENV_KEYS = new Set([
    'OPENAI_API_KEY', 'OPENAI_API_KEY1', 'OPENAI_API_KEY2', 'OPENAI_API_KEY3',
    'MISTRAL_API_KEY', 'MISTRAL_API_KEY1',
  ])

  it('gives every key configured in the environment a chain entry', () => {
    // The narrow version of this only checked three named keys. GEMINI_API_KEY2
    // and MISTRAL_API_KEY1 were both set in .env and absent from the chain on
    // 30 Aug — two working keys doing nothing while the chain ran dry.
    const envKeys = new Set(FALLBACK_CHAIN.map(i => i.envKey))
    const configuredButUnused = Object.keys(process.env)
      .filter(k => /^(GEMINI|MISTRAL|GROQ|CEREBRAS|OPENAI|COHERE|NVIDIA)_API_KEY\d*$/.test(k))
      .filter(k => (process.env[k] ?? '').length > 0)
      .filter(k => !envKeys.has(k))
      .filter(k => !RETIRED_ENV_KEYS.has(k))
    assert.deepEqual(configuredButUnused, [], `configured but never tried: ${configuredButUnused.join(', ')}`)
  })

  it('never points Cerebras at a model it no longer serves', () => {
    // llama-3.3-70b returned 404 "Model does not exist or you do not have access
    // to it" on both keys; Cerebras serves gpt-oss-120b and gemma-4-31b.
    for (const item of FALLBACK_CHAIN.filter(i => i.provider === 'cerebras')) {
      assert.ok(!/llama/i.test(item.model), `${item.label} still requests ${item.model}`)
    }
  })

  it('has at least one non-Gemini fallback so a Gemini outage is survivable', () => {
    // Not hypothetical: Gemini returned 429 "prepayment credits are depleted"
    // during this work and every turn fell through to the next tier.
    assert.ok(FALLBACK_CHAIN.some(i => i.provider !== 'gemini'))
  })
})
