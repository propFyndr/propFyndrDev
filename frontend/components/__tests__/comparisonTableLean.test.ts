import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('ComparisonTable — lean schema cutover', () => {
  it('references no dropped dna/recommendation_profile/persona_profile field', () => {
    const src = readFileSync(join(__dirname, '..', 'ComparisonTable.tsx'), 'utf8')
    for (const f of ['dna?.', 'recommendation_profile?.tier', 'persona_profile?.', 'TIER_CFG', 'TIER_ORDER']) {
      assert.doesNotMatch(src, new RegExp(f.replace(/[.?]/g, '\\$&')), `ComparisonTable still references ${f}`)
    }
  })
})
