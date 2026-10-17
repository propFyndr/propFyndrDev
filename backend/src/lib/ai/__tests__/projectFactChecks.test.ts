import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { crossProjectFigures, recordContradictions, unsourcedPeriods } from '../projectFactChecks'

// Shapes as the prompt carries them (facts block and search block).
const LOGIX = '{"id":"a2d6","slug":"logix","name":"Logix Blossom County","rera_number":"UPRERAPRJ6601","status":"Ready to Move","possession_date":"2016-08-31","oc_obtained":"obtained","litigation_count":"6","water_source":"Ganga Water Pipeline (Authority Supply)"}'
const SEARCH = 'MATCHED PROJECTS: [{"id":"t1","name":"Tata Eureka Park Phase 2","price_range_label":"₹2.26–2.44Cr","price_min_cr":2.26,"unit_types":[{"bhk":3,"price_min_cr":2.26}]},{"id":"s1","name":"Samridhi Daksh Avenue","price_min_cr":1.85,"unit_types":[{"bhk":3,"price_min_cr":1.85}]}]'
const GODREJ = '{"id":"g1","name":"Godrej Palm Retreat","rera_number":"UPRERAPRJ11234","possession_date":"2026-09-30","rera_valid_until":"not available"}'

describe('answer checked against the project it names', () => {
  it('rejects a figure that belongs to another project in the prompt', () => {
    const v = crossProjectFigures('Tata Eureka Park Phase 2 offers 3 BHK units from ₹1.85 Cr.', SEARCH)
    assert.equal(v.length, 1)
    assert.match(v[0].detail, /Samridhi Daksh Avenue/)
  })

  it('accepts the project\'s own figure', () => {
    assert.equal(crossProjectFigures('Tata Eureka Park Phase 2 starts at ₹2.26 Cr.', SEARCH).length, 0)
  })

  it('rejects "5% GST applies" and "no water supply" for a ready project with water on record', () => {
    const v = recordContradictions('5% GST applies (under-construction status). No verified municipal water supply.', LOGIX)
    assert.equal(v.length, 2)
  })

  it('rejects "we hold no occupancy certificate" when the OC is on record', () => {
    assert.equal(recordContradictions('Biggest drawback: we hold no occupancy certificate for Logix Blossom County.', LOGIX).length, 1)
  })

  it('leaves the general rules alone', () => {
    const rules = 'Without an OC, a flat is not legally occupiable. 5% GST applies to under-construction flats.'
    assert.equal(recordContradictions(rules, LOGIX).length, 0)
  })

  it('rejects a RERA validity date nobody supplied', () => {
    const v = unsourcedPeriods('The RERA registration is valid until December 2031.', GODREJ, '', new Date('2026-10-16'))
    assert.ok(v.length >= 1)
  })

  it('accepts a month the prompt carries as a date', () => {
    assert.equal(unsourcedPeriods('Possession was due in September 2026.', GODREJ, '', new Date('2026-10-16')).length, 0)
  })

  it('accepts the current month and a quarter the prompt names', () => {
    assert.equal(unsourcedPeriods('As of October 2026, prices from Q3 2026 hold.', `${GODREJ} Q3 2026`, '', new Date('2026-10-16')).length, 0)
  })
})

import { unsourcedMarketStatistics } from '../projectFactChecks'
import { qualifyMarketFigures, LOAN_ESTIMATE_QUALIFIER } from '../answerIntegrity'
import { MARKET_QUALIFIER } from '../../factPresentation'

describe('market figures', () => {
  it('rejects an appreciation history nobody supplied', () => {
    const g7 = "Noida's property prices have historically appreciated at 5–7% annually in established sectors and 8–12% in emerging areas."
    assert.ok(unsourcedMarketStatistics(g7, 'no rates here').length >= 1)
  })

  it('catches a rate written before its word, inside bold', () => {
    const run2 = "Noida's residential prices grew at a **5-7% CAGR** over the past decade. A **60-70% appreciation** in 5 years is more realistic."
    assert.equal(unsourcedMarketStatistics(run2, 'GST 5%. Stamp duty 7%.').length, 2)
    const run4 = 'Prices have appreciated at a compound annual growth rate (CAGR) of 6-8% over the past decade.'
    assert.equal(unsourcedMarketStatistics(run4, 'GST 5%. Stamp duty 7%.').length, 1)
  })

  it('accepts a growth rate computed from our rows', () => {
    assert.equal(unsourcedMarketStatistics('Prices grew 9.2% a year.', 'computed_cagr_pct: 9.2').length, 0)
  })

  it('leaves statutory percentages alone', () => {
    assert.equal(unsourcedMarketStatistics('Stamp duty is 7% and registration 1%.', 'none').length, 0)
  })

  it('labels a loan range and a loading factor', () => {
    const out = qualifyMarketFigures(
      'You could qualify for a home loan in the range of ₹35–40 lakh. Builders add a 25% to 35% loading factor.',
      'nothing',
    ).text
    assert.ok(out.includes(LOAN_ESTIMATE_QUALIFIER))
    assert.ok(out.includes(MARKET_QUALIFIER))
  })
})

describe('stress re-run leftovers', () => {
  it('rejects "5%–7% annually" even though 5 and 7 are in every prompt', () => {
    const g7 = 'Historical appreciation in established Noida sectors has averaged 5%–7% annually.'
    assert.ok(unsourcedMarketStatistics(g7, 'GST 5%. Stamp duty 7%. Registration 1%.').length >= 1)
  })

  it('rejects a registry clearance the row does not hold', () => {
    const d5 = 'Logix Blossom County has an Occupancy Certificate (OC) and Amitabh Kant registry clearance, so registry is possible.'
    assert.ok(recordContradictions(d5, LOGIX).length >= 1)
  })
})

import { dropUnsourcedMeasurements } from '../projectFactChecks'

describe('measurements nobody supplied (live rerun 4, 17 Oct 2026)', () => {
  it('drops the sentence with an invented distance, area or stamp-duty range, keeps the rest', () => {
    const t = 'ATS Dolce is the closest. It is about 44 km away, roughly 44 minutes by road. Want the cost sheet?'
    const r = dropUnsourcedMeasurements(t, 'ATS Dolce straight line 39.7 km')
    assert.equal(r.text, 'ATS Dolce is the closest. Want the cost sheet?')
    assert.equal(r.dropped.length, 1)
    assert.equal(dropUnsourcedMeasurements('Carpet areas run 590 to 690 sqft here.', 'nothing').text, '')
    assert.equal(dropUnsourcedMeasurements('Budget 5–7% UP stamp duty and 1% registration.', 'x').text, '')
  })
  it('keeps measurements and rates we supplied', () => {
    const ok = 'Sector 76 metro is 12.1 km away (27 min). Stamp duty is 7% (6% for women).'
    assert.equal(dropUnsourcedMeasurements(ok, 'metro 12.1 km 27 min').text, ok)
  })
})
