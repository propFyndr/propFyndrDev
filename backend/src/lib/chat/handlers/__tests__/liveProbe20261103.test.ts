import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSectorRateQuote } from '../sectorRateCheck'
import { matchesPriceForecast, priceMultipleAnswer, PRICE_FORECAST_ANSWER } from '../investmentScenario'
import { loanEmiFollowUp, loanEmiAnswer } from '../loanEmi'
import { wantsToBookVisit, matchesSiteVisitQuestion } from '../buyerSupport'
import { matchesMessageOnlyTopic } from '../messageOnlyTopics'
import { sectorsNamedIn, missingYieldNote } from '../../../ai/yieldTable'
import { mentionsPortal } from '../../../ai/sanitizeOutput'

// Every message below was a live failure on 3 Nov 2026 (scripted probe of realtyask.in).

describe('a quoted per-sq-ft rate is checked against our rows', () => {
  it('"is that okay" counts as the ask, and reaches the handler gate with no project named', () => {
    const m = 'builder quoted 9500 per sq ft in sector 150, is that okay?'
    assert.ok(matchesSectorRateQuote(m))
    assert.ok(matchesMessageOnlyTopic(m))
  })
  it('a rate with no ask is not a rate check', () => {
    assert.equal(matchesSectorRateQuote('projects around 9500 per sq ft in sector 150'), false)
  })
})

describe('a forward price question is declined in code', () => {
  it('declines "will prices go up in the next 3 years" without a forecast', () => {
    const m = 'will property prices in Noida Extension go up in the next 3 years?'
    assert.ok(matchesPriceForecast(m))
    assert.ok(matchesMessageOnlyTopic(m))
    const a = priceMultipleAnswer(m)
    assert.equal(a, PRICE_FORECAST_ANSWER)
    assert.match(a, /^I don't forecast prices\./)
    assert.doesNotMatch(a, /\d+(?:\.\d+)?\s*%/)
  })
  it('leaves past movement, EMI and rent questions alone', () => {
    for (const m of [
      'has the price of Gaur City gone up since 2023?',
      'how much did prices rise in the last 3 years in sector 150?',
      'will my EMI go up if the rate increases?',
      'will rents go up in sector 62?',
      'will prices double in 5 years?',
    ]) assert.equal(matchesPriceForecast(m), false, m)
  })
})

describe('an EMI follow-up re-runs the stated loan', () => {
  const prior = ['EMI on a 90 lakh loan for 20 years at 8.5%']
  it('takes the new rate and keeps the loan and tenure', () => {
    const q = loanEmiFollowUp('what if the rate goes to 9.5%?', prior)
    assert.deepEqual(q, { principal: 9_000_000, rate: 9.5, tenure: 20 })
    assert.match(loanEmiAnswer(q!), /at 9\.5% over 20 years/)
    assert.ok(matchesMessageOnlyTopic('what if the rate goes to 9.5%?', prior))
  })
  it('carries an earlier change forward', () => {
    assert.deepEqual(loanEmiFollowUp('and over 25 years?', [...prior, 'what if the rate goes to 9.5%?']), { principal: 9_000_000, rate: 9.5, tenure: 25 })
  })
  it('needs an EMI question to follow, and is not a possession period', () => {
    assert.equal(loanEmiFollowUp('what if the rate goes to 9.5%?', ['3bhk in sector 150']), null)
    assert.equal(loanEmiFollowUp('show me flats with possession in 2 years', prior), null)
    assert.equal(loanEmiFollowUp('what about sector 62?', prior), null)
  })
})

describe('a visit booking is not a checklist question', () => {
  it('reads the booking asks', () => {
    for (const m of ['I want to visit Mahagun Mezzaria this weekend', 'Schedule a site visit for ATS Destinaire.', 'can i book a visit on saturday'])
      assert.ok(wantsToBookVisit(m), m)
  })
  it('leaves the checklist ask to the checklist', () => {
    const m = 'on a site visit what should I check?'
    assert.ok(matchesSiteVisitQuestion(m))
    assert.equal(wantsToBookVisit(m), false)
  })
})

describe('a yield question about one sector says when we cannot place it', () => {
  it('reads the sector and states the gap in code', () => {
    assert.deepEqual(sectorsNamedIn('what rental yield can I expect in Sector 150?'), ['Sector 150'])
    const rows = [{ sector: 'Sector 4', city: 'Greater Noida West', monthlyRent: 34000, medianPriceCr: 1.05, sampleSize: 9, grossYieldPct: 3.89 }]
    assert.match(missingYieldNote(['Sector 150'], rows), /can't place a yield for Sector 150/)
    assert.equal(missingYieldNote(['Sector 4'], rows), '')
  })
})

describe('a portal is recognised in the question', () => {
  it('names 99acres, and keeps no state between calls', () => {
    assert.ok(mentionsPortal('what does 99acres say about Gaur City prices?'))
    assert.ok(mentionsPortal('what does 99acres say about Gaur City prices?'))
    assert.equal(mentionsPortal('what do you hold on Gaur City prices?'), false)
  })
})
