// backend/src/lib/chat/handlers/__tests__/comparisonHandler.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildForensicVectors, comparisonHandler } from '../comparisonHandler'

describe('Forensic Head-to-Head Comparison Engine (Battle Mode)', () => {
  const p1 = {
    name: 'Godrej Woods',
    slug: 'godrej-woods',
    price_per_sqft: 12000,
    all_in_cost_multiplier: 1.32,
    amitabh_kant_clearance: true,
    oc_status: 'PHASED_OC',
    water_source_type: 'BOREWELL',
    water_tds_range: '> 1400 ppm',
    shahdara_drain_impact: false,
    lift_act_compliant: true,
    total_units: 1200,
    land_area_acres: 11,
    builder: { average_delay_months: 2 },
  }

  const p2 = {
    name: 'ATS Picturesque Reprieves',
    slug: 'ats-picturesque-reprieves',
    price_per_sqft: 9500,
    all_in_cost_multiplier: 1.30,
    amitabh_kant_clearance: false,
    oc_status: 'NONE',
    water_source_type: 'GANGA_JAL',
    water_tds_range: '180-260 ppm',
    shahdara_drain_impact: true,
    lift_act_compliant: false,
    total_units: 800,
    land_area_acres: 15,
    builder: { average_delay_months: 8 },
  }

  it('builds 8 forensic comparison vectors and computes advantages correctly', () => {
    const vectors = buildForensicVectors(p1, p2)
    assert.equal(vectors.length, 8, 'Must evaluate exactly 8 forensic vectors')

    // Vector 1: Landed Cost (p2 is cheaper per sqft -> p2 advantage)
    const costVec = vectors.find(v => v.vector === 'landed_cost')!
    assert.ok(costVec.p1Value.includes('15,840'), '12000 * 1.32 = 15840')
    assert.ok(costVec.p2Value.includes('12,350'), '9500 * 1.30 = 12350')
    assert.equal(costVec.winner, 'p2')

    // Vector 2: Registry (p1 cleared under Amitabh Kant -> p1 advantage)
    const regVec = vectors.find(v => v.vector === 'registry')!
    assert.equal(regVec.winner, 'p1')

    // Vector 3: Water (p2 is Ganga Jal -> p2 advantage)
    const waterVec = vectors.find(v => v.vector === 'water')!
    assert.equal(waterVec.winner, 'p2')

    // Vector 4: Environment (p1 safe distance, p2 within drain buffer -> p1 advantage)
    const drainVec = vectors.find(v => v.vector === 'environment')!
    assert.equal(drainVec.winner, 'p1')

    // Vector 5: Lifts Act (p1 compliant -> p1 advantage)
    const liftVec = vectors.find(v => v.vector === 'lifts')!
    assert.equal(liftVec.winner, 'p1')

    // Vector 6: Density (p2 has 800/15 = 53 units/acre vs p1 1200/11 = 109 units/acre -> p2 advantage)
    const densityVec = vectors.find(v => v.vector === 'density')!
    assert.equal(densityVec.winner, 'p2')

    // Vector 8: Delivery track record (p1 2 months delay vs p2 8 months delay -> p1 advantage)
    const delVec = vectors.find(v => v.vector === 'delivery')!
    assert.equal(delVec.winner, 'p1')
  })

  it('matcher claims comparison queries with multiple named projects', () => {
    const compareCtx = {
      message: 'Compare Godrej Woods vs ATS Reprieves',
      flags: { isCompareRequest: true },
      intent: { projectNames: ['Godrej Woods', 'ATS Reprieves'] },
    }
    assert.equal(comparisonHandler.matches(compareCtx as any), true)

    const diffCtx = {
      message: 'What is the difference between Mahagun Manorialle and Gulshan Dynasty?',
      flags: {},
      intent: { projectNames: ['Mahagun Manorialle', 'Gulshan Dynasty'] },
    }
    assert.equal(comparisonHandler.matches(diffCtx as any), true)

    const singleCtx = {
      message: 'What is the price of Godrej Woods?',
      flags: { isCompareRequest: false },
      intent: { projectNames: ['Godrej Woods'] },
    }
    assert.equal(comparisonHandler.matches(singleCtx as any), false)
  })
})
