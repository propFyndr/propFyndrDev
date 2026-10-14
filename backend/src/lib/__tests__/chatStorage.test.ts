import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compactCard, compactArtifacts, isCompactCard, CARD_FIELDS } from '../chatStorage'
import { readLastProjectCards, readLastProjectIds } from '../discovery/lastProjects'

const full = {
  id: 'p1', slug: 'ace-parkway', name: 'ACE Parkway', sector: 'Sector 150', city: 'Noida',
  builder: { id: 'b1', name: 'ACE Group', slug: 'ace', outstanding_dues_cr: 12, executives: ['x'] },
  status: 'ready_to_move', possession_label: 'Ready', rera_number: 'UPRERA123',
  price_range_label: '₹1.8–2.4 Cr', price_min_cr: 1.8, price_max_cr: 2.4,
  matchReasons: ['Within budget'], concerns: ['Far from metro'], lat: 28.4, lng: 77.5,
  unit_types: [{ id: 'u1', bhk: 3, super_area_sqft: 1800, carpet_area_sqft: 1250, price_min_cr: 1.8, floor_plans: ['huge'] }],
  images: Array.from({ length: 10 }, (_, i) => ({ type: 'gallery', url: `https://img/${i}.jpg`, caption: 'c' })),
  // what made the stored copies huge — none of it is read by the chat card
  decisionIntelligence: { verdict: 'x'.repeat(5000) },
  buyerPersonas: [{ persona: 'y'.repeat(4000) }],
  decision_profile: { decision_thesis: 'z' },
  competitors: [{ name: 'Other' }],
  top_amenities: ['Pool'],
  _multidimensional_rank: 3,
  _recommendation_summary: 'internal',
  dna: { overall_score: 92 },
}

describe('compactCard', () => {
  const c = compactCard(full) as Record<string, any>

  it('keeps what the chat card reads', () => {
    for (const k of ['id', 'slug', 'name', 'sector', 'city', 'status', 'rera_number', 'price_range_label', 'price_min_cr', 'lat', 'lng', 'matchReasons', 'concerns']) {
      assert.deepEqual(c[k], (full as any)[k], k)
    }
    assert.deepEqual(c.unit_types, [{ id: 'u1', bhk: 3, super_area_sqft: 1800, carpet_area_sqft: 1250, price_min_cr: 1.8 }])
    assert.equal(c.images.length, 6)
    assert.deepEqual(c.images[0], { type: 'gallery', url: 'https://img/0.jpg' })
    assert.deepEqual(c.builder, { id: 'b1', name: 'ACE Group', slug: 'ace' })
    assert.equal(c.compact, true)
  })

  it('drops analysis, ranker internals and DNA', () => {
    for (const k of ['decisionIntelligence', 'buyerPersonas', 'decision_profile', 'competitors', 'top_amenities', '_multidimensional_rank', '_recommendation_summary', 'dna']) {
      assert.equal(k in c, false, k)
    }
    assert.ok(JSON.stringify(c).length < JSON.stringify(full).length / 5)
  })

  it('is idempotent and only ever keeps listed fields', () => {
    assert.deepEqual(compactCard(c), c)
    for (const k of Object.keys(c)) assert.ok(k === 'compact' || (CARD_FIELDS as readonly string[]).includes(k), k)
  })
})

describe('compactArtifacts', () => {
  it('compacts card lists and leaves other artifact data alone', () => {
    const [a, b] = compactArtifacts([
      { type: 'property_results', expansion: { radius: 2 }, exactResults: [full], nearbyResults: [full] },
      { type: 'comparison', rows: [1, 2] },
    ]) as any[]
    assert.equal(a.type, 'property_results')
    assert.deepEqual(a.expansion, { radius: 2 })
    assert.ok(isCompactCard(a.exactResults[0]) && isCompactCard(a.nearbyResults[0]))
    assert.deepEqual(b, { type: 'comparison', rows: [1, 2] })
  })
})

describe('last_projects reuse', () => {
  it('full cards are reused; compact cards are not, but their ids still read', () => {
    assert.ok(readLastProjectCards([full]))
    const compact = [compactCard(full)]
    assert.equal(readLastProjectCards(compact), null)
    assert.deepEqual(readLastProjectIds(compact), ['p1'])
  })
})
