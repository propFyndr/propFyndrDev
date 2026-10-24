import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getCachedResponseLocal, setCachedResponse, setCatalogStampForTest, meaningKey, GLOBAL_SCOPE } from '../semanticCache'

// Week plan Day 5.3: a factual question in other words shares the saved answer;
// a question that differs in sector, size, budget, place or topic never does.
setCatalogStampForTest('meaning-test')

const same: Array<[string, string]> = [
  ['What is the average price per sq ft in Sector 150?', 'average price per sq ft in sector 150 noida'],
  ['What is the average property price per sq ft in Noida right now?', 'average per sq ft rate of property in Noida currently?'],
  ['Which areas of Noida are best for families?', 'best areas in Noida for families?'],
  ['3 BHK in Sector 150 under 1.5 crore', 'sector-150 3bhk below 1.5 cr'],
  ['2 BHK flats under 80 lakh in Sector 75', '2bhk apartments within 80 lakhs sector 75'],
]

const different: Array<[string, string, string]> = [
  ['What is the average price per sq ft in Sector 150?', 'What is the average price per sq ft in Sector 137?', 'sector'],
  ['3 BHK in Sector 150 under 1.5 crore', '2 BHK in Sector 150 under 1.5 crore', 'size'],
  ['3 BHK in Sector 150 under 1.5 crore', '3 BHK in Sector 150 under 2 crore', 'budget'],
  ['3 BHK in Sector 150 under 1.5 crore', '3 BHK in Sector 150 above 1.5 crore', 'ceiling vs floor'],
  ['2 BHK under 3 crore', '3 BHK under 2 crore', 'numbers swapped'],
  ['3 BHK under 1.5 crore', '3 BHK under 1.5 lakh', 'unit'],
  ['Which projects are in Sector 150?', 'Which projects are not in Sector 150?', 'negation'],
  ['average price per sq ft in Noida', 'average price per sq ft in Greater Noida', 'city'],
  ['average price per sq ft in Sector 1 Greater Noida West', 'average price per sq ft in Sector 1', 'Greater Noida sector vs Noida sector'],
  ['What is the average price per sq ft in Sector 150?', 'What is the possession status of projects in Sector 150?', 'topic'],
  ['What is the average price per sq ft in Sector 150?', 'What is the total cost per sq ft in Sector 150?', 'price vs cost'],
  ['average rate in Sector 150', 'average price in Sector 150', 'per sq ft rate vs ticket price'],
  ['main road facing flats in Sector 150', 'road facing flats in Sector 150', 'main road'],
  ['common area maintenance in Sector 150', 'area maintenance in Sector 150', 'common area'],
  ['When is possession in Sector 150?', 'Where is possession in Sector 150?', 'question word'],
]

describe('meaningKey', () => {
  for (const [a, b] of same) {
    it(`same meaning: "${a}" = "${b}"`, () => assert.equal(meaningKey(a), meaningKey(b)))
  }
  for (const [a, b, why] of different) {
    it(`differs (${why}): "${a}" != "${b}"`, () => assert.notEqual(meaningKey(a), meaningKey(b)))
  }
})

describe('answer cache matches factual questions on meaning', () => {
  it('serves a saved answer to the same question in other words', () => {
    setCachedResponse('What is the average price per sq ft in Sector 150?', { token: 'S150 avg' }, undefined, GLOBAL_SCOPE, 'anon')
    assert.equal(getCachedResponseLocal('average price per sq ft in sector 150 noida', GLOBAL_SCOPE, 'anon')?.token, 'S150 avg')
  })

  it('never serves it to a near miss', () => {
    setCachedResponse('What is the average price per sq ft in Sector 150?', { token: 'S150 avg' }, undefined, GLOBAL_SCOPE, 'anon')
    for (const [, b] of different.filter(([a]) => a === 'What is the average price per sq ft in Sector 150?')) {
      assert.equal(getCachedResponseLocal(b, GLOBAL_SCOPE, 'anon'), null, b)
    }
  })

  it('keeps a judgement question on its exact words', () => {
    setCachedResponse('Is Sector 150 good for families?', { token: 'judgement' }, undefined, GLOBAL_SCOPE, 'anon')
    assert.equal(getCachedResponseLocal('is sector 150 good for families', GLOBAL_SCOPE, 'anon')?.token, 'judgement')
    assert.equal(getCachedResponseLocal('Is Sector 150 good for a family?', GLOBAL_SCOPE, 'anon'), null)
  })

  it('still refuses follow-ups, which mean nothing without the turns before them', () => {
    setCachedResponse('average price per sq ft of these', { token: 'x' }, undefined, GLOBAL_SCOPE, 'anon')
    assert.equal(getCachedResponseLocal('average price per sq ft of these', GLOBAL_SCOPE, 'anon'), null)
  })

  it('still splits by what the buyer told us before this turn', () => {
    setCachedResponse('which sectors have metro', { token: 'for 1.5cr buyer' }, undefined, GLOBAL_SCOPE, 'fp-budget-1.5')
    assert.equal(getCachedResponseLocal('sectors which have metro', GLOBAL_SCOPE, 'anon'), null)
    assert.equal(getCachedResponseLocal('sectors which have metro', GLOBAL_SCOPE, 'fp-budget-1.5')?.token, 'for 1.5cr buyer')
  })
})
