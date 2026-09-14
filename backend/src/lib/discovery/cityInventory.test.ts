import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPropertySearchSignal, SHELF_NOUN_RE } from './openQuery'
import { cardBudgetFor } from './cardBudget'
import type { Intent } from './types'

// "properties in greater noida west" failed at three independent guards, each
// of which read a field that is sector-or-finer and found nothing. The phrase
// is city-level; the buyer still named a place and asked to see units.

test('a city plus a property noun is a search signal', () => {
  const city = { city: 'Greater Noida West', spatialScope: 'BROAD' }
  assert.equal(hasPropertySearchSignal(city, 'properties in greater noida west'), true)
  assert.equal(hasPropertySearchSignal(city, 'flats in greater noida west'), true)
  assert.equal(hasPropertySearchSignal({ city: 'Noida' }, '3 bhk in noida'), true)
})

test('a city on its own is a place, not a search', () => {
  // The regression this guard exists to prevent: a question that merely
  // mentions a city must not come back as a shelf of property cards.
  assert.equal(hasPropertySearchSignal({ city: 'Noida' }, 'what is stamp duty in noida'), false)
  assert.equal(hasPropertySearchSignal({ city: 'Noida' }, 'is noida a good investment'), false)
  assert.equal(hasPropertySearchSignal({}, 'hi'), false)
  // No message at all: the old single-argument callers must keep their meaning.
  assert.equal(hasPropertySearchSignal({ city: 'Noida' }), false)
})

test('a named city earns cards, an empty intent does not', () => {
  assert.equal(cardBudgetFor({ city: 'Greater Noida West' } as Intent, 'properties in greater noida west').limit, 4)
  assert.equal(cardBudgetFor({} as Intent, 'i want to buy a flat').limit, 0)
})

test('city and sector are one location constraint, not two', () => {
  // Both present must not inflate the budget past what one place earns.
  const both = cardBudgetFor({ city: 'Noida', sector: 'Sector 75' } as Intent, 'properties in noida sector 75')
  assert.equal(both.limit, 4, both.reason)
})

test('the shelf regex carries no global flag', () => {
  // A global regex used with .test keeps lastIndex between calls and returns
  // false on every other call — which would make the gate flicker per turn.
  assert.equal(SHELF_NOUN_RE.global, false)
  assert.equal(SHELF_NOUN_RE.test('flats in noida'), true)
  assert.equal(SHELF_NOUN_RE.test('flats in noida'), true)
})
