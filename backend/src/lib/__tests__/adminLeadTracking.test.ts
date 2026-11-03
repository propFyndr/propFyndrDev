import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { siteVisitsQuery, leadPatchAudit, medianOrNull } from '../adminLeadTracking'
import { STAGE_ORDER } from '../analytics/buyerJourney'

describe('siteVisitsQuery', () => {
  it('reads real leads only: the team exclusion is in the SQL by default', () => {
    const q = siteVisitsQuery({ limit: 50, offset: 0 })
    for (const sql of [q.list.sql, q.count.sql]) {
      assert.match(sql, /team_identities/)
      assert.match(sql, /kind = 'site_visit'/)
      assert.match(sql, /is_test = false/)
    }
    assert.match(q.list.sql, /ORDER BY sv\.created_at DESC/)
  })

  it('includeTeam drops only the team exclusion', () => {
    const q = siteVisitsQuery({ includeTeam: true, limit: 50, offset: 0 })
    assert.doesNotMatch(q.list.sql, /team_identities/)
    assert.doesNotMatch(q.count.sql, /team_identities/)
    assert.match(q.list.sql, /kind = 'site_visit'/)
  })

  it('binds the status filter to both list and count, never inlines it', () => {
    const q = siteVisitsQuery({ status: 'confirmed', limit: 10, offset: 20 })
    assert.match(q.list.text, /sv\.status::text = \$\d+/)
    assert.match(q.count.text, /sv\.status::text = \$\d+/)
    assert.ok(q.list.values.includes('confirmed'))
    assert.ok(q.count.values.includes('confirmed'))
    assert.ok(q.list.values.includes(10) && q.list.values.includes(20))
    assert.doesNotMatch(siteVisitsQuery({ limit: 1, offset: 0 }).list.sql, /sv\.status::text =/)
  })
})

describe('leadPatchAudit', () => {
  it('the request that stamped first contact is CONTACTED, with old → new', () => {
    assert.deepEqual(leadPatchAudit('new', 'contacted', true), { action: 'CONTACTED', summary: 'First contact: new → contacted' })
  })
  it('a later status change is STATUS_CHANGED', () => {
    assert.deepEqual(leadPatchAudit('contacted', 'qualified', false), { action: 'STATUS_CHANGED', summary: 'Status contacted → qualified' })
  })
  it('no status change and no stamp writes nothing', () => {
    assert.equal(leadPatchAudit('contacted', 'contacted', false), null)
    assert.equal(leadPatchAudit('new', undefined, false), null)
  })
})

describe('medianOrNull', () => {
  it('is null under five samples and the upper middle otherwise', () => {
    assert.equal(medianOrNull([1, 2, 3, 4]), null)
    assert.equal(medianOrNull([9, 1, 5, 3, 7]), 5)
    assert.equal(medianOrNull([1, 2, 3, 4, 5, 6]), 4)
  })
})

describe('buyer journey stage order', () => {
  it('keeps every old key and puts the new stages on the buyer path in order', () => {
    for (const old of ['chat_started', 'saved', 'callback', 'site_visit', 'dossier']) {
      assert.ok((STAGE_ORDER as readonly string[]).includes(old), old)
    }
    const path = ['chat_started', 'cards_shown', 'project_opened', 'saved', 'lead', 'brief_opened', 'contacted']
    const idx = path.map((s) => (STAGE_ORDER as readonly string[]).indexOf(s))
    assert.ok(idx.every((i) => i >= 0), `missing: ${path.filter((_, k) => idx[k] < 0)}`)
    assert.deepEqual([...idx].sort((a, b) => a - b), idx)
  })
})
