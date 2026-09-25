import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { builderCoverage } from '../coverageAnswer'

// builderCoverage hits the database only after the phrase passes the name
// filter, so a rejected phrase resolves null without a query. Every string
// below is a real query from the 50 demand-weighted set.

describe('a question is not a builder name', () => {
  // All five of these were answered with "We do not hold any projects from
  // <the buyer's own words> in Noida", which reads as a broken system and
  // leaves a real question unanswered.
  const MUST_NOT_MATCH: Array<[string, string]> = [
    ['are all properties in noida leasehold', 'captured "are all"'],
    ['I am considering buying a flat from a relatively unknown builder in Noida because it is 20% cheaper than comparable projects. Should I do it?', 'captured "relatively unknown"'],
    ['How should I compare two Noida projects when one has a lower price but the other has a better location and builder reputation?', 'captured "two noida"'],
    ['what are the best projects in noida', 'captured "best"'],
    ['show me some good projects near me', 'captured "some good"'],
    ['are these projects ready to move', 'captured "are these"'],
    ['which builders have the best delivery record', 'captured "which"'],
  ]

  for (const [q, why] of MUST_NOT_MATCH) {
    it(`ignores: ${q.slice(0, 52)}`, async () => {
      assert.equal(await builderCoverage(q), null, why)
    })
  }
})

describe('a real builder name still reaches the coverage answer', () => {
  it('recognises a builder we do not hold', async () => {
    // "sarthi" is not in our 117 builders, and saying so plainly is the
    // correct answer — this path must keep working.
    const out = await builderCoverage('sarthi properties in noida')
    assert.ok(out, 'sarthi was rejected as a builder name')
    assert.equal(out.kind, 'builder_absent')
    assert.match(out.text, /sarthi/i)
  })

  it('recognises a builder we do hold', async () => {
    const out = await builderCoverage('godrej properties in noida')
    assert.ok(out, 'godrej was rejected as a builder name')
    assert.equal(out.kind, 'builder_held')
    assert.ok((out.projects?.length ?? 0) > 0, 'held builder returned no projects')
  })

  it('accepts a two-word brand', async () => {
    const out = await builderCoverage('sikka group projects in noida')
    assert.ok(out, 'a two-word brand was rejected')
  })
})

describe('coverage answers what we hold, not what we think of a builder', () => {
  // The call site in chat-router used to suppress coverage with a negative
  // regex that ended in `|\?` — a bare question mark — which switched the
  // whole gate off for nearly every message. The condition now lives inside
  // builderCoverage, in the affirmative.

  const ADVISORY = [
    'is godrej properties reliable',
    'what is the reputation of sikka group',
    'has sikka group had delays on their projects',
    'is godrej properties worth it compared to ats group',
    'any complaints about prateek group projects',
  ]
  for (const q of ADVISORY) {
    it(`declines the advisory question: ${q.slice(0, 48)}`, async () => {
      assert.equal(
        await builderCoverage(q),
        null,
        'an advisory question must not be answered with an inventory list',
      )
    })
  }

  // The positive direction is already covered above by "godrej properties in
  // noida" and "sikka group projects in noida", both of which still pass. A
  // leading "what projects does ..." is not tested here because the name
  // extractor captures "what" as the brand and rejects the turn — the same
  // known limitation as "which builders have the best delivery record" in
  // MUST_NOT_MATCH, and not something this change set out to alter.
})
