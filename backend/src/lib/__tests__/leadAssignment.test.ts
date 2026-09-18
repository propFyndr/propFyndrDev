import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { nextInRotation, type AssignmentCandidate } from '../leadAssignment'

const p = (id: string, assignedCount: number): AssignmentCandidate => ({ id, name: id, assignedCount })

/**
 * "Distributed equally" was the brief. The point of testing the rule rather
 * than the endpoint is that even distribution over many rounds is the whole
 * claim, and a test needing thirteen partner rows in a database to ask it would
 * not have been written.
 */
describe('partner rotation', () => {
  it('picks nobody when a builder has no eligible partners', () => {
    assert.equal(nextInRotation([]), null)
  })

  it('picks the partner holding the least work', () => {
    const chosen = nextInRotation([p('a', 5), p('b', 1), p('c', 3)])
    assert.equal(chosen?.id, 'b')
  })

  it('breaks ties on the order given, not at random', () => {
    // eligiblePartners() orders by creation date, so a builder's first partner
    // wins an even split. A builder asking "why them" deserves an answer.
    const chosen = nextInRotation([p('first', 2), p('second', 2), p('third', 2)])
    assert.equal(chosen?.id, 'first')
  })

  it('distributes ten leads evenly across three partners', () => {
    const partners = [p('a', 0), p('b', 0), p('c', 0)]
    for (let i = 0; i < 10; i++) {
      const chosen = nextInRotation(partners)!
      partners.find((x) => x.id === chosen.id)!.assignedCount++
    }
    const counts = partners.map((x) => x.assignedCount).sort()
    assert.deepEqual(counts, [3, 3, 4], 'ten does not divide by three; the spread must be one')
  })

  it('does not repeat a partner before the cycle completes', () => {
    const partners = [p('a', 0), p('b', 0), p('c', 0)]
    const order: string[] = []
    for (let i = 0; i < 3; i++) {
      const chosen = nextInRotation(partners)!
      order.push(chosen.id)
      partners.find((x) => x.id === chosen.id)!.assignedCount++
    }
    assert.equal(new Set(order).size, 3)
  })

  it('catches a partner up rather than starting them at the back', () => {
    // A partner added late, or one a builder assigned to by hand, is absorbed:
    // the rule reads current load rather than a stored cursor, so the next few
    // leads go to whoever is behind.
    const partners = [p('veteran', 8), p('newcomer', 0)]
    const order: string[] = []
    for (let i = 0; i < 3; i++) {
      const chosen = nextInRotation(partners)!
      order.push(chosen.id)
      partners.find((x) => x.id === chosen.id)!.assignedCount++
    }
    assert.deepEqual(order, ['newcomer', 'newcomer', 'newcomer'])
  })
})
