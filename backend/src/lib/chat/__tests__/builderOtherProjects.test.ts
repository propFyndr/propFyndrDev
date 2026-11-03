import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { asksOtherWork, otherProjectsAnswer } from '../handlers/shortlistFacts'

// hard-43 F15, 31 Oct 2026: "what else have they delivered" got the builder's name only.
describe('a builder\'s other projects, from our rows', () => {
  it('recognises the ask', () => {
    assert.ok(asksOtherWork('Who is the builder of Divine Meadows and what else have they delivered?'))
    assert.ok(asksOtherWork('who is the developer, and their other projects?'))
    assert.ok(!asksOtherWork('who is the developer of each?'))
  })

  it('lists them with status as stored and says what the list is not', () => {
    const t = otherProjectsAnswer([
      { builder: 'Divine India Group', projects: [{ name: 'Divine Grace', sector: 'Sector 108', status: 'ready_to_move' }] },
      { builder: 'Solo Builder', projects: [] },
    ])
    assert.match(t, /\| Divine Grace \| Sector 108 \| Ready to move \|/)
    assert.match(t, /Solo Builder:\*\* we hold no other projects/)
    assert.match(t, /not an occupancy certificate/)
    assert.doesNotMatch(t, /delivered on time|track record of|\d+ projects/i)
  })
})
