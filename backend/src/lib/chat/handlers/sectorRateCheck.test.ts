import test from 'node:test'
import assert from 'node:assert/strict'
import { ratePerSqftIn, medianOf } from './sectorRateCheck'

test('a per-sq-ft rate is read from English and Hinglish asks', () => {
  assert.equal(ratePerSqftIn('Is 8,500 per sq ft a fair price in Sector 150?'), 8500)
  assert.equal(ratePerSqftIn('Sector 150 mein 8,500 per sq ft ka rate theek hai ya mehenga?'), 8500)
  assert.equal(ratePerSqftIn('₹9500/sqft in sector 78 is it reasonable'), 9500)
})

test('a crore, lakh, BHK or area figure is not a rate', () => {
  assert.equal(ratePerSqftIn('A 2BHK of 1,500 sq ft for 1.1 crore, reasonable?'), null)
  assert.equal(ratePerSqftIn('1.4 crore flat, stamp duty?'), null)
  assert.equal(ratePerSqftIn('100 per sq ft'), null)
})

test('median of an even and odd list', () => {
  assert.equal(medianOf([3, 1, 2]), 2)
  assert.equal(medianOf([1, 2, 3, 4]), 2.5)
})
