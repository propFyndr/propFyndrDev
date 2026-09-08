import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { endsRagged } from '../endsRagged'

describe('endsRagged', () => {
  it('flags the exact 8 Sep production failure — a bare trailing word', () => {
    const text = 'as developers in this micro-market primarily focus on larger 2, 3, and 4 BHK configurations. \n\nWould'
    assert.equal(endsRagged(text), true)
  })

  it('does not flag a normally terminated sentence', () => {
    assert.equal(endsRagged('Sector 75 has 12 verified projects.'), false)
  })

  it('does not flag a question mark, closing paren, or bold marker', () => {
    assert.equal(endsRagged('Want to compare this with a similar project?'), false)
    assert.equal(endsRagged('(possession expected 2027)'), false)
    assert.equal(endsRagged('**Strong Buy**'), false)
  })

  it('does not flag a complete markdown table row', () => {
    assert.equal(endsRagged('| Godrej Woods | Sector 43 | RTM |'), false)
  })

  it('flags a row cut off before its closing pipe', () => {
    assert.equal(endsRagged('| Godrej Woods | Sector 43 | RTM'), true)
  })

  it('ignores trailing whitespace', () => {
    assert.equal(endsRagged('Complete sentence.   \n\n  '), false)
  })

  it('does not flag empty text', () => {
    assert.equal(endsRagged(''), false)
    assert.equal(endsRagged('   '), false)
  })
})
