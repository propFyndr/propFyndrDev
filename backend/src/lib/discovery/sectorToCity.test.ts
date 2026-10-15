import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getQualifiedSector, isSectorInCity, alternativeSectorCities, sectorAmbiguityNote, sectorCounterpart, counterpartNote } from './sectorToCity'

// Noida numbers its sectors 1–168; GNW, Greater Noida and the Yamuna
// Expressway reuse many of those numbers. Each row was resolved wrongly
// before 2026-10-13.
describe('sector numbers shared with Noida', () => {
  const cases: [string, string][] = [
    ['Sector 18', 'Sector 18, Noida'], // was Yamuna Expressway
    ['Sector 18, Noida', 'Sector 18, Noida'],
    ['Sector 16 Noida', 'Sector 16, Noida'], // was Greater Noida West
    ['Sector 1 Noida', 'Sector 1, Noida'], // was Greater Noida West
    ['Noida Sector 1', 'Sector 1, Noida'], // was unresolved
    ['Sector 27', 'Sector 27, Noida'], // was Greater Noida
    // Named or unique sectors keep their city.
    ['Sector 1, Greater Noida West', 'Sector 1, Greater Noida West'],
    ['Sector 18 Yamuna Expressway', 'Sector 18, Yamuna Expressway'],
    ['Sector 27, Greater Noida', 'Sector 27, Greater Noida'],
    ['Sector 16B', 'Sector 16B, Greater Noida West'],
    ['Sector 22D', 'Sector 22D, Yamuna Expressway'],
    // A bare GNW number stays GNW: V1 covers GNW and the catalogue's projects are there.
    ['Sector 1', 'Sector 1, Greater Noida West'],
    ['Sector 150', 'Sector 150, Noida'],
  ]
  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => assert.equal(getQualifiedSector(input), expected))
  }

  it('a city hint settles a bare number', () => {
    assert.equal(getQualifiedSector('Sector 1', 'Noida'), 'Sector 1, Noida')
    assert.equal(getQualifiedSector('Sector 18', 'Yamuna Expressway'), 'Sector 18, Yamuna Expressway')
  })

  it('a negated city is not the named one', () => {
    assert.equal(getQualifiedSector('Sector 1', 'noida sector 1 not noida extension'), 'Sector 1, Noida')
  })
})

describe('isSectorInCity', () => {
  it('a sector that exists in the city is kept (mergeIntent drops the rest)', () => {
    assert.equal(isSectorInCity('Sector 18', 'Noida'), true) // was false: the sector was dropped
    assert.equal(isSectorInCity('Sector 16', 'Noida'), true)
    assert.equal(isSectorInCity('Sector 1', 'Greater Noida West'), true)
  })
  it('Sector 150 is never Greater Noida West', () => {
    assert.equal(isSectorInCity('Sector 150', 'Greater Noida West'), false)
  })
})

describe('ambiguity note', () => {
  it('lists the other city a bare number could mean', () => {
    assert.deepEqual(alternativeSectorCities('Sector 1'), ['Noida'])
    assert.deepEqual(alternativeSectorCities('Sector 18'), ['Yamuna Expressway'])
    assert.deepEqual(alternativeSectorCities('Sector 1, Noida'), [])
    assert.deepEqual(alternativeSectorCities('Sector 150'), [])
  })

  it('notes the other Sector 1 when every result is from one city', () => {
    const note = sectorAmbiguityNote('3bhk in sector 1 under 2 cr', ['Greater Noida West', 'Greater Noida West'])
    assert.ok(note)
    assert.match(note, /Sector 1, Greater Noida West/)
    assert.match(note, /Noida also has a Sector 1/)
  })

  it('no note when the buyer named the city, the sector is unique, or results span cities', () => {
    assert.equal(sectorAmbiguityNote('3bhk in noida sector 1', ['Greater Noida West']), null)
    assert.equal(sectorAmbiguityNote('flats in sector 1 greater noida west', ['Greater Noida West']), null)
    assert.equal(sectorAmbiguityNote('flats in sector 150', ['Noida']), null)
    assert.equal(sectorAmbiguityNote('flats in sector 1', ['Noida', 'Greater Noida West']), null)
    assert.equal(sectorAmbiguityNote('flats in sector 1', []), null)
  })
})

describe('named sector with a namesake elsewhere', () => {
  // ChatGPT drew this line ("Noida Sector 1 is not Noida Extension Sector 1");
  // we answered "no verified data" and stopped.
  it('detects the city the buyer named and the other place with that number', () => {
    assert.deepEqual(sectorCounterpart('is there any project in noida sector 1 not noida extension 1?'), { sector: 'Sector 1', asked: 'Noida', other: 'Greater Noida West' })
    assert.deepEqual(sectorCounterpart('flats in sector 1 greater noida west'), { sector: 'Sector 1', asked: 'Greater Noida West', other: 'Noida' })
    assert.equal(sectorCounterpart('3bhk in sector 150 noida'), null)
    assert.equal(sectorCounterpart('sector 1 flats'), null)
  })
  it('notes only when the named sector is empty and its namesake is not', () => {
    const c = { sector: 'Sector 1', asked: 'Noida', other: 'Greater Noida West' }
    assert.match(counterpartNote(c, 0, 36)!, /different places\. We hold no projects in Noida Sector 1; we hold 36 in Sector 1, Greater Noida West/)
    assert.equal(counterpartNote(c, 2, 36), null)
    assert.equal(counterpartNote(c, 0, 0), null)
  })
})
