import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { priceFor, isFreeModel, CACHED_INPUT_RATIO, PRICING_VERSION } from '../cost'
import { FALLBACK_CHAIN } from '../../config'

/**
 * Cost is the one number here that someone reconciles against a real invoice,
 * so the arithmetic gets a test rather than a comment claiming it is right.
 */
describe('AI cost pricing', () => {
  it('prices uncached input and output from the table', () => {
    // gemini-3.6-flash: $0.75 in, $3.75 out per 1M.
    const cost = priceFor('gemini-3.6-flash', 1_000_000, 1_000_000)
    assert.equal(Number(cost.toFixed(6)), 4.5)
  })

  it('bills the cached portion at the cached ratio, not the full rate', () => {
    const allUncached = priceFor('gemini-3.6-flash', 1_000_000, 0, 0)
    const allCached = priceFor('gemini-3.6-flash', 1_000_000, 0, 1_000_000)
    assert.equal(
      Number((allCached / allUncached).toFixed(4)),
      CACHED_INPUT_RATIO,
      'a fully cached prompt must cost CACHED_INPUT_RATIO of an uncached one',
    )
  })

  it('never counts cached tokens twice, even if a provider over-reports them', () => {
    // A cached count larger than the prompt count would otherwise produce a
    // negative uncached figure and undercharge.
    const cost = priceFor('gemini-3.6-flash', 1000, 0, 999_999)
    const floor = priceFor('gemini-3.6-flash', 1000, 0, 1000)
    assert.equal(cost, floor)
    assert.ok(cost > 0)
  })

  it('a free model is distinguishable from an unpriced one', () => {
    assert.equal(isFreeModel('command-a-03-2025'), true)
    assert.equal(isFreeModel('gemini-3.6-flash'), false)
    assert.equal(isFreeModel('some-model-nobody-priced'), false)
  })

  /**
   * The failure this prevents is silent and expensive: a model joins the chain,
   * nobody adds a price row, every call through it records $0, and the cost
   * dashboard reports a number that is confidently wrong. Either price it or
   * mark it free — both are a deliberate act, which is the point.
   */
  it('every model in the live fallback chain is priced or explicitly free', () => {
    const unaccounted = FALLBACK_CHAIN
      .map((leg) => leg.model)
      .filter((model, i, all) => all.indexOf(model) === i)
      .filter((model) => !isFreeModel(model) && priceFor(model, 1_000_000, 1_000_000) === 0)

    assert.deepEqual(
      unaccounted,
      [],
      `these chain models record $0 because nothing prices them: ${unaccounted.join(', ')}`,
    )
  })

  it('the pricing version is set, so stored rows stay re-computable', () => {
    assert.ok(PRICING_VERSION >= 2)
  })
})
