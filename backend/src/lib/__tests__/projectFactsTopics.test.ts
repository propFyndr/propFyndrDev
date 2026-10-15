import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectFacts, detectFactTopics, type FactTopic } from '../projectFactsBlock'

const topics = (message: string): FactTopic[] => [...detectFactTopics(message)].sort()
const has = (message: string, topic: FactTopic) => detectFactTopics(message).has(topic)

describe('price_history topic', () => {
  it('fires on the natural wording that used to reach the model with no history', () => {
    for (const q of [
      'Has the price of Ace Parkway changed over the last 12 months?',
      'What was the price per sqft in 2023?',
      'Ace Parkway ka price kitna badh gaya pichle saal?',
    ]) assert.ok(has(q, 'price_history'), q)
  })

  it('stays off for a plain price question', () => {
    assert.ok(!has('What is the price of Ace Parkway?', 'price_history'))
    assert.ok(!has('Show the cost sheet of Ace Parkway', 'price_history'))
  })
})

describe('specifications topic', () => {
  it('fires on how the spec sections are named on the page', () => {
    for (const q of [
      'What structure and safety features does Ace Parkway have?',
      'What are the specifications? flooring and finishes',
      'Is the building earthquake resistant? what about fire safety',
      'what brand of lifts and what kind of plumbing',
    ]) assert.ok(has(q, 'specifications'), q)
  })

  it('stays off for questions that are not about build quality', () => {
    assert.ok(!has('How far is the metro?', 'specifications'))
    assert.ok(!has('Is Ace Parkway safe for my family?', 'specifications'))
    assert.ok(!has('who is the builder', 'specifications'))
  })
})

describe('updates topic', () => {
  it('fires on update and timeline questions', () => {
    for (const q of [
      'Any recent updates or timeline for Ace Parkway?',
      'what is the latest news on this project',
      'is the project delayed',
      'any updates on construction',
      'is it on schedule',
    ]) assert.ok(has(q, 'updates'), q)
  })

  it('stays off for unrelated questions', () => {
    assert.ok(!has('What amenities does it have?', 'updates'))
    assert.ok(!has('what is the price per sqft', 'updates'))
  })
})

describe('forward_looking topic', () => {
  it('fires on yield, growth and analyst-view questions', () => {
    for (const q of [
      'What is the rental yield at Ace Parkway?',
      'What rental income can I expect?',
      'Is Ace Parkway a good investment?',
      'What is the decision thesis for Ace Parkway?',
      'Who is Ace Parkway best suited for? buyer persona',
      'What are the advanced investment insights?',
      'what will the price be in 5 years',
    ]) assert.ok(has(q, 'forward_looking'), q)
  })

  it('stays off for factual questions', () => {
    assert.ok(!has('What is the RERA number?', 'forward_looking'))
    assert.ok(!has('How many towers are there?', 'forward_looking'))
  })

  it('a question can light several topics', () => {
    assert.deepEqual(topics('Is it a good investment, and how has the price changed?').filter((t) => t === 'forward_looking' || t === 'price_history'), ['forward_looking', 'price_history'])
  })
})

const BASE = { name: 'X', sector: 'Sector 1', city: 'Noida', status: 'under_construction' }
const lifecycle = [
  { title: 'Maintenance & Handover', description: 'Handover begins', update_date: new Date('2026-06-01'), impact: 'positive', source: 'builder', update_type: 'handover', affects_pricing: true, affects_recommendation: true, legal_flag_cleared: false, verified_by: 'ops@x' },
]
const construction = [
  { title: 'Tower A slab', description: 'Slab 12 done', update_date: new Date('2026-10-01'), completion_pct: 40, quarter_label: 'Q3 2026', source: 'site visit', verified_by: 'ops@x' },
]

describe('recent_updates in the facts block', () => {
  const row = { ...BASE, lifecycle_updates: lifecycle, construction_updates: construction }

  it('is absent unless the question is about updates', () => {
    assert.ok(!('recent_updates' in buildProjectFacts(row as never)))
    assert.ok(!('recent_updates' in buildProjectFacts(row as never, { topics: new Set<FactTopic>(['specifications']) })))
  })

  it('merges project and construction updates, newest first', () => {
    const facts = buildProjectFacts(row as never, { topics: detectFactTopics('any recent updates?') })
    const updates = facts.recent_updates as Array<Record<string, unknown>>
    assert.equal(updates.length, 2)
    assert.equal(updates[0].title, 'Tower A slab')
    assert.equal(updates[1].title, 'Maintenance & Handover')
  })

  it('carries what a buyer can use and none of the analyst flags', () => {
    const facts = buildProjectFacts(row as never, { topics: detectFactTopics('any recent updates?') })
    const text = JSON.stringify(facts.recent_updates)
    assert.match(text, /Slab 12 done/)
    assert.match(text, /Q3 2026/)
    for (const hidden of ['affects_pricing', 'affects_recommendation', 'legal_flag_cleared', 'verified_by', 'ops@x']) {
      assert.ok(!text.includes(hidden), `${hidden} must not reach the prompt`)
    }
  })

  it('is omitted, not empty, when the project has no updates', () => {
    const facts = buildProjectFacts({ ...BASE } as never, { topics: detectFactTopics('any recent updates?') })
    assert.ok(!('recent_updates' in facts))
  })
})

describe('withheld_by_policy in the facts block', () => {
  const draft = { ...BASE, decision_profile: { status: 'DRAFT', decision_thesis: 'internal draft text' } }

  it('says the analyst view is an unpublished draft, without carrying its content', () => {
    const facts = buildProjectFacts(draft as never, { topics: detectFactTopics('What is the decision thesis?') })
    const w = facts.withheld_by_policy as Record<string, string>
    assert.match(w.analyst_view, /still a draft, so it is not published/)
    assert.match(w.projections, /does not state an expected rental yield/)
    assert.ok(!JSON.stringify(facts).includes('internal draft text'), 'the draft itself must never reach the prompt')
  })

  it('does not claim a draft exists when there is no profile', () => {
    const facts = buildProjectFacts({ ...BASE } as never, { topics: detectFactTopics('what is the rental yield?') })
    const w = facts.withheld_by_policy as Record<string, string>
    assert.ok(w.projections)
    assert.ok(!('analyst_view' in w))
  })

  it('is absent for an ordinary question', () => {
    assert.ok(!('withheld_by_policy' in buildProjectFacts(draft as never, { topics: detectFactTopics('How many towers?') })))
  })

  it('the forward-looking question also carries the recorded price points, the thing we can offer', () => {
    const row = { ...draft, price_history: [{ quarter_label: 'Q1 2026', price_per_sqft: 14893, source: 'market_verified_2026', recorded_at: new Date('2026-02-15') }] }
    const facts = buildProjectFacts(row as never, { topics: detectFactTopics('is it a good investment?') })
    assert.ok('price_history' in facts)
  })
})
