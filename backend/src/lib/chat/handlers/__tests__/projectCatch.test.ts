import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ASKS_FOR_THE_CATCH, catchAnswer } from '../projectCatch'

const base = {
  name: 'Test Heights', status: 'under_construction', possession_date: null, possession_label: 'Under Construction',
  oc_status: null, rera_number: 'UPRERAPRJ000001', project_risk_flag: null, litigation_count: null,
  ongoing_litigation_count: null, nclt_moratorium_active: null, location_concerns: [],
  flood_waterlogging_risk: null, amitabh_kant_clearance: null,
  registry_status: null, maintenance_per_sqft_monthly: null, water_source_type: null,
  builder: { name: 'Test Builder', insolvency_history: false, legal_flag: null, delayed_projects_count: null },
  unit_types: [],
} as any

describe('project catch', () => {
  it('recognises how buyers ask for the catch', () => {
    for (const q of [
      'whats the catch with godrej tropical isle? what will sales team not tell me',
      'any red flags in ATS Pious?',
      'downsides of Ace Parkway',
      'gulshan botnia mein kya dikkat hai',
    ]) assert.ok(ASKS_FOR_THE_CATCH.test(q), q)
    assert.ok(!ASKS_FOR_THE_CATCH.test('tell me about godrej tropical isle'))
  })

  it('states only what the rows show, and lists the gaps as questions', () => {
    const text = catchAnswer(base)
    assert.match(text, /we hold no possession date/)
    assert.doesNotMatch(text, /Possession on record: Under Construction/)
    assert.match(text, /What we do not hold/)
    // A schema-default `authority_dues_cleared: true` is neither good news nor bad.
    assert.doesNotMatch(text, /dues (?:cleared|in good standing)/i)
  })

  it('recognises "what could go wrong" and "is it safe" as the same question', () => {
    for (const q of [
      'what could go wrong with mahagun mezzaria?',
      'What can go wrong if I buy in Ace Parkway',
      'what are the risks of buying Godrej Woods',
      'is mahagun mezzaria safe to buy',
      'is mezzaria the safer buy?',
    ]) assert.ok(ASKS_FOR_THE_CATCH.test(q), q)
    assert.ok(!ASKS_FOR_THE_CATCH.test('what is the safety deposit for ace parkway'))
    // hard-43 bm2: a possession-timeline question that mentions risk is not a "catch" question.
    assert.ok(!ASKS_FOR_THE_CATCH.test('Is Supertech Supernova Astralis on track for possession, and what is the risk if it slips?'))
  })

  it('names a RERA validity date that has passed, as our record, not as a ruling', () => {
    const now = new Date('2026-11-03')
    const text = catchAnswer({ ...base, rera_valid_until: new Date('2021-09-28') }, null, now)
    assert.match(text, /UP-RERA validity on record: 28 Sep 2021, which has passed/)
    assert.match(text, /extension/i)
    assert.doesNotMatch(catchAnswer({ ...base, rera_valid_until: new Date('2028-01-01') }, null, now), /validity on record/)
    assert.doesNotMatch(catchAnswer({ ...base, rera_valid_until: null }, null, now), /validity on record/)
  })

  it('states an approved UP-RERA complaint count with its source and read date, and says it is not a ruling', () => {
    const record = { project: 53, promoter: 59, readAt: new Date('2026-10-27T19:14:42Z') }
    const text = catchAnswer(base, record)
    assert.match(text, /53 complaints/)
    assert.match(text, /59 against the promoter/)
    assert.match(text, /We read UP-RERA's registry page for this project on 27 Oct 2026/)
    // The portal's address in a sentence makes the sanitizer delete that sentence, figures included.
    assert.doesNotMatch(text, /up-rera\.in/i)
    assert.match(text, /not a ruling/i)
    assert.doesNotMatch(text, /number of complaints against the project/i, 'must not also list it as a gap')
  })

  it('lists the complaint count as a gap when we hold no approved record', () => {
    assert.match(catchAnswer(base, null), /complaints against the project on the UP-RERA portal/i)
  })

  it('surfaces a missing RERA number and disagreeing price rows', () => {
    const text = catchAnswer({
      ...base,
      rera_number: null,
      unit_types: [{ bhk: 3, price_min_cr: 3.2, price_per_sqft: 17777 }, { bhk: 3, price_min_cr: 3.7, price_per_sqft: 14845 }],
    })
    assert.match(text, /no UP-RERA registration number/)
    assert.match(text, /3 BHK rows for this project disagree on price/)
  })
})
