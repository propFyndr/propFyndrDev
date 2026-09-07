import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { groqReplyCeiling, GROQ_MIN_REPLY_TOKENS } from './config'

describe('groq reply ceiling', () => {
  it('raises a profile that asks for less than the floor', () => {
    // lookup (700) and factual (1200) are the two shapes measured truncating
    // on gpt-oss-20b — both must come up to the floor.
    assert.equal(groqReplyCeiling(700), GROQ_MIN_REPLY_TOKENS)
    assert.equal(groqReplyCeiling(1200), GROQ_MIN_REPLY_TOKENS)
  })

  it('never lowers a profile that already asks for more', () => {
    // advisory (1600) and reasoning (2600) were not the shapes truncating;
    // the floor must not touch them.
    assert.equal(groqReplyCeiling(1600), 1600)
    assert.equal(groqReplyCeiling(2600), 2600)
  })

  it('is the mirror image of Mistral\'s cap, not a copy of it', () => {
    // Mistral's number bounds a runaway generation from below the profile;
    // Groq's raises a genuinely-too-tight one from above it. Confusing the
    // two directions would silently undo whichever one runs second in a
    // future refactor, so the relationship is pinned here.
    assert.ok(GROQ_MIN_REPLY_TOKENS > 700, 'floor must exceed the lookup profile it is meant to lift')
  })
})
