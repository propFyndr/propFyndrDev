import '../../eval/replayEnv'
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../db'
import { discoverProjects } from '../projects'
import type { Intent } from '../types'

// Needs the dev database, like routeReplay.test.ts.
after(() => prisma.$disconnect())

describe('facing search against the catalogue', () => {
  // The stored orientation is templated by BHK, so it must not narrow a search: a card
  // that says "east-facing" would be repeating a script's guess.
  it('"3 BHK facing east" is not narrowed by templated orientation, and each card says it is unverified', async () => {
    const east = await discoverProjects({ bhk: [3], facing: ['east_facing'] } as Intent)
    const plain = await discoverProjects({ bhk: [3] } as Intent)
    assert.ok(east.exactResults.length > 0)
    assert.equal(east.totalCount, plain.totalCount, 'no orientation filter while the values are templated')
    for (const p of east.exactResults as Array<{ name?: string; matchReason?: string; match_reason?: string; concerns?: string[] }>) {
      assert.ok(!/east-facing configurations on record/.test(String(p.matchReason ?? p.match_reason)), `${p.name} claims east-facing`)
    }
  })
})
