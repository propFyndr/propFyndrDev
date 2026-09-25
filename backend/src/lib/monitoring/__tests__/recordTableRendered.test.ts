import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { recordTableRendered } from '../langfuse'

/**
 * This helper spent its whole life as a no-op.
 *
 * Both call sites passed `(ctx as any).trace`, and `ChatHandlerContext` had no
 * `trace` field — so the argument was `undefined`, the null check at the top
 * returned, and every deterministic table this product renders was invisible in
 * Langfuse. The `as any` is what hid it from the compiler.
 *
 * The field is declared now, so the compiler guards the wiring. This guards the
 * other half: that a trace which IS present actually receives the event.
 */
describe('recordTableRendered', () => {
  it('emits one event on the trace it is given', () => {
    const events: Array<Record<string, any>> = []
    const trace = { event: (e: Record<string, any>) => events.push(e) } as any

    recordTableRendered(trace, {
      tableType: 'cost_sheet',
      projectName: 'ACE Parkway',
      rowCount: 9,
      characterLength: 1240,
    })

    assert.equal(events.length, 1)
    assert.equal(events[0].name, 'table_rendered:cost_sheet')
    assert.equal(events[0].input.projectName, 'ACE Parkway')
    assert.equal(events[0].output.rowCount, 9)
  })

  it('is a no-op without a trace, because Langfuse is optional', () => {
    assert.doesNotThrow(() =>
      recordTableRendered(null, { tableType: 'payment_plan', rowCount: 3, characterLength: 200 }),
    )
    assert.doesNotThrow(() =>
      recordTableRendered(undefined, { tableType: 'payment_plan', rowCount: 3, characterLength: 200 }),
    )
  })

  it('never lets a telemetry failure reach the buyer', () => {
    const throwing = { event: () => { throw new Error('langfuse down') } } as any
    assert.doesNotThrow(() =>
      recordTableRendered(throwing, { tableType: 'yield_table', rowCount: 1, characterLength: 10 }),
    )
  })
})
