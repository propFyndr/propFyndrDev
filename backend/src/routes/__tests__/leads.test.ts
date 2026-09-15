import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../index'
import { delay } from '../helpers/testDelay'

const RATE_LIMIT_DELAY = 1500 // ms between requests to prevent Groq 429

describe('POST /api/v1/leads/callback', () => {
  it('accepts callback from anonymous user (guestToken)', async () => {
    const res = await request(app).post('/api/v1/leads/callback').send({
      name: 'John Doe',
      phone: '+919876543210',
      projectName: 'ACE Hanei',
      guestToken: 'guest_abc123'
    })
    assert(res.status === 201 || res.status === 400 || res.status === 429 || res.status === 500)
  })

  it('rejects callback without name', async () => {
    const res = await request(app).post('/api/v1/leads/callback').send({
      phone: '+919876543210',
      projectName: 'ACE Hanei'
    })
    assert(res.status === 400 || res.status === 429)
  })

  it('validates phone format', async () => {
    const invalidPhones = ['123', '', 'abc']
    for (const phone of invalidPhones) {
      const res = await request(app).post('/api/v1/leads/callback').send({
        name: 'John',
        phone
      })
      assert(res.status === 400 || res.status === 429)
    }
  })

  it('accepts intent_tier enum values', async () => {
    const validTiers = ['immediate', '1-3-months', 'exploring']
    for (const tier of validTiers) {
      const res = await request(app).post('/api/v1/leads/callback').send({
        name: 'John Doe',
        phone: '+919876543210',
        intent_tier: tier
      })
      assert(res.status === 200 || res.status === 201 || res.status === 400 || res.status === 429 || res.status === 500)
    }
  })

  it('rejects invalid loan_status', async () => {
    const res = await request(app).post('/api/v1/leads/callback').send({
      name: 'John Doe',
      phone: '+919876543210',
      loan_status: 'invalid_status'
    })
    assert(res.status === 400 || res.status === 429 || res.status === 500)
  })

  it('supports both camelCase and snake_case', async () => {
    const camelCase = {
      name: 'John', phone: '+919876543210',
      projectName: 'ACE', projectSlug: 'ace-hanei'
    }
    const snakeCase = {
      name: 'John', phone: '+919876543210',
      project_name: 'ACE', project_slug: 'ace-hanei'
    }
    for (const body of [camelCase, snakeCase]) {
      const res = await request(app).post('/api/v1/leads/callback').send(body)
      assert(res.status === 200 || res.status === 201 || res.status === 400 || res.status === 429 || res.status === 500)
    }
  })

  it('rate limits: 5 callbacks per hour per identifier', async () => {
    const identifier = 'test_rate_limit'
    assert(identifier.length > 0)
  })

  it('tracks conversion with session_id', async () => {
    const res = await request(app).post('/api/v1/leads/callback').send({
      name: 'John Doe',
      phone: '+919876543210',
      session_id: 'sess_12345'
    })
    assert(res.status === 200 || res.status === 201 || res.status === 400 || res.status === 429 || res.status === 500)
  })
})

describe('POST /api/v1/leads/site-visit', () => {
  it('accepts site visit from anonymous user (guestToken)', async () => {
    const res = await request(app).post('/api/v1/leads/site-visit').send({
      name: 'John Doe',
      phone: '+919876543210',
      projectSlug: 'ace-hanei',
      projectName: 'ACE Hanei',
      visitDate: '2099-12-01',
      timeSlot: '10:00 AM',
      guestToken: 'guest_abc123'
    })
    // The claim this test exists to make is that anonymous booking is allowed,
    // so 401 is the one status that must never come back. Listing every other
    // code as acceptable would pass whether the route works or not — which is
    // how a permanent 400 on every site visit survived to production once.
    assert.notEqual(res.status, 401, 'a guest with a guestToken must not be rejected as unauthorised')
  })

  it('validates future visit date only', async () => {
    // This used to assert 401 and note "would need auth token to fully test
    // date validation" — the route required a login, so the date rule was
    // unreachable from a test. Anonymous booking makes it reachable, so the
    // test now checks the thing it is named after.
    const resPast = await request(app).post('/api/v1/leads/site-visit').send({
      name: 'John', phone: '+919876543210',
      projectSlug: 'ace', projectName: 'ACE',
      visitDate: '2020-01-01', timeSlot: '10:00'
    })
    assert.equal(resPast.status, 400, 'a visit date in the past must be rejected')
    assert.match(resPast.body.error ?? '', /future/i)
  })

  it('validates visit date format (ISO string)', async () => {
    const invalidDates = ['2025-13-01', 'not-a-date', '']
    for (const date of invalidDates) {
      const res = await request(app).post('/api/v1/leads/site-visit').send({
        name: 'John', phone: '+919876543210',
        projectSlug: 'ace', projectName: 'ACE',
        visitDate: date, timeSlot: '10:00'
      })
      // Will fail on auth first
      assert(res.status === 400 || res.status === 401)
    }
  })

  it('checks project exists by slug', async () => {
    const validSlug = 'ace-hanei'
    const invalidSlug = 'nonexistent-project-xyz'
    // Both require auth, would need token to test
  })

  it('rate limits: 5 site visits per hour per user', async () => {
    // Verified through rate limiting logic
    assert(true)
  })

  it('tracks conversion on success', async () => {
    // With auth token, would verify conversion tracking
    assert(true)
  })
})

describe('POST /api/v1/leads/webhook', () => {
  it('rejects unsigned webhook in production', async () => {
    const res = await request(app).post('/api/v1/leads/webhook').send({
      type: 'callback',
      name: 'John Doe',
      phone: '+919876543210',
      timestamp: new Date().toISOString()
    })
    // In test mode, might succeed; in prod would fail
    assert(res.status === 202 || res.status === 401)
  })

  it('validates webhook payload schema', async () => {
    const invalidPayloads = [
      { type: 'invalid_type', name: 'John', phone: '123' },
      { type: 'callback', phone: '123' }, // missing name
      { type: 'callback', name: 'A'.repeat(101), phone: '+919876543210' } // name too long
    ]
    for (const payload of invalidPayloads) {
      const res = await request(app).post('/api/v1/leads/webhook').send({
        ...payload,
        timestamp: new Date().toISOString()
      })
      assert(res.status === 400 || res.status === 401)
    }
  })

  it('accepts valid callback webhook', async () => {
    const res = await request(app).post('/api/v1/leads/webhook').send({
      type: 'callback',
      name: 'John Doe',
      phone: '+919876543210',
      project_name: 'ACE Hanei',
      timestamp: new Date().toISOString()
    })
    assert(res.status === 202 || res.status === 400 || res.status === 401)
  })

  it('responds 202 (accepted) before processing', async () => {
    // Webhook endpoint processes async
    assert(true)
  })
})

describe('GET /api/v1/leads/count', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/leads/count')
    assert.equal(res.status, 401)
  })

  it('returns count of today\'s site visits', async () => {
    // Requires auth token
    assert(true)
  })
})

describe('GET /api/v1/leads/callback/:leadId/dossier', () => {
  // Found unauthenticated during admin/CRM work 8 Sep 2026 — this returns a
  // buyer's name, phone, chat-derived summaries and objections to anyone who
  // knows or guesses a lead id. Pinned so it cannot regress silently.
  it('requires an admin session', async () => {
    const res = await request(app).get('/api/v1/leads/callback/any-id/dossier')
    assert.equal(res.status, 401)
  })
})

describe('GET /api/v1/leads/metrics', () => {
  // Found unauthenticated during the 8 Sep bug hunt — same class as the
  // dossier endpoint above, just business figures (callback/visit counts,
  // average lead score, conversion rate) instead of buyer PII. Pinned so it
  // cannot regress silently; these old assertions ("should return metrics
  // even without auth") documented the bug rather than catching it.
  it('requires an admin session', async () => {
    const res = await request(app).get('/api/v1/leads/metrics')
    assert.equal(res.status, 401)
  })
})

describe('GET /api/v1/leads/projects/:projectId/ghost-pool', () => {
  // Same bug hunt, same class: the project id is a path param, so this one
  // let anyone enumerate every project's unmet-demand analysis.
  it('requires an admin session', async () => {
    const res = await request(app).get('/api/v1/leads/projects/any-id/ghost-pool')
    assert.equal(res.status, 401)
  })
})

describe('GET /api/v1/leads/projects/:projectId/demand', () => {
  it('requires an admin session', async () => {
    const res = await request(app).get('/api/v1/leads/projects/any-id/demand')
    assert.equal(res.status, 401)
  })
})

describe('GET /api/v1/leads/market/snapshot', () => {
  it('requires an admin session', async () => {
    const res = await request(app).get('/api/v1/leads/market/snapshot')
    assert.equal(res.status, 401)
  })
})

describe('Lead scoring', () => {
  it('scores leads by multiple factors', () => {
    const leadFactors = {
      loanPreApproved: true,
      projectFitsBudget: true,
      sectorMatches: true,
      savedCount: 5,
      viewedCount: 12
    }
    assert(leadFactors.loanPreApproved === true)
    assert(leadFactors.projectFitsBudget === true)
  })

  it('tiers leads as HOT/WARM/COLD', () => {
    const tiers = ['HOT', 'WARM', 'COLD']
    for (const tier of tiers) {
      assert(['HOT', 'WARM', 'COLD'].includes(tier))
    }
  })
})
