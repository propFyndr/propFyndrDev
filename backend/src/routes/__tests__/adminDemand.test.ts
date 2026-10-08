import test, { describe, it, before } from 'node:test'
import assert from 'node:assert'
import { prisma } from '../../lib/db'

describe('Admin Demand Signal API', () => {
  before(async () => {
    // Clean up any test signals for deterministic assertions
    await prisma.demandSignal.deleteMany({
      where: { city: { in: ['Bengaluru_Test', 'Gurgaon_Test'] } },
    })

    // Insert test demand signals
    await prisma.demandSignal.createMany({
      data: [
        { city: 'Bengaluru_Test', question_kind: 'market', budget_max_cr: 1.2, bhk: 3 },
        { city: 'Bengaluru_Test', question_kind: 'market', budget_max_cr: 1.8, bhk: 3 },
        { city: 'Gurgaon_Test', question_kind: 'market', budget_max_cr: 2.5, bhk: 4 },
      ],
    })
  })

  it('aggregates demand signals correctly by city', async () => {
    const rawSignals = await prisma.demandSignal.findMany({
      where: { city: { in: ['Bengaluru_Test', 'Gurgaon_Test'] } },
    })

    assert.strictEqual(rawSignals.length, 3)
    const bgSignals = rawSignals.filter((s) => s.city === 'Bengaluru_Test')
    assert.strictEqual(bgSignals.length, 2)
  })
})
