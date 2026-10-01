import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ASKS_FAIRNESS, quotedAmountCr, fairnessVerdict } from '../priceFairness'

describe('price fairness', () => {
  it('recognises fairness and negotiation questions', () => {
    for (const q of ['is 1.9cr fair for gulshan botnia', 'how much can i negotiate', 'overpriced?', 'ye rate sahi daam hai?']) {
      assert.ok(ASKS_FAIRNESS.test(q), q)
    }
    assert.ok(!ASKS_FAIRNESS.test('what is the price of gulshan botnia'))
  })

  it('reads the quoted amount in crore', () => {
    assert.equal(quotedAmountCr('quoted 1.9cr all inclusive'), 1.9)
    assert.equal(quotedAmountCr('asking 95 lakh'), 0.95)
    assert.equal(quotedAmountCr('is it fair'), null)
  })

  it('states negotiation room only as the gap to our recorded range', () => {
    assert.match(fairnessVerdict(2.8, 2.35, 2.54), /about 10% above/)
    assert.match(fairnessVerdict(1.76, 2.35, 2.54), /below/)
    assert.match(fairnessVerdict(2.4, 2.35, 2.54), /within/)
    assert.doesNotMatch(fairnessVerdict(2.8, 2.35, 2.54), /usually|typically/)
  })
})
