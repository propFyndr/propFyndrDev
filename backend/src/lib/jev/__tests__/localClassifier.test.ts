import test, { describe, it } from 'node:test'
import assert from 'node:assert'
import { classifyQueryLocal } from '../localClassifier'

describe('Fast In-Process Local Classifier', () => {
  it('classifies educational queries with high confidence (>=0.95)', () => {
    const r1 = classifyQueryLocal('What is carpet area?')
    assert.strictEqual(r1.matched, true)
    assert.ok(r1.confidence >= 0.95)
    assert.strictEqual(r1.intent, 'educational_query')

    const r2 = classifyQueryLocal('difference between carpet and super area')
    assert.strictEqual(r2.matched, true)
    assert.ok(r2.confidence >= 0.95)
  })

  it('classifies financial calculator queries with high confidence (>=0.95)', () => {
    const r1 = classifyQueryLocal('calculate emi for 1.5 crore')
    assert.strictEqual(r1.matched, true)
    assert.ok(r1.confidence >= 0.95)
    assert.strictEqual(r1.intent, 'financial_calc')
  })

  it('classifies direct catalog search queries', () => {
    const r1 = classifyQueryLocal('show me flats in Sector 150 Noida')
    assert.strictEqual(r1.matched, true)
    assert.ok(r1.confidence >= 0.95)
    assert.strictEqual(r1.intent, 'direct_search')
  })

  it('returns low confidence (<0.95) for complex ambiguous queries', () => {
    const r1 = classifyQueryLocal('I want a 3 BHK near Noida Expressway with good schools and low maintenance but high green cover')
    assert.strictEqual(r1.matched, false)
    assert.ok(r1.confidence < 0.95)
    assert.strictEqual(r1.intent, 'unknown')
  })
})
