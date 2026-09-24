import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getBaseSystemPrompt, splitSystemPrompt } from '../base'
import type { SupportedCity } from '../../../discovery/cities'
import type { QueryKind } from '../../../discovery'

/**
 * The head is scoped to the question shape, and the scoping is safe to cache.
 *
 * Roadmap step 3.5 claimed a JIT-scoped head; measured afterwards it was still
 * `head=39232c` byte-identical across single-project, comparison and discovery
 * turns, so nothing was scoped. Two blocks a named-project turn provably cannot
 * use are now gated on `queryKind`.
 *
 * Two properties have to hold together, or the saving is paid back as cache
 * misses:
 *   1. the gate reads only `queryKind`, which is part of the head cache key in
 *      systemPromptCache.getCachedBasePrompt — a gate on anything outside that
 *      key serves a stale head from the memo;
 *   2. a shorter variant is a strict PREFIX of a longer one, so implicit prefix
 *      caching still matches up to the divergence rather than breaking in the
 *      middle of the rules.
 */

const head = (queryKind: string, userMessage = 'tell me about this') =>
  splitSystemPrompt(
    getBaseSystemPrompt({}, [], 'noida' as SupportedCity, 'READY_TO_SEARCH', queryKind as QueryKind, userMessage),
  ).head

const GEOGRAPHY = '## STRICT GEOGRAPHIC & CIVIC JURISDICTION ARCHITECTURE'
const PILLARS = '## THE 4 PILLARS OF "BEST" & MAXIMUM RETURNS'

describe('system prompt head is scoped to the question shape', () => {
  it('a discovery turn keeps both the corridor architecture and the ranking pillars', () => {
    const h = head('DISCOVERY')
    assert.ok(h.includes(GEOGRAPHY), 'a discovery turn is choosing between corridors')
    assert.ok(h.includes(PILLARS), 'a discovery turn ranks')
  })

  it('a named-project turn carries neither', () => {
    for (const kind of ['DRILLDOWN', 'PROJECT_DEEP_DIVE', 'COST_BREAKDOWN']) {
      const h = head(kind)
      assert.ok(!h.includes(GEOGRAPHY), `${kind} does not decide which authority governs which sector`)
      assert.ok(!h.includes(PILLARS), `${kind} is not ranking anything`)
    }
  })

  it('an unknown or absent queryKind keeps everything', () => {
    // Never let a kind nobody anticipated silently lose a safety rule.
    for (const kind of ['', 'SOMETHING_NEW']) {
      const h = head(kind)
      assert.ok(h.includes(GEOGRAPHY), `"${kind}" must fall back to the full head`)
      assert.ok(h.includes(PILLARS), `"${kind}" must fall back to the full head`)
    }
  })

  it('the short variant is a strict prefix of the long one', () => {
    const short = head('COST_BREAKDOWN')
    const long = head('DISCOVERY')
    assert.ok(long.startsWith(short), 'gated blocks must sit at the END of the head, not in the middle')
    assert.ok(long.length > short.length, 'the gate is not actually removing anything')
  })

  it('scoping saves a real amount, not a rounding error', () => {
    const saved = head('DISCOVERY').length - head('COST_BREAKDOWN').length
    assert.ok(saved > 5000, `only ${saved} chars saved — the gate has stopped covering the blocks it names`)
  })
})
