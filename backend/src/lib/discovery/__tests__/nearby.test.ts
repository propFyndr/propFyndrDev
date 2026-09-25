import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  heldLandmarkType,
  isProximityQuestion,
  requestedRadiusKm,
  unheldLandmark,
  resolveNearbyAnchor,
  findNearby,
} from '../nearby'

describe('recognising a proximity question', () => {
  for (const q of [
    'I want a property near Sector 62 Noida',
    'what is nearby',
    'anything close to Sector 150?',
    'projects around Sector 75',
    'what is the nearest project to Godrej Nurture',
    'how far is Sector 137 from Sector 150',
    'show me something within 5 km of sector 76',
    'flats next to sector 128',
    'neighbouring sectors to 75',
  ]) {
    it(`matches: ${q}`, () => assert.equal(isProximityQuestion(q), true))
  }

  for (const q of [
    'best 3 bhk in noida',
    'what is the stamp duty in UP',
    'compare sector 75 and sector 150',
    'is noida extension good for investment',
  ]) {
    it(`ignores: ${q}`, () => assert.equal(isProximityQuestion(q), false))
  }
})

describe('a radius the buyer asked for', () => {
  it('reads an explicit radius', () => {
    assert.equal(requestedRadiusKm('anything within 5 km of sector 76'), 5)
    assert.equal(requestedRadiusKm('projects within 2.5 kilometres'), 2.5)
  })
  it('falls back when none is given', () => {
    assert.equal(requestedRadiusKm('projects near sector 76'), 3.5)
  })
  it('refuses an absurd radius rather than scanning the city', () => {
    assert.equal(requestedRadiusKm('anything within 900 km'), 3.5)
    assert.equal(requestedRadiusKm('anything within 0 km'), 3.5)
  })
})

describe('landmarks we hold no position for', () => {
  // The Connectivity table gives all 280 projects the same landmark set, so a
  // distance to any of these would be fabricated however confident it looked.
  it('names a metro question as unheld', () => {
    assert.equal(unheldLandmark('projects near a metro station in noida'), 'a metro station')
    assert.equal(unheldLandmark('anything close to the blue line'), 'a metro station')
  })
  it('names schools and hospitals as unheld', () => {
    assert.equal(unheldLandmark('flats near a good school'), 'a school')
    assert.equal(unheldLandmark('property near a hospital'), 'a hospital')
  })
  it('leaves a sector question alone', () => {
    assert.equal(unheldLandmark('property near Sector 62 Noida'), null)
  })
})

describe('resolving what "near" is anchored to', () => {
  it('anchors on a sector named in the message', async () => {
    const a = await resolveNearbyAnchor('I want a property near Sector 75 Noida')
    assert.equal(a.kind, 'sector')
    assert.match(a.label, /Sector 75/i)
    assert.ok(typeof a.lat === 'number' && typeof a.lng === 'number', 'sector anchor carries coordinates')
  })

  it('reports a metro question as an unheld landmark rather than guessing a sector', async () => {
    const a = await resolveNearbyAnchor('show me projects near a metro station in noida')
    assert.equal(a.kind, 'unheld_landmark')
    assert.equal(a.landmark, 'a metro station')
  })

  it('anchors on a project named in the message', async () => {
    const a = await resolveNearbyAnchor('what is near Godrej Nurture')
    assert.equal(a.kind, 'project', `resolved as ${a.kind} (${a.label})`)
  })
})

describe('finding what is actually near a sector', () => {
  it('returns real projects with real distances, nearest first', async () => {
    const anchor = await resolveNearbyAnchor('property near Sector 75 Noida')
    const out = await findNearby(anchor, 3.5)
    assert.ok(out.projects.length > 0, 'nothing found near Sector 75')
    for (const p of out.projects) {
      assert.ok(p.distanceKm <= out.radiusKm + 0.001, `${p.name} at ${p.distanceKm}km exceeds ${out.radiusKm}km`)
      assert.ok(p.name.length > 0 && p.sector.length > 0)
    }
    const distances = out.projects.map((p) => p.distanceKm)
    assert.deepEqual(distances, [...distances].sort((a, b) => a - b), 'not sorted nearest first')
  })

  it('finds neighbours of a sector we are thin in', async () => {
    // The bug this handler exists for: "near Sector 62" was answered with
    // "we hold one project in Sector 62" and nothing about its neighbours.
    const anchor = await resolveNearbyAnchor('I want a property near Sector 62 Noida')
    const out = await findNearby(anchor, 3.5)
    assert.ok(out.projects.length > 1, `only ${out.projects.length} project(s) found near Sector 62`)
  })

  it('resolves to nothing rather than throwing when the anchor has no coordinates', async () => {
    const out = await findNearby({ kind: 'unresolved', label: '' }, 3.5)
    assert.deepEqual(out.projects, [])
  })
})

describe('heldLandmarkType — landmark classes answerable from Connectivity rows', () => {
  it('maps metro, school, hospital, mall, airport', () => {
    assert.equal(heldLandmarkType('projects near a metro station'), 'metro')
    assert.equal(heldLandmarkType('flats near a good school'), 'school')
    assert.equal(heldLandmarkType('near jewar'), 'airport')
    assert.equal(heldLandmarkType('property near Sector 62'), null)
  })
})
