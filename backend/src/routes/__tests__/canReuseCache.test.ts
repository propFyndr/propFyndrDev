import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canReuseCache } from '../chat-helpers'

// Live 26 Oct: "only show me above 3.8 cr" reused the 16 projects cached for
// "Greater Noida" with no budget, so the floor was never applied. A budget
// change can widen the set, which filtering the cache cannot do.
describe('canReuseCache on a budget change', () => {
  const cached = [] as never[]
  const prev = { city: 'Greater Noida' }

  it('re-discovers when a floor is added', () => {
    assert.equal(canReuseCache({ city: 'Greater Noida', budgetMin: 3.8 } as never, prev, cached).reuse, false)
  })

  it('re-discovers when the ceiling is raised', () => {
    assert.equal(canReuseCache({ budgetMax: 2 } as never, { budgetMax: 1.5 }, cached).reuse, false)
  })

  it('reuses when nothing searchable changed', () => {
    assert.equal(canReuseCache({ city: 'Greater Noida' } as never, prev, cached).reuse, true)
  })
})
