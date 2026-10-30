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

describe('cheapest is a sort over our price rows', () => {
  it('parses place, configuration and status', async () => {
    const q = await parseAggregateQuestion('cheapest 2bhk ready to move in greater noida west')
    assert.equal(q?.metric, 'cheapest')
    assert.equal(q?.field, 'price')
    assert.equal(q?.bhk, 2)
    assert.equal(q?.status, 'ready_to_move')
    assert.equal(q?.city, 'Greater Noida West')
  })
  it('renders ascending with the count it rests on', () => {
    const rows = [{ name: 'B', sector: 'S2', value: 0.6, possession: null }, { name: 'A', sector: 'S1', value: 0.52, possession: 'Q1 2026' }, { name: 'C', sector: 'S3', value: 0.9, possession: null }]
    const text = renderAggregateAnswer({ found: true, query: { metric: 'cheapest', field: 'price', bhk: 2 }, matched: 3, used: 3, excludedEstimated: 0, rows, stats: { avg: 0.67, median: 0.6, min: { value: 0.52, name: 'A', sector: 'S1' }, max: { value: 0.9, name: 'C', sector: 'S3' }, modeShare: 0.34 } })
    assert.ok(text.indexOf('| A |') < text.indexOf('| B |') && text.indexOf('| B |') < text.indexOf('| C |'))
    assert.match(text, /₹52 lakh/)
    assert.match(text, /3 projects/)
  })
})

describe('queryProjects + renderAggregateAnswer', () => {
  // price_is_estimated is dropped (lean-schema migration, 2026-10) — every
  // price_per_sqft is now treated uniformly; there is no measured/estimated
  // split left to exclude.
  const unit = (psf: number) => ({ bhk: 3, price_min_cr: 1.5, price_per_sqft: psf })
  const projects = [
    { name: 'A', sector: 'Sector 150', price_min_cr: 1.2, possession_label: 'Dec 2026', maintenance_per_sqft_monthly: 3, unit_types: [unit(8000)] },
    { name: 'B', sector: 'Sector 150', price_min_cr: 2.0, possession_label: null, maintenance_per_sqft_monthly: 4, unit_types: [unit(10000)] },
    { name: 'C', sector: 'Sector 150', price_min_cr: 3.0, possession_label: null, maintenance_per_sqft_monthly: null, unit_types: [unit(12000)] },
    { name: 'D', sector: 'Sector 150', price_min_cr: null, possession_label: null, maintenance_per_sqft_monthly: null, unit_types: [] },
  ]
  let restore: () => void
  before(() => { restore = stub('project', { findMany: async () => projects }) })
  after(() => restore())

  it('averages price per sq ft, leaving projects without a priced unit out', () => {
    return queryProjects({ metric: 'avg', field: 'price_per_sqft', sector: 'Sector 150' }).then((r) => {
      assert.equal(r.matched, 4)
      // D has no unit_types, so it contributes no price_per_sqft figure.
      assert.equal(r.used, 3)
      assert.equal(r.excludedEstimated, 0)
      assert.equal(r.stats?.avg, 10000)
      assert.equal(r.stats?.median, 10000)
      assert.equal(r.stats?.min.name, 'A')
      assert.equal(r.stats?.max.name, 'C')
      const text = renderAggregateAnswer(r)
      assert.match(text, /Average price per sq\.ft: \*\*₹10,000\/sq\.ft\*\*/)
      assert.match(text, /computed over 3 projects we hold/)
    })
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

// Live 26 Oct: "the most expensive property in greater noida" got the
// budget-band ranking table, topped by a ₹3.8 Cr Noida project.
describe('most expensive is a max over each project\'s top listed price', () => {
  it('parses with or without a place', async () => {
    const restore = stub('builder', { findMany: async () => [] })
    try {
      const q = await parseAggregateQuestion("can you check what's the price of the most expensive property in greater noida?")
      assert.equal(q?.metric, 'max')
      assert.equal(q?.field, 'price')
      assert.equal(q?.city, 'Greater Noida')
      assert.equal((await parseAggregateQuestion('which is the costliest project you have'))?.metric, 'max')
    } finally { restore() }
  })

  it('ranks by the dearest unit, not the entry price', async () => {
    const restore = stub('project', { findMany: async () => [
      { name: 'Cheap entry, dear top', sector: 'Pari Chowk', price_min_cr: 1.3, possession_label: null, maintenance_per_sqft_monthly: null,
        unit_types: [{ bhk: 3, price_min_cr: 1.3, price_max_cr: 1.5, price_per_sqft: null }, { bhk: 4, price_min_cr: 6.36, price_max_cr: 6.86, price_per_sqft: null }] },
      { name: 'Dear entry', sector: 'Sector 27', price_min_cr: 3.95, possession_label: null, maintenance_per_sqft_monthly: null,
        unit_types: [{ bhk: 4, price_min_cr: 3.95, price_max_cr: 4.5, price_per_sqft: null }] },
    ] })
    try {
      const text = renderAggregateAnswer(await queryProjects({ metric: 'max', field: 'price', city: 'Greater Noida' }))
      assert.match(text, /\*\*₹6\.86 Cr\*\* at Cheap entry, dear top/)
      assert.match(text, /\| Dear entry \| Sector 27 \| ₹4\.50 Cr \|/)
    } finally { restore() }
  })
})
