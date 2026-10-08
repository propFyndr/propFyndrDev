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

test('"sec" is read as "sector", abbreviated', () => {
  assert.deepEqual(extractSectorMentions('sec 62 near metro', HELD), ['Sector 62'])
  assert.deepEqual(extractSectorMentions('sec. 150', HELD), ['Sector 150'])
})

test('a plausible sector resolves even when we hold no project there', () => {
  // We hold "93A"/"93B" in HELD, never bare "93" or "15A" — but both are real
  // Noida sectors (1-168), and recognising them is what lets the turn answer
  // honestly ("we don't list Sector 15A") instead of silently going citywide.
  assert.deepEqual(extractSectorMentions('Sector 15A?', HELD), ['Sector 15A'])
  assert.deepEqual(extractSectorMentions('93', HELD), ['Sector 93'])
})

test('"15A93" — glued, no separator — splits at the letter boundary', () => {
  // Reported from live use: a buyer meant Sector 15A and Sector 93, typed as
  // one run-together token, and the parser dropped both.
  assert.deepEqual(extractSectorMentions('15A93', HELD).sort(), ['Sector 15A', 'Sector 93'])
  assert.deepEqual(extractSectorMentions('93A15', HELD).sort(), ['Sector 15', 'Sector 93A'])
})

test('a glued run with no letter boundary is left unresolved', () => {
  // "1593" could be 15|93, 159|3 or 1|593 — equally plausible, nothing to
  // choose between them. Guessing wrong is worse than asking.
  assert.deepEqual(extractSectorMentions('1593', HELD), [])
})

test('separated short fragments resolve the same way the glued one does', () => {
  assert.deepEqual(extractSectorMentions('15a 93', HELD).sort(), ['Sector 15A', 'Sector 93'])
  assert.deepEqual(extractSectorMentions('15A, 93', HELD).sort(), ['Sector 15A', 'Sector 93'])
  assert.deepEqual(extractSectorMentions('15a/93', HELD).sort(), ['Sector 15A', 'Sector 93'])
  assert.deepEqual(extractSectorMentions('15a & 93', HELD).sort(), ['Sector 15A', 'Sector 93'])
  assert.deepEqual(extractSectorMentions('150 and 137', HELD).sort(), ['Sector 137', 'Sector 150'])
  assert.deepEqual(extractSectorMentions('150 ya 137?', HELD).sort(), ['Sector 137', 'Sector 150'])
})

test('two bare numbers with nothing else at all stay unresolved', () => {
  // No letter suffix and no connector word or punctuation to anchor the
  // read — "137 150" alone is as ambiguous as "is 76 better than 75?".
  assert.deepEqual(extractSectorMentions('137 150', HELD), [])
})

test('a bare sector number inside a real-estate sentence resolves without the word "sector"', () => {
  // "noida 150 3bhk 1.5" and "kya 150 mein 2bhk mil jayega 1 cr mein" both
  // dropped 150 silently; the fast path then read only the BHK and budget
  // and searched citywide.
  assert.deepEqual(extractSectorMentions('noida 150 3bhk 1.5', HELD), ['Sector 150'])
  assert.deepEqual(extractSectorMentions('kya 150 mein 2bhk mil jayega 1 cr mein', HELD), ['Sector 150'])
  assert.deepEqual(extractSectorMentions('family ke liye 150?', HELD), ['Sector 150'])
})

test('a bare number stays unresolved without a real-estate signal, comparison words included', () => {
  // Unchanged from the anchored-comparison test above, restated for the new
  // unanchored rule: a comparison word alone is not enough.
  assert.deepEqual(extractSectorMentions('is 76 better than 75?', HELD), [])
})

test('a single bare digit stays ambiguous even with a signal word', () => {
  // Sector 1 and Sector 2 exist, but a lone "1" or "2" beside "bhk"/"crore" is
  // too easily the BHK count or a budget digit rather than a sector.
  assert.deepEqual(extractSectorMentions('2 bhk near sector', HELD), [])
})
