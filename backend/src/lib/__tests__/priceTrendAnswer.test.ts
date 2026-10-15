import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { basisLabel, renderPriceTrend, yearAsked, type TrendPoint } from '../ai/priceTrendAnswer'

const pt = (q: string, iso: string, psf: number, source: string): TrendPoint => ({ quarterLabel: q, recordedAt: new Date(iso), pricePerSqft: psf, source })

// ACE Parkway's real shape: five benchmark points and one observed.
const ACE = [
  pt('Q1 2021', '2021-02-15', 8638, 'historical_benchmark'),
  pt('Q2 2022', '2022-05-15', 10127, 'historical_benchmark'),
  pt('Q3 2023', '2023-08-15', 11765, 'historical_benchmark'),
  pt('Q1 2024', '2024-02-15', 13106, 'historical_benchmark'),
  pt('Q3 2025', '2025-08-15', 14148, 'historical_benchmark'),
  pt('Q1 2026', '2026-02-15', 14893, 'market_verified_2026'),
]

describe('renderPriceTrend', () => {
  it('shows every point with its basis, oldest first', () => {
    const { text } = renderPriceTrend('ACE Parkway', [...ACE].reverse())
    const rows = text.split('\n').filter((l) => l.startsWith('| Q'))
    assert.equal(rows.length, 6)
    assert.match(rows[0], /Q1 2021.*₹8,638.*Internal benchmark estimate/)
    assert.match(rows[5], /Q1 2026.*₹14,893.*Observed \(market check\)/)
  })

  it('with one observed point: states it, says the rest are benchmarks, and gives no rate of change', () => {
    const r = renderPriceTrend('ACE Parkway', ACE)
    assert.equal(r.observedCount, 1)
    assert.match(r.text, /We hold one observed price: ₹14,893 per sq ft \(Q1 2026/)
    assert.match(r.text, /internal benchmark estimates, not prices we saw being paid/)
    assert.ok(!/%/.test(r.text.replace(/\|.*\|/g, '')), 'no percentage may be derived from benchmark points')
    assert.ok(!/not available/i.test(r.text), 'must not claim the history is unavailable while showing it')
  })

  it('with two observed points: states the change between them, as a record not a forecast', () => {
    const r = renderPriceTrend('X', [
      pt('Q1 2025', '2025-02-01', 10000, 'market_verified_2026'),
      pt('Q1 2026', '2026-02-01', 11000, 'active_market_listing'),
    ])
    assert.equal(r.observedCount, 2)
    assert.match(r.text, /from ₹10,000 to ₹11,000 per sq ft \(\+10\.0%\)/)
    assert.match(r.text, /not a forecast/)
  })

  it('a rate uses only the observed points, never the benchmarks around them', () => {
    const r = renderPriceTrend('X', [
      pt('Q1 2020', '2020-02-01', 5000, 'historical_benchmark'),
      pt('Q1 2025', '2025-02-01', 10000, 'market_verified_2026'),
      pt('Q1 2026', '2026-02-01', 12000, 'market_verified_2026'),
    ])
    assert.match(r.text, /from ₹10,000 to ₹12,000 .*\(\+20\.0%\)/)
    assert.ok(!/\+1\d\d\.\d%/.test(r.text))
  })

  it('with no observed point: says none is observed, and gives no rate', () => {
    const r = renderPriceTrend('X', ACE.slice(0, 3))
    assert.equal(r.observedCount, 0)
    assert.match(r.text, /None of these figures is an observed price/)
  })

  it('with no history at all: says so and what would settle it', () => {
    const r = renderPriceTrend('X', [])
    assert.equal(r.pointCount, 0)
    assert.match(r.text, /hold no recorded price history/)
  })

  it('answers a named year directly, with the basis, before the table', () => {
    const r = renderPriceTrend('ACE Parkway', ACE, { year: 2023 })
    assert.match(r.text, /^### Price movement — ACE Parkway\n\nFor 2023 we hold Q3 2023: ₹11,765 per sq ft \(internal benchmark estimate\)\./)
  })

  it('says so when no point exists for the year, and names the nearest either side', () => {
    const gap = renderPriceTrend(
      'X',
      [pt('Q1 2021', '2021-02-01', 8000, 'historical_benchmark'), pt('Q1 2024', '2024-02-01', 12000, 'historical_benchmark')],
      { year: 2022 },
    )
    assert.match(gap.text, /We hold no price point for 2022; the closest are Q1 2021 \(₹8,000\) and Q1 2024 \(₹12,000\)\./)
  })

  it('reads the year from the question', () => {
    assert.equal(yearAsked('What was the price per sqft of Ace Parkway in 2023?'), 2023)
    assert.equal(yearAsked('has the price changed over the last 12 months?'), undefined)
    assert.equal(yearAsked('Ace Parkway 3 BHK 1850 sq ft'), undefined)
  })

  it('labels every source we store', () => {
    assert.equal(basisLabel('monthly_auto_snapshot'), 'Automatic snapshot')
    assert.equal(basisLabel('active_market_listing'), 'Observed (live listing)')
    assert.equal(basisLabel('some_new_source'), 'some new source')
  })
})
