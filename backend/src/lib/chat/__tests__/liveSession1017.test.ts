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
