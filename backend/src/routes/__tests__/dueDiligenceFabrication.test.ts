import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getProjectDueDiligence } from '../../lib/projectFacts'
import { createToolHandler } from '../../lib/ai/tools/handlers'
import { NEUTRAL_TOOLS } from '../../lib/ai/tools'

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

  it('returns structured due diligence parameters for existing project', async () => {
    const res = await getProjectDueDiligence('Lotus 300')
    if (res.found) {
      assert.ok(res.due_diligence, 'due_diligence block must be present')
      const dd = res.due_diligence as any
      assert.ok(dd.occupancy_certificate, 'occupancy_certificate must exist')
      assert.ok(dd.living_quality_and_utilities, 'living_quality_and_utilities must exist')
      assert.ok(Array.isArray(res.data_gaps), 'data_gaps must be an array')
    }
  })

  it('executes via createToolHandler dispatch without errors', async () => {
    const handle = createToolHandler({})
    const callResult = await handle('project_due_diligence', { project_name: 'Lotus 300' })
    assert.ok(callResult, 'Tool execution result must exist')
    assert.equal(typeof (callResult as any).found, 'boolean')
  })
})
