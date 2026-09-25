import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { shouldCarryFocus } from '../focusCarry'

/**
 * The turn shape this gate exists for: a project is in focus, the buyer named
 * nothing new, and no upstream gate judged the turn a fresh search.
 */
const followUp = (message: string) => ({
  message,
  namesProjectThisTurn: false,
  clearPersistedFocus: false,
  hasFocus: true,
})

describe('shouldCarryFocus', () => {
  /**
   * Every one of these dropped the project under the old `ATTRIBUTE_FOLLOWUP`
   * whitelist, because none of their nouns were on it. They are the reason the
   * gate was inverted — a buyer asking for an opinion about the building on
   * their screen was answered about Noida in general.
   */
  it('carries the focus through phrasings no whitelist enumerated', () => {
    for (const q of [
      'should i buy?',
      'worth it at that price?',
      'any red flags?',
      'what do you think?',
      'my wife thinks it is too far',
      'is the builder reliable?',
      'would you recommend it',
      'how does it stack up',
      'anything that would put you off',
    ]) {
      assert.equal(shouldCarryFocus(followUp(q)), true, q)
    }
  })

  it('still carries the phrasings the whitelist did cover', () => {
    for (const q of ['what is the payment plan?', 'are there any hidden charges for it?', 'possession?']) {
      assert.equal(shouldCarryFocus(followUp(q)), true, q)
    }
  })

  it('drops the focus when the turn brings its own subject', () => {
    // A sector named in THIS message.
    assert.equal(shouldCarryFocus(followUp('what are prices in sector 76')), false)
    // An upstream gate already judged it a fresh search.
    assert.equal(
      shouldCarryFocus({ ...followUp('what are prices in greater noida west'), clearPersistedFocus: true }),
      false,
    )
    // The buyer named a project themselves — that one wins.
    assert.equal(shouldCarryFocus({ ...followUp('tell me about Godrej Woods'), namesProjectThisTurn: true }), false)
  })

  it('does not hand a subject to an acknowledgement', () => {
    for (const q of ['thanks', 'ok', 'got it', 'yes', 'hmm', 'Thank you.']) {
      assert.equal(shouldCarryFocus(followUp(q)), false, q)
    }
    // A courtesy word that opens a real question is a real question.
    assert.equal(shouldCarryFocus(followUp('ok so what is the possession date')), true)
  })

  it('carries nothing when there is nothing in focus', () => {
    assert.equal(shouldCarryFocus({ ...followUp('what do you think?'), hasFocus: false }), false)
  })
})
