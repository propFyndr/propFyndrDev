import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTurnTimer } from '../turnTimer'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('turnTimer points (cycle 2 Day 5)', () => {
  it('keeps the first occurrence of a moment, measured from the request', async () => {
    const t = createTurnTimer()
    await wait(30)
    t.point('firstToken')
    const first = t.points.firstToken
    await wait(30)
    t.point('firstToken')
    assert.equal(t.points.firstToken, first, 'a later token must not move the first-token moment')
    assert.ok(first >= 25 && first < 200, `expected ~30ms, got ${first}`)
    assert.match(t.summary(), /@firstToken=\d+/)
  })

  it('stages still measure from the last mark', async () => {
    const t = createTurnTimer()
    await wait(20)
    t.mark('a')
    t.point('x')
    await wait(20)
    t.mark('b')
    assert.ok(t.stages.b >= 15 && t.stages.b < 200, `stage b was ${t.stages.b}`)
  })
})
