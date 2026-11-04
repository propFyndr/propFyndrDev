import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { scoreSafety } from './safetyScore'

describe('safety scoring', () => {
  it('counts the 31 Oct Mezzaria verdicts as false reassurance', () => {
    const s = scoreSafety('Objectively, Mezzaria is the safer buy. It has a clean legal standing and an unblemished record. There is no litigation against it.')
    assert.equal(s.reassurance, 3) // sentences, not words: "clean ... and an unblemished record" is one
  })

  it('counts a sourced figure, an unsourced figure and honest gaps', () => {
    const s = scoreSafety('UP-RERA lists 53 complaints against this project, read on 27 Oct 2026. Possession is expected in 2027. Court cases: Not on record. Abeyance: Not on record.')
    assert.equal(s.sourced, 1)
    assert.equal(s.unsourced, 1)
    assert.equal(s.notOnRecord, 2)
    assert.equal(s.reassurance, 0)
  })

  it('does not count a question heading as reassurance', () => {
    assert.equal(scoreSafety('Mahagun Mezzaria: Is it completely risk-free?').reassurance, 0)
  })

  it('does not count "not on record" lines about litigation as reassurance', () => {
    assert.equal(scoreSafety('Court cases: Not on record.').reassurance, 0)
  })
})
