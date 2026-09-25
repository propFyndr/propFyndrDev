import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../index'

describe('Deal Dossier & Family Consultation Summary API', () => {
  let createdToken: string

  it('synthesizes and creates a family deal dossier via POST /api/v1/dossier/create', async () => {
    const res = await request(app)
      .post('/api/v1/dossier/create')
      .send({
        buyerName: 'Sharma Family',
        targetSector: 'Sector 150',
        targetBhk: '3 BHK',
        budgetLabel: '₹2.0 - 2.5 Cr',
      })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.success, true)
    assert.ok(res.body.token)
    assert.ok(res.body.shareUrl)
    assert.strictEqual(res.body.shareUrl, `/dossier/${res.body.token}`)

    const dossier = res.body.dossier
    assert.ok(dossier)
    assert.strictEqual(dossier.consultation.buyerName, 'Sharma Family')
    assert.ok(Array.isArray(dossier.projects))
    assert.ok(dossier.projects.length >= 1)

    // Check project data structure
    const p = dossier.projects[0]
    assert.ok(p.name)
    assert.ok(Array.isArray(p.strengths))
    assert.ok(Array.isArray(p.redFlags))
    assert.ok(Array.isArray(p.siteVisitChecklist))
    assert.ok(p.financials)
    assert.ok(p.financials.standardEmi > 0)
    assert.ok(p.financials.netMonthlyEmi > 0)
    assert.ok(p.financials.taxShieldMonthly > 0)

    createdToken = res.body.token
  })

  it('retrieves the cached deal dossier via GET /api/v1/dossier/:token', async () => {
    assert.ok(createdToken, 'createdToken should be available from previous test')

    const res = await request(app).get(`/api/v1/dossier/${createdToken}`)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.success, true)
    assert.strictEqual(res.body.dossier.token, createdToken)
    assert.strictEqual(res.body.dossier.consultation.buyerName, 'Sharma Family')
  })

  it('returns 404 for nonexistent or invalid dossier token', async () => {
    const res = await request(app).get('/api/v1/dossier/nonexistenttoken1234567890abcdef')
    assert.strictEqual(res.status, 404)
    assert.ok(res.body.error)
  })
})
