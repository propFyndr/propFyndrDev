import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { asksBudgetPlan, extraDownPayment, statedMonthlyIncome, parseFinancingStatement, statesFinancing, loanForEmi } from '../affordability'
import { parseMonthlyIncome, computeFinancingPlan, renderFinancingPlan, calculateEmi } from '../../chat/handlers/affordabilityHandler'
import { FINANCIAL } from '../../config'
import { UP_STATUTORY } from '../../factPresentation'

// Live session ed1ac3ff, 17 Oct 2026: each of these reached the model, which did
// the arithmetic, was rejected by the integrity check, and ended on the outage notice.
describe('budget planning is answered in code', () => {
  it('claims the turns the buyer actually typed', () => {
    for (const q of [
      'Help me work out a realistic budget and EMI.',
      'so how much should be my monthly salary in order to match this EMI',
      'nice and now If I secure another 20 lakhs from personal savings',
      'what income do i need, how much should my salary be',
    ]) assert.ok(asksBudgetPlan(q), q)
  })

  it('leaves searches and unrelated money talk alone', () => {
    for (const q of ['show me 3bhk under 1.2 cr', 'what is the stamp duty in noida', 'is noida good for investment'])
      assert.ok(!asksBudgetPlan(q), q)
  })

  it('reads the extra down payment', () => {
    assert.equal(extraDownPayment('If I secure another 20 lakhs from personal savings'), 20_00_000)
    assert.equal(extraDownPayment('add an extra 0.5 cr'), 50_00_000)
    assert.equal(extraDownPayment('budget 1.2 cr'), null)
  })
})

// Live session, 17 Oct 2026: both financing statements ended on the outage
// notice because the model did the arithmetic and failed the integrity check.
const LIVE_STATEMENT = 'monthly income is : 1,50,000/month\nexisting home loan tenure is 20 years\nmy down payment capacity is 20 lakhs.'
const LIVE_WHAT_IF = 'what if I have a monthly income of 1.5L/MONTH and can do a down payment of 20 lakhs and take an 80 lakh loan from the bank?'

describe('incomes in the ways buyers write them', () => {
  it('reads Indian digit grouping, lakh shorthand and LPA', () => {
    for (const [q, n] of [
      [LIVE_STATEMENT, 1_50_000], [LIVE_WHAT_IF, 1_50_000],
      ['my income is 1,50,000', 1_50_000], ['salary 150000', 1_50_000], ['income 1.5L', 1_50_000],
      ['I earn 1.5 lakh a month', 1_50_000], ['income of 1.5L/MONTH', 1_50_000], ['I make 15 LPA', 1_25_000],
    ] as Array<[string, number]>) {
      assert.equal(statedMonthlyIncome(q), n, q)
      assert.equal(parseMonthlyIncome(q), n, q)
    }
  })

  it('never reads a down payment or a loan as income', () => {
    for (const q of ['my down payment capacity is 20 lakhs.', 'can do a down payment of 20 lakhs', 'I can make a down payment of 20 lakhs', 'take an 80 lakh loan']) {
      assert.equal(statedMonthlyIncome(q), null, q)
      assert.equal(parseMonthlyIncome(q), undefined, q)
    }
  })
})

describe('a stated financing plan', () => {
  it('parses the live messages', () => {
    assert.deepEqual(parseFinancingStatement(LIVE_STATEMENT), { monthlyIncome: 1_50_000, downPayment: 20_00_000, tenureYears: 20 })
    assert.deepEqual(parseFinancingStatement(LIVE_WHAT_IF), { monthlyIncome: 1_50_000, downPayment: 20_00_000, loanAmount: 80_00_000 })
    assert.equal(parseFinancingStatement('20 lakh as down payment').downPayment, 20_00_000)
    assert.equal(parseFinancingStatement('loan amount of 1.2 cr').loanAmount, 1_20_00_000)
  })

  it('claims income plus a down payment or loan, and nothing less', () => {
    for (const q of [LIVE_STATEMENT, LIVE_WHAT_IF, 'salary 2 lakh a month, 30 lakh down payment']) {
      assert.ok(statesFinancing(q), q)
      assert.ok(asksBudgetPlan(q), q)
    }
    for (const q of ['my down payment capacity is 20 lakhs.', 'I earn 2 lakh a month', "what if I'd want a 3bhk with this budget?", 'show me 3bhk above 2.5 cr'])
      assert.ok(!statesFinancing(q), q)
  })

  it('with a loan stated: price is down payment plus loan, EMI at the assumed rate', () => {
    const p = computeFinancingPlan({ ...parseFinancingStatement(LIVE_WHAT_IF), monthlyIncome: 1_50_000 })!
    assert.equal(p.price, 1_00_00_000)
    assert.equal(p.loanBasis, 'stated')
    assert.equal(p.rate, FINANCIAL.EMI_RATE)
    assert.equal(p.tenureYears, FINANCIAL.LOAN_TENURE_YEARS)
    assert.equal(p.emi, calculateEmi(80_00_000, FINANCIAL.EMI_RATE, FINANCIAL.LOAN_TENURE_YEARS))
    assert.equal(p.emiPctOfIncome, Math.round(p.emi / 1_50_000 * 100))
    assert.equal(p.stampDuty, 1_00_00_000 * UP_STATUTORY.stampDutyPct / 100)
    assert.equal(p.registration, 1_00_00_000 * UP_STATUTORY.registrationPct / 100)
    assert.equal(p.gstIfUnderConstruction, 1_00_00_000 * UP_STATUTORY.gstUnderConstructionPct / 100)
    const table = renderFinancingPlan(p, false)
    assert.match(table, /₹1\.00 Cr/)
    assert.match(table, /rate is an assumption/)
    assert.match(table, /tenure is assumed/)
  })

  it('without a loan: the loan is what 40% of income services, over the stated tenure', () => {
    const p = computeFinancingPlan({ ...parseFinancingStatement(LIVE_STATEMENT), monthlyIncome: 1_50_000 })!
    assert.equal(p.loanBasis, 'foir')
    assert.equal(p.tenureYears, 20)
    assert.equal(p.loan, Math.round(loanForEmi(60_000, FINANCIAL.EMI_RATE, 20)))
    assert.equal(p.price, 20_00_000 + p.loan)
    assert.ok(Math.abs(p.emi - 60_000) <= 1)
    assert.doesNotMatch(renderFinancingPlan(p, true), /tenure is assumed/)
  })

  it('caps the loan at 80% of the price when the down payment is small', () => {
    const p = computeFinancingPlan({ monthlyIncome: 5_00_000, downPayment: 10_00_000 })!
    assert.equal(p.loanBasis, 'ltv')
    assert.equal(p.loan, 40_00_000)
    assert.equal(p.price, 50_00_000)
  })
})
