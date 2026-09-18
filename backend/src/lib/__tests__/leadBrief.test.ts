import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { scrubCompetitors, suggestOpening, type LeadBriefObjection } from '../leadBrief'

/**
 * The brief is the one thing we hand a builder that a listings portal cannot,
 * and the reason we can hand it over at all is that it names no competitor.
 * If this scrub fails, we have sold our neutrality — which is the product.
 */
describe('competitor scrubbing', () => {
  const NAMES = ['Godrej Woods', 'Godrej', 'ATS Knightsbridge', 'Lotus Boulevard', 'M3M']

  it('removes a competing project name', () => {
    const out = scrubCompetitors('They are also considering Lotus Boulevard in Sector 100.', NAMES)
    assert.ok(!out!.includes('Lotus Boulevard'))
    assert.ok(out!.includes('another project'))
  })

  it('matches regardless of case', () => {
    const out = scrubCompetitors('comparing against godrej woods', NAMES)
    assert.ok(!/godrej/i.test(out!))
  })

  it('prefers the longest name, so no fragment survives', () => {
    // "Godrej Woods" must be matched before "Godrej", or the output reads
    // "another project Woods" and the competitor is still named.
    const out = scrubCompetitors('Godrej Woods has better amenities.', NAMES)
    assert.ok(!/woods/i.test(out!), `fragment survived: ${out}`)
  })

  it('collapses a list of competitors instead of repeating itself', () => {
    const out = scrubCompetitors('Comparing M3M, Godrej and ATS Knightsbridge.', NAMES)
    assert.ok(!/M3M|Godrej|ATS/i.test(out!))
    assert.ok(out!.includes('other projects'), `got: ${out}`)
  })

  it('keeps the fact that a comparison is happening', () => {
    // The comparison itself is useful to a builder and names nobody. Deleting
    // the clause would hide a real buying signal.
    const out = scrubCompetitors('They are comparing on possession date with Godrej.', NAMES)
    assert.ok(/comparing on possession date/.test(out!))
  })

  it('leaves text alone when there is nothing to scrub', () => {
    assert.equal(scrubCompetitors('Wants a 3BHK under 1.5 cr.', NAMES), 'Wants a 3BHK under 1.5 cr.')
  })

  it('passes null through rather than inventing an empty string', () => {
    assert.equal(scrubCompetitors(null, NAMES), null)
  })

  it('is not fooled by regex characters in a builder name', () => {
    const out = scrubCompetitors('Looking at A+B (Developers) too.', ['A+B (Developers)'])
    assert.ok(!out!.includes('A+B'))
  })
})

describe('the suggested opening', () => {
  const obj = (category: string, confidence: number | null): LeadBriefObjection =>
    ({ category, text: 'x', confidence })

  it('is absent when no objection is on file', () => {
    // A generic "ask about their requirements" line would be worse than
    // silence: it teaches the reader the field is filler, and then they stop
    // reading it on the day it matters.
    assert.equal(suggestOpening([]), null)
  })

  it('leads with the highest-confidence objection', () => {
    const out = suggestOpening([obj('price', 0.4), obj('possession', 0.9)])
    assert.ok(out!.includes('completion timeline'), out!)
  })

  it('still says something useful for an unmapped category', () => {
    const out = suggestOpening([obj('parking', 0.8)])
    assert.ok(out!.includes('parking'))
  })

  it('treats a missing confidence as the weakest signal', () => {
    const out = suggestOpening([obj('legal', null), obj('financing', 0.2)])
    assert.ok(out!.includes('lender panel'), out!)
  })
})
