import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectOpenQuery, hasPropertySearchSignal } from './openQuery'
import { classifyQueryDeterministic, classifyQuery } from './queryClassifier'
import { stripUngroundedSentences } from '../ai/groundedAnswer'

describe('detectOpenQuery', () => {
  it('routes demographic residence questions to SECTOR_PROFILE', () => {
    for (const q of [
      'Which is the sector where the richest people live in Noida?',
      'Where do middle class people prefer to buy a house in Noida?',
      'Which areas are posh in Greater Noida',
    ]) {
      const d = detectOpenQuery(q, false)
      assert.equal(d?.topic, 'SECTOR_PROFILE', `expected SECTOR_PROFILE for: ${q}`)
    }
  })

  it('reads Elite as a brand unless it qualifies people or a place', () => {
    assert.equal(detectOpenQuery('where do elite people live in noida', false)?.topic, 'SECTOR_PROFILE')
    for (const q of ['its elite x by elite group sector 10 greater noida west.', 'should I move to elite homz sector 77']) {
      assert.notEqual(detectOpenQuery(q, false)?.topic, 'SECTOR_PROFILE', q)
      assert.equal(detectOpenQuery(q, true), null, q)
    }
  })

  it('extracts the subject of a named-entity lookup', () => {
    assert.equal(detectOpenQuery('Tell me about Investors Clinic', false)?.entity, 'Investors Clinic')
    assert.equal(detectOpenQuery('Who are the founders of Elite Group?', false)?.entity, 'Elite Group')
    assert.equal(detectOpenQuery('what is the track record of Gaurs Group in Noida', false)?.entity, 'Gaurs Group')
  })

  it('leaves messages tied to a known project alone', () => {
    assert.equal(detectOpenQuery('Tell me about Godrej Woods', true), null)
  })

  it('treats a sector named via "about" as a sector question, not a company', () => {
    assert.equal(detectOpenQuery('tell me about Sector 150', false)?.topic, 'SECTOR_PROFILE')
  })

  it('ignores property searches', () => {
    assert.equal(detectOpenQuery('Show me 3BHK in Sector 150 under 1.5cr', false), null)
    assert.equal(detectOpenQuery('what is the payment plan', false), null)
  })
})

describe('classifier OPEN routing', () => {
  it('classifies open questions as OPEN with text render target', () => {
    const c = classifyQueryDeterministic('Which sector do the richest people live in?', {})
    assert.equal(c?.queryKind, 'OPEN')
    assert.equal(c?.renderTarget, 'text')
  })

  it('wins over the DRILLDOWN attribute match for entity track-record questions', () => {
    // "reputation"/"track record" also match the attribute keywords used by DRILLDOWN,
    // which routes into the project pipeline and has no row to answer from.
    const c = classifyQueryDeterministic('what is the reputation of Investors Clinic', {})
    assert.equal(c?.queryKind, 'OPEN')
  })

  it('fails open to OPEN, not DISCOVERY, for a question with no search signal', () => {
    const c = classifyQuery('why are property prices climbing here', {})
    assert.equal(c.queryKind, 'OPEN')
  })

  it('still fails open to DISCOVERY when the user is shopping', () => {
    const c = classifyQuery('anything around 1.4 crore', { budgetMax: 1.4 })
    assert.equal(c.queryKind, 'DISCOVERY')
  })
})

describe('hasPropertySearchSignal', () => {
  it('detects shopping constraints', () => {
    assert.equal(hasPropertySearchSignal({ bhk: [3] }), true)
    assert.equal(hasPropertySearchSignal({ sector: 'Sector 150' }), true)
    assert.equal(hasPropertySearchSignal({}), false)
    assert.equal(hasPropertySearchSignal({ bhk: [] }), false)
  })
})

describe('stripUngroundedSentences', () => {
  const grounding = 'Sector 150 (Noida) | avg ₹12,400/sqft | stage: established'

  it('keeps sentences whose numbers appear in the grounding', () => {
    const { text, dropped } = stripUngroundedSentences(
      'Sector 150 leads at ₹12,400 per sqft.',
      grounding,
    )
    assert.equal(dropped.length, 0)
    assert.match(text, /12,400/)
  })

  it('drops a sentence carrying a number the grounding never states', () => {
    const { text, dropped } = stripUngroundedSentences(
      'Sector 150 leads at ₹12,400 per sqft. Prices rose 18% last year.',
      grounding,
    )
    assert.equal(dropped.length, 1)
    assert.match(dropped[0], /18%/)
    assert.doesNotMatch(text, /18%/)
  })

  it('ignores small list counters', () => {
    const { dropped } = stripUngroundedSentences('There are 3 things worth noting.', grounding)
    assert.equal(dropped.length, 0)
  })
})

describe('generic-phrase rejection', () => {
  it('rejects a category phrased as a name', () => {
    assert.equal(detectOpenQuery('Tell me about 3BHK properties', false), null)
    assert.equal(detectOpenQuery('tell me about good builders', false), null)
  })

  it('keeps developer names that end in a generic word', () => {
    // Half of NCR's developers are "<Name> Properties" / "Homes" / "Group".
    assert.equal(detectOpenQuery('tell me about Godrej Properties', false)?.entity, 'Godrej Properties')
    assert.equal(detectOpenQuery('who are the founders of Elite Group', false)?.entity, 'Elite Group')
  })
})

describe('shopping vocabulary guard', () => {
  it('leaves a ranking query to the ranking path', () => {
    // Matches the "what is X" shape but is a filtered search, not a name lookup.
    assert.equal(detectOpenQuery('What are the best projects under 1.5 crore in Sector 62?', false), null)
    assert.equal(detectOpenQuery('what is available under 2 cr', false), null)
  })

  it('does not disqualify demographic questions that mention affordability', () => {
    const d = detectOpenQuery('which areas are affordable for middle class families in Noida', false)
    assert.equal(d?.topic, 'SECTOR_PROFILE')
  })
})

describe('third-party consultancy questions (Wealth Clinic regression)', () => {
  it('detects "How is X?"', () => {
    const d = detectOpenQuery('How is Wealth Clinic? Can I buy a property from them?', false)
    assert.equal(d?.topic, 'ENTITY')
    assert.equal(d?.entity, 'Wealth Clinic')
  })

  it('detects can-I-transact phrasing', () => {
    assert.equal(detectOpenQuery('can i buy from Investors Clinic', false)?.entity, 'Investors Clinic')
  })

  it('detects opinion phrasing', () => {
    assert.equal(detectOpenQuery('what do you think of Wealth Clinic', false)?.entity, 'Wealth Clinic')
    assert.equal(detectOpenQuery('your opinion on Gaurs Group', false)?.entity, 'Gaurs Group')
  })

  it('detects trust checks', () => {
    assert.equal(detectOpenQuery('is Wealth Clinic legit', false)?.entity, 'Wealth Clinic')
  })

  it('never treats a pronoun as a company', () => {
    // "Can I buy a property from them?" on its own must not look up a firm called "them".
    assert.equal(detectOpenQuery('Can I buy a property from them?', false), null)
  })

  it('reaches the open lane when the extractor guessed a name that is not a real project', () => {
    // hasProjectNames=false is what the router now passes for an unmatched guess.
    const d = detectOpenQuery('How is Wealth Clinic?', false)
    assert.equal(d?.topic, 'ENTITY')
  })

  it('still defers to the project pipeline for a verified project name', () => {
    assert.equal(detectOpenQuery('How is Godrej Woods?', true), null)
  })
})

describe('a superlative about a PARTY is not a property search', () => {
  // The shopping-vocabulary guard bailed on `best`/`cheapest` anywhere in the
  // message, so every one of these went to discovery and came back as a shelf of
  // property cards — an answer to a question nobody asked, about companies the
  // discovery pipeline has no notion of.
  for (const q of [
    'which is the best broker in Noida',
    'who is the most trustworthy property consultant here',
    'cheapest channel partner for booking',
    'best real estate agency in Noida',
    'top advisory firm for NRI buyers',
  ]) {
    it(`routes "${q}" to the open path`, () => {
      const d = detectOpenQuery(q, false)
      assert.ok(d, 'fell through to the property taxonomy')
    })
  }

  // The exemption must stay narrow. A superlative plus an inventory noun is
  // still shopping, and the citywide band shelf answers it.
  for (const q of [
    'which is the best project in Noida',
    'cheapest 3BHK under 1 crore',
    'best society in Sector 150',
    'best builder projects in Sector 150',
    'top apartments near the metro',
  ]) {
    it(`leaves "${q}" to discovery`, () => {
      assert.equal(detectOpenQuery(q, false), null)
    })
  }
})
