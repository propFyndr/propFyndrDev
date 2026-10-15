import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyLiterals } from '../../ai/intent'
import { extractDeterministic } from '../../ai/intentDeterministic'
import { intentFingerprint } from '../../ai/semanticCache'
import { buildHardFilters } from '../projects'
import { buildMatchSignals } from '../scoring'
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
  it('puts orientation on the same unit condition as BHK', () => {
    const w = unitOr(buildHardFilters({ bhk: [3], facing: ['east_facing'] } as Intent))
    assert.match(w, /"bhk":\{"in":\[3\]\}[^]*"unit_orientations":\{"hasSome":\["east_facing"\]\}/)
  })
  it('adds nothing without a facing', () => {
    assert.ok(!unitOr(buildHardFilters({ bhk: [3] } as Intent)).includes('unit_orientations'))
  })
})

describe('facing in match signals', () => {
  const base = { sector: 'Sector 150', status: 'under_construction' }
  const sig = (orient: string[] | null) =>
    buildMatchSignals({ ...base, unit_types: [{ bhk: 3, price_min_cr: 1, unit_orientations: orient }] } as any, { facing: ['east_facing'] } as Intent, 'WITHIN' as any)
  it('reason when a configuration lists it', () => {
    assert.ok(sig(['east_facing']).matchReasons.some((r: string) => /east-facing configurations on record/.test(r)))
  })
  it('concern when others are recorded but not this one', () => {
    assert.ok(sig(['north_facing']).concerns.some((c: string) => /No east-facing configuration on record/.test(c)))
  })
  it('concern when nothing is recorded', () => {
    assert.ok(sig([]).concerns.some((c: string) => /Facing is not on record/.test(c)))
  })
})

describe('facing in the cache fingerprint', () => {
  it('separates "3 BHK" from "3 BHK facing east"', () => {
    assert.notEqual(intentFingerprint({ bhk: [3] }), intentFingerprint({ bhk: [3], facing: ['east_facing'] }))
  })
})
