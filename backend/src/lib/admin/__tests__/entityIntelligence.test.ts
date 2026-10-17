import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeEntityIntelligence, normaliseQuestion } from '../entityIntelligence'

const projects = [
  { id: 'p1', name: 'Panchsheel Greens 1', slug: 'pg1', sector: 'Sector 16' },
  { id: 'p2', name: 'ATS Happy Trails', slug: 'ath', sector: 'Sector 10' },
]

describe('entity intelligence counts real conversations', () => {
  it('counts distinct conversations, matches a project without its phase number, and sector 1 is not sector 150', () => {
    const msgs = [
      { session_id: 's1', content: 'tell me about panchsheel greens', intent_snapshot: { sector: 'Sector 150, Noida', bhk: [3], budgetMax: 1.5 } },
      { session_id: 's1', content: 'panchsheel greens possession?', intent_snapshot: {} },
      { session_id: 's2', content: 'flats in sector 1 greater noida west', intent_snapshot: {} },
    ]
    const r = computeEntityIntelligence(msgs, projects, new Map([['s3', 'p2']]))
    assert.deepEqual(r.topProjects.map((p) => [p.name, p.count]).sort(), [['ATS Happy Trails', 1], ['Panchsheel Greens 1', 1]])
    const sectors = Object.fromEntries(r.topSectors.map((s) => [s.sector, s.count]))
    assert.equal(sectors['Sector 150'], 1)
    assert.equal(sectors['Sector 1'], 1)
    assert.equal(sectors['Greater Noida West'], 1)
    assert.deepEqual(r.topRequirements.bhk, [{ label: '3 BHK', count: 1 }])
    assert.deepEqual(r.topRequirements.budget, [{ label: '₹1.2–1.8 Cr', count: 1 }])
  })

  it('groups the same question with different figures and drops greetings and follow-ups', () => {
    assert.equal(normaliseQuestion('Show me 3BHK in Sector 150 under 1.5 cr'), normaliseQuestion('show me 2bhk in sector 76 under 90 lakh'))
    for (const t of ['hi', 'yes please', 'next', 'step 6', 'test']) assert.equal(normaliseQuestion(t), null, t)
    const r = computeEntityIntelligence([
      { session_id: 'a', content: 'Show me 3BHK in Sector 150 under 1.5 cr', intent_snapshot: {} },
      { session_id: 'b', content: 'show me 2bhk in sector 76 under 90 lakh', intent_snapshot: {} },
      { session_id: 'c', content: 'a one-off question nobody else asked', intent_snapshot: {} },
    ], projects, new Map())
    assert.equal(r.topQueries.length, 1)
    assert.equal(r.topQueries[0].count, 2)
  })
})
