import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderOrientation, type ConfigOrientation } from '../ai/orientationAnswer'

// ACE Parkway's real shape.
const ACE: ConfigOrientation[] = [
  { name: '2 BHK Classic', bhk: 2, orientations: ['east_facing', 'road_facing'] },
  { name: '3 BHK Premier', bhk: 3, orientations: ['north_facing', 'pool_view'] },
  { name: '4 BHK Penthouse Villa', bhk: 4, orientations: ['corner_unit', 'east_facing', 'park_facing', 'golf_view'] },
]

describe('renderOrientation', () => {
  it('names the configurations that list the direction, and the ones that do not', () => {
    const r = renderOrientation('ACE Parkway', ACE, ['east_facing'])
    assert.equal(r.matched, 2)
    assert.match(r.text, /East-facing configurations on record:\*\* 2 BHK Classic; 4 BHK Penthouse Villa\./)
    assert.match(r.text, /Not listed as east-facing: 3 BHK Premier \(north-facing, pool view\)\./)
  })

  it('treats sunrise as east, and says so', () => {
    const r = renderOrientation('ACE Parkway', ACE, ['east_facing'], { sunrise: true })
    assert.match(r.text, /sunrise side is east in our records/)
  })

  it('never claims a specific unit faces a direction, and sends the buyer to the floor plan', () => {
    const r = renderOrientation('ACE Parkway', ACE, ['east_facing'])
    assert.match(r.text, /recorded per configuration, not per tower or floor/)
    assert.match(r.text, /confirm the facing of the exact unit on the builder's floor plan/)
    assert.ok(!/flat \d|unit \d|tower [A-Z]\b/i.test(r.text.replace(/\|.*\|/g, '')))
  })

  it('says plainly when no configuration lists the direction', () => {
    const r = renderOrientation('ACE Parkway', [ACE[1]], ['east_facing'])
    assert.equal(r.matched, 0)
    assert.match(r.text, /None of ACE Parkway's configurations lists east-facing/)
    assert.match(r.text, /What it records: 3 BHK Premier \(north-facing, pool view\)/)
  })

  it('says we hold none for a direction no project records (west, south)', () => {
    const r = renderOrientation('ACE Parkway', ACE, ['west_facing'])
    assert.equal(r.matched, 0)
    assert.match(r.text, /We do not record west-facing for any project/)
  })

  it('says when the project holds no orientation at all', () => {
    const r = renderOrientation('X', [{ name: '3 BHK', bhk: 3, orientations: [] }], ['east_facing'])
    assert.equal(r.withData, 0)
    assert.match(r.text, /hold no verified orientation \(facing or view\) for any configuration of X/)
    assert.ok(!/\| Configuration/.test(r.text), 'no table of nothing')
  })

  it('lists configurations with no orientation separately', () => {
    const r = renderOrientation('X', [...ACE, { name: '5 BHK Villa', bhk: 5, orientations: [] }], ['east_facing'])
    assert.match(r.text, /No orientation on record for: 5 BHK Villa\./)
    assert.match(r.text, /\| 5 BHK Villa \| Not on record \|/)
  })

  it('with no direction asked, shows everything on record', () => {
    const r = renderOrientation('ACE Parkway', ACE, [])
    assert.equal(r.matched, 0)
    assert.equal(r.withData, 3)
    assert.match(r.text, /\| 4 BHK Penthouse Villa \| corner unit, east-facing, park-facing, golf view \|/)
  })

  it('answers an either-or request with the union', () => {
    const r = renderOrientation('ACE Parkway', ACE, ['east_facing', 'north_facing'])
    assert.equal(r.matched, 3)
    assert.match(r.text, /East-facing or north-facing configurations on record/)
  })
})
