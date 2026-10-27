import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyTurn, normaliseSector } from '../answerGaps'

const turn = (question: string, answer: string, latencyMs = 3000, degraded = false) => ({ question, answer, latencyMs, degraded })

describe('classifyTurn', () => {
  it('flags each way a live answer fell short (27 Oct 2026 turns)', () => {
    assert.deepEqual(classifyTurn(turn('2BHK in Sector 10 under 30k', 'None of the projects we hold match 2 BHK in Sector 10.')), ['no_match', 'out_of_scope'])
    assert.deepEqual(classifyTurn(turn('ceiling height and noise at ACE Parkway?', 'Noise Level: Not recorded in current our verified data')), ['not_on_record'])
    assert.deepEqual(classifyTurn(turn('payment plan for X', "We don't have the developer payment schedule for X verified in our records yet.")), ['not_on_record'])
    assert.deepEqual(classifyTurn(turn('find a 3bhk in mumbai', 'Here are options.')), ['out_of_scope'])
    assert.deepEqual(classifyTurn(turn('3bhk in sector 150', 'Here are 5 projects.', 27_900)), ['slow'])
    assert.deepEqual(classifyTurn(turn('hi', "Sorry, I couldn't get you a reliable answer just now.")), ['ai_failed'])
    assert.deepEqual(classifyTurn(turn('hi', 'Hello.', 2000, true)), ['ai_failed'])
  })

  it('leaves a good answer alone', () => {
    assert.deepEqual(classifyTurn(turn('3bhk in sector 150 under 2 cr', '**12 projects match** 3 BHK in Sector 150.')), [])
  })
})

describe('normaliseSector', () => {
  it('reads the common spellings as one sector', () => {
    for (const s of ['Sector 10', 'sec-10', 'sector10', 'SECTOR 10']) assert.equal(normaliseSector(s), 'sector 10')
    assert.equal(normaliseSector('Sector 15A'), 'sector 15a')
  })
})
