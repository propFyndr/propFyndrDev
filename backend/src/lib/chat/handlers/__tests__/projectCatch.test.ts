import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ASKS_FOR_THE_CATCH, catchAnswer } from '../projectCatch'

const base = {
  name: 'Test Heights', status: 'under_construction', possession_date: null, possession_label: 'Under Construction',
  oc_status: null, rera_number: 'UPRERAPRJ000001', legal_flag: null, litigation_count: null,
  ongoing_litigation_count: null, nclt_moratorium_active: null, location_concerns: [],
  flood_waterlogging_risk: null, amitabh_kant_clearance: null, authority_dues_cleared: true,
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
