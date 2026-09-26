/**
 * Regressions from the 2026-09-26 buyer test run (claudeQueries.md).
 * Each case is a message that was misrouted or mis-answered on that run.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesLegalRiskQuestion } from '../legalRisk'
import { statedBasePriceInr, femaleStampDutySaving } from '../totalOutflow'
import { resolveShownSet, asksForSinglePick, needsShownContext } from '../../../discovery/reference'
import { UP_STATUTORY } from '../../../factPresentation'

describe('legal-risk routing', () => {
  it('claims EOI, Sports City and unregistered-resale questions', () => {
    for (const q of [
      'ace new launch sector 150 asking 10 lakh EOI. refundable hai? should i pay',
      'ace new launch sector 150 asking 10 lakh EOl. refundable hai? should i pay', // the typo from the run
      'is sector 150 sports city registry problem solved now? which projects are affected',
      'resale flat mil raha gaur city side, seller ke paas registry nahi hai, builder bol raha baad me transfer kar denge. safe hai?',
    ]) assert.equal(matchesLegalRiskQuestion(q), true, q)
  })

  it('leaves amenity, search and plain launch questions alone', () => {
    for (const q of [
      'which society in sector 150 has the best sports facilities',
      'show me 3bhk in sector 150 under 2 cr',
      'what new launches are there in noida',
    ]) assert.equal(matchesLegalRiskQuestion(q), false, q)
  })
})

describe('stated base price', () => {
  it('reads the buyer\'s own BSP, not a budget ceiling', () => {
    assert.equal(statedBasePriceInr('bsp 1.2 cr for 3bhk under construction on expressway. total kitna padega'), 12_000_000)
    assert.equal(statedBasePriceInr('base price 95 lakh, all in kitna'), 9_500_000)
    assert.equal(statedBasePriceInr('3bhk under 1.2 cr in sector 150'), null)
  })

  it('caps the female stamp-duty saving', () => {
    assert.equal(femaleStampDutySaving(12_000_000), UP_STATUTORY.stampDutyFemaleConcessionCapInr)
    assert.equal(femaleStampDutySaving(500_000), 5_000)
  })
})

describe('shown-set references', () => {
  const shown = [
    { id: 'a', name: 'Prateek Laurel' },
    { id: 'b', name: 'Divine Meadows' },
    { id: 'c', name: 'ACE Parkway' },
    { id: 'd', name: 'Mahagun Meadows' },
  ]
  const q = "compare the top 3 you showed. dont give pros cons, just tell me which one you'd buy for a family and why"

  it('resolves "the top 3 you showed" to the first three shown', () => {
    assert.deepEqual(resolveShownSet(q, shown).map(p => p.id), ['a', 'b', 'c'])
    assert.equal(needsShownContext(q), true)
  })

  it('reads it as a request for one verdict', () => {
    assert.equal(asksForSinglePick(q), true)
    assert.equal(asksForSinglePick('compare the top 2 you showed'), false)
  })

  it('returns nothing without a pointer, or with fewer than two shown', () => {
    assert.deepEqual(resolveShownSet('compare noida and gurgaon', shown), [])
    assert.deepEqual(resolveShownSet(q, shown.slice(0, 1)), [])
  })
})
