import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../db'
import { parseAggregateQuestion, queryProjects, renderAggregateAnswer } from '../aggregateQuery'

// prisma delegates are proxies; swap them on the client for the duration.
function stub(model: string, impl: Record<string, unknown>): () => void {
  const original = Object.getOwnPropertyDescriptor(prisma, model)
  Object.defineProperty(prisma, model, { configurable: true, value: impl })
  return () => { if (original) Object.defineProperty(prisma, model, original); else delete (prisma as any)[model] }
}

describe('parseAggregateQuestion', () => {
  let restore: () => void
  before(() => { restore = stub('builder', { findMany: async () => [{ name: 'Godrej Properties' }, { name: 'ATS Infrastructure' }] }) })
  after(() => restore())

  it('average price per sq ft in a sector', async () => {
    const q = await parseAggregateQuestion('What is the average price per sq ft in Sector 150?')
    assert.equal(q?.metric, 'avg')
    assert.equal(q?.field, 'price_per_sqft')
    assert.equal(q?.sector, 'Sector 150')
  })

  it('average maintenance in Noida', async () => {
    const q = await parseAggregateQuestion('average maintenance in noida')
    assert.deepEqual([q?.metric, q?.field, q?.city], ['avg', 'maintenance', 'Noida'])
  })

  it('a count by builder, from the first word of its name', async () => {
    const q = await parseAggregateQuestion('How many projects does Godrej have in Noida?')
    assert.deepEqual([q?.metric, q?.field, q?.builder], ['count', 'projects', 'Godrej Properties'])
  })

  it('a filtered list discovery cannot apply', async () => {
    const q = await parseAggregateQuestion('Which projects have a clubhouse and possession before 2027?')
    assert.equal(q?.metric, 'list')
    assert.equal(q?.amenity, 'club')
    assert.equal(q?.possessionBefore?.toISOString(), '2027-01-01T00:00:00.000Z')
  })

  for (const msg of [
    'i want a house in noida around 3BHK sector 128',
    'cheapest 3bhk in greater noida west',
    'should I buy in sector 150, what is the average price',
    'what is the rate of interest on a home loan',
    'compare average price in sector 150 and sector 128',
    'average price in gurgaon sector 62',
    'what is the average price in delhi',
  ]) {
    it(`leaves "${msg}" to the other lanes`, async () => {
      assert.equal(await parseAggregateQuestion(msg), null)
    })
  }
})

describe('queryProjects + renderAggregateAnswer', () => {
  const unit = (psf: number, estimated: boolean) => ({ bhk: 3, price_min_cr: 1.5, price_per_sqft: psf, price_is_estimated: estimated })
  const projects = [
    { name: 'A', sector: 'Sector 150', price_min_cr: 1.2, possession_label: 'Dec 2026', maintenance_per_sqft_monthly: 3, unit_types: [unit(8000, false)] },
    { name: 'B', sector: 'Sector 150', price_min_cr: 2.0, possession_label: null, maintenance_per_sqft_monthly: 4, unit_types: [unit(10000, false)] },
    { name: 'C', sector: 'Sector 150', price_min_cr: 3.0, possession_label: null, maintenance_per_sqft_monthly: null, unit_types: [unit(12000, false)] },
    { name: 'D', sector: 'Sector 150', price_min_cr: null, possession_label: null, maintenance_per_sqft_monthly: null, unit_types: [unit(99000, true)] },
  ]
  let restore: () => void
  before(() => { restore = stub('project', { findMany: async () => projects }) })
  after(() => restore())

  it('averages measured price per sq ft and leaves estimates out', async () => {
    const r = await queryProjects({ metric: 'avg', field: 'price_per_sqft', sector: 'Sector 150' })
    assert.equal(r.matched, 4)
    assert.equal(r.used, 3)
    assert.equal(r.excludedEstimated, 1)
    assert.equal(r.stats?.avg, 10000)
    assert.equal(r.stats?.median, 10000)
    assert.equal(r.stats?.min.name, 'A')
    assert.equal(r.stats?.max.name, 'C')
    const text = renderAggregateAnswer(r)
    assert.match(text, /Average price per sq\.ft: \*\*₹10,000\/sq\.ft\*\*/)
    assert.match(text, /computed over 3 projects we hold/)
    assert.match(text, /1 only an estimate/)
  })

  it('says how few projects a figure rests on', async () => {
    const r = await queryProjects({ metric: 'avg', field: 'maintenance' })
    assert.equal(r.used, 2)
    assert.match(renderAggregateAnswer(r), /too few projects/)
  })

  it('counts and lists', async () => {
    const r = await queryProjects({ metric: 'count', field: 'projects', sector: 'Sector 150' })
    const text = renderAggregateAnswer(r)
    assert.match(text, /We hold \*\*4\*\* projects in Sector 150/)
    assert.match(text, /\| A \| Sector 150 \| Dec 2026 \|/)
  })
})

describe('no match is said plainly', () => {
  it('names the filters that matched nothing', async () => {
    const restore = stub('project', { findMany: async () => [] })
    try {
      const r = await queryProjects({ metric: 'avg', field: 'price', sector: 'Sector 999' })
      assert.match(renderAggregateAnswer(r), /None of the projects we hold match: projects in Sector 999/)
    } finally { restore() }
  })
})
