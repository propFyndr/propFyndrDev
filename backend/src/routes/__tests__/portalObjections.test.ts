import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { scrubCompetitors } from '../../lib/leadBrief'

describe('portal objection competitor scrubbing and executive summary logic', () => {
  const COMPETITORS = ['Godrej Woods', 'Godrej', 'ATS Knightsbridge', 'County Group']

  it('scrubs competitor names from raw objection reason text', () => {
    const rawReason = 'Buyer hesitates because ATS Knightsbridge offers lower maintenance and Godrej Woods has closer metro access.'
    const scrubbed = scrubCompetitors(rawReason, COMPETITORS)
    assert.ok(!scrubbed!.includes('ATS Knightsbridge'))
    assert.ok(!scrubbed!.includes('Godrej Woods'))
    assert.ok(scrubbed!.includes('other projects') || scrubbed!.includes('another project'))
  })

  it('computes executive summary accurately from category tally', () => {
    const tally = [
      { name: 'possession', count: 18, share: 45 },
      { name: 'price', count: 14, share: 35 },
      { name: 'amenities', count: 8, share: 20 },
    ]
    const total = 40
    const topCategory = tally[0]
    const executiveSummary = topCategory
      ? `${topCategory.name} is your top objection (${topCategory.share}% of recorded buyer hesitations across ${total} instances).`
      : 'No objections recorded for this developer yet.'

    assert.equal(
      executiveSummary,
      'possession is your top objection (45% of recorded buyer hesitations across 40 instances).'
    )
  })

  it('computes fallback summary when zero objections recorded', () => {
    const tally: any[] = []
    const total = 0
    const topCategory = tally[0] ?? null
    const executiveSummary = topCategory
      ? `${topCategory.name} is your top objection (${topCategory.share}% of recorded buyer hesitations across ${total} instances).`
      : 'No objections recorded for this developer yet.'

    assert.equal(executiveSummary, 'No objections recorded for this developer yet.')
  })
})

describe('sales velocity median calculation threshold', () => {
  function computeMedian(waits: number[]): number | null {
    if (waits.length < 5) return null
    const sorted = [...waits].sort((a, b) => a - b)
    return Math.round(sorted[Math.floor(sorted.length / 2)] / 60000)
  }

  it('returns null when contacted sample is under 5', () => {
    const waitsUnder5 = [120000, 300000, 180000, 240000] // 4 items
    assert.equal(computeMedian(waitsUnder5), null)
  })

  it('computes median in minutes when contacted sample is 5 or more', () => {
    // 2m, 3m, 4m, 5m, 10m in ms -> median is 4m (240000ms)
    const waits5 = [120000, 180000, 240000, 300000, 600000]
    assert.equal(computeMedian(waits5), 4)
  })
})
