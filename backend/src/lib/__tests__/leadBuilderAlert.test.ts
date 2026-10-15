import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { newLeadMessage, notifyBuildersOfLead, type AlertDeps, type AlertLead } from '../leadBuilderAlert'
import type { EnqueueOptions } from '../outboxDispatcher'

const LEAD: AlertLead = {
  id: 'lead-1',
  project_slug: 'elite-x',
  lead_tier: 'HOT',
  intent_tier: 'immediate',
  loan_pre_approved: true,
  is_test: false,
}

function deps(over: Partial<AlertDeps> = {}): { d: AlertDeps; sent: EnqueueOptions[] } {
  const sent: EnqueueOptions[] = []
  const d: AlertDeps = {
    findProject: async () => ({ name: 'Elite X', builder_id: 'b1' }),
    findRecipients: async () => ['a@builder.test', 'b@builder.test'],
    send: async (o) => { sent.push(o) },
    enabled: () => true,
    origin: () => 'https://realtyask.in',
    ...over,
  }
  return { d, sent }
}

describe('builder lead alert', () => {
  it('emails every BUILDER login of the project, with a portal link', async () => {
    const { d, sent } = deps()
    assert.equal(await notifyBuildersOfLead(LEAD, d), 2)
    assert.deepEqual(sent.map((s) => s.toEmail), ['a@builder.test', 'b@builder.test'])
    assert.equal(sent[0].template, 'new_lead')
    assert.equal(sent[0].actionUrl, 'https://realtyask.in/builder/portal')
    assert.equal(sent[0].relatedId, 'lead-1')
  })

  it('carries no buyer name, phone or form text', () => {
    // AlertLead has no name or phone field at all, so there is nothing to leak;
    // the message is built from the project row and the tier only.
    const { subject, body } = newLeadMessage('Elite X', LEAD)
    assert.equal(subject, 'New callback request: Elite X')
    assert.ok(body.includes('HOT — buying now, loan pre-approved.'))
    assert.ok(!/\d{8,}/.test(subject + body), 'no phone-like number')
  })

  it('sends nothing for a test row', async () => {
    const { d, sent } = deps()
    assert.equal(await notifyBuildersOfLead({ ...LEAD, is_test: true }, d), 0)
    assert.equal(sent.length, 0)
  })

  it('sends nothing unless the switch is on', async () => {
    const { d, sent } = deps({ enabled: () => false })
    assert.equal(await notifyBuildersOfLead(LEAD, d), 0)
    assert.equal(sent.length, 0)
  })

  it('sends nothing without a project, or when the project has no builder', async () => {
    const a = deps()
    assert.equal(await notifyBuildersOfLead({ ...LEAD, project_slug: null }, a.d), 0)
    const b = deps({ findProject: async () => ({ name: 'X', builder_id: null }) })
    assert.equal(await notifyBuildersOfLead(LEAD, b.d), 0)
    assert.equal(a.sent.length + b.sent.length, 0)
  })

  it('never throws, and one failed send does not stop the others', async () => {
    let n = 0
    const sent: string[] = []
    const { d } = deps({
      send: async (o) => { n++; if (n === 1) throw new Error('boom'); sent.push(o.toEmail) },
    })
    assert.equal(await notifyBuildersOfLead(LEAD, d), 1)
    assert.deepEqual(sent, ['b@builder.test'])
    const boom = deps({ findProject: async () => { throw new Error('db down') } })
    assert.equal(await notifyBuildersOfLead(LEAD, boom.d), 0)
  })
})
