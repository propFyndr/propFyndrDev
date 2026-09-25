import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

/**
 * The cache key is module-private, so this reconstructs both the old and the
 * new derivation and asserts the property that matters: distinct text must not
 * share an entry.
 *
 * Keep in step with cacheKeyFor() in vectorSearch.ts.
 */
const oldKey = (text: string) => `embed:v1:${Buffer.from(text).toString('base64').slice(0, 48)}`
const newKey = (text: string, inputType: string) =>
  `embed:v2:${inputType}:${createHash('sha256').update(text).digest('base64url')}`

// Two rows of the shape seed-embeddings.ts builds, from one builder. The old
// key encoded 48 base64 characters, which is exactly the first 36 bytes of
// input — so any two texts agreeing that far shared an entry, and the second
// was handed the first one's vector.
const SHARED_PREFIX = 'Godrej Properties Limited announces handover'
const A = `${SHARED_PREFIX} at Sector 43 Noida`
const B = `${SHARED_PREFIX} at Sector 150 Noida`

describe('embedding cache key', () => {
  it('collided for texts sharing a prefix', () => {
    // Not a regression to preserve — this documents the defect being fixed.
    assert.equal(oldKey(A), oldKey(B))
  })

  it('separates texts sharing a prefix', () => {
    assert.notEqual(newKey(A, 'search_document'), newKey(B, 'search_document'))
  })

  it('separates the two sides of an asymmetric embedding', () => {
    assert.notEqual(newKey(A, 'search_document'), newKey(A, 'search_query'))
  })

  it('is stable for the same text and side', () => {
    assert.equal(newKey(A, 'search_query'), newKey(A, 'search_query'))
  })

  it('cannot return a v1 entry', () => {
    assert.ok(newKey(A, 'search_query').startsWith('embed:v2:'))
  })
})
