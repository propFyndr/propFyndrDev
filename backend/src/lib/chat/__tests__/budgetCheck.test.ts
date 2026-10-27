import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseBudgetCheck, renderBudgetCheck } from '../budgetCheck'

describe('parseBudgetCheck (live questions, 30 days to 27 Oct 2026)', () => {
  it('reads a budget, a BHK and an area', () => {
    assert.deepEqual(parseBudgetCheck('Is 2 crore too much for a 3 BHK in Noida right now?'), { bhk: 3, budgetCr: 2, city: 'Noida' })
    assert.deepEqual(parseBudgetCheck('What is a reasonable budget for a 3 BHK flat?'), { bhk: 3 })
    assert.deepEqual(parseBudgetCheck('is 90 lakh enough for 2bhk in greater noida west'), { bhk: 2, budgetCr: 0.9, city: 'Greater Noida West' })
    assert.deepEqual(parseBudgetCheck('What budget should I consider is the minimum like 40,50,60,70lakhs?'), null)
  })

  it('leaves money-in/out and rent questions to their own lanes', () => {
    assert.equal(parseBudgetCheck('my salary is 1.5 lakh, is that enough for a 3bhk'), null)
    assert.equal(parseBudgetCheck('is 25k enough to rent a 2bhk in noida'), null)
    assert.equal(parseBudgetCheck('3bhk in sector 150 under 2 cr'), null)
  })
})

describe('renderBudgetCheck', () => {
  const result = (values: number[]) => ({
    found: true, query: { metric: 'median' as const, field: 'price' as const }, matched: values.length, used: values.length, excludedEstimated: 0,
    stats: { avg: 0, median: 1.45, min: { value: 0.9, name: 'A', sector: 'Sector 1' }, max: { value: 4, name: 'B', sector: 'Sector 2' }, modeShare: 0 },
    rows: values.map((value, i) => ({ name: `P${i}`, sector: 'Sector 1', value, possession: null })),
  })

  it('states how many projects start within the budget, from our rows', () => {
    const text = renderBudgetCheck({ bhk: 3, budgetCr: 2, city: 'Noida' }, result([0.9, 1.4, 1.5, 2.5]))!
    assert.match(text, /\*\*3 of 4\*\* projects with a 3 BHK in Noida on record start at or under ₹2 Cr \(75%\)/)
    assert.match(text, /middle starting price is \*\*₹1\.45 Cr\*\*/)
    assert.match(text, /computed over 4 projects we hold/)
    assert.match(text, /Want me to show the 3 BHK in Noida options within ₹2 Cr\?/)
  })

  it('says nothing when too few projects carry a price', () => {
    assert.equal(renderBudgetCheck({ bhk: 3, budgetCr: 2 }, result([1, 2])), null)
  })
})
