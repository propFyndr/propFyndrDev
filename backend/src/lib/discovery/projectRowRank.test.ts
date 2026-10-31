import test from 'node:test'
import assert from 'node:assert/strict'
import { pickRow, statedSectors } from './projectRowRank'
import { matchProjectInText } from './matchProjectInText'

const rows = [
  { id: 'b', name: 'Great Value Sharanam Greno', sector: 'Sector 1' },
  { id: 'a', name: 'Great Value Sharanam', sector: 'Sector 107' },
]

test('an exact name beats a longer name that contains it, whatever the array order', () => {
  assert.equal(pickRow(rows, 'Great Value Sharanam')?.id, 'a')
  assert.equal(pickRow([...rows].reverse(), 'Great Value Sharanam')?.id, 'a')
})

test('the sector the buyer typed beats an exact name', () => {
  const klassic = [
    { id: 'x', name: 'Jaypee Klassic', sector: 'Sector 128' },
    { id: 'y', name: 'Jaypee Klassic Block 6-10', sector: 'Sector 134' },
  ]
  assert.equal(pickRow(klassic, 'Jaypee Klassic', 'possession of Jaypee Klassic in Sector 134?')?.id, 'y')
  assert.equal(pickRow(klassic, 'Jaypee Klassic', 'possession of Jaypee Klassic?')?.id, 'x')
})

test('stated sectors are read, bare numbers are not', () => {
  assert.deepEqual([...statedSectors('Sector 143B and sec. 78, 2 BHK under 150 lakh')].sort(), ['143b', '78'])
})

test('matchProjectInText follows a stated sector to the extension row', () => {
  const catalog = [
    { id: 'x', name: 'Jaypee Klassic', sector: 'Sector 128' },
    { id: 'y', name: 'Jaypee Klassic Block 6-10', sector: 'Sector 134' },
  ]
  assert.equal(matchProjectInText('When will I get possession of Jaypee Klassic in Sector 134?', catalog)?.id, 'y')
  assert.equal(matchProjectInText('When will I get possession of Jaypee Klassic?', catalog)?.id, 'x')
  // A workplace sector that matches no variant leaves the exact name alone.
  assert.equal(matchProjectInText('Jaypee Klassic, my office is in Sector 62', catalog)?.id, 'x')
})
