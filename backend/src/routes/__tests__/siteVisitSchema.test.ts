import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SiteVisitSchema } from '../leads'

// The body below is exactly what frontend/components/SiteVisitScheduler.tsx
// posts. The schema used to demand camelCase, so this body failed validation on
// every submission and production holds zero site visit requests as a result.
// If this test ever fails again, site visits are silently broken again.
const SCHEDULER_BODY = {
  project_id: 'p-1',
  project_slug: 'ace-hanei',
  project_name: 'ACE Hanei',
  name: 'Furqan',
  phone: '+919876543210',
  email: 'buyer@example.com',
  visit_date: '2027-01-01T10:00:00.000Z',
  time_slot: '10:00 AM',
  message: 'Prefer a weekend slot',
}

describe('SiteVisitSchema', () => {
  it('accepts the body the site visit scheduler actually sends', () => {
    const parsed = SiteVisitSchema.safeParse(SCHEDULER_BODY)
    assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues))
    if (!parsed.success) return
    assert.equal(parsed.data.project_slug, 'ace-hanei')
    assert.equal(parsed.data.visit_date, '2027-01-01T10:00:00.000Z')
    assert.equal(parsed.data.time_slot, '10:00 AM')
    assert.equal(parsed.data.email, 'buyer@example.com')
  })

  it('still accepts the camelCase spelling older callers use', () => {
    const parsed = SiteVisitSchema.safeParse({
      name: 'Furqan',
      phone: '+919876543210',
      projectSlug: 'ace-hanei',
      projectName: 'ACE Hanei',
      visitDate: '2027-01-01T10:00:00.000Z',
      timeSlot: '10:00 AM',
    })
    assert.equal(parsed.success, true)
  })

  it('rejects a session_id that is not a string, rather than handing it to Prisma', () => {
    const parsed = SiteVisitSchema.safeParse({ ...SCHEDULER_BODY, session_id: { id: 'x' } })
    assert.equal(parsed.success, false)
  })

  it('rejects a malformed email instead of storing it', () => {
    const parsed = SiteVisitSchema.safeParse({ ...SCHEDULER_BODY, email: 'not-an-email' })
    assert.equal(parsed.success, false)
  })
})

describe('site visit identity', () => {
  it('accepts a guestToken, because an anonymous booking is still attributed', () => {
    const parsed = SiteVisitSchema.safeParse({ ...SCHEDULER_BODY, guestToken: 'guest_abc123' })
    assert.equal(parsed.success, true)
    if (parsed.success) assert.equal(parsed.data.guestToken, 'guest_abc123')
  })

  it('accepts an empty or null email — the scheduler posts both for a blank field', () => {
    for (const email of ['', null]) {
      assert.equal(SiteVisitSchema.safeParse({ ...SCHEDULER_BODY, email }).success, true, `rejected ${JSON.stringify(email)}`)
    }
  })
})
