import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { clearsFacing, facingLabel, facingList, readFacing, satisfiesFacing } from '../facing'

const reads = (q: string) => readFacing(q)

describe('readFacing: east and sunrise', () => {
  const east = [
    'I need a 3BHK flat in Noida facing sunrise side',
    'I am looking for a property facing sunrise',
    'What are the properties in Noida? I am looking for a property facing sunrise',
    'I want flats facing east',
    'east facing 3bhk in sector 150',
    'East-facing flat please',
    'flat with east side balcony',
    'which flats face east',
    'is it east facing?',
    'I want morning sun in the bedroom',
    'need a flat that gets sunrise',
    // Hinglish
    'Kya Ace Parkway mein east facing flat milega?',
    'purab mukhi flat chahiye',
    'poorab disha wala flat dikhao',
    'subah ki dhoop wala flat chahiye',
    'east wala flat chahiye',
  ]
  for (const q of east) it(`east: ${q}`, () => assert.ok(reads(q).includes('east_facing'), `got ${JSON.stringify(reads(q))}`))
})

describe('readFacing: other directions, views and positions', () => {
  it('reads north, west and south, and sunset as west', () => {
    assert.deepEqual(reads('north facing flat'), ['north_facing'])
    assert.deepEqual(reads('I want a west facing flat'), ['west_facing'])
    assert.deepEqual(reads('south facing please'), ['south_facing'])
    assert.deepEqual(reads('a flat with sunset views'), ['west_facing'])
    assert.deepEqual(reads('uttar mukhi flat'), ['north_facing'])
  })

  it('reads a list of directions, in the order stated', () => {
    assert.deepEqual(reads('east or north facing'), ['east_facing', 'north_facing'])
    assert.deepEqual(reads('north, east facing flats'), ['north_facing', 'east_facing'])
  })

  it('reads north-east as east and north, without double counting', () => {
    assert.deepEqual(reads('north east facing flat').sort(), ['east_facing', 'north_facing'])
    assert.deepEqual(reads('NE facing flat').sort(), ['east_facing', 'north_facing'])
  })

  it('reads the views and positions the data stores', () => {
    assert.deepEqual(reads('park facing 3bhk'), ['park_facing'])
    assert.deepEqual(reads('flat with a pool view'), ['pool_view'])
    assert.deepEqual(reads('garden view apartment'), ['garden_view'])
    assert.deepEqual(reads('golf course view flats'), ['golf_view'])
    assert.deepEqual(reads('main road facing unit'), ['road_facing'])
    assert.deepEqual(reads('I want a corner unit'), ['corner_unit'])
    assert.deepEqual(reads('east facing with a park view').sort(), ['east_facing', 'park_facing'])
  })
})

describe('readFacing: what is not a facing', () => {
  const none = [
    'Show me 3 BHK under 1.5 crore in Sector 150',
    'What is the price of Ace Parkway?',
    'properties in East Delhi',
    'flats in noida east',
    'Is Ace Parkway vastu compliant?',
    'how far is the airport',
    'Tell me about Sunrise Heights',
    'show me Sunrise Apartments in Sector 62',
    'Sunrise Greens payment plan',
    'uttar pradesh rera number',
    'what is the dakshin bharat connectivity',
    'I need a south indian restaurant nearby',
    'park near my office',
    'facing a tight budget',
    '',
  ]
  for (const q of none) it(`nothing: "${q}"`, () => assert.deepEqual(reads(q), []))

  it('a negated mention asks for nothing', () => {
    assert.deepEqual(reads('not east facing please'), [])
    assert.deepEqual(reads('no west facing, avoid it'), [])
    // Hindi puts the negative after the phrase.
    assert.deepEqual(reads('east facing flats nahi chahiye'), [])
    assert.deepEqual(reads('purab mukhi flat mat dikhao'), [])
    assert.deepEqual(reads('east facing, not west facing'), ['east_facing'])
  })
})

describe('clearsFacing', () => {
  it('recognises the buyer lifting the preference', () => {
    assert.equal(clearsFacing('any facing is fine'), true)
    assert.equal(clearsFacing('direction does not matter'), true)
    assert.equal(clearsFacing('facing doesn\'t matter to me'), true)
    assert.equal(clearsFacing('no particular direction'), true)
  })
  it('does not fire on a stated facing', () => {
    assert.equal(clearsFacing('east facing flat'), false)
    assert.equal(clearsFacing('what is the price'), false)
  })
})

describe('labels and matching', () => {
  it('says each token the way a buyer would', () => {
    assert.equal(facingLabel('east_facing'), 'east-facing')
    assert.equal(facingLabel('pool_view'), 'pool view')
    assert.equal(facingLabel('corner_unit'), 'corner unit')
    assert.equal(facingLabel('some_new_token'), 'some new token')
  })
  it('lists them', () => {
    assert.equal(facingList(['east_facing']), 'east-facing')
    assert.equal(facingList(['east_facing', 'north_facing']), 'east-facing or north-facing')
    assert.equal(facingList(['east_facing', 'north_facing', 'park_facing'], 'and'), 'east-facing, north-facing and park-facing')
  })
  it('matches a unit that lists any wanted token', () => {
    assert.equal(satisfiesFacing(['east_facing', 'road_facing'], ['east_facing']), true)
    assert.equal(satisfiesFacing(['north_facing'], ['east_facing']), false)
    assert.equal(satisfiesFacing([], ['east_facing']), false)
    assert.equal(satisfiesFacing(null, ['east_facing']), false)
  })
})
