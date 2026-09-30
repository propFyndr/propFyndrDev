// backend/src/lib/__tests__/calculators.test.ts

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcAllInCost,
  calcTrueNetRentalYield,
  calcUpgradeEquity,
  calcLoadingRatio,
  calcStampDuty,
  calcEmi,
  formatInr,
} from '../calculators'

describe('Real Estate Calculators Suite', () => {
  describe('calcAllInCost', () => {
    it('computes all-in cost for under-construction unit (with GST & stamp duty)', () => {
      const res = calcAllInCost(1.5, 'under_construction', 'male', 1200)
      assert.equal(res.basePriceCr, 1.5)
      assert.ok(res.gst > 0, 'GST must be > 0 for under construction')
      assert.equal(res.stampDuty, 1_50_00_000 * 0.07)
      assert.equal(res.registration, 1_50_00_000 * 0.01)
      assert.equal(res.ifms, 1200 * 50)
      assert.ok(res.totalCr > 1.5, 'Total landed cost must exceed base price')
      assert.ok(res.overheadPct > 15 && res.overheadPct < 35, `Overhead % should be between 15-35%, got ${res.overheadPct}`)
    })

    it('exempts GST for ready-to-move units', () => {
      const res = calcAllInCost(1.5, 'ready_to_move', 'male', 1200)
      assert.equal(res.gst, 0, 'Ready to move must have 0 GST')
      assert.ok(res.totalCr > 1.5)
    })

    it('applies concessionary 6% stamp duty for female buyers in UP', () => {
      const maleRes = calcAllInCost(2.0, 'ready_to_move', 'male', 1000)
      const femaleRes = calcAllInCost(2.0, 'ready_to_move', 'female', 1000)
      assert.equal(maleRes.stampDuty, 14_00_000)
      assert.equal(femaleRes.stampDuty, 12_00_000)
      assert.ok(femaleRes.totalCr < maleRes.totalCr)
    })
  })

  describe('calcTrueNetRentalYield', () => {
    it('calculates gross and true net rental yield factoring vacancy and maintenance', () => {
      const monthlyRent = 35000
      const costCr = 1.5 // 1.5 Cr
      const res = calcTrueNetRentalYield(monthlyRent, costCr, 1, 3500)
      // Gross = (35000 * 12) / 1.5 Cr = 420000 / 15000000 = 2.8%
      assert.equal(res.grossYieldPct, 2.8)
      // Net = (35000 - 3500) * 11 / 15000000 = 31500 * 11 / 15000000 = 346500 / 15000000 = 2.31%
      assert.equal(res.netYieldPct, 2.31)
      assert.ok(res.netYieldPct < res.grossYieldPct)
    })

    it('safely handles 0 cost without crashing or producing NaN', () => {
      const res = calcTrueNetRentalYield(20000, 0)
      assert.equal(res.grossYieldPct, 0)
      assert.equal(res.netYieldPct, 0)
    })
  })

  describe('calcUpgradeEquity', () => {
    it('computes upgrade equity transition accurately', () => {
      const res = calcUpgradeEquity(1.2, 0.4, 2.0, 20, 8.5, 20)
      // Transaction cost = 1.2 * 0.02 = 0.024 Cr (2.4L)
      assert.equal(res.transactionCostsCr, 0.024)
      // Net cash = 1.2 - 0.4 - 0.024 = 0.776 Cr (77.6L)
      assert.equal(res.netRealizedCashCr, 0.776)
      // Down payment = 20% of 2.0 = 0.4 Cr
      assert.equal(res.downPaymentCr, 0.4)
      // Cash gap / surplus = 0.776 - 0.4 = 0.376 Cr
      assert.equal(res.cashFlowGapMonthly, 0.376)
      // New loan = 2.0 - 0.4 = 1.6 Cr
      assert.equal(res.newLoanCr, 1.6)
      assert.ok(res.newMonthlyEmi > 0)
      assert.ok(!Number.isNaN(res.newMonthlyEmi))
    })
  })

  describe('calcLoadingRatio', () => {
    it('computes loading ratio and carpet efficiency correctly', () => {
      const res = calcLoadingRatio(1200, 850)
      // loading = (1200 - 850) / 1200 = 350 / 1200 = 29.17%
      assert.equal(res.loadingPct, 29.17)
      // carpet efficiency = 100 - 29.17 = 70.83%
      assert.equal(res.carpetEfficiencyPct, 70.83)
      assert.equal(res.verdict, 'average')
    })

    it('awards efficient verdict for carpet efficiency >= 75%', () => {
      const res = calcLoadingRatio(1000, 800)
      assert.equal(res.loadingPct, 20)
      assert.equal(res.carpetEfficiencyPct, 80)
      assert.equal(res.verdict, 'efficient')
    })

    it('handles boundary and invalid values gracefully', () => {
      const res = calcLoadingRatio(0, 0)
      assert.equal(res.loadingPct, 0)
      assert.equal(res.carpetEfficiencyPct, 0)
      assert.equal(res.verdict, 'average')
    })
  })

  describe('formatInr', () => {
    it('formats Cr, Lakh, and thousands properly', () => {
      assert.equal(formatInr(1_50_00_000), '₹1.50 Cr')
      assert.equal(formatInr(45_00_000), '₹45.00 L')
      assert.equal(formatInr(50_000), '₹50,000')
    })
  })
})
