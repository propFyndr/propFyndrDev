import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { searchSummary, priceBounds, describeSearch } from '../searchSummary'

const p = (o: Record<string, unknown>) => ({ name: 'X', sector: 'Sector 1', status: 'under_construction', budgetStatus: 'within', ...o }) as any

describe('a plain search is answered from its rows', () => {
  it('reads BHK-narrowed price labels in crore and lakh', () => {
    assert.deepEqual(priceBounds('₹0.99–1.07Cr'), [0.99, 1.07])
    assert.deepEqual(priceBounds('₹85 L–1.1 Cr'), [0.85, 1.1])
    assert.deepEqual(priceBounds(null, 0.73), [0.73, 0.73])
  })

  it('states count, range and readiness, lists the shown projects, and says ready rather than an old possession label', () => {
    const t = searchSummary({
      intent: { bhk: [3], budgetMax: 1.5, city: 'Greater Noida' },
      exact: [
        p({ name: 'Omaxe Riviera', sector: 'Surajpur', status: 'ready_to_move', possession_label: 'Q3 2027', price_range_label: '₹0.99–1.07Cr', price_for_bhk: '3 BHK' }),
        p({ name: 'Ace Platinum', sector: 'Zeta 1', possession_label: 'Dec 2027', price_range_label: '₹1.2–1.4Cr', price_for_bhk: '3 BHK' }),
        p({ name: 'Over Tower', budgetStatus: 'over', price_range_label: '₹1.8–2.0Cr' }),
      ],
      nearby: [],
      shown: 6,
    })
    assert.match(t, /\*\*2 projects match\*\* 3 BHK in Greater Noida up to ₹1\.5 Cr\./)
    assert.match(t, /Prices run ₹99 L to ₹1\.4 Cr\./)
    assert.match(t, /1 ready to move, the rest under construction/)
    assert.match(t, /\*\*Omaxe Riviera\*\*, Surajpur: ₹99 L–₹1\.07 Cr for 3 BHK, ready to move/)
    assert.doesNotMatch(t, /Q3 2027/)
    assert.match(t, /possession Dec 2027/)
    assert.match(t, /Above your budget \(not matches\):\*\* Over Tower/)
    assert.doesNotMatch(t, /CREDAI|we hold no|couldn't find/i)
  })

  it('says plainly when nothing matches and offers what to relax', () => {
    const t = searchSummary({ intent: { bhk: [3], budgetMax: 0.5, sector: 'Sector 150, Noida', city: 'Noida', possession: 'immediate' }, exact: [], nearby: [], shown: 6 })
    assert.match(t, /^None of the projects we hold match 3 BHK in Sector 150 up to ₹50 L, ready to move\./)
    assert.match(t, /raise the budget above ₹50 L/)
    assert.match(t, /search all of Noida instead of Sector 150/)
    assert.match(t, /include under-construction projects/)
  })

  it('describes a floor', () => {
    assert.equal(describeSearch({ bhk: [3], budgetMin: 2.5 }), '3 BHK from ₹2.5 Cr')
  })
})

// Day 7 corpus, 26 Oct: "possession Possession Dec 2026".
it('does not repeat "possession" when the label already says it', () => {
  const t = searchSummary({ intent: { bhk: [2] }, exact: [p({ name: 'Nirala Trio', possession_label: 'Possession Dec 2026', price_range_label: '₹1.05–1.13Cr' })], nearby: [], shown: 6 })
  assert.match(t, /possession Dec 2026/)
  assert.doesNotMatch(t, /possession Possession/i)
})

describe('a shortlist says who confirmed its prices and when', () => {
  it('carries a 31-day-old confirmation with its warning, and nothing when no note is given', async () => {
    const { projectPriceNotes } = await import('../../projectPriceNote')
    const { summarisePriceNotes } = await import('../../priceVerification')
    const now = new Date('2026-10-30T00:00:00Z')
    const verifiedAt = new Date(now.getTime() - 31 * 86_400_000)
    const notes = await projectPriceNotes(['p1'], now, async () => ({
      projects: [{ id: 'p1' }], units: [],
      rows: [{ entityType: 'Project', entityId: 'p1', tier: 'BUILDER_ATTESTED', verifiedAt }],
    }))
    const args = { intent: { bhk: [3], city: 'Noida' }, exact: [p({ name: 'Omaxe Riviera', price_range_label: '₹1.2–1.4Cr', price_for_bhk: '3 BHK' })], nearby: [], shown: 6 }
    const withNote = searchSummary({ ...args, priceNote: summarisePriceNotes([...notes.values()]) })
    assert.match(withNote, /_Prices: last confirmed by the builder on 29 Sep(?:t)? 2026 \(31 days ago\), so it may have changed\._/)
    assert.doesNotMatch(searchSummary(args), /_Prices:/)
  })
})

describe('a list of sectors and a sector with no flat of that size', () => {
  it('names every sector the buyer listed, not only the first', () => {
    assert.equal(
      describeSearch({ bhk: [2], sector: 'Sector 74, Noida', sectorsMentioned: ['Sector 74', 'Sector 75', 'Sector 76'] }),
      '2 BHK in Sectors 74, 75 and 76',
    )
    assert.equal(describeSearch({ bhk: [2], sector: 'Sector 74', sectorsMentioned: ['Sector 74'] }), '2 BHK in Sector 74')
  })

  it('says the same sector has other configurations instead of calling them a near match', () => {
    const t = searchSummary({
      intent: { bhk: [1], sector: 'Sector 75, Noida', city: 'Noida' },
      exact: [],
      nearby: [p({ name: 'AIMS Golf City', sector: 'Sector 75', status: 'ready_to_move', price_range_label: '₹0.79–1.17Cr' })],
      shown: 6,
    })
    assert.ok(t.startsWith('We hold no 1 BHK in Sector 75.'))
    assert.ok(t.includes('other configurations'))
    assert.ok(t.includes('**AIMS Golf City**, Sector 75'))
    assert.ok(!t.includes('These are the closest'))
  })

  it('keeps the closest-matches wording when the nearby projects are in other sectors', () => {
    const t = searchSummary({
      intent: { bhk: [1], sector: 'Sector 75' },
      exact: [],
      nearby: [p({ name: 'Elsewhere', sector: 'Sector 76', price_range_label: '₹0.9–1.0Cr' })],
      shown: 6,
    })
    assert.ok(t.includes('These are the closest'))
  })
})
