import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { firstStatusLine } from '../statusLine'

describe('first status line', () => {
  it('names what the buyer typed', () => {
    assert.equal(firstStatusLine('3bhk in sector 150 under 2 cr'), 'Checking Sector 150 projects…')
    assert.equal(firstStatusLine('Compare Sector 75 with Sector 150'), 'Checking Sectors 75 and 150…')
    assert.equal(firstStatusLine('wife ka office sec 62, 3bhk'), 'Checking Sector 62 projects…')
    assert.equal(firstStatusLine('properties in greater noida west'), 'Checking Greater Noida West projects…')
    assert.equal(firstStatusLine('2 bhk around 80 lakh'), 'Looking through verified listings…')
  })
  it('never names a project', () => {
    assert.equal(firstStatusLine('whats the catch with godrej tropical isle?'), 'Reading your question…')
  })
})
