import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateEmi,
  calculateAffordabilityBreakdown,
  affordabilityHandler,
} from '../affordabilityHandler'

describe('Affordability & Cash-Flow Advisor', () => {
  it('calculates standard home loan EMI accurately', () => {
    // 1.5 Cr loan at 8.5% for 20 years
    const loan = 15_000_000
    const emi = calculateEmi(loan, 8.5, 20)
    assert.strictEqual(emi, 130173)

    // Edge cases
    assert.strictEqual(calculateEmi(0, 8.5, 20), 0)
    assert.strictEqual(calculateEmi(10_000_000, 0, 20), 0)
  })

  it('computes full breakdown with rate shock and Indian tax shield', () => {
    const breakdown = calculateAffordabilityBreakdown({
      basePrice: 15_000_000, // 1.5 Cr
      multiplier: 1.30,      // Landed = 1.95 Cr
      downpaymentPct: 0.20,  // Down = 39 L
      baseRatePct: 8.5,
      shockHikeBps: 150,     // 10.0%
      tenureYears: 20,
      userMonthlyIncome: 350_000, // 3.5 L/mo
    })

    assert.strictEqual(breakdown.basePrice, 15_000_000)
    assert.strictEqual(breakdown.totalLandedCost, 19_500_000)
    assert.strictEqual(breakdown.downpaymentAmount, 3_900_000)
    assert.strictEqual(breakdown.loanPrincipal, 15_600_000)

    // Standard EMI on 1.56 Cr loan at 8.5%
    assert.strictEqual(breakdown.standardEmi, 135380)

    // Shock EMI at 10.0%
    assert.strictEqual(breakdown.shockEmi, 150543)
    assert.strictEqual(breakdown.rateShockBufferMonthly, breakdown.shockEmi - breakdown.standardEmi)

    // Section 24b tax shield (~₹5,200/mo)
    assert.strictEqual(breakdown.monthlyTaxShieldSec24b, 5200)
    assert.strictEqual(breakdown.netMonthlyOutflow, breakdown.standardEmi - 5200)

    // Safe income at 40% FOIR
    assert.strictEqual(breakdown.safeMonthlyTakeHome, Math.round(breakdown.standardEmi / 0.40))

    // User FOIR evaluation
    assert.strictEqual(breakdown.userMonthlyIncome, 350_000)
    assert.strictEqual(breakdown.userFoirPct, Math.round((breakdown.standardEmi / 350_000) * 100)) // 39%
    assert.strictEqual(breakdown.foirStatus, 'manageable')
  })

  it('correctly matches natural financial queries and ignores unrelated ones', () => {
    const dummyCtx = (msg: string) => ({
      message: msg,
      intent: { type: 'QUERY' } as any,
      sessionId: 's-1',
      send: () => {},
      emitUiState: () => {},
      res: {} as any,
      cachedProjects: [],
      flags: {},
      builders: [],
      catalog: [],
      intentState: 'START',
    })

    assert.strictEqual(affordabilityHandler.matches(dummyCtx('Can I afford Godrej Woods on 3 Lakh salary?')), true)
    assert.strictEqual(affordabilityHandler.matches(dummyCtx('What is the monthly payment and EMI for 2 crore house?')), true)
    assert.strictEqual(affordabilityHandler.matches(dummyCtx('I earn 35 LPA can I buy this flat?')), true)
    assert.strictEqual(affordabilityHandler.matches(dummyCtx('Run a rate shock stress test on the loan')), true)

    assert.strictEqual(affordabilityHandler.matches(dummyCtx('Show me photos of the swimming pool')), false)
    assert.strictEqual(affordabilityHandler.matches(dummyCtx('Who is the builder of ATS Destinaire?')), false)
  })
})

import { parseMonthlyIncome } from '../affordabilityHandler'

describe('parseMonthlyIncome', () => {
  it('reads the roadmap example "afford this on 2.5L salary" as ₹2.5L a month', () => {
    assert.equal(parseMonthlyIncome('can I afford this on 2.5L salary?'), 250000)
  })
  it('reads LPA and crore-a-year as annual', () => {
    assert.equal(parseMonthlyIncome('I earn 36 LPA'), 300000)
    assert.equal(parseMonthlyIncome('income is 1.2 cr per annum'), 1000000)
  })
  it('reads k and explicit monthly', () => {
    assert.equal(parseMonthlyIncome('take home 180k per month'), 180000)
    assert.equal(parseMonthlyIncome('salary of 2.5 lakh'), 250000)
  })
  it('returns undefined without an income word', () => {
    assert.equal(parseMonthlyIncome('flat for 2.5 cr'), undefined)
  })
})
