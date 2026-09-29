// backend/src/lib/discovery/__tests__/queryPlanValidation.test.ts

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compileQueryPlan, CENTRAL_NOIDA_SECTORS } from '../queryPlan'
import { normalizeRequirementState } from '../requirementState'
import { discoverProjects } from '../projects'

describe('QueryPlan Compiler & Zero-Silent-Fallback Gate', () => {
  it('Test 1: Compiles exact Prisma where clause for Central Noida under hard budget ceiling', () => {
    const raw = '3BHK flats in Central Noida under 1.2 Cr'
    const state = normalizeRequirementState(raw)
    const plan = compileQueryPlan(state)

    assert.equal(plan.hardConstraints.budgetMaxCr, 1.2)
    assert.equal(plan.hardConstraints.isHardBudget, true)
    assert.ok(plan.hardConstraints.includedSectors.length >= CENTRAL_NOIDA_SECTORS.length)

    // Prisma where verification
    assert.ok(plan.where.AND, 'Must compile structured AND filter')
    const conditions = plan.where.AND as any[]
    const sectorCondition = conditions.find((c) => c.sector?.in)
    assert.ok(sectorCondition, 'Sector condition must be present')
    assert.ok(sectorCondition.sector.in.includes('Sector 75'))

    const budgetCondition = conditions.find((c) => c.price_min_cr?.lte)
    assert.ok(budgetCondition, 'Hard budget ceiling condition must be present')
    assert.equal(budgetCondition.price_min_cr.lte, 1.2)
  })

  it('Test 2: Compiles ready_to_move status constraint', () => {
    const raw = 'ready to move 2BHK in Sector 78 under 90 lakhs'
    const state = normalizeRequirementState(raw)
    const plan = compileQueryPlan(state)

    assert.equal(plan.hardConstraints.status, 'ready_to_move')
    assert.equal(plan.hardConstraints.isHardStatus, true)

    const conditions = plan.where.AND as any[]
    const statusCondition = conditions.find((c) => c.status?.equals)
    assert.ok(statusCondition, 'Status condition must be present')
    assert.equal(statusCondition.status.equals, 'ready_to_move')
  })

  it('Test 3: Compiles location exclusion filters', () => {
    const raw = 'Flats in Sector 75, avoid Sector 137'
    const state = normalizeRequirementState(raw)
    const plan = compileQueryPlan(state)

    const conditions = plan.where.AND as any[]
    const excludeCondition = conditions.find((c) => c.sector?.notIn)
    assert.ok(excludeCondition, 'Sector exclusion must be compiled')
    assert.ok(excludeCondition.sector.notIn.includes('Sector 137'))
  })

  it('Test 4 (Zero-Silent-Fallback): Impossible filter in Central Noida returns exactResults: []', async () => {
    // There are 0 properties in Central Noida under ₹0.20 Cr
    const intent = {
      sector: 'Central Noida',
      budgetMax: 0.2,
      bhk: [3],
    }

    const res = await discoverProjects(intent)

    assert.equal(res.exactResults.length, 0, 'Exact results must be empty')
    assert.equal(res.totalCount, 0, 'Total count must be 0')
    assert.equal(res.expansion?.reason, 'no_results_in_requested_sector')

    // Crucial check: Citywide properties (Sector 168, Sector 144) must NEVER be in exactResults
    const foreignSectors = res.exactResults.map((p) => p.sector)
    assert.ok(!foreignSectors.includes('Sector 168'))
    assert.ok(!foreignSectors.includes('Sector 144'))
  })

  it('Test 5: Proves Sector 168 never contaminates Central Noida search results', async () => {
    const intent = {
      sector: 'Central Noida',
      budgetMax: 1.2,
      bhk: [3],
    }

    const res = await discoverProjects(intent)

    // Verify zero projects from Sector 168 in exactResults
    for (const p of res.exactResults) {
      assert.notEqual(p.sector, 'Sector 168', 'Sector 168 must not be in exact results for Central Noida')
      assert.notEqual(p.sector, 'Sector 144', 'Sector 144 must not be in exact results for Central Noida')
    }
  })

  it('Test 6: Valid sector query continues to return matching properties', async () => {
    const intent = {
      sector: 'Sector 150',
      budgetMax: 3.5,
      bhk: [3],
    }

    const res = await discoverProjects(intent)
    assert.ok(res.exactResults.length > 0, 'Sector 150 should return exact results')
    for (const p of res.exactResults) {
      assert.equal(p.sector, 'Sector 150')
    }
  })
})
