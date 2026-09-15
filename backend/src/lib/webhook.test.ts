import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bhkLabel, missingFields } from './webhook'

describe('bhkLabel', () => {
  it('dedupes and sorts the configurations a project actually sells', () => {
    assert.equal(bhkLabel([{ bhk: 3 }, { bhk: 2 }, { bhk: 3 }, { bhk: 4 }]), '2, 3, 4')
  })

  it('is null when the project has no unit types — never an empty string in an alert', () => {
    assert.equal(bhkLabel([]), null)
    assert.equal(bhkLabel(null), null)
    assert.equal(bhkLabel(undefined), null)
  })

  it('drops nulls rather than rendering them', () => {
    assert.equal(bhkLabel([{ bhk: null }, { bhk: 2 }]), '2')
  })
})

describe('webhook payload contract', () => {
  it('names the fields a site visit dropped — the bug that shipped blank alerts', () => {
    const drifted = { name: 'A', phone: '9', projectName: 'X', visitDate: 'd', timeSlot: 't' }
    assert.deepEqual(
      missingFields('site_visit_requested', drifted),
      ['project_name', 'visit_date', 'time_slot', 'sector', 'price_range', 'bhk', 'lead_score', 'lead_tier'],
    )
  })

  it('treats an explicit null as present — a null sector is a fact, not a gap', () => {
    const complete = {
      name: 'A', phone: '9', project_name: 'X', visit_date: 'd', time_slot: 't',
      sector: null, price_range: null, bhk: null, lead_score: 0, lead_tier: 'COLD',
    }
    assert.deepEqual(missingFields('site_visit_requested', complete), [])
  })

  it('does not hold a builder application to the buyer field set', () => {
    const application = { application_id: '1', company_name: 'C', email: 'e@x.com', phone: '9' }
    assert.deepEqual(missingFields('builder_application_submitted', application), [])
  })
})
