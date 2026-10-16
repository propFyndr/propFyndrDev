import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getCachedResponseLocal, setCachedResponse, setCatalogStampForTest } from '../semanticCache'

describe('answer cache follows the catalogue', () => {
  it('stops serving an answer once the catalogue changes', () => {
    setCatalogStampForTest('before-edit')
    setCachedResponse('what is the price at stamp test tower', { token: 'old price' })
    assert.equal(getCachedResponseLocal('what is the price at stamp test tower')?.token, 'old price')
    setCatalogStampForTest('after-edit')
    assert.equal(getCachedResponseLocal('what is the price at stamp test tower'), null)
  })

  it('never caches an affordability question, whose income may come from an earlier turn', () => {
    setCachedResponse('Ok so what can I actually afford then, roughly?', { token: 'stale figures' })
    assert.equal(getCachedResponseLocal('Ok so what can I actually afford then, roughly?'), null)
  })
})
