// Text corruption measured on a live buyer chat (2026-09-26), each introduced
// by post-processing rather than by the model:
//
//   "(at approx. ₹8,333/sq. Ft (typical for Noida — …). Base rate)"
//   "₹3.50 to ₹4.50 per sq. Ft (typical for Noida — …)., which"
//   "~₹1,400–₹1,₹450 Cr"
//   "* ****Stamp Duty & Registration:**"
//   "stamp duty … is about **₹?**"

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { qualifyMarketFigures } from '../answerIntegrity'
import { beautifyResponse } from '../responseBeautifier'
import { cleanDebris, sanitizeOutput } from '../sanitizeOutput'
import { MARKET_QUALIFIER } from '../../factPresentation'

const NO_FACTS = 'You are PropFyndr.\n\nVERIFIED FACTS\n(none)\n'

describe('market qualifier placement', () => {
  it('uses the comma form inside an open parenthesis', () => {
    const out = qualifyMarketFigures('Base cost ~₹1.45 Cr (at approx. ₹8,333/sq. ft. base rate).', NO_FACTS).text
    assert.equal(out, `Base cost ~₹1.45 Cr (at approx. ₹8,333/sq. ft, ${MARKET_QUALIFIER}, base rate).`)
  })

  it('does not leave ")., " after an abbreviation dot', () => {
    const out = qualifyMarketFigures('Societies charge ₹3.50 to ₹4.50 per sq. ft., which adds up.', NO_FACTS).text
    assert.ok(!out.includes(').,'), out)
    assert.ok(out.includes(`per sq. ft (${MARKET_QUALIFIER}), which`), out)
  })

  it('keeps the plain form outside parentheses', () => {
    const out = qualifyMarketFigures('Rates run ₹11,000 per sq ft today.', NO_FACTS).text
    assert.equal(out, `Rates run ₹11,000 per sq ft (${MARKET_QUALIFIER}) today.`)
  })
})

describe('beautifier', () => {
  it('does not capitalise after "sq."', () => {
    assert.ok(beautifyResponse('It costs ₹8,333 per sq. ft for this belt.').includes('sq. ft'))
  })

  it('still capitalises a real sentence start', () => {
    assert.ok(beautifyResponse('That is the rate. and parking is extra.').includes('rate. And'))
  })

  it('never welds ₹ into the middle of a number', () => {
    const out = beautifyResponse('Base cost is about 1,450 cr in this case.')
    assert.ok(!out.includes('1,₹'), out)
    assert.ok(out.includes('₹1,450 Cr'), out)
  })

  it('does not double an existing ₹', () => {
    assert.ok(beautifyResponse('Budget ₹1.5 crore works.').includes('Budget ₹1.5 Cr'))
  })
})

describe('debris cleanup', () => {
  it('collapses runs of asterisks', () => {
    assert.equal(cleanDebris('* ****Stamp Duty:** 7%'), '* **Stamp Duty:** 7%')
  })

  it('removes a ₹ welded after a thousands comma', () => {
    assert.equal(cleanDebris('₹1,₹450 Cr'), '₹1,450 Cr')
  })

  it('replaces an unfilled ₹? placeholder', () => {
    const out = sanitizeOutput('The duty is about **₹?** here.').text
    assert.ok(!out.includes('₹?'), out)
  })
})
