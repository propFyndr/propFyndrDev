import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getTier0InvariantCore, getBaseSystemPrompt, splitSystemPrompt, TIER_0_CORE_END } from '../prompts/base'
import { getCachedTier0Core, assembleTieredPrompt } from '../systemPromptCache'
import { estimateTokensReal } from '../tokenizer'

describe('Tier 0 Invariant Prompt Ladder Stability', () => {
  const tier0 = getTier0InvariantCore()

  it('Tier 0 is comfortably above the Gemini minimum cacheable threshold (1,024 tokens)', () => {
    const tokenCount = estimateTokensReal(tier0)
    assert.ok(
      tokenCount >= 1024,
      `Tier 0 token count (${tokenCount}) must be >= 1024 to qualify for Gemini explicit caching`,
    )
    assert.ok(
      tokenCount >= 4000 && tokenCount <= 8500,
      `Tier 0 token count (${tokenCount}) expected between 4,000 and 8,500 tokens`,
    )
  })

  it('Tier 0 is 100% byte-identical and bitwise-equal across multiple calls', () => {
    const t0_first = getTier0InvariantCore()
    const t0_second = getTier0InvariantCore()
    const t0_cached = getCachedTier0Core()

    assert.equal(t0_first, t0_second)
    assert.equal(t0_first, t0_cached)
    assert.equal(Buffer.byteLength(t0_first, 'utf8'), Buffer.byteLength(t0_second, 'utf8'))
    assert.equal(Buffer.byteLength(t0_first, 'utf8'), Buffer.byteLength(t0_cached, 'utf8'))
  })

  it('Tier 0 contains zero dynamic variable interpolations', () => {
    // Assert no unresolved template placeholders
    assert.ok(!tier0.includes('${'), 'Tier 0 must not contain unresolved template literals')
    assert.ok(!tier0.includes('undefined'), 'Tier 0 must not contain stringified undefined')
  })

  const TEST_SCENARIOS = [
    { name: 'Discovery in Noida with tools', city: 'Noida', kind: 'DISCOVERY', tools: true },
    { name: 'Comparison in Greater Noida West without tools', city: 'Greater Noida West', kind: 'COMPARISON', tools: false },
    { name: 'Cost Breakdown in Yamuna Expressway', city: 'Yamuna Expressway', kind: 'COST_BREAKDOWN', tools: true },
    { name: 'Drilldown on named project in Sector 150', city: 'Noida', kind: 'DRILLDOWN', tools: true },
    { name: 'Project Deep Dive without tools', city: 'Noida', kind: 'PROJECT_DEEP_DIVE', tools: false },
    { name: 'Legal / RERA advisory', city: 'Noida', kind: 'LEGAL_CHECK', tools: true },
    { name: 'Hinglish relocation inquiry', city: 'Greater Noida', kind: 'ADVISORY', tools: true },
    { name: 'Ranking in Central Noida', city: 'Noida', kind: 'RANKING', tools: true },
    { name: 'Open search query', city: 'Noida', kind: 'OPEN', tools: false },
    { name: 'Unknown queryKind with blocked builders', city: 'Noida', kind: 'CUSTOM_LANE', tools: true, blocked: [{ name: 'Test Builder', legal_flag: 'Flagged' }] },
  ]

  it('Every lane head begins with the exact byte-identical Tier 0 invariant prefix', () => {
    for (const scenario of TEST_SCENARIOS) {
      const full = getBaseSystemPrompt(
        undefined,
        scenario.blocked as never,
        scenario.city as never,
        undefined,
        scenario.kind as never,
        undefined,
        scenario.tools,
      )
      const { head } = splitSystemPrompt(full)

      assert.ok(
        head.startsWith(tier0),
        `Lane "${scenario.name}" head does not begin with Tier 0 invariant core!`,
      )
      assert.ok(
        head.includes(TIER_0_CORE_END),
        `Lane "${scenario.name}" missing TIER_0_CORE_END marker!`,
      )
      // Extract prefix up to TIER_0_CORE_END
      const prefix = head.slice(0, head.indexOf(TIER_0_CORE_END)).trimEnd()
      assert.equal(
        Buffer.byteLength(prefix, 'utf8'),
        Buffer.byteLength(tier0.trimEnd(), 'utf8'),
        `Lane "${scenario.name}" has byte divergence in Tier 0 prefix`,
      )
    }
  })

  it('assembleTieredPrompt correctly stitches 4 tiers with proper boundaries', () => {
    const tiered = assembleTieredPrompt({
      tier0,
      tier1: '## LANE DIRECTIVE: Comparison mode active.',
      tier2: '## VERIFIED_FACTS_BLOCK: Project A: 1.5 Cr',
      tier3: 'User: Compare Sector 150 vs Sector 137',
    })

    assert.ok(tiered.cacheableHead.startsWith(tier0))
    assert.ok(tiered.cacheableHead.includes(TIER_0_CORE_END))
    assert.ok(tiered.cacheableHead.includes('LANE DIRECTIVE'))
    assert.ok(tiered.dynamicTail.includes('VERIFIED_FACTS_BLOCK'))
    assert.ok(tiered.dynamicTail.includes('Compare Sector 150'))
  })
})
