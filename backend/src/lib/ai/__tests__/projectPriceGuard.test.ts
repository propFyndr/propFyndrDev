import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dropMisattributedPrices, setProjectPricesForTest } from '../projectPriceGuard'
import { looksLikeRestart } from '../fallbackChain'

describe('a price beside a project must be that project\'s (live rerun 5, 17 Oct 2026)', () => {
  setProjectPricesForTest({
    'Prateek Canary': [[1.1, 1.6]],
    'Godrej Palm Retreat': [[2.2, 3.36]],
    'Migsun Ultima': [[0.78, 1.13]],
  })

  it('drops a sentence pricing a project outside its recorded range', () => {
    const t = 'Prateek Canary offers 3 BHK layouts at ₹3.2 Cr. Ask me for its cost sheet.'
    const r = dropMisattributedPrices(t, '')
    assert.equal(r.text, 'Ask me for its cost sheet.')
    assert.equal(r.dropped.length, 1)
  })

  it('keeps the project\'s own price and the buyer\'s own figure', () => {
    const own = 'Migsun Ultima is priced around ₹1.05 Cr for a 3 BHK.'
    assert.equal(dropMisattributedPrices(own, '').text, own)
    const budget = 'Godrej Palm Retreat fits your ₹2.5 Cr floor.'
    assert.equal(dropMisattributedPrices(budget, 'options in Rs. 2.5CR+').text, budget)
    const noProject = 'Central Noida starts near ₹9 Cr.'
    assert.equal(dropMisattributedPrices(noProject, '').text, noProject)
  })
})

describe('a hand-off that restarts the answer in prose', () => {
  it('is caught when the paragraph opens with a sentence already shown', () => {
    const shown = 'Prateek Laurel in Sector 120 fits your ₹1.8 Cr ceiling with 3 BHK configurations and high-rise living.'
    assert.ok(looksLikeRestart(`${shown} It also has a pool.`, shown))
    assert.ok(!looksLikeRestart('It also has a clubhouse and a pool for residents.', shown))
  })
})

import { dropGarbled, splitClauses } from '../projectFactChecks'

describe('live rerun 7 (17 Oct 2026): broken output and list lines', () => {
  it('drops digit-scrambled prices and prompt labels, keeps clean lines', () => {
    const t = 'Four projects match:9511926295119295118211132\n- **Antriksh Golf View I**: ₹ L–₹. Cr for  BHK, ready to move.\n## MATCHED PROJECTS IN our verified data (GROUND TRUTH - CITE UNIT CONFIGURATION PRICES ONLY):\n- **Sunshine Helios**: ₹95 L for 2 BHK.'
    const r = dropGarbled(t)
    assert.equal(r.text, '- **Sunshine Helios**: ₹95 L for 2 BHK.')
    // "₹. Cr" splits the bullet at "₹." so it goes as two clauses.
    assert.equal(r.dropped.length, 4)
  })
  it('a bad figure on one bullet does not take the header or other bullets with it', () => {
    setProjectPricesForTest({ 'Antriksh Golf View I': [[0.95, 1.19]], 'Aditya Urban Casa': [[1.1, 2.25]] })
    const t = 'Four projects match your criteria up to ₹1.25 Cr:\n- **Antriksh Golf View I**: ₹95 L–₹1.19 Cr for 2 BHK.\n- **Aditya Urban Casa**: ₹95 L for 2 BHK.'
    assert.equal(dropMisattributedPrices(t, 'within 1.25 cr').text, 'Four projects match your criteria up to ₹1.25 Cr:\n- **Antriksh Golf View I**: ₹95 L–₹1.19 Cr for 2 BHK.')
    assert.equal(splitClauses('a. b\nc').join(''), 'a. b\nc')
  })
})
