import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadScoreState, saveScoreMap, TTL_SECS } from './completenessCache'

const map = { p1: { score: 70, tabScores: { overview: 80 } } }

test('a map saved now is served and fresh', async () => {
  await saveScoreMap(map)
  const s = await loadScoreState()
  assert.deepEqual(s.scores, map)
  assert.equal(s.stale, false)
})

test('a map older than TTL_SECS is still served, marked stale', async () => {
  await saveScoreMap(map, Date.now() - (TTL_SECS + 1) * 1000)
  const s = await loadScoreState()
  assert.deepEqual(s.scores, map)
  assert.equal(s.stale, true)
})
