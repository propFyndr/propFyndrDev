import test from 'node:test'
import assert from 'node:assert/strict'
import { extractSectorMentions } from './sectorMentions'

// Every sector number the pilot table actually holds includes 1, 2 and 3 —
// which is precisely why the bare-number scan was so destructive.
const HELD = ['1', '2', '3', '10', '75', '76', '78', '128', '137', '150', '168']

test('a budget band is not a sector pair', () => {
  assert.deepEqual(
    extractSectorMentions('Show me the best projects between 1 and 2 crore, with the reason for each and its main trade-off.', HELD),
    [],
  )
})

test('a BHK range is not a sector pair', () => {
  assert.deepEqual(extractSectorMentions('compare 2 and 3 BHK options', HELD), [])
})

test('a carpet area range is not a sector pair', () => {
  assert.deepEqual(extractSectorMentions('what is better, 1200 or 3 sq ft balcony', HELD), [])
})

test('explicit sectors still resolve', () => {
  assert.deepEqual(
    extractSectorMentions('Compare Sector 150 and Sector 137', HELD).sort(),
    ['Sector 137', 'Sector 150'],
  )
})

test('the second number inherits the word sector', () => {
  assert.deepEqual(extractSectorMentions('sector 76 vs 75', HELD).sort(), ['Sector 75', 'Sector 76'])
})

test('a bare number resolves only when anchored to a named sector', () => {
  assert.deepEqual(
    extractSectorMentions('is sector 76 better than 75?', HELD).sort(),
    ['Sector 75', 'Sector 76'],
  )
  // Same sentence shape, no anchor: nothing is promoted.
  assert.deepEqual(extractSectorMentions('is 76 better than 75?', HELD), [])
})

test('a budget beside a real sector does not become a second sector', () => {
  assert.deepEqual(
    extractSectorMentions('best projects in sector 150 between 1 and 2 crore', HELD),
    ['Sector 150'],
  )
})

test('the plural form resolves — it used to extract nothing at all', () => {
  // Reported from live use. `\bsector\s*` requires whitespace after "sector",
  // so every plural phrasing matched zero sectors and the turn fell through to
  // whatever sticky state it had.
  assert.deepEqual(extractSectorMentions('sectors 1 and 2', HELD).sort(), ['Sector 1', 'Sector 2'])
  assert.deepEqual(extractSectorMentions('compare sectors 75 and 78', HELD).sort(), ['Sector 75', 'Sector 78'])
  assert.deepEqual(extractSectorMentions('which is better sectors 137 or 150', HELD).sort(), ['Sector 137', 'Sector 150'])
})

test('the word carries across a whole list, not just one neighbour', () => {
  // The same convention that makes "1 crore and 2 crores" a band and
  // "2 and 3 BHK" two configurations: a unit stated once governs the run.
  assert.deepEqual(
    extractSectorMentions('flats in sectors 150, 137 and 128', HELD).sort(),
    ['Sector 128', 'Sector 137', 'Sector 150'],
  )
  assert.deepEqual(
    extractSectorMentions('sector 75, 76 or 78', HELD).sort(),
    ['Sector 75', 'Sector 76', 'Sector 78'],
  )
})

test('a list stops at an item carrying its own unit', () => {
  // "sector 150 and 2 crore" is one sector and a budget, not two sectors.
  assert.deepEqual(extractSectorMentions('sector 150 and 2 crore', HELD), ['Sector 150'])
  assert.deepEqual(extractSectorMentions('sector 137 and 3 BHK', HELD), ['Sector 137'])
})
