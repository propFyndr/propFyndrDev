import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

/**
 * No live DB: `lib/db.ts` reuses `globalThis.prisma` when set, so a stub placed
 * there before the dynamic imports below is the client every module sees.
 *
 * Fixtures: "Lotus 300" holds no forensic research (every column null) and
 * "Docketed Tower" holds some. A null must reach the buyer as unknown, never as
 * `false`, `NONE` or a typical multiplier.
 */
const FIXTURES: Record<string, Record<string, unknown>> = {
  'lotus 300': {
    id: 'p-lotus', name: 'Lotus 300', slug: 'lotus-300', status: 'READY_TO_MOVE', sector: 'Sector 107', city: 'Noida',
    oc_status: null, oc_details: null, amitabh_kant_clearance: null, bank_apf_codes: null,
    water_source_type: null, water_tds_range: null, shahdara_drain_impact: null, lift_act_compliant: null,
    power_supply_type: null, all_in_cost_multiplier: null, maintenance_per_sqft_monthly: null,
    dg_power_rate_per_unit: null, authority_dues_cleared: null, rera_number: null, rera_url: null,
    builder: { name: 'Lotus Greens', insolvency_history: null, litigation_count: null },
  },
  'docketed tower': {
    id: 'p-dock', name: 'Docketed Tower', slug: 'docketed-tower', status: 'READY_TO_MOVE', sector: 'Sector 150', city: 'Noida',
    oc_status: 'FULL', oc_details: 'All towers', amitabh_kant_clearance: 'CLEARED', bank_apf_codes: null,
    water_source_type: 'GANGA_JAL', water_tds_range: '120-180', shahdara_drain_impact: null, lift_act_compliant: false,
    power_supply_type: null, all_in_cost_multiplier: 1.12, maintenance_per_sqft_monthly: null,
    dg_power_rate_per_unit: null, authority_dues_cleared: null, rera_number: 'UPRERAPRJ0000', rera_url: null,
    builder: { name: 'Fixture Builder', insolvency_history: false, litigation_count: 0 },
  },
}

const stubPrisma = {
  project: {
    findFirst: async (args: { where?: { OR?: Array<{ name?: { equals?: string } }> } }) => {
      const name = args.where?.OR?.find(c => c.name?.equals)?.name?.equals ?? ''
      return FIXTURES[name.toLowerCase()] ?? null
    },
  },
}

import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)
;(globalThis as { prisma?: unknown }).prisma = stubPrisma
const { getProjectDueDiligence } = req('../../lib/projectFacts')
const { createToolHandler } = req('../../lib/ai/tools/handlers')
const { NEUTRAL_TOOLS } = req('../../lib/ai/tools')

describe('Due Diligence Tool & Zero-Fabrication Guarantees', () => {
  it('registers project_due_diligence in NEUTRAL_TOOLS catalog', () => {
    const tool = NEUTRAL_TOOLS.find(t => t.name === 'project_due_diligence')
    assert.ok(tool, 'project_due_diligence must be defined in NEUTRAL_TOOLS')
    assert.equal(tool.parameters.required?.[0], 'project_name')
  })

  it('transparently refuses unknown project without inventing facts', async () => {
    const res = await getProjectDueDiligence('Nonexistent Phantom Township 999')
    assert.equal(res.found, false)
    assert.match(String(res.message), /No project found matching/i)
    assert.equal(res.due_diligence, undefined)
  })

  it('finds a fixture project and presents every null field as unknown, not as a finding', async () => {
    const res = await getProjectDueDiligence('Lotus 300')
    assert.equal(res.found, true, 'fixture project must be found; a miss here is a failure, not a skip')
    const dd = res.due_diligence as any
    assert.ok(dd, 'due_diligence block must be present')
    assert.equal(dd.occupancy_certificate.status, null)
    assert.equal(dd.registry_and_clearances.amitabh_kant_clearance, null)
    assert.equal(dd.registry_and_clearances.authority_dues_cleared, null)
    assert.equal(dd.registry_and_clearances.builder_insolvency_history, null)
    assert.equal(dd.living_quality_and_utilities.lift_act_compliant, null, 'null must not become false')
    assert.equal(dd.living_quality_and_utilities.water_source, null)
    assert.equal(dd.living_quality_and_utilities.water_tds_range, null)
    assert.equal(dd.living_quality_and_utilities.shahdara_drain_impact, null)
    assert.equal(dd.financial_and_banking.all_in_cost_multiplier, null, 'no typical multiplier may stand in')

    const gaps = res.data_gaps as string[]
    assert.ok(Array.isArray(gaps))
    assert.ok(gaps.some(g => /not in the forensic due-diligence docket/i.test(g) && /unverified/i.test(g)))
    assert.ok(gaps.some(g => /Water TDS/i.test(g)))
    assert.ok(gaps.some(g => /All-in landed cost multiplier unrecorded/i.test(g)))
    assert.match(String(res.note), /null means we have not researched/i)
  })

  it('passes researched values through untouched, including a checked false', async () => {
    const res = await getProjectDueDiligence('Docketed Tower')
    assert.equal(res.found, true)
    const dd = res.due_diligence as any
    assert.equal(dd.occupancy_certificate.status, 'FULL')
    assert.equal(dd.living_quality_and_utilities.water_source, 'GANGA_JAL')
    assert.equal(dd.living_quality_and_utilities.lift_act_compliant, false)
    assert.equal(dd.financial_and_banking.all_in_cost_multiplier, 1.12)
    // Researched project: the whole-docket gap must not fire.
    assert.ok(!(res.data_gaps as string[]).some(g => /not in the forensic due-diligence docket/i.test(g)))
  })

  it('executes via createToolHandler dispatch without errors', async () => {
    const handle = createToolHandler({})
    const callResult = await handle('project_due_diligence', { project_name: 'Lotus 300' })
    assert.equal((callResult as any).found, true)
  })
})
