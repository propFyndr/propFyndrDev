import '../../eval/replayEnv'
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../db'
import { discoverProjects } from '../projects'
import type { Intent } from '../types'

// Needs the dev database, like routeReplay.test.ts.
after(() => prisma.$disconnect())

describe('facing search against the catalogue', () => {
  it('"3 BHK facing east" returns only projects that list an east-facing configuration', async () => {
    const r = await discoverProjects({ bhk: [3], facing: ['east_facing'] } as Intent)
    assert.ok(r.exactResults.length > 0, 'the catalogue records east for 200 projects')
    for (const p of r.exactResults as Array<{ name?: string; matchReason?: string; match_reason?: string }>) {
      assert.match(String(p.matchReason ?? p.match_reason), /east-facing configurations on record/, `${p.name} is shown without an east-facing reason`)
    }
  })

  it('a direction nobody records returns nothing, not a shelf of other projects', async () => {
    const r = await discoverProjects({ bhk: [3], facing: ['west_facing'] } as Intent)
    assert.equal(r.exactResults.length, 0)
    assert.equal(r.nearbyResults.length, 0)
  })
})
