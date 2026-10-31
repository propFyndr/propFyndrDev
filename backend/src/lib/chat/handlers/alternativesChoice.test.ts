import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAlternatives, summariseSide, looksHinglish } from './alternativesChoice'

test('the hero question splits into two sides, each with its own BHK, status and place', () => {
  const r = parseAlternatives('I have 1.3 crore. Should I take a 2BHK ready to move in Noida or a 3BHK under construction in Greater Noida West?')
  assert.ok(r)
  assert.deepEqual(r.a, { bhk: 2, status: 'ready', region: 'noida' })
  assert.deepEqual(r.b, { bhk: 3, status: 'uc', region: 'greater_noida_west' })
  assert.equal(r.budgetMaxCr, 1.3)
  assert.equal(r.hinglish, false)
})

test('the Hinglish order of the same question parses the same way', () => {
  const r = parseAlternatives('1.3 crore hai mere paas. Noida mein ready 2BHK lun ya Greater Noida West mein under-construction 3BHK?')
  assert.ok(r)
  assert.deepEqual(r.a, { bhk: 2, status: 'ready', region: 'noida' })
  assert.deepEqual(r.b, { bhk: 3, status: 'uc', region: 'greater_noida_west' })
  assert.equal(r.budgetMaxCr, 1.3)
  assert.equal(r.hinglish, true)
})

test('a plain search for either size is not a decision question', () => {
  assert.equal(parseAlternatives('2bhk or 3bhk in Noida under 1.5 cr'), null)
  assert.equal(parseAlternatives('show me 2 BHK ready to move in Noida'), null)
})

test('two sides that do not differ are not an alternative', () => {
  assert.equal(parseAlternatives('Should I take a 3BHK in Noida or a 3BHK in Noida?'), null)
})

test('a side that is both ready and under construction is not parsed', () => {
  assert.equal(parseAlternatives('Should I take a ready or under construction 2BHK or a 3BHK?'), null)
})

test('Hinglish needs two markers, not one', () => {
  assert.equal(looksHinglish('Noida mein 2BHK'), false)
  assert.equal(looksHinglish('Noida mein ready 2BHK lun ya 3BHK'), true)
})

test('a side keeps only rows in its region and at or under the budget; sizes and dates are read from rows', () => {
  const row = (id: string, name: string, sector: string, price: number, area: number | null, date: string | null) => ({
    id, name, sector, city: null, status: 'under_construction', possession_date: date ? new Date(date) : null,
    unit_types: [{ price_min_cr: price, super_area_sqft: area }],
  })
  const s = summariseSide(
    [
      row('1', 'West A', 'Sector 16B', 1.1, 1200, '2027-12-31'),
      row('2', 'West B', 'Sector 10', 1.4, 1300, null),
      row('3', 'Noida C', 'Sector 150', 1.0, 1100, '2027-06-30'),
    ],
    { bhk: 3, status: 'uc', region: 'greater_noida_west' },
    1.3,
  )
  assert.deepEqual(s.projects.map(p => p.name), ['West A'])
  assert.equal(s.loCr, 1.1)
  assert.equal(s.medianArea, 1200)
  assert.equal(s.undated, 0)
})
