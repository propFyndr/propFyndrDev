import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../db'
import { getSectorProjects } from '../projectFacts'

/**
 * The model's sector tools stripped "Sector " and matched `equals: "128"`
 * against a column that holds "Sector 128", so every lookup returned
 * found:false and the advisor told a buyer we hold nothing for Sector 128
 * while the cards above showed Sector 128 projects (Langfuse, 8 Oct 2026).
 */
describe('sector tools match the stored "Sector N" form', () => {
  for (const input of ['128', 'Sector 128', 'sector 128']) {
    it(`"${input}" queries Sector 128`, async () => {
      let where: any
      // prisma.project is a delegate proxy, so mock.method cannot see findMany;
      // swap the delegate on the client instead.
      const original = Object.getOwnPropertyDescriptor(prisma, 'project')
      Object.defineProperty(prisma, 'project', {
        configurable: true,
        value: { findMany: async (args: any) => { where = args.where; return [] } },
      })
      try {
        await getSectorProjects({ sector: input, city: 'Noida', bhk: 3 })
      } finally {
        if (original) Object.defineProperty(prisma, 'project', original)
        else delete (prisma as any).project
      }
      assert.ok(
        where.OR.some((c: any) => c.sector?.equals === 'Sector 128'),
        `no "Sector 128" clause in ${JSON.stringify(where)}`,
      )
      assert.equal(where.sector, undefined)
    })
  }
})
