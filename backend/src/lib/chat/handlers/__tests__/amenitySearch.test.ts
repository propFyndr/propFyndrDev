import 'dotenv/config'
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchesAmenitySearch, facilitiesAsked, areaIn, searchAnswer, projectAnswer, amenitySearchHandler,
} from '../amenitySearch'
import { vicinityLookupHandler } from '../vicinityLookup'
import type { ChatHandlerContext } from '../../handlerContext'

const LIVE = [
  'is there a paddle playing area around or in this property?',
  "I'm asking about padel",
  'Tell me the properties which has padel courts or football turfs nearby!!!',
  'Tell me the properties in greater noida which has padel courts or football turfs nearby',
]

const ctxFor = (message: string) =>
  ({ message, flags: {}, activeProjectName: 'ATS Happy Trails' }) as unknown as ChatHandlerContext

describe('amenity search matcher (live chat 17 Oct 2026)', () => {
  it('claims the four live phrasings', () => {
    for (const m of LIVE) assert.ok(matchesAmenitySearch(m), m)
  })

  it('leaves landmark questions to vicinity', () => {
    assert.ok(!matchesAmenitySearch("what's near ATS Happy Trails"))
    assert.ok(!matchesAmenitySearch('metro near sector 150'))
    assert.ok(!matchesAmenitySearch('is there a cricket stadium near this project'))
  })

  it('reads padel, turf and the area', () => {
    assert.deepEqual(facilitiesAsked(LIVE[2]).map(f => f.label), ['padel court', 'football turf'])
    assert.equal(areaIn(LIVE[3])?.label, 'Greater Noida and Greater Noida West')
    assert.equal(areaIn('which projects in sector 150 have tennis')?.label, 'Sector 150')
    assert.equal(areaIn(LIVE[2]), null)
  })

  it('a kids-zone "Shock-Absorbent Turf" is not a football turf', () => {
    const turf = facilitiesAsked('football turf')[0]
    assert.ok(!turf.names.test('Children Dedicated Play Zone with Shock-Absorbent Turf & Swings'))
    assert.ok(turf.names.test('Football Turf'))
    const tennis = facilitiesAsked('tennis court')[0]
    assert.ok(!tennis.names.test('Indoor Games Room with Table Tennis & Carrom'))
  })
})

describe('vicinity no longer claims facility or cross-project searches', () => {
  it('declines the live phrasings', () => {
    for (const m of LIVE) assert.ok(!vicinityLookupHandler.matches(ctxFor(m)), m)
  })

  it('still claims landmark questions', () => {
    assert.ok(vicinityLookupHandler.matches(ctxFor("what's near ATS Happy Trails")))
    assert.ok(vicinityLookupHandler.matches(ctxFor('metro near sector 150')))
    assert.ok(vicinityLookupHandler.matches(ctxFor('is there a stadium nearby')))
  })
})

describe('answers', () => {
  const fs = facilitiesAsked('padel or football turf')

  it('no match is an honest none, plus the nearby caveat', () => {
    const t = searchAnswer(fs, [], 'Greater Noida', true)
    assert.match(t, /None of the projects we hold in Greater Noida lists a padel court or football turf\. Amenity lists we hold are incomplete/)
    assert.match(t, /don't hold sports facilities outside projects/)
  })

  it('templated text is listed with its count', () => {
    const t = searchAnswer(facilitiesAsked('tennis'), [
      { project: 'A', sector: 'Sector 1', amenity: 'Synthetic Lawn Tennis Court', sharedBy: 24 },
      { project: 'B', sector: 'Sector 2', amenity: 'Clay Tennis Court', sharedBy: 1 },
    ], null, false)
    assert.ok(t.indexOf('| B |') < t.indexOf('| A |'))
    assert.match(t, /same text on 24 projects/)
    assert.doesNotMatch(t, /outside projects/)
  })

  it('one project: absent is "not on record", never "does not have"', () => {
    const t = projectAnswer('ATS Happy Trails', facilitiesAsked('padel'), [], true)
    assert.match(t, /A padel court is not on record for ATS Happy Trails/)
    assert.doesNotMatch(t, /doesn't have|does not have/)
  })
})

// Read-only against dev (Supabase DATABASE_URL), never NEON_DB.
const dbOk = Boolean(process.env.DATABASE_URL) && !process.env.DATABASE_URL!.includes('neon')
describe('dev DB (read-only)', { skip: !dbOk && 'no dev DATABASE_URL' }, () => {
  after(async () => { (await import('../../../db')).prisma.$disconnect() })

  const run = async (message: string) => {
    let out = ''
    const ctx = {
      ...ctxFor(message), intent: {}, sessionId: 's', intentState: 'DISCOVERY',
      send: (e: string, d: Record<string, unknown>) => { if (e === 'token') out += d.token },
      emitUiState: () => {}, res: { end: () => {} },
    } as unknown as ChatHandlerContext
    assert.equal(await amenitySearchHandler.handle(ctx), true)
    return out
  }

  it('padel / turf in Greater Noida: none, not a kids-zone turf', async () => {
    const t = await run(LIVE[3])
    assert.match(t, /None of the projects we hold in Greater Noida/)
  })

  it('padel at ATS Happy Trails: not on record', async () => {
    assert.match(await run(LIVE[0]), /not on record for ATS Happy Trails/)
  })

  it('badminton at ATS Happy Trails: recorded, flagged as template', async () => {
    assert.match(await run('is there a badminton court in this property'), /Badminton Court .*may be a template/)
  })
})
