import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeProfile } from './leadProfile'

describe('summarizeProfile', () => {
  it('reads as a line a salesperson can use before dialling', () => {
    const line = summarizeProfile({
      bhk: 3,
      budget_cr: { min: 1.2, max: 1.5 },
      preferred_sector: 'Sector 150',
      loan_pre_approved: true,
      engagement: { projects_viewed: 6, projects_saved: 2 },
    })
    assert.equal(line, '3BHK · ₹1.2–1.5 cr · Sector 150 · loan pre-approved · viewed 6, saved 2')
  })

  it('omits what we do not hold rather than filling it in', () => {
    const line = summarizeProfile({ bhk: 2, engagement: { projects_viewed: 1, projects_saved: 0 } })
    assert.equal(line, '2BHK · viewed 1, saved 0')
  })

  it('handles a one-sided budget without printing a dangling range', () => {
    assert.equal(summarizeProfile({ budget_cr: { min: null, max: 1.5 } }), 'up to ₹1.5 cr')
    assert.equal(summarizeProfile({ budget_cr: { min: 1.2, max: null } }), 'from ₹1.2 cr')
  })

  it('is null when we know nothing — an empty line is worse than no line', () => {
    assert.equal(summarizeProfile({}), null)
    assert.equal(summarizeProfile({ budget_cr: { min: null, max: null } }), null)
    assert.equal(summarizeProfile({ engagement: { projects_viewed: 0, projects_saved: 0 } }), null)
  })
})
