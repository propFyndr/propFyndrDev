import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { expandAffirmation } from '../followUp'
import { matchesLoanBanks, matchesDeveloperOfEach, loanBanksAnswer, developersAnswer } from '../handlers/shortlistFacts'

// Live session ed1ac3ff, 17 Oct 2026.
describe('a bare "yes" accepts the offer it answers', () => {
  const offer = [{ role: 'assistant', content: 'I found no verified 3 BHK listings under ₹2.5 Cr in Central Noida.\n\nWould you like me to show you options in the ₹2.5 Cr+ range, or explore a different corridor?' }]
  it('appends the first offered action, keeping the buyer\'s word', () => {
    assert.equal(expandAffirmation('yes please', offer), 'yes please (show me options in the ₹2.5 Cr+ range)')
    assert.equal(expandAffirmation('yes show me please', offer), 'yes show me please (show me options in the ₹2.5 Cr+ range)')
  })
  it('leaves real messages and offer-less turns alone', () => {
    assert.equal(expandAffirmation('yes look for options in a nearby sector', offer), 'yes look for options in a nearby sector')
    assert.equal(expandAffirmation('yes', [{ role: 'assistant', content: 'Here are three projects.' }]), 'yes')
  })
})

describe('lenders and developers for the projects on screen', () => {
  it('claims the live phrasings', () => {
    assert.ok(matchesLoanBanks('Alright now tell me the banks readily available to provide home loan for these properties'))
    assert.ok(matchesDeveloperOfEach('who is the developer of each?'))
    assert.ok(!matchesLoanBanks('home loan in noida'))
    assert.ok(!matchesDeveloperOfEach('which builder is good in noida'))
  })
  it('names no lender we do not hold, and drops a templated escrow value', () => {
    const t = loanBanksAnswer(
      [{ name: 'Panchsheel Greens 1', escrow_bank_name: 'HDFC Bank Escrow Account' }, { name: 'Divine Meadows', escrow_bank_name: 'ICICI BANK LTD' }],
      new Set(['HDFC Bank Escrow Account']),
    )
    assert.match(t, /We don't hold which banks have approved/)
    assert.match(t, /\| Panchsheel Greens 1 \| Not on record \|/)
    assert.match(t, /\| Divine Meadows \| ICICI BANK LTD \|/)
    assert.doesNotMatch(t, /pre-approved|tie-up|SBI|Axis|PNB/i)
  })
  it('lists every project, not the first', () => {
    const t = developersAnswer([
      { name: 'A Tower', sector: 'Sector 1', builder: { name: 'Builder A' } },
      { name: 'B Tower', sector: 'Sector 4', builder: null },
    ])
    assert.match(t, /\| A Tower \| Sector 1 \| Builder A \|/)
    assert.match(t, /\| B Tower \| Sector 4 \| Not on record \|/)
    assert.doesNotMatch(t, /founded|ISO|CREDAI|track record of/i)
  })
})

describe('a financing plan that mentions a bank is not a lender question', () => {
  it('leaves "take an 80 lakh loan from the bank" to affordability', () => {
    assert.ok(!matchesLoanBanks('what if I have a monthly income of 1.5L/MONTH and can do a down payment of 20 lakhs and take an 80 lakh loan from the bank?'))
    assert.ok(matchesLoanBanks('which banks give home loans for these projects?'))
  })
})

import { isAffordabilityQuestion } from '../../ai/affordability'

describe('a search that names a budget is a search', () => {
  it('does not read "budget of 1.8 cr" as an affordability question', () => {
    assert.ok(!isAffordabilityQuestion('alright so get me a property with a budget of 1.8 cr , that has spacious 3 bhk rooms'))
    assert.ok(!isAffordabilityQuestion('show me the most recommended option for a 3 bhk in greater noida within 1.5cr budget!!'))
    assert.ok(isAffordabilityQuestion('Help me work out a realistic budget and EMI.'))
    assert.ok(isAffordabilityQuestion('what can I afford in Noida?'))
  })
})

import { isBuilderNameCandidate } from '../../builderNames'
import { dependsOnConversation } from '../../ai/semanticCache'

describe('second transcript rerun', () => {
  it('a pronoun is never a builder filter', () => {
    for (const w of ['these', 'this', 'each', 'them', 'of each', 'the builder']) assert.ok(!isBuilderNameCandidate(w), w)
    for (const w of ['ATS', 'Gaurs Group', 'Mahagun']) assert.ok(isBuilderNameCandidate(w), w)
  })
  it('follow-ups are not served from the answer cache', () => {
    for (const q of ['step 7?', 'yes please', 'okay then show me the properties in these sectors', 'next'])
      assert.ok(dependsOnConversation(q), q)
    assert.ok(!dependsOnConversation('what is the stamp duty for a woman buyer in noida'))
  })
})

import { reconcileIntent } from '../../ai/sessionMemory'

describe('live rerun 3: the merged intent must be searchable', () => {
  const stuck = { bhk: [3], budgetMin: 2.5, budgetMax: 1.5, sector: 'Sector 78, Noida', city: 'Greater Noida', excludeSectors: ['Sector 78'] } as any
  it('a ceiling under a stale floor wins unless this message states a floor', () => {
    const r = reconcileIntent(stuck, 'alright then, show me the most recommended option for a 3 bhk in greater noida within 1.5cr budget!!')
    assert.equal(r.budgetMin, undefined)
    assert.equal(r.budgetMax, 1.5)
    const f = reconcileIntent({ budgetMin: 2.5, budgetMax: 1.5 } as any, 'yes show me options in Rs. 2.5CR+ for 3bhk')
    assert.equal(f.budgetMax, undefined)
    assert.equal(f.budgetMin, 2.5)
  })
  it('drops a sector the buyer excluded or widened away from', () => {
    assert.equal(reconcileIntent(stuck, 'in greater noida within 1.5cr').sector, undefined)
    assert.equal(reconcileIntent({ sector: 'Sector 78, Noida', excludeSectors: ['Sector 78'] } as any, 'show me more').sector, undefined)
    assert.equal(reconcileIntent({ sector: 'Sector 150, Noida' } as any, '3bhk in sector 150 noida').sector, 'Sector 150, Noida')
  })
})

import { asksProjectPriceHistory } from '../handlers/priceTrend'

describe('a backward-looking price question about the shortlist', () => {
  it('is a project price-history question, not a market forecast', () => {
    assert.ok(asksProjectPriceHistory('3 bhk + servant royale price trend in the last 12 months'))
    assert.ok(!asksProjectPriceHistory('noida property price trends'))
    assert.ok(!asksProjectPriceHistory('what will prices be in 5 years'))
    assert.ok(!asksProjectPriceHistory('price trend in greater noida over the last year'))
  })
})

import { matchesBareYes } from '../handlers/bareYes'

describe('a yes the router could attach nothing to', () => {
  it('carries the question it answers, or reaches the what-next handler', () => {
    const q = [{ role: 'assistant', content: 'Panchsheel Greens 1 offers ready flats.\n\nAre you looking to move in immediately?' }]
    assert.equal(expandAffirmation('yes', q), 'yes (answering: Are you looking to move in immediately?)')
    const none = [{ role: 'assistant', content: '### Distance to Noida International (Jewar)\n\nATS Dolce is nearest.' }]
    const still = expandAffirmation('yes', none)
    assert.equal(still, 'yes')
    assert.ok(matchesBareYes(still))
    assert.ok(!matchesBareYes('yes please (show me options in the ₹2.5 Cr+ range)'))
  })
})
