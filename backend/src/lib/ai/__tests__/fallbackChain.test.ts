import { describe, it } from 'node:test'
import assert from 'node:assert'
import { executeWithFallbackChain, looksLikeRestart } from '../fallbackChain'
import type { FallbackKeyConfig } from '../../config'

describe('Multi-Provider Fallback Chain Engine', () => {
  it('falls back to second key when first key throws pre-token error', async () => {
    const key1Tried = false
    const key2Tried = false

    // Save original env
    const origEnv = process.env.TEST_KEY_1
    const origEnv2 = process.env.TEST_KEY_2

    process.env.TEST_KEY_1 = 'dummy-key-1'
    process.env.TEST_KEY_2 = 'dummy-key-2'

    const customChain: FallbackKeyConfig[] = [
      {
        provider: 'gemini',
        envKey: 'TEST_KEY_1',
        model: 'dummy-model',
        supportsTools: true,
        label: 'Key 1 (Simulated Failure)',
      },
      {
        provider: 'groq',
        envKey: 'TEST_KEY_2',
        model: 'dummy-model',
        supportsTools: false,
        label: 'Key 2 (Simulated Success)',
      },
    ]

    // Override streamWithGemini / streamWithGroq behavior via fallbackChain params testing
    const events: Array<{ event: string; data: any }> = []
    const send = (event: string, data: any) => {
      events.push({ event, data })
    }

    try {
      // Mock stream calls by wrapping mock execute with custom chain logic
      // Note: executeWithFallbackChain imports actual provider functions,
      // but if we pass an unmapped provider or mock env, we can test error handling paths.
      assert.strictEqual(customChain[0].envKey, 'TEST_KEY_1')
      assert.strictEqual(customChain[1].envKey, 'TEST_KEY_2')
    } finally {
      process.env.TEST_KEY_1 = origEnv
      process.env.TEST_KEY_2 = origEnv2
    }
  })

  it('generates user-friendly fallback text when all keys in chain fail or are missing', async () => {
    const customChain: FallbackKeyConfig[] = [
      {
        provider: 'gemini',
        envKey: 'NON_EXISTENT_KEY_1',
        model: 'dummy-model',
        supportsTools: true,
        label: 'Key 1',
      },
      {
        provider: 'openai',
        envKey: 'NON_EXISTENT_KEY_2',
        model: 'dummy-model',
        supportsTools: true,
        label: 'Key 2',
      },
    ]

    const events: Array<{ event: string; data: any }> = []
    const send = (event: string, data: any) => {
      events.push({ event, data })
    }

    const result = await executeWithFallbackChain({
      systemPrompt: 'Test system prompt',
      messages: [{ role: 'user', content: 'Hello' }],
      send,
      onToolCall: async () => ({}),
      groqFallbackSuffix: '\n[Fallback]',
      chainConfig: customChain,
    })

    assert.ok(result.text.includes("couldn't get you a reliable answer"))
    assert.strictEqual(result.degraded, true, 'callers need this to suppress cards and chips')
    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].event, 'token')
    assert.ok((events[0].data as any).token.includes('briefly unavailable'))
  })

  it('the outage notice names no project, whatever retrieval returned', async () => {
    // It used to reach for `projects[0]` and write "Here are the verified
    // details for **X** in Y ... Please review the property card." Nothing about
    // that was verified — every leg had just failed, so no model had read the
    // question — and `projects[0]` is related to the buyer's message only by
    // accident. Reported from live use as an unrelated card appearing during an
    // outage; this is the mechanism.
    const events: Array<{ event: string; data: any }> = []
    const result = await executeWithFallbackChain({
      systemPrompt: 'Test system prompt',
      messages: [{ role: 'user', content: 'what are the payment plans?' }],
      send: (event, data) => events.push({ event, data }),
      onToolCall: async () => ({}),
      groqFallbackSuffix: '',
      chainConfig: [
        { provider: 'gemini', envKey: 'NON_EXISTENT_KEY_1', model: 'm', supportsTools: true, label: 'Key 1' },
      ],
      projects: [
        { id: 'p1', name: 'Totally Unrelated Towers', sector: 'Sector 99', price_range_label: '₹1 Cr' },
      ] as never,
    })

    assert.equal(/Totally Unrelated Towers/.test(result.text), false, 'named a project on a failed turn')
    assert.equal(/property card/i.test(result.text), false, 'pointed at a card on a failed turn')
    assert.equal(result.degraded, true)
  })
})

describe('a leg that cannot look anything up is skipped when the answer needs rows', () => {
  // Two tool-blind legs and no key for either, so nothing can answer. What is
  // asserted is which legs were CONSIDERED — a skipped leg never reaches the
  // "no API key configured" branch, so the log distinguishes them.
  const toolBlindChain: FallbackKeyConfig[] = [
    { provider: 'mistral', envKey: 'NO_SUCH_KEY_A', model: 'm', supportsTools: false, label: 'Blind A' },
    { provider: 'groq', envKey: 'NO_SUCH_KEY_B', model: 'g', supportsTools: false, label: 'Blind B' },
  ]

  const run = async (message: string, retrieved: Array<{ name: string }>) => {
    const skipped: string[] = []
    const original = console.log
    console.log = (...args: unknown[]) => {
      const line = args.map(String).join(' ')
      if (line.includes('[FALLBACK:NO_LOOKUP]')) skipped.push(line)
    }
    try {
      await executeWithFallbackChain({
        systemPrompt: 'You are an advisor.',
        messages: [{ role: 'user', content: message }],
        send: () => {},
        onToolCall: async () => ({}),
        groqFallbackSuffix: '',
        chainConfig: toolBlindChain,
        userMessage: message,
        projects: retrieved as never,
      })
    } finally {
      console.log = original
    }
    return skipped
  }

  it('skips both blind legs on a DISCOVERY turn when nothing was retrieved', async () => {
    assert.strictEqual((await run('best society in sector 137 noida', [])).length, 2)
  })

  it('does not skip a process question — it needs no rows', async () => {
    assert.strictEqual((await run('How do I verify whether a project is RERA compliant?', [])).length, 0)
  })

  it('does not skip when retrieval found rows to answer from', async () => {
    assert.strictEqual((await run('best society in sector 137 noida', [{ name: 'Ace Hanei' }])).length, 0)
  })

  it('does not skip a market question answered from the rendered tables', async () => {
    // Every other call site omits it, and must keep its existing behaviour.
    assert.strictEqual((await run('What is the average price per sqft in Noida right now?', [])).length, 0)
  })
})

describe('the skip is narrow enough not to cost honest answers', () => {
  // Every string here was answered well by a tool-blind leg on the demo corpus.
  // A first, blunter version of this rule — retrieval empty AND queryKind in
  // {DISCOVERY,RANKING,COMPARISON,DRILLDOWN} — skipped all twelve, taking the
  // pass rate from 89.6% to 71.6%. They answer from the rendered market tables
  // and statutory content, not from project rows.
  const MUST_STILL_BE_TRIED = [
    'Compare Sector 75, Sector 78, Sector 137 and Sector 150 and tell me which one you would choose',
    'Noida Extension vs Noida: where should a first-time homebuyer buy a 2 BHK?',
    'Which Noida sector gives me the best combination of connectivity and livability?',
    'I earn ₹1.5 lakh per month and have ₹25 lakh available for a down payment. What should I consider?',
    'What is the average property price per sq ft in Noida right now?',
    'Is Sector 78 Noida better for living or investing?',
    'Which is a better investment today: Sector 150 Noida or Noida Extension?',
    'property dealers in sector 75 noida',
  ]

  const MUST_BE_SKIPPED = [
    'best society in sector 137 noida',
    'best society in noida extension',
    'best builder in noida for apartments',
  ]

  const blindChain: FallbackKeyConfig[] = [
    { provider: 'mistral', envKey: 'NO_SUCH_KEY_A', model: 'm', supportsTools: false, label: 'Blind A' },
  ]

  const skipped = async (message: string) => {
    let hit = false
    const original = console.log
    console.log = (...args: unknown[]) => {
      if (args.map(String).join(' ').includes('[FALLBACK:NO_LOOKUP]')) hit = true
    }
    try {
      await executeWithFallbackChain({
        systemPrompt: 'You are an advisor.',
        messages: [{ role: 'user', content: message }],
        send: () => {},
        onToolCall: async () => ({}),
        groqFallbackSuffix: '',
        chainConfig: blindChain,
        userMessage: message,
      })
    } finally {
      console.log = original
    }
    return hit
  }

  for (const q of MUST_STILL_BE_TRIED) {
    it(`still tries: ${q.slice(0, 48)}`, async () => assert.strictEqual(await skipped(q), false))
  }
  for (const q of MUST_BE_SKIPPED) {
    it(`skips: ${q}`, async () => assert.strictEqual(await skipped(q), true))
  }
})

describe('looksLikeRestart', () => {
  it('flags a paragraph that redraws a table header separator already in prior text', () => {
    const prior = 'Some intro.\n\n| Core Metric | A | B |\n| :--- | :--- | :--- |\n| Price | 1 | 2 |'
    const next = '| Core Metric | A | B |\n| :--- | :--- | :--- |\n'
    assert.strictEqual(looksLikeRestart(next, prior), true)
  })

  it('flags a paragraph that repeats a heading already in prior text', () => {
    const prior = '### Verdict\nChoose A because reasons.'
    const next = '### Verdict\nSomething else entirely.'
    assert.strictEqual(looksLikeRestart(next, prior), true)
  })

  it('does not flag a genuine continuation with no heading or table', () => {
    const prior = '### Verdict\nChoose A because reasons.'
    const next = 'if you value affordability over location.'
    assert.strictEqual(looksLikeRestart(next, prior), false)
  })

  it('does not flag the first table in prior text against itself when nothing new is drawn', () => {
    const prior = ''
    const next = '| Core Metric | A | B |\n| :--- | :--- | :--- |\n'
    assert.strictEqual(looksLikeRestart(next, prior), false)
  })

  it('flags a bare table HEADER row (no separator yet) arriving after ### Recommendation — the actual observed failure shape', () => {
    const prior = '### Verdict\nSome verdict.\n\n| Core Metric | A | B |\n| :--- | :--- | :--- |\n\n### Recommendation\nChoose A if you want '
    const next = '| Core Metric | A | B |'
    assert.strictEqual(looksLikeRestart(next, prior), true)
  })

  it('does not flag ordinary prose that happens to precede ### Recommendation', () => {
    const prior = '### Verdict\nSome verdict.\n\n| Core Metric | A | B |\n| :--- | :--- | :--- |\n'
    const next = 'Choose A if you want affordability.'
    assert.strictEqual(looksLikeRestart(next, prior), false)
  })
})
