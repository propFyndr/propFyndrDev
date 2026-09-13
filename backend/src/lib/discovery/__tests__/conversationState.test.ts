// The two concepts that were missing when a 15-turn production run broke.
//
// Both failures are quoted in the modules under test. These tests pin the
// behaviour that replaced them, and — more importantly — pin the cases that
// must NOT trigger, because a false positive on either one is worse than the
// original bug: a wrongly-detected workplace drops a real search filter, and a
// wrongly-resolved ordinal answers about the wrong building.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectCommuteAnchor, applyCommuteAnchor, beltFor } from '../commuteAnchor'
import { resolveOrdinalReference, resolveOrdinalPair, resolveSuperlativeReference, needsShownContext } from '../reference'
import { cardBudgetFor, capCards, MAX_CARDS } from '../cardBudget'
import type { Intent } from '../types'

describe('commute anchor', () => {
  it('reads the phrasing that broke the funnel', () => {
    // Verbatim from the run. This set `sector: Sector 63`, the sector lane found
    // no residential inventory in a commercial district, and the buyer was told
    // to contact the advisory team.
    const a = detectCommuteAnchor('central noida, sector 63 noida in particular for office')
    assert.equal(a?.place, 'Sector 63')
    assert.ok(a!.belt.length >= 3, 'a workplace with no belt cannot be acted on')
    assert.ok(a!.belt.includes('Sector 76'))
  })

  for (const [q, expected] of [
    ['my office is in sector 63', 'Sector 63'],
    ['i work in sector 62', 'Sector 62'],
    ['i commute to sector 132 daily', 'Sector 132'],
    ['my workplace is Sector 16A', 'Sector 16A'],
    ['sector 125 for work', 'Sector 125'],
  ] as Array<[string, string]>) {
    it(`detects "${q}"`, () => {
      assert.equal(detectCommuteAnchor(q)?.place, expected)
    })
  }

  // An anchor is anywhere the buyer travels to regularly, not only an office.
  //
  // The first version listed office words only, and the school case failed
  // exactly as the office case had: "my kids school is in sector 62" set
  // `sector: "Sector 62, Noida"`, that sector holds one project, and the buyer
  // got "One project is not enough for me to tell you what the sector is like
  // to live in... The sectors we cover in most depth are Sector 75, Sector 150,
  // Sector 79" — three sectors unrelated to the school, repeated verbatim on
  // the next turn.
  for (const [q, expected] of [
    ['i need a 3bhk under 2cr, my kids school is in sector 62', 'Sector 62'],
    ["my daughter's school is in sector 44", 'Sector 44'],
    ['my parents live in sector 50', 'Sector 50'],
    ['my hospital is in sector 128', 'Sector 128'],
    ['sector 125 for work', 'Sector 125'],
  ] as Array<[string, string]>) {
    it(`treats a non-office anchor as an anchor: "${q}"`, () => {
      assert.equal(detectCommuteAnchor(q)?.place, expected)
    })
  }

  it('reads a commute verb through an adverb', () => {
    // "i commute daily to X" put an adverb between the verb and the
    // preposition, and matched nothing.
    assert.ok(detectCommuteAnchor('i commute daily to the noida expressway'))
  })

  // The important half. Every one of these names a sector the buyer wants to
  // LIVE in; treating it as a workplace would delete the filter they just gave.
  for (const q of [
    'show me flats in sector 63',
    '3bhk in sector 150 under 2cr',
    'is sector 137 good for families',
    'what is the price in sector 78',
    'projects in sector 62',
    // A school as an AMENITY the buyer wants nearby is not an anchor to
    // measure from — it is a filter on the project, and reading it as an
    // anchor would delete the location they actually gave.
    'i need a 3bhk in noida with good schools nearby under 2cr',
    'projects with a school inside the society',
  ]) {
    it(`does not invent an anchor from "${q}"`, () => {
      assert.equal(detectCommuteAnchor(q), null)
    })
  }

  it('removes the workplace from the search filters', () => {
    const { intent } = applyCommuteAnchor(
      'central noida, sector 63 noida in particular for office',
      { sector: 'Sector 63', bhk: [3], budgetMax: 2 },
    )
    assert.equal((intent as { sector?: string }).sector, undefined, 'the workplace must not stay a filter')
    assert.equal((intent as { workplace?: string }).workplace, 'Sector 63')
    assert.deepEqual((intent as { bhk?: number[] }).bhk, [3], 'the real filters survive')
  })

  it('keeps a search sector that is not the workplace', () => {
    // "flats in 78, I work in 63" — Sector 78 is a real filter and must stay.
    const { intent } = applyCommuteAnchor('flats in sector 78, i work in sector 63', {
      sector: 'Sector 78',
      bhk: [3],
    })
    assert.equal((intent as { sector?: string }).sector, 'Sector 78')
    assert.equal((intent as { workplace?: string }).workplace, 'Sector 63')
  })

  it('gives the employment sectors a curated belt, not a numeric guess', () => {
    // Sector 63 appears in SECTOR_ADJACENCY only as a value, so the generic
    // path fell through to ±1/±2/±5 and offered Sectors 64, 65 and 68 — all
    // industrial.
    const belt = beltFor('Sector 63')
    assert.ok(belt.includes('Sector 76') && belt.includes('Sector 78'))
    assert.ok(!belt.includes('Sector 64'), 'an industrial sector is not a residential belt')
  })
})

describe('ordinal references', () => {
  const shown = [
    { id: 'a', name: 'Prateek Wisteria' },
    { id: 'b', name: 'Antriksh Golf View I' },
    { id: 'c', name: 'Divine Meadows' },
    { id: 'd', name: 'ATS Nobility' },
  ]

  for (const [q, expected] of [
    ['tell me about the first one', 'Prateek Wisteria'],
    ['what about the second option', 'Antriksh Golf View I'],
    ['the third project please', 'Divine Meadows'],
    ['tell me about the last one', 'ATS Nobility'],
    ['tell me about the first', 'Prateek Wisteria'],
  ] as Array<[string, string]>) {
    it(`resolves "${q}"`, () => {
      assert.equal(resolveOrdinalReference(q, shown)?.project.name, expected)
    })
  }

  it('answers nothing rather than guessing past the end of the list', () => {
    assert.equal(resolveOrdinalReference('tell me about the fifth option', shown), null)
  })

  it('does not read an ordinal out of a quantity', () => {
    // "3" was in this alternation, and "show me 3 options" only escaped
    // resolving to the third project because `option` is plural there.
    for (const q of ['show me 3 options', 'give me 2 projects', 'top 3 options in sector 150']) {
      assert.equal(resolveOrdinalReference(q, shown), null, q)
    }
  })

  it('does not resolve a message that names a project outright', () => {
    assert.equal(resolveOrdinalReference('tell me about ATS Nobility', shown), null)
  })

  it('resolves "it" against the focused project for a comparison', () => {
    // T14 on the run: "compare it with the second option" was answered "we
    // currently only have ATS Nobility in our verified records".
    const pair = resolveOrdinalPair('compare it with the second option', shown, 'd')
    assert.deepEqual(pair.map(p => p.name), ['ATS Nobility', 'Antriksh Golf View I'])
  })

  it('knows which messages cannot be answered without the list', () => {
    for (const q of ['tell me about the first one', 'which of these is closest to sector 63', 'compare the first two']) {
      assert.equal(needsShownContext(q), true, q)
    }
    for (const q of ['what is stamp duty in UP', 'show me 3bhk in sector 150']) {
      assert.equal(needsShownContext(q), false, q)
    }
  })

  it('does not read a referent out of a pronoun the message answers itself', () => {
    // "What is EDC and IDC and do I have to pay them?" was answered with "I've
    // lost track of which options you mean" — `them` points at the two charges
    // the same sentence just named, not at a shortlist that was never shown.
    for (const q of [
      'What is EDC and IDC and do I have to pay them?',
      'what are IFMS and club charges and are they refundable, do I pay them upfront',
      'What is a Transfer Memorandum and who pays for these charges',
    ]) {
      assert.equal(needsShownContext(q), false, q)
    }
  })

  it('still needs the list for a pronoun with no antecedent of its own', () => {
    for (const q of ['what are these?', 'tell me about them', 'compare these', 'which of these is cheapest']) {
      assert.equal(needsShownContext(q), true, q)
    }
  })

  it('resolves nothing when no list has been shown', () => {
    assert.equal(resolveOrdinalReference('tell me about the first one', []), null)
  })
})

describe('card budget', () => {
  // Measured across four 15-turn production runs: 17-20 cards on nearly every
  // discovery turn, whatever the buyer had said. Nineteen came back for "my
  // budget would be 2cr max", and nineteen again for "how much would the EMI
  // be" and "i want to visit this weekend". Nineteen cards is a directory.
  it('shows nothing before the buyer has narrowed anything', () => {
    assert.equal(cardBudgetFor({} as Intent).limit, 0)
  })

  it('opens up as constraints arrive', () => {
    assert.equal(cardBudgetFor({ bhk: [3] } as Intent).limit, 4)
    assert.equal(cardBudgetFor({ bhk: [3], budgetMax: 2 } as Intent).limit, MAX_CARDS)
    assert.equal(cardBudgetFor({ sector: 'Sector 150', bhk: [3], budgetMax: 2 } as Intent).limit, MAX_CARDS)
  })

  it('counts a workplace as a location, because it also implies a ranking', () => {
    assert.equal(cardBudgetFor({ workplace: 'Sector 63' } as unknown as Intent).limit, 4)
    assert.equal(cardBudgetFor({ workplace: 'Sector 63', bhk: [3] } as unknown as Intent).limit, MAX_CARDS)
  })

  it('narrows to the subject once a project is in focus', () => {
    // A drilldown answered with six cards buries the project it is about.
    const budget = cardBudgetFor({ projectNames: ['ATS Nobility'], bhk: [3], budgetMax: 2 } as Intent)
    assert.equal(budget.limit, 3)
  })

  it('never exceeds the cap however much is stated', () => {
    const everything = {
      sector: 'Sector 150', bhk: [3], budgetMax: 2, budgetMin: 1,
      possession: 'immediate', purpose: 'endUse', lifestyleKeywords: ['pool', 'gym'],
    } as unknown as Intent
    assert.equal(cardBudgetFor(everything).limit, MAX_CARDS)
  })

  it('caps a payload and keeps the order the ranker chose', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    assert.deepEqual(capCards(rows, 3), [1, 2, 3])
    assert.deepEqual(capCards(rows, 0), [])
    assert.deepEqual(capCards(undefined, 5), [])
  })
})

describe('superlative references', () => {
  const shown = [
    { id: 'a', name: 'Golden Palms', priceMinCr: 0.72 },
    { id: 'b', name: 'Ace Platinum', priceMinCr: 0.88 },
    { id: 'c', name: 'ATS Pristine', priceMinCr: 4.30 },
  ]

  // Measured: "What is the per sqft rate on the cheapest one and what would the
  // total registry cost be?" — asked right after six cards — answered neither
  // question. It returned a micro-market price table, because the superlative
  // resolved to nothing and the word "rate" then triggered that table.
  it('resolves "the cheapest one" against the shown list', () => {
    assert.equal(resolveSuperlativeReference('per sqft rate on the cheapest one', shown)?.project.name, 'Golden Palms')
  })

  it('resolves the other direction too', () => {
    assert.equal(resolveSuperlativeReference('tell me about the most expensive one', shown)?.project.name, 'ATS Pristine')
  })

  it('resolves nothing when no prices are known', () => {
    // Guessing which is cheapest without prices would answer about the wrong
    // building.
    const unpriced = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    assert.equal(resolveSuperlativeReference('the cheapest one', unpriced), null)
  })

  it('does not fire on an ordinary question about price', () => {
    assert.equal(resolveSuperlativeReference('what is the price of ATS Pristine', shown), null)
  })

  it('counts as needing the shown list', () => {
    assert.equal(needsShownContext('what is the rate on the cheapest one'), true)
  })
})

describe('a stated constraint is not a referent', () => {
  // Shipped for one deploy: "budget" was in the superlative list with an
  // optional noun, so "3bhk, my office is in sector 63, budget 2cr" was read as
  // pointing at the cheapest of a list that did not exist, and the turn was
  // answered with a request for clarification. It broke the happy path.
  for (const q of [
    '3bhk, my office is in sector 63, budget 2cr',
    'my budget is 1.5 cr',
    'show me budget homes in noida',
    'premium 4bhk in sector 150',
    'what is the price of ATS Pristine',
  ]) {
    it(`does not read a referent out of "${q}"`, () => {
      assert.equal(needsShownContext(q), false, q)
      assert.equal(resolveSuperlativeReference(q, [{ id: 'a', name: 'A', priceMinCr: 1 }]), null, q)
    })
  }

  it('still reads the explicit forms', () => {
    const shown = [{ id: 'a', name: 'Cheap One', priceMinCr: 0.7 }, { id: 'b', name: 'Dear One', priceMinCr: 4 }]
    assert.equal(resolveSuperlativeReference('rate on the cheapest one', shown)?.project.name, 'Cheap One')
    assert.equal(resolveSuperlativeReference('which is the cheapest', shown)?.project.name, 'Cheap One')
    assert.equal(resolveSuperlativeReference('the most expensive option', shown)?.project.name, 'Dear One')
  })
})
