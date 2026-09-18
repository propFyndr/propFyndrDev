import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractBuyerName } from '../buyerName'

/**
 * A lead's name is the first thing a salesperson reads and the word they open
 * the call with. Getting it wrong is not cosmetic.
 */
describe('extracting a buyer name from chat', () => {
  it('handles the message that produced the bug', () => {
    // Stored live as "Is Rahul Sharma and my phone number is".
    assert.equal(
      extractBuyerName('My name is Rahul Sharma and my phone number is 9876543210'),
      'Rahul Sharma',
    )
  })

  it('reads the forms people actually type', () => {
    assert.equal(extractBuyerName('my name is Priya Menon'), 'Priya Menon')
    assert.equal(extractBuyerName('Name: Arjun Nair'), 'Arjun Nair')
    assert.equal(extractBuyerName('this is Kavita'), 'Kavita')
    assert.equal(extractBuyerName('I am Vikram Singh, please call me'), 'Vikram Singh')
    assert.equal(extractBuyerName("I'm Sneha"), 'Sneha')
  })

  it('stops at punctuation', () => {
    assert.equal(extractBuyerName('My name is Rahul, call me at 9876543210'), 'Rahul')
    assert.equal(extractBuyerName('name: Deepak. Need a 3BHK.'), 'Deepak')
  })

  it('normalises casing without mangling the name', () => {
    assert.equal(extractBuyerName('my name is rahul sharma'), 'Rahul Sharma')
    assert.equal(extractBuyerName('MY NAME IS RAHUL'), 'Rahul')
  })

  it('keeps hyphens and apostrophes', () => {
    assert.equal(extractBuyerName('my name is Anne-Marie'), 'Anne-Marie')
    assert.equal(extractBuyerName("this is D'Souza"), "D'Souza")
  })

  it('caps the length rather than swallowing a sentence', () => {
    const out = extractBuyerName('my name is One Two Three Four Five Six Seven')
    assert.equal(out, 'One Two Three Four')
  })

  it('returns null when there is no introduction at all', () => {
    // The caller uses its own placeholder. Guessing here is what produced a
    // lead named after half a sentence.
    assert.equal(extractBuyerName('call me on 9876543210'), null)
    assert.equal(extractBuyerName('I want a 3BHK in Sector 150'), null)
    assert.equal(extractBuyerName(''), null)
  })

  it('returns null when the introduction is followed by nothing usable', () => {
    assert.equal(extractBuyerName('my name is 9876543210'), null)
    assert.equal(extractBuyerName('my name is and my number is 9876543210'), null)
    assert.equal(extractBuyerName('I am interested in Sector 150'), null)
    assert.equal(extractBuyerName('I am looking for a 3BHK'), null)
  })

  it('rejects a single stray letter', () => {
    assert.equal(extractBuyerName('my name is R'), null)
  })

  it('never returns a string containing a digit', () => {
    // The property that actually matters: whatever comes back is dialable-safe
    // to greet someone by.
    const messages = [
      'My name is Rahul Sharma and my phone number is 9876543210',
      'name: Arjun 9876543210',
      'this is Kavita my mobile 9988776655',
      'I am Vikram, number 9876543210',
    ]
    for (const m of messages) {
      const out = extractBuyerName(m)
      if (out !== null) assert.ok(!/\d/.test(out), `${m} -> ${out}`)
    }
  })

  it('never returns a terminator word on its own', () => {
    for (const m of ['my name is and', 'name: my', 'I am the']) {
      assert.equal(extractBuyerName(m), null, m)
    }
  })
})
