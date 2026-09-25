import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getBaseSystemPrompt, splitSystemPrompt } from '../prompts/base'
import { estimateTokensReal } from '../tokenizer'

/**
 * The head's token cost, pinned per lane.
 *
 * The roadmap's Day 3.5 pass condition is a <=1,800 token system prompt. It is
 * not met and is not close: measured with tiktoken, the head is 7,782 tokens on
 * the cheapest lane and 9,517 on the most expensive. Nothing printed that
 * number before, which is how the claim survived in the doc — see
 * `npm run measure:prompt`.
 *
 * FURTHER GATING WAS TRIED ON 2026-09-25 AND REVERTED. Gating the remaining
 * ~20 sections on `queryKind` took the drilldown lane to 5,386 tokens (-31%),
 * and `promptPrefixStability.test.ts` failed on five assertions. The reason is
 * the one the long comment in base.ts already gives: Gemini's implicit cache
 * matches a PREFIX, so a gated block in the MIDDLE of the head ends the shared
 * prefix there. The measured prefix is ~24,900 of ~39,200 characters; gating
 * mid-prompt would have cut it to wherever the first gated block sits, and the
 * cache-miss cost exceeds the token saving.
 *
 * Doing it properly means restructuring the head into a nested ladder — every
 * gated block at the tail, ordered so each lane's head is a strict prefix of
 * the next. The two blocks already gated (geography, ranking pillars) are at
 * the tail for exactly this reason. That is a deliberate design change, not a
 * refactor to slip in.
 *
 * And it would still stop well short of 1,800, because most of the head is the
 * honesty core — HARD RULES, the sentinels, NOT-IN-DATABASE, SCOPE, the
 * competitor ban, the builder data rules, the configuration/pricing integrity
 * rule. Those are what stop the advisor inventing a number. The target was set
 * without costing the rule set the product actually has.
 *
 * This test does NOT assert the 1,800 ceiling, because asserting a target you
 * do not meet gives you a red suite, not a smaller prompt. It asserts a
 * RATCHET: the head may shrink freely, and may not grow. Closing the remaining
 * gap means deleting behavioural rules, which changes answers and has to be
 * validated against the corpus — a product decision, not a refactor.
 *
 * `queryKind` is the only axis the head is gated on, and it is part of the
 * base-prompt cache key in `systemPromptCache.getCachedBasePrompt`, so each
 * entry here is a real cache variant rather than a hypothetical one.
 */
const CEILING_BY_KIND: Record<string, number> = {
  // Gated: no geography taxonomy, no ranking pillars. The drilldown/deep-dive/
  // cost lane is the most common follow-up shape in the product.
  DRILLDOWN: 7800,
  PROJECT_DEEP_DIVE: 7800,
  COST_BREAKDOWN: 7800,
  // Gated: no geography taxonomy. Comparison ranks two named projects.
  COMPARISON: 9000,
  // Ungated — everything, including the taxonomy and the ranking pillars.
  DISCOVERY: 9600,
  ADVISORY: 9600,
  OPEN: 9600,
  RANKING: 9600,
}

/** The target Day 3.5 states. Recorded so the distance stays visible. */
const ROADMAP_TARGET = 1800

describe('system prompt head size', () => {
  for (const [kind, ceiling] of Object.entries(CEILING_BY_KIND)) {
    it(`${kind} head stays at or under ${ceiling} tokens`, () => {
      const full = getBaseSystemPrompt(undefined, undefined, 'Noida' as never, undefined, kind as never, undefined, true)
      const { head } = splitSystemPrompt(full)
      const tokens = estimateTokensReal(head)

      assert.ok(
        tokens <= ceiling,
        `${kind} head grew to ${tokens} tokens (ratchet is ${ceiling}). ` +
          `If this is a deliberate addition, lower another section first — the head is already ` +
          `${Math.round((tokens / ROADMAP_TARGET) * 10) / 10}x the ${ROADMAP_TARGET}-token target.`,
      )
    })
  }

  const headTokens = (kind?: string) =>
    estimateTokensReal(
      splitSystemPrompt(
        getBaseSystemPrompt(undefined, undefined, 'Noida' as never, undefined, kind as never, undefined, true),
      ).head,
    )

  it('an unrecognised queryKind loses no rules', () => {
    // A kind nobody anticipated must get the FULL head, never a silently
    // trimmed one — `keepAll` in base.ts. So it is at least as large as every
    // lane we do recognise, including the widest.
    const unknown = headTokens('SOMETHING_NEW')
    for (const kind of Object.keys(CEILING_BY_KIND)) {
      assert.ok(
        unknown >= headTokens(kind),
        `unrecognised kind (${unknown}) must not be smaller than ${kind} (${headTokens(kind)})`,
      )
    }
    // And it matches the no-kind-at-all case, which is the same code path.
    assert.equal(unknown, headTokens(undefined))
  })

  it('the gated lanes are actually cheaper than the ungated ones', () => {
    // If a future edit makes a gated block unconditional again, this is what
    // notices — the per-kind ratchets above would all still pass.
    assert.ok(headTokens('COST_BREAKDOWN') < headTokens('COMPARISON'), 'named-project lane must skip the ranking pillars')
    assert.ok(headTokens('COMPARISON') < headTokens('DISCOVERY'), 'comparison lane must skip the geography taxonomy')
  })

  it('no lane loses a rule that stops it inventing a number', () => {
    /**
     * The gating is a token exercise; this is the line it must not cross.
     * Every lane, including the most heavily trimmed, keeps the blocks that
     * make an answer honest. If a future cut reaches for one of these to hit
     * the 1,800 target, this fails before it ships.
     */
    const REQUIRED_EVERYWHERE = [
      '## HARD RULES',
      'Never invent property data',
      '## SENTINEL RULES',
      'PROJECT_NOT_FOUND',
      '## NOT-IN-DATABASE FIELDS',
      '## SCOPE',
      '## COMPETITOR BAN',
      '## CONFIDENTIALITY',
      '## UNTRUSTED CONTENT',
      '## BUILDER DATA RULES',
      '## CONFIGURATION & PRICING INTEGRITY RULE',
      'NEVER SIZE THE DATABASE',
      'NEVER DESCRIBE YOUR OWN INPUTS',
      'NO FABRICATED SCORES',
      'OUT-OF-DATABASE',
    ]
    for (const kind of [...Object.keys(CEILING_BY_KIND), 'SOMETHING_NEW']) {
      const head = splitSystemPrompt(
        getBaseSystemPrompt(undefined, undefined, 'Noida' as never, undefined, kind as never, undefined, true),
      ).head
      for (const rule of REQUIRED_EVERYWHERE) {
        assert.ok(head.includes(rule), `${kind} lost "${rule}"`)
      }
    }
  })
})
