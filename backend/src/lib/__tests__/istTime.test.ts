import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startOfIstDay } from '../istTime'

test('before 18:30 UTC the IST day began the previous UTC evening', () => {
  assert.equal(startOfIstDay(new Date('2026-11-03T10:00:00Z')).toISOString(), '2026-11-02T18:30:00.000Z')
})

test('after 18:30 UTC it is already the next IST day', () => {
  assert.equal(startOfIstDay(new Date('2026-11-03T19:00:00Z')).toISOString(), '2026-11-03T18:30:00.000Z')
})

test('exactly IST midnight maps to itself', () => {
  assert.equal(startOfIstDay(new Date('2026-11-03T18:30:00Z')).toISOString(), '2026-11-03T18:30:00.000Z')
})
