// A Noida-wide rate stated as though we verified it.
//
// Measured live on a beta pass: "How will the Jewar airport impact property
// prices?" came back with plot prices "tripling in many pockets to reach around
// ₹9,600/sqft", flat, no qualifier, traceable to no row we hold. The integrity
// gate did not object because it guards PROJECT facts and a corridor-wide rate
// is not one. CLAUDE.md's market tier says such a figure may be used but must
// carry its qualifier every single time.
//
// The other half of this file is the more important half: statutory rates must
// come through untouched. Labelling UP stamp duty "not verified for this
// project" would be a worse answer, not a more honest one.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { qualifyMarketFigures } from '../answerIntegrity'
import { MARKET_QUALIFIER } from '../../factPresentation'

const NO_FACTS = 'You are RealtyPal.\n\nVERIFIED FACTS\n(none)\n'

describe('labels unverified rate claims', () => {
  for (const text of [
    'Plot prices have tripled to around ₹9,600/sqft along the corridor.',
    'Rates in the belt run ₹11,000 per sq ft today.',
    'The corridor has seen 18% appreciation since the airport was announced.',
    'Expect roughly 7% CAGR over the next five years.',
    'Residential rental yield sits near 3% yield in this belt.',
  ]) {
    it(`qualifies: "${text.slice(0, 46)}…"`, () => {
      const out = qualifyMarketFigures(text, NO_FACTS)
      assert.equal(out.qualified, 1, `got ${out.qualified} in "${out.text}"`)
      assert.ok(out.text.includes(MARKET_QUALIFIER))
    })
  }
})

describe('leaves statutory rates alone', () => {
  // Every one of these is fixed by UP law and identical for every project.
  for (const text of [
    'UP stamp duty is 7% for male buyers and 6% for female buyers.',
    'Registration is charged at 1% of the consideration.',
    'Under-construction flats attract 5% GST; ready-to-move with an OC attract 0%.',
    'You must deduct 1% TDS under Section 194-IA above ₹50 lakh.',
    'Loading in NCR high-rises typically runs 25% to 35%.',
    'The authority transfer fee is 1% to 5% of the circle rate.',
  ]) {
    it(`does not touch: "${text.slice(0, 46)}…"`, () => {
      const out = qualifyMarketFigures(text, NO_FACTS)
      assert.equal(out.qualified, 0, `wrongly qualified: "${out.text}"`)
      assert.equal(out.text, text)
    })
  }
})

describe('a figure we actually hold is ours to state plainly', () => {
  it('leaves a rate that appears in the injected facts block', () => {
    const prompt = 'You are RealtyPal.\n\nVERIFIED FACTS\nProject: ATS Pious\nRate: ₹12,500/sqft\n'
    const text = 'ATS Pious is priced at ₹12,500/sqft.'
    const out = qualifyMarketFigures(text, prompt)
    assert.equal(out.qualified, 0)
    assert.equal(out.text, text)
  })

  it('still labels a DIFFERENT rate in the same answer', () => {
    const prompt = 'VERIFIED FACTS\nRate: ₹12,500/sqft\n'
    const text = 'This one is ₹12,500/sqft, while the wider belt runs ₹9,600/sqft.'
    const out = qualifyMarketFigures(text, prompt)
    assert.equal(out.qualified, 1)
    assert.ok(out.text.includes(`₹9,600/sqft (${MARKET_QUALIFIER})`))
    assert.ok(out.text.includes('is ₹12,500/sqft,'), 'the verified rate must stay clean')
  })
})

describe('does not stack qualifiers', () => {
  it('leaves a figure that already carries one', () => {
    const text = `Rates run ₹9,600/sqft (${MARKET_QUALIFIER}) across the belt.`
    const out = qualifyMarketFigures(text, NO_FACTS)
    assert.equal(out.qualified, 0)
    assert.equal(out.text, text)
  })
})

describe('costs nothing on ordinary answers', () => {
  for (const text of [
    'Possession is expected in Q4 2027.',
    'Ace Divino is in Sector 1, Greater Noida West.',
    'Yes, the project has a clubhouse and a swimming pool.',
    '',
  ]) {
    it(`passes through: "${text.slice(0, 40)}"`, () => {
      assert.equal(qualifyMarketFigures(text, NO_FACTS).text, text)
    })
  }
})
