import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesAirportProximity, airportProximityAnswer } from '../airportProximity'
import { AIRPORTS } from '../../../discovery/airports'
import { withUserTurn } from '../../../ai/openai'

const JEWAR = AIRPORTS.find((a) => a.key === 'jewar')!

describe('airport proximity (live chat 17 Oct 2026)', () => {
  it('claims the questions the chat asked', () => {
    assert.ok(matchesAirportProximity("What's the property closest to the Noida airport"))
    assert.ok(matchesAirportProximity("I want to know what's the closest to jewar airport between the shortlisted options"))
    assert.ok(!matchesAirportProximity('what is the progress of jewar airport'))
    assert.ok(!matchesAirportProximity('closest metro to sector 150'))
  })

  it('ranks by straight-line distance, says so, and lists projects with no coordinates as left out', () => {
    const rows = [
      { id: 'a', name: 'Far Tower', sector: 'Sector 1', status: 'ready_to_move', lat: 28.6012, lng: 77.4307 },
      { id: 'b', name: 'Near Tower', sector: 'Sector 150', status: 'under_construction', lat: 28.4213, lng: 77.4871 },
      { id: 'c', name: 'No Coords', sector: 'Sector 4', status: null, lat: null, lng: null },
    ]
    const t = airportProximityAnswer(rows, JEWAR, 'shortlist')
    assert.match(t, /\*\*Near Tower\*\* is nearest/)
    assert.ok(t.indexOf('Near Tower |') < t.indexOf('Far Tower |'))
    assert.match(t, /straight-line distances/)
    assert.match(t, /1 project has no reliable map location/)
    assert.doesNotMatch(t, /minutes/)
  })
})

describe('OpenAI-compatible request always carries a user turn', () => {
  it('turns a system-only request into a user turn (Cohere 400 otherwise)', () => {
    assert.deepEqual(withUserTurn([{ role: 'system', content: 'x' }]), [{ role: 'user', content: 'x' }])
    const both = [{ role: 'system' as const, content: 's' }, { role: 'user' as const, content: 'u' }]
    assert.equal(withUserTurn(both), both)
  })
})

import { isPlaceholderCoordinate } from '../../../discovery/geo'

describe('placeholder coordinates are missing, not a location', () => {
  it('treats the seeded round-number points as missing', () => {
    assert.ok(isPlaceholderCoordinate(28.4, 77.55))
    assert.ok(isPlaceholderCoordinate(28, 77))
    assert.ok(!isPlaceholderCoordinate(28.5755, 77.3819))
    assert.ok(!isPlaceholderCoordinate(28.42, 77.4813))
  })

  it('leaves a placeholder project out of the ranking', () => {
    const t = airportProximityAnswer([
      { id: 'p', name: 'Seeded Point', sector: 'Alpha 2', status: 'ready_to_move', lat: 28.4, lng: 77.55 },
      { id: 'r', name: 'Real Point', sector: 'Sector 150', status: 'ready_to_move', lat: 28.4213, lng: 77.4871 },
    ], JEWAR, 'shortlist')
    assert.doesNotMatch(t, /Seeded Point \|/)
    assert.match(t, /no reliable map location/)
  })
})
