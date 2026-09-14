// Ported from jest/vitest globals to node:test — this file previously threw
// "describe is not defined" on load and had never executed.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractIntentHeuristic, nothingToExtract } from '../intent'
import type { Intent } from '../../discovery'

describe('Intent Heuristic Extraction', () => {
  const baseIntent: Intent = {}

  it('extracts BHK from message', () => {
    const result = extractIntentHeuristic('Looking for 3 BHK', baseIntent)
    assert.deepEqual(result.bhk, [3])
  })

  it('extracts budget in crore', () => {
    const result = extractIntentHeuristic('under 2 crore', baseIntent)
    assert.strictEqual(result.budgetMax, 2)
  })

  it('extracts budget in lakh and converts to crore', () => {
    const result = extractIntentHeuristic('150 lakh budget', baseIntent)
    assert.strictEqual(result.budgetMax, 1.5)
  })

  it('extracts sector', () => {
    const result = extractIntentHeuristic('in Sector 150', baseIntent)
    assert.ok(result.sector?.includes('150'), `expected sector to contain 150, got ${result.sector}`)
  })

  it('extracts immediate possession', () => {
    const result = extractIntentHeuristic('ready to move', baseIntent)
    assert.strictEqual(result.possession, 'immediate')
  })

  it('extracts 1 year possession', () => {
    const result = extractIntentHeuristic('within 1 year', baseIntent)
    assert.strictEqual(result.possession, '1year')
  })

  it('extracts investment purpose', () => {
    const result = extractIntentHeuristic('for investment returns', baseIntent)
    assert.strictEqual(result.purpose, 'investment')
  })

  it('extracts end-use purpose', () => {
    const result = extractIntentHeuristic('to live in', baseIntent)
    assert.strictEqual(result.purpose, 'endUse')
  })

  it('extracts area range', () => {
    const result = extractIntentHeuristic('1000 to 1200 sqft', baseIntent)
    assert.strictEqual(result.areaMin, 1000)
    assert.strictEqual(result.areaMax, 1200)
  })

  it('returns previous intent if no matches', () => {
    const prev = { bhk: [2] }
    const result = extractIntentHeuristic('random text', prev as Intent)
    assert.deepEqual(result.bhk, [2])
  })

  it('handles multiple signals', () => {
    const result = extractIntentHeuristic('3 BHK under 2 crore in Sector 150 ready to move', baseIntent)
    assert.deepEqual(result.bhk, [3])
    assert.strictEqual(result.budgetMax, 2)
    assert.strictEqual(result.possession, 'immediate')
  })

  it('is case-insensitive', () => {
    const result1 = extractIntentHeuristic('3 bhk', baseIntent)
    const result2 = extractIntentHeuristic('3 BHK', baseIntent)
    assert.deepEqual(result1.bhk, result2.bhk)
  })
})

describe('nothingToExtract — the no-signal skip', () => {
  // Measured before this existed: "hi" cost 3,115ms of intent extraction,
  // "explain capital gains tax on property sale" 1,442ms and "what maintenance
  // should I expect in Noida?" 1,345ms. Each was a full model round-trip that
  // returned nothing, paid IN FRONT of the answer call.
  for (const q of [
    'hi',
    'hello',
    'thanks',
    'ok',
    'explain capital gains tax on property sale',
    'what maintenance should I expect in Noida?',
    'is it a good time to buy',
    'what is the capital of france',
    'how does registration work',
    'who are you',
  ]) {
    it(`skips extraction for "${q}"`, () => {
      assert.equal(nothingToExtract(q), true, `"${q}" carries no intent to extract`)
    })
  }

  // The other side, and the one that matters: a message carrying a constraint,
  // a correction, or a name we may hold must still reach the model. A skip here
  // silently drops the buyer's budget or their refinement.
  for (const q of [
    '3bhk in sector 150 under 1.5cr',
    'make that 2 crore',
    'show me something bigger',
    'actually 3 BHK instead',
    'tell me about Godrej Woods',
    'what about Mahagun Mirabella',
    'ready to move flats',
    'my budget is 1.8 cr',
    'projects near the metro',
    'I earn 2 lakh a month',
    'anything cheaper',
    'possession within a year',
    'I want to invest',
    'we are a family of four looking to move closer to my office in the next eighteen months',
  ]) {
    it(`still extracts for "${q}"`, () => {
      assert.equal(nothingToExtract(q), false, `"${q}" carries something the extractor must see`)
    })
  }

  it('treats the default city and the acronyms as noise, not as a name', () => {
    // "Noida" is capitalised in almost every message and means nothing — if it
    // counted as naming something, no general question would ever skip.
    assert.equal(nothingToExtract('tell me about RERA'), true)
    assert.equal(nothingToExtract('how is Noida'), true)
  })

  it('skips a market question that states no constraint', () => {
    // "what are prices like in Noida" names no budget, sector or configuration,
    // so extraction can only come back empty. The question is answered from
    // sector data downstream, not from intent, so skipping saves the round trip.
    assert.equal(nothingToExtract('what are prices like in Noida'), true)
    // But attach a number and it is a constraint the extractor must see.
    assert.equal(nothingToExtract('flats around 1.5 cr in Noida'), false)
  })
})

describe('a topic is not a constraint', () => {
  /**
   * "under 2 crore" constrains a search. "what are the hidden costs beyond the
   * sticker price?" is a question ABOUT cost and constrains nothing. Both carry
   * the word "price", and one vocabulary could not tell them apart — so every
   * advisory question containing one of these nouns paid a full extraction
   * round-trip (~2,671 tokens) to learn nothing, charged IN FRONT of the answer
   * call so the buyer waited for it before the answer began.
   */
  for (const q of [
    'What are the hidden costs beyond the sticker price?',
    'why is the registry delayed even after possession',
    'who pays the transfer memorandum fee',
    'what is stamp duty in UP',
    'explain capital gains tax on property sale',
  ]) {
    it(`skips extraction for the advisory question: "${q.slice(0, 44)}"`, () => {
      assert.equal(nothingToExtract(q), true)
    })
  }

  for (const q of [
    'show me 3bhk under 2 crore',
    'my budget is 1.5cr',
    'possession within a year',
    'possession by 2027',
    'I need possession soon',
    'flats priced below 90 lakh',
  ]) {
    it(`still extracts the real constraint: "${q}"`, () => {
      assert.equal(nothingToExtract(q), false)
    })
  }

  it('keeps purpose words unconditional — they need no number', () => {
    // "I want to invest" sets `purpose` with nothing numeric attached.
    for (const q of ['I want to invest', 'looking for rental yield', 'resale only']) {
      assert.equal(nothingToExtract(q), false, q)
    }
  })
})
