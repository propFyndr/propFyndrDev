import { it } from 'node:test'
import assert from 'node:assert/strict'
import { cleanDebris } from '../sanitizeOutput'
import { needsJoinSpace } from '../endsRagged'

// Seen live: "�8 0� lakh" where the answer said "₹80 lakh".
it('a continuation cut inside a number joins without a space', () => {
  assert.equal(needsJoinSpace('costs ₹8', '0 lakh'), false)
  assert.equal(needsJoinSpace('the project', 'is'), true)
  assert.equal(needsJoinSpace('done.', 'Next'), false)
})
it('undecodable bytes never reach the buyer; before a figure they were the rupee sign', () => {
  assert.equal(cleanDebris('about �80 lakh�'), 'about ₹80 lakh')
  assert.equal(cleanDebris('plain ₹1.2 Cr'), 'plain ₹1.2 Cr')
})
