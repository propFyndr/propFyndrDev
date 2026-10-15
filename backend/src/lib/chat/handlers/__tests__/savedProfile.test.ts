import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { describeProfile, profileAsRequest } from '../../../ai/memory'
import { matchesSavedProfileQuestion } from '../savedProfile'

describe('saved profile', () => {
  const mem = { bhk_preference: 3, budget_max_cr: 2, work_location: 'Sector 63', possession_pref: '2year', viewed_slugs: [] as string[] }

  it('lists only stored fields', () => {
    assert.deepEqual(describeProfile(mem), ['3 BHK', 'budget up to ₹2 Cr', 'works near Sector 63', 'possession within two years'])
    assert.deepEqual(describeProfile({ viewed_slugs: [] }), [])
  })

  it('turns the profile into a request the buyer sends back themselves', () => {
    assert.equal(profileAsRequest(mem), 'Show me 3 BHK, under ₹2 Cr, near my office in Sector 63, possession within two years')
    assert.equal(profileAsRequest({ viewed_slugs: [] }), null)
  })

  it('answers only an explicit ask for the saved profile', () => {
    assert.ok(matchesSavedProfileQuestion('what do you remember about me?'))
    assert.ok(matchesSavedProfileQuestion('use my saved preferences'))
    assert.ok(!matchesSavedProfileQuestion('3bhk under 2 cr near sector 63'))
  })
})
