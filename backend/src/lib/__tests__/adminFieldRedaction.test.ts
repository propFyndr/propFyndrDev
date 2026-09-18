import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { redactFields, REDACTION_MATRIX } from '../adminFieldRedaction'

/**
 * Path policy answers "may this role open this endpoint". It cannot answer "may
 * this role see this column", and the two are different questions inside any
 * endpoint a role legitimately needs — a salesperson must read the partner list
 * to know who is working a lead, and that row carries what we pay that firm.
 */
describe('admin field redaction', () => {
  const SALES = REDACTION_MATRIX.SALES!

  it('removes a commercial field from a flat object', () => {
    const row = { id: 'p1', name: 'Acme Realty', commission_rate_pct: 2.5, payment_terms: 'net_30' }
    redactFields(row, SALES)
    assert.equal('commission_rate_pct' in row, false)
    assert.equal('payment_terms' in row, false)
    assert.equal(row.name, 'Acme Realty', 'ordinary fields survive')
  })

  it('removes it from every element of a list', () => {
    const rows = [
      { id: 'a', commission_rate_pct: 1 },
      { id: 'b', commission_rate_pct: 2 },
    ]
    redactFields(rows, SALES)
    assert.deepEqual(rows, [{ id: 'a' }, { id: 'b' }])
  })

  it('reaches fields nested inside a relation', () => {
    // The case a top-level-only redactor misses: admin payloads nest freely, so
    // a partner arrives inside a lead and a builder inside a project.
    const payload = {
      leads: [
        {
          id: 'l1',
          name: 'A Buyer',
          assigned_partner: { id: 'cp1', name: 'Partner Co', commission_rate_pct: 3.5 },
        },
      ],
    }
    redactFields(payload, SALES)
    assert.equal('commission_rate_pct' in payload.leads[0].assigned_partner, false)
    assert.equal(payload.leads[0].assigned_partner.name, 'Partner Co')
    assert.equal(payload.leads[0].name, 'A Buyer')
  })

  it('leaves Date values intact', () => {
    const when = new Date('2026-09-17T00:00:00.000Z')
    const row: Record<string, unknown> = { id: 'x', created_at: when, cost_usd: 1.23 }
    redactFields(row, SALES)
    assert.equal(row.created_at, when)
    assert.equal('cost_usd' in row, false)
  })

  it('survives a payload with a cycle rather than hanging', () => {
    const a: Record<string, unknown> = { id: 'a', commission_rate_pct: 1 }
    a.self = a
    redactFields(a, SALES)
    assert.equal('commission_rate_pct' in a, false)
  })

  it('shields no field from a super admin', () => {
    assert.equal(REDACTION_MATRIX.SUPER_ADMIN, undefined)
  })

  it('keeps what each role actually needs', () => {
    // An analyst maintains the catalogue, so internal scoring stays with them;
    // what a partner firm is paid does not.
    const ANALYST = REDACTION_MATRIX.ANALYST!
    assert.ok(ANALYST.includes('commission_rate_pct'))
    assert.ok(!ANALYST.includes('market_demand_score'), 'analyst scoring is analyst work')
    assert.ok(SALES.includes('market_demand_score'))
  })
})
