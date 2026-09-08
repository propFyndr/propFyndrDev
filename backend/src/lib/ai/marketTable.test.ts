import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  renderMicroMarketTable,
  renderProjectTable,
  renderPaymentPlanTable,
  renderCityBandShelf,
  wantsCityBandShelf,
  renderCostSheetTable,
  renderSectorComparisonTable,
  renderDerivedSectorTable,
  renderProjectComparisonTable,
  wantsMarketTable,
} from './marketTable'
import type { MicroMarketSummary } from '../discovery/sectorDataGateway'

const market = (over: Partial<MicroMarketSummary> = {}): MicroMarketSummary =>
  ({
    microMarket: 'Noida Expressway',
    sectors: ['128', '150'],
    avgPricePerSqft: 11500,
    priceRange: { min: 11000, max: 15500 },
    lifestyleTags: ['low density', 'green'],
    dominantSegment: 'Premium low-density',
    highlights: ['80% green cover'],
    ...over,
  }) as MicroMarketSummary

describe('rendered market table', () => {
  it('renders every column from our own rows', () => {
    const t = renderMicroMarketTable([market(), market({ microMarket: 'Greater Noida West', avgPricePerSqft: 7000 })])
    assert.match(t, /\| Micro-market \| Sectors \| Avg rate \| Range \| Character \|/)
    assert.match(t, /₹11,500\/sqft/)
    assert.match(t, /₹11,000 – ₹15,500/)
  })

  it('prints an explicit gap rather than inventing a value', () => {
    // The failure this replaces: asked for a rate it did not have, the model
    // wrote "**25–35%** (Metro + Airport + FAR policy)" — a five-year
    // risk-adjusted upside nothing in the database supports.
    const t = renderMicroMarketTable([
      market({ avgPricePerSqft: null as unknown as number, priceRange: null as unknown as MicroMarketSummary['priceRange'] }),
      market({ microMarket: 'Central Noida' }),
    ])
    assert.match(t, /Not recorded/)
  })

  it('cannot emit an emoji, because nothing here can', () => {
    // The model put ⭐ and ⚠️ into cells while the prompt banned emoji outright.
    const t = renderMicroMarketTable([market(), market({ microMarket: 'Central Noida' })])
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t), 'rendered table contains an emoji')
  })

  it('escapes a pipe so one value cannot break the row', () => {
    const t = renderMicroMarketTable([
      market({ dominantSegment: 'Premium | luxury' }),
      market({ microMarket: 'Central Noida' }),
    ])
    const dataRows = t.split('\n').slice(2)
    for (const r of dataRows) {
      assert.equal(r.split(/(?<!\\)\|/).length, 7, `row has the wrong cell count: ${r}`)
    }
  })

  it('renders nothing when there is no comparison to make', () => {
    // One row is not a comparison, and an empty table is worse than a sentence.
    assert.equal(renderMicroMarketTable([market()]), '')
    assert.equal(renderMicroMarketTable([]), '')
  })

  it('orders by price in the direction the question implies', () => {
    const rows = [market({ microMarket: 'Cheap', avgPricePerSqft: 7000 }), market({ microMarket: 'Dear', avgPricePerSqft: 15000 })]
    assert.ok(renderMicroMarketTable(rows, { order: 'price_asc' }).indexOf('Cheap') < renderMicroMarketTable(rows, { order: 'price_asc' }).indexOf('Dear'))
    assert.ok(renderMicroMarketTable(rows, { order: 'price_desc' }).indexOf('Dear') < renderMicroMarketTable(rows, { order: 'price_desc' }).indexOf('Cheap'))
  })
})

describe('when a market table is warranted', () => {
  it('attaches one to questions about places and prices', () => {
    for (const q of [
      'sector 150 vs sector 128 noida',
      'which sector is best for investment in noida',
      'property rates in noida',
      'where should I look with 80 lakh',
      'best areas in noida',
    ]) {
      assert.equal(wantsMarketTable(q, false), true, q)
    }
  })

  it('does not attach one to a question about a single project', () => {
    // A city-wide table under "does this project have a gym" is noise the buyer
    // pays to scroll past.
    assert.equal(wantsMarketTable('does it have a gym', true), false)
    assert.equal(wantsMarketTable('compare these two projects', true), false)
  })

  it('does not attach one to a question with no place in it', () => {
    assert.equal(wantsMarketTable('what documents do I need', false), false)
    assert.equal(wantsMarketTable('how does RERA registration work', false), false)
  })
})

describe('rendered project shortlist', () => {
  const proj = (over: Record<string, unknown> = {}) => ({
    name: 'ACE Parkway',
    sector: 'Sector 150',
    status: 'under_construction',
    price_range_label: '₹1.2 – 1.8 Cr',
    builder: { name: 'ACE Group' },
    ...over,
  })

  it('renders the shortlist the model used to draw itself', () => {
    const t = renderProjectTable([proj(), proj({ name: 'ATS Pristine' })])
    assert.match(t, /\| Project \| Builder \| Sector \| Price \| Status \|/)
    assert.match(t, /ACE Parkway/)
    assert.match(t, /ATS Pristine/)
  })

  it('says so when a price is missing instead of inventing a band', () => {
    const t = renderProjectTable([
      proj({ price_range_label: undefined, price_min_cr: null }),
      proj({ name: 'ATS Pristine' }),
    ])
    assert.match(t, /Not recorded/)
  })

  it('falls back to the minimum price when no label exists', () => {
    const t = renderProjectTable([
      proj({ price_range_label: undefined, price_min_cr: 1.4 }),
      proj({ name: 'ATS Pristine' }),
    ])
    assert.match(t, /from ₹1\.4 Cr/)
  })

  it('accepts a sector given as an object or a string', () => {
    const t = renderProjectTable([proj({ sector: { name: 'Sector 79' } }), proj({ name: 'B' })])
    assert.match(t, /Sector 79/)
  })

  it('renders nothing for a single project — the card already shows it', () => {
    assert.equal(renderProjectTable([proj()]), '')
    assert.equal(renderProjectTable([]), '')
  })
})

describe('rendered payment plans', () => {
  const plan = (o: Record<string, unknown> = {}) => ({
    plan_name: 'Construction Linked',
    plan_type: 'construction_linked',
    down_payment_pct: 10,
    booking_amount_lakh: 5,
    total_duration_months: 36,
    watch_out: 'Interest accrues from possession date',
    ...o,
  })

  it('gives watch_out its own column so it cannot be dropped', () => {
    // A payment schedule presented without its catch is the one-sided answer
    // the trade-off rule exists to prevent, and it was the easiest field for
    // the model to omit when it was drawing the table itself.
    const t = renderPaymentPlanTable([plan()])
    assert.match(t, /Watch out/)
    assert.match(t, /Interest accrues from possession date/)
  })

  it('humanises the plan type when there is no name', () => {
    assert.match(renderPaymentPlanTable([plan({ plan_name: null })]), /Construction Linked/)
  })

  it('says Not recorded rather than inventing a percentage', () => {
    const t = renderPaymentPlanTable([plan({ down_payment_pct: null, booking_amount_lakh: null })])
    assert.match(t, /Not recorded/)
  })

  it('renders nothing when we hold no plans', () => {
    assert.equal(renderPaymentPlanTable([]), '')
  })
})

describe('rendered cost sheet', () => {
  it('converts the rupee-denominated fields at the right scale', () => {
    // schema.prisma warns that parking_cost / ifms / club_membership are RUPEES,
    // not lakhs. Printing ₹300000 as "₹3" would read as a typo, not an error.
    const t = renderCostSheetTable({
      base_price_per_sqft: 11500,
      parking_cost: 300000,
      club_membership: 150000,
      ifms: 90000,
      stamp_duty_pct: 7,
    })
    assert.match(t, /₹3\.00 lakh/)
    assert.match(t, /₹11,500\/sqft/)
  })

  it('omits a charge we do not hold rather than defaulting it', () => {
    const t = renderCostSheetTable({
      base_price_per_sqft: 11500,
      stamp_duty_pct: 7,
      registration_pct: 1,
      parking_cost: null,
    })
    assert.ok(!/Parking/.test(t), 'a charge with no figure was still given a row')
  })

  it('renders nothing when there is barely anything to show', () => {
    assert.equal(renderCostSheetTable({ base_price_per_sqft: 11500 }), '')
    assert.equal(renderCostSheetTable(null), '')
  })
})

describe('rendered sector comparison', () => {
  const stats = (o: Record<string, unknown> = {}) => ({
    sector: 'Sector 75',
    totalProjects: 12,
    priceRange: '₹1.2–2.4 Cr',
    readyCount: 4,
    topProjects: 'Apex Florville, Dasnac Burj',
    ...o,
  })

  it('shows only rows we can fill from our own counts', () => {
    // The template this replaced asked for "Metro & Transit", "Livability &
    // Atmosphere" and "Social Infrastructure" — three rows with nothing behind
    // them, which the model filled from memory under a "Verified" header.
    const t = renderSectorComparisonTable(stats(), stats({ sector: 'Sector 137' }))
    assert.match(t, /Projects listed/) // renamed: a market question, not an inventory count
    assert.match(t, /Price band/)
    assert.ok(!/Livability|Social Infrastructure|Metro & Transit/.test(t))
  })
})

describe('rendered project comparison', () => {
  const project = (o: Record<string, unknown> = {}) => ({
    name: 'Godrej Woods',
    sector: 'Sector 43',
    builder: { name: 'Godrej Properties' },
    price_min_cr: 1.8,
    price_max_cr: 2.9,
    possession_label: 'Ready to move',
    rera_number: 'UPRERAPRJ12345',
    unit_types: [{ bhk: 2 }, { bhk: 3 }],
    ...o,
  })

  it('transposes attributes down and projects across', () => {
    const t = renderProjectComparisonTable([project(), project({ name: 'ATS Pious Hideaways', sector: 'Sector 150', price_min_cr: 1.2, price_max_cr: 2.1 })])
    assert.match(t, /Godrej Woods/)
    assert.match(t, /ATS Pious Hideaways/)
    assert.match(t, /Builder/)
    assert.match(t, /Configurations/)
  })

  it('never renders for fewer than two projects', () => {
    assert.equal(renderProjectComparisonTable([project()]), '')
    assert.equal(renderProjectComparisonTable([]), '')
  })

  it('caps at three projects, the most a buyer can meaningfully compare at once', () => {
    const t = renderProjectComparisonTable([
      project(),
      project({ name: 'B' }),
      project({ name: 'C' }),
      project({ name: 'D' }),
    ])
    assert.match(t, /\*\*B\*\*/)
    assert.match(t, /\*\*C\*\*/)
    assert.ok(!/\*\*D\*\*/.test(t))
  })

  it('says Not recorded rather than inventing a missing RERA number', () => {
    const t = renderProjectComparisonTable([project({ rera_number: null }), project({ name: 'B' })])
    assert.match(t, /Not recorded/)
  })
})

describe('derived sector table', () => {
  const row = (o: Record<string, unknown> = {}) => ({
    sector: 'Sector 120',
    projectCount: 4,
    readyCount: 2,
    priceMinCr: 0.85,
    priceMaxCr: 1.6,
    ...o,
  })

  it('describes sectors that have projects but no curated intelligence', () => {
    // 61 sectors have projects; 13 have curated rows. Every one of the other 48
    // was answered with "not recorded" while priced projects sat in the same
    // database. This is arithmetic on data we already had.
    const t = renderDerivedSectorTable([row(), row({ sector: 'Sector 121', projectCount: 3 })])
    assert.match(t, /Sector 120/)
    assert.match(t, /₹0\.85 – 1\.6 Cr/)
  })

  it('collapses the band when there is only one price', () => {
    const t = renderDerivedSectorTable([
      row({ priceMaxCr: 0.85 }),
      row({ sector: 'Sector 121' }),
    ])
    assert.match(t, /₹0\.85 Cr/)
    assert.ok(!/0\.85 – 0\.85/.test(t))
  })

  it('says Not recorded rather than guessing an unpriced sector', () => {
    const t = renderDerivedSectorTable([
      row({ priceMinCr: null, priceMaxCr: null }),
      row({ sector: 'Sector 121' }),
    ])
    assert.match(t, /Not recorded/)
  })

  it('renders nothing for a single sector', () => {
    assert.equal(renderDerivedSectorTable([row()]), '')
  })
})

describe('a market table is scoped to the sectors the buyer named', () => {
  const markets = [
    { microMarket: 'Central 7X Hub', sectors: ['Sector 75', 'Sector 76', 'Sector 78'], avgPricePerSqft: 11100, priceRange: { min: 10800, max: 11500 }, dominantSegment: 'Family' },
    { microMarket: 'Established Urban Hub', sectors: ['Sector 74', 'Sector 62'], avgPricePerSqft: 9500, priceRange: { min: 9500, max: 9500 }, dominantSegment: 'High rise' },
    { microMarket: 'Gateway to Gr. Noida West', sectors: ['Sector 1', 'Sector 16'], avgPricePerSqft: 8800, priceRange: { min: 8800, max: 8800 }, dominantSegment: 'Mid' },
    { microMarket: 'Aerotropolis', sectors: ['Sector 22D'], avgPricePerSqft: 7200, priceRange: { min: 7200, max: 7200 }, dominantSegment: 'Speculative' },
  ] as never[]

  it('keeps only the micro-markets the named sectors fall in', () => {
    // The 30 Aug run: "which is better for a family: 74, 75, 76 or 78" printed
    // all four rows, three of which the buyer had not asked about, above prose
    // quoting different rates for the same sectors.
    const t = renderMicroMarketTable(markets, { focusSectors: ['Sector 74', 'Sector 75', 'Sector 76', 'Sector 78'] })
    assert.match(t, /Central 7X Hub/)
    assert.match(t, /Established Urban Hub/)
    assert.ok(!/Aerotropolis/.test(t), t)
    assert.ok(!/Gateway/.test(t), t)
  })

  it('suppresses the table when the named sectors leave nothing to compare', () => {
    // One row is not a comparison, and the prose already covers it.
    assert.equal(renderMicroMarketTable(markets, { focusSectors: ['Sector 22D'] }), '')
  })

  it('still renders the whole city when no sector was named', () => {
    const t = renderMicroMarketTable(markets, {})
    assert.match(t, /Aerotropolis/)
    assert.match(t, /Central 7X Hub/)
  })

  it('does not print a range whose ends are equal', () => {
    // "₹8,800 – ₹8,800" reads as a spread when it is one observation.
    const t = renderMicroMarketTable(markets, {})
    assert.ok(!/8,800 – ₹8,800/.test(t), t)
    assert.match(t, /10,800 – ₹11,500/)
  })
})

describe('the citywide band shelf', () => {
  const shelfProjects = [
    { name: 'Nirala Estate', builder: { name: 'Nirala World' }, sector: 'Sector 16B', possession_label: 'Ready to move', unit_types: [{ price_min_cr: 0.72, price_max_cr: 0.95 }] },
    { name: 'Ace Divino', builder: { name: 'Ace Group' }, sector: 'Sector 1', possession_label: 'Dec 2026', unit_types: [{ price_min_cr: 0.85, price_max_cr: 1.1 }] },
    { name: 'Godrej Woods', builder: { name: 'Godrej Properties' }, sector: 'Sector 43', possession_label: 'Dec 2027', unit_types: [{ price_min_cr: 1.6, price_max_cr: 2.4 }] },
    { name: 'Max Estate 128', builder: { name: 'Max Estates' }, sector: 'Sector 128', possession_label: 'Jun 2028', unit_types: [{ price_min_cr: 4.2, price_max_cr: 6.8 }] },
  ]

  it('picks one project per band and prints the rule it ranked on', () => {
    const out = renderCityBandShelf(shelfProjects as any)
    assert.match(out, /Under ₹1 Cr/)
    assert.match(out, /₹1–2 Cr/)
    assert.match(out, /Above ₹2 Cr/)
    // The rule is printed, not implied.
    assert.match(out, /RERA registration/)
    assert.match(out, /delivery record/)
    // One row per band, not per project: Ace Divino is in the same band as
    // Nirala Estate and must not appear.
    assert.ok(!out.includes('Ace Divino'), 'second project in a band leaked in')
    assert.equal(out.split('\n').filter((l) => l.startsWith('| **')).length, 3)
  })

  it('refuses to render when only one band has anything in it', () => {
    // One band is a shortlist with extra framing, and renderProjectTable
    // already does that better.
    const onlyMid = shelfProjects.filter((p) => p.name === 'Godrej Woods')
    assert.equal(renderCityBandShelf(onlyMid as any), '')
  })

  it('prints Not recorded rather than inventing a possession date', () => {
    const noDate = [
      { name: 'A', builder: { name: 'X' }, sector: 'Sector 1', unit_types: [{ price_min_cr: 0.8 }] },
      { name: 'B', builder: { name: 'Y' }, sector: 'Sector 2', unit_types: [{ price_min_cr: 3.0 }] },
    ]
    assert.match(renderCityBandShelf(noDate as any), /Not recorded/)
  })

  it('fires on a citywide superlative and not on a narrowed one', () => {
    const bare = { hasSector: false, hasBudget: false, hasProjectFocus: false }
    assert.equal(wantsCityBandShelf('which is the best project in Noida', bare), true)
    assert.equal(wantsCityBandShelf('best society to buy right now', bare), true)
    assert.equal(wantsCityBandShelf('cheapest flats in Noida', bare), true)
    assert.equal(wantsCityBandShelf('recommend a project', bare), true)

    // Once the buyer has narrowed, one band IS the answer and a shortlist is
    // the right shape.
    assert.equal(wantsCityBandShelf('best project in Sector 150', { ...bare, hasSector: true }), false)
    assert.equal(wantsCityBandShelf('best project under 1.5 crore', { ...bare, hasBudget: true }), false)
    assert.equal(wantsCityBandShelf('is Godrej Woods the best?', { ...bare, hasProjectFocus: true }), false)

    // Not a superlative, or not about inventory.
    assert.equal(wantsCityBandShelf('what is the stamp duty in UP', bare), false)
    assert.equal(wantsCityBandShelf('best time to buy', bare), false)
    assert.equal(wantsCityBandShelf('', bare), false)
  })
})
