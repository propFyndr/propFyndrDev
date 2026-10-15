import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyLiterals } from '../../ai/intent'
import { extractDeterministic } from '../../ai/intentDeterministic'
import { intentFingerprint } from '../../ai/semanticCache'
import { buildHardFilters } from '../projects'
import { buildMatchSignals } from '../scoring'
import { ORIENTATION_IS_SOURCED, recordedOrientations } from '../facing'
import type { Intent } from '../types'

const lit = (msg: string, prev: Intent = {} as Intent) =>
  applyLiterals({ ...prev } as Intent, extractDeterministic(msg, ['150']), msg, prev)

describe('facing in intent', () => {
  it('sets east from "facing sunrise"', () => {
    assert.deepEqual(lit('3 BHK facing sunrise in sector 150').facing, ['east_facing'])
  })
  it('replaces on a correction', () => {
    assert.deepEqual(lit('actually north facing', { facing: ['east_facing'] } as Intent).facing, ['north_facing'])
  })
  it('clears on "any facing"', () => {
    assert.equal(lit('any facing is fine', { facing: ['east_facing'] } as Intent).facing, undefined)
  })
  it('does not set facing from a negation', () => {
    assert.equal(lit('not east facing please').facing, undefined)
  })
  it('does not set facing from a project name', () => {
    assert.equal(lit('tell me about Sunrise Heights').facing, undefined)
  })
})

describe('facing in filters', () => {
  const unitOr = (w: any) => JSON.stringify(w)
  // The stored orientation is a function of BHK (4 distinct sets over 592 units), so it is
  // not filterable data until it is re-sourced. If this fails because the gate was opened,
  // restore the same-unit assertion that lived here (bhk + unit_orientations hasSome).
  it('does not filter on orientation while the stored values are templated', () => {
    assert.equal(ORIENTATION_IS_SOURCED, false)
    assert.ok(!unitOr(buildHardFilters({ bhk: [3], facing: ['east_facing'] } as Intent)).includes('unit_orientations'))
    assert.deepEqual(recordedOrientations(['east_facing', 'road_facing']), [])
  })
  it('adds nothing without a facing', () => {
    assert.ok(!unitOr(buildHardFilters({ bhk: [3] } as Intent)).includes('unit_orientations'))
  })
})

describe('facing in match signals', () => {
  const base = { sector: 'Sector 150', status: 'under_construction' }
  const sig = (orient: string[] | null) =>
    buildMatchSignals({ ...base, unit_types: [{ bhk: 3, price_min_cr: 1, unit_orientations: orient }] } as any, { facing: ['east_facing'] } as Intent, 'WITHIN' as any)
  it('never claims a facing from templated stored values', () => {
    const s = sig(['east_facing'])
    assert.ok(!s.matchReasons.some((r: string) => /east-facing/.test(r)))
    assert.ok(s.concerns.some((c: string) => /east-facing is not verified for this project/.test(c)))
  })
  it('says the same when nothing is stored', () => {
    assert.ok(sig([]).concerns.some((c: string) => /not verified for this project/.test(c)))
  })
})

describe('facing in the cache fingerprint', () => {
  it('separates "3 BHK" from "3 BHK facing east"', () => {
    assert.notEqual(intentFingerprint({ bhk: [3] }), intentFingerprint({ bhk: [3], facing: ['east_facing'] }))
  })
})
