import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIndianPhone } from '../indianPhone'

test('keeps a number that starts with 9 intact (the old regex ate it)', () => {
  assert.equal(normalizeIndianPhone('9876543210', true), '+919876543210')
})

test('accepts the common pasted shapes', () => {
  for (const v of ['+919876543210', '+91 98765 43210', '919876543210', '09876543210']) {
    assert.equal(normalizeIndianPhone(v, true), '+919876543210', v)
  }
})

test('typing after the prefix builds the number, capped at 10 digits', () => {
  assert.equal(normalizeIndianPhone('+919', true), '+919')
  assert.equal(normalizeIndianPhone('+9198765432109', true), '+919876543210')
})

test('clearing returns the prefix for required fields and empty for optional ones', () => {
  assert.equal(normalizeIndianPhone('+9', true), '+91')
  assert.equal(normalizeIndianPhone('+9', false), '')
  assert.equal(normalizeIndianPhone('', false), '')
  assert.equal(normalizeIndianPhone('+91', false), '')
})
