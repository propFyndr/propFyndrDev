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

  it('checks a bullet against the project named on the heading above it', () => {
    const v = crossProjectFigures('**Tata Eureka Park Phase 2**\n- 3 BHK from ₹1.85 Cr\n- Possession 2027', SEARCH)
    assert.equal(v.length, 1)
    assert.match(v[0].detail, /Samridhi Daksh Avenue/)
  })

  it('accepts a bullet carrying the heading project\'s own figure', () => {
    assert.equal(crossProjectFigures('**Tata Eureka Park Phase 2**\n- 3 BHK from ₹2.26 Cr', SEARCH).length, 0)
  })

  it('does not carry a project into a plain summary line after the list', () => {
    const t = '**Tata Eureka Park Phase 2**\n- 3 BHK from ₹2.26 Cr\nAcross the two, entry starts at ₹1.85 Cr.'
    assert.equal(crossProjectFigures(t, SEARCH).length, 0)
  })

  it('accepts either project\'s figure on table rows under a header naming both', () => {
    const t = '| | Tata Eureka Park Phase 2 | Samridhi Daksh Avenue |\n|---|---|---|\n| 3 BHK from | ₹2.26 Cr | ₹1.85 Cr |'
    assert.equal(crossProjectFigures(t, SEARCH).length, 0)
  })

  it('attributes a claim in a two-project sentence to the project it is about (live 29 Oct)', () => {
    const JAYPEE = '{"id":"j1","name":"Jaypee Klassic","litigation_count":"10"}'
    const GULSHAN = '{"id":"g2","name":"Gulshan Ikebana","litigation_count":"0"}'
    const prompt = `${JAYPEE} ${GULSHAN}`
    const fine = 'Choose Gulshan Ikebana if you prioritize a litigation-free purchase; choose Jaypee Klassic if you want the lower entry price.'
    assert.equal(recordContradictions(fine, prompt).length, 0)
    const wrong = 'Jaypee Klassic is litigation-free, unlike Gulshan Ikebana.'
    assert.equal(recordContradictions(wrong, prompt).length, 1)
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
  it('checks metres and hours too, converting from the km and minutes we supplied', () => {
    assert.equal(dropUnsourcedMeasurements('The metro is 800 m from the gate.', 'nothing').text, '')
    assert.equal(dropUnsourcedMeasurements('It is a 1.5 hour drive to the airport.', 'nothing').text, '')
    const ok = 'The metro is 800 m away. The airport is about 1.5 hours by road.'
    assert.equal(dropUnsourcedMeasurements(ok, 'metro 0.8 km, airport 90 min').text, ok)
    assert.equal(dropUnsourcedMeasurements('A 2 BHK on the 12th floor.', 'nothing').text, 'A 2 BHK on the 12th floor.')
    assert.equal(dropUnsourcedMeasurements('Power backup runs 24 hours a day.', 'nothing').text, 'Power backup runs 24 hours a day.')
    assert.equal(dropUnsourcedMeasurements('The metro is 300 m away.', 'metro 0.8 km').text, '')
  })
})

import { dropUnsourcedJudgements } from '../projectFactChecks'

describe('judgements nobody supplied (live rerun 4, 17 Oct 2026)', () => {
  it('drops the sentence carrying an unsupported judgement, keeps the rest', () => {
    const t = 'Migsun Ultima in Zeta 1 is ready to move. Its older delivery vintage requires factoring in renovation costs. Want the cost sheet?'
    assert.equal(dropUnsourcedJudgements(t, 'Migsun Ultima ready_to_move').text, 'Migsun Ultima in Zeta 1 is ready to move. Want the cost sheet?')
    const s = 'Aditya Urban Casa tends to have more settled maintenance committees and active resident welfare.'
    assert.equal(dropUnsourcedJudgements(s, 'Aditya Urban Casa').text, '')
  })
  it('keeps a judgement whose words are in our rows, and ordinary advice', () => {
    assert.equal(dropUnsourcedJudgements('The builder is known for timely delivery.', 'builder known for timely delivery').text, 'The builder is known for timely delivery.')
    const advice = 'Ask the society for its maintenance charges before you book.'
    assert.equal(dropUnsourcedJudgements(advice, '').text, advice)
  })
})

describe('judgement wordings seen in live rerun 5', () => {
  it('drops older construction vintage, Mivan and room-size judgements unless supplied', () => {
    for (const t of [
      'Omaxe Palm Greens carries an older construction vintage.',
      'Developers deliver large-format residences featuring Mivan construction.',
      'Migsun Villa features compact room dimensions relative to its super area.',
    ]) assert.equal(dropUnsourcedJudgements(t, 'Omaxe Palm Greens Migsun Villa').text, '', t)
    assert.equal(dropUnsourcedJudgements('Built with Mivan shuttering.', 'construction: mivan').text, 'Built with Mivan shuttering.')
  })
})

describe('day-to-day living claims no row supports', () => {
  it('drops the sentence, keeps the rest', async () => {
    const { dropUnsourcedJudgements } = await import('../projectFactChecks')
    const t = 'Exotica Fresco has 2 to 4 BHK layouts. Trade-off: Visitor parking can get constrained during peak evening hours. Possession is ready to move.'
    const out = dropUnsourcedJudgements(t, 'Exotica Fresco ready_to_move 2 to 4 BHK').text
    assert.doesNotMatch(out, /parking|peak/i)
    assert.match(out, /2 to 4 BHK layouts/)
    assert.match(out, /ready to move/)
  })
})
