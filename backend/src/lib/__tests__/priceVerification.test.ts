import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  changedPriceFields, combinePriceFreshness, parsePriceVerification, priceDateNote, priceFactWrites, priceFreshness,
  summarisePriceNotes, UNDATED_NOTE,
  type PriceVerificationInput,
} from '../priceVerification'

const NOW = new Date('2026-10-15T06:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

describe('parsePriceVerification', () => {
  it('treats an absent block as no attestation', () => {
    assert.deepEqual(parsePriceVerification(undefined, NOW), { ok: true, value: null })
    assert.deepEqual(parsePriceVerification(null, NOW), { ok: true, value: null })
  })

  it('defaults the date to now and the sources to null', () => {
    const r = parsePriceVerification({ tier: 'BUILDER_ATTESTED' }, NOW)
    assert.ok(r.ok && r.value)
    assert.equal(r.value!.verified_at.getTime(), NOW.getTime())
    assert.equal(r.value!.source_url, null)
  })

  it('rejects SCRAPED, a bad date, a future date and a bad url', () => {
    assert.equal(parsePriceVerification({ tier: 'SCRAPED' }, NOW).ok, false)
    assert.equal(parsePriceVerification({ tier: 'VERIFIED', verified_at: 'nope' }, NOW).ok, false)
    assert.equal(parsePriceVerification({ tier: 'VERIFIED', verified_at: '2026-12-01' }, NOW).ok, false)
    assert.equal(parsePriceVerification({ tier: 'VERIFIED', source_url: 'not a url' }, NOW).ok, false)
  })
})

describe('changedPriceFields', () => {
  const existing = { price_min_cr: 1.5, price_max_cr: 2.1, price_label: '₹1.5 Cr onwards' }

  it('ignores a field that is absent or equal (a whole-form save must not reset dates)', () => {
    assert.deepEqual(changedPriceFields('UnitType', existing, { price_min_cr: '1.50', price_max_cr: 2.1, name: 'x' }), [])
    assert.deepEqual(changedPriceFields('UnitType', existing, {}), [])
  })

  it('reports only the fields whose value moved', () => {
    assert.deepEqual(changedPriceFields('UnitType', existing, { price_min_cr: 1.6, price_max_cr: 2.1 }), ['price_min_cr'])
    assert.deepEqual(changedPriceFields('UnitType', existing, { price_label: '₹1.6 Cr onwards' }), ['price_label'])
  })

  it('treats null and a missing price as equal', () => {
    assert.deepEqual(changedPriceFields('Project', { price_min_cr: null }, { price_min_cr: null }), [])
  })
})

describe('priceFactWrites', () => {
  const v: PriceVerificationInput = { tier: 'BUILDER_ATTESTED', verified_at: daysAgo(2), source_url: null, source_doc: 'cost sheet' }

  it('an attestation covers every price field the entity holds after the save', () => {
    const w = priceFactWrites({
      entity: 'UnitType', entityId: 'u1', after: { price_min_cr: 1.5, price_max_cr: null, price_label: '₹1.5 Cr' },
      changed: [], verification: v, verifiedBy: 'ops@realtyask.in',
    })
    assert.deepEqual(w.map((x) => x.fieldName), ['price_min_cr', 'price_label'])
    assert.equal(w[0].data.tier, 'BUILDER_ATTESTED')
    assert.equal(w[0].data.verifiedBy, 'ops@realtyask.in')
    assert.equal(w[0].data.sourceDoc, 'cost sheet')
  })

  it('a changed price with no attestation resets to SCRAPED and undated', () => {
    const w = priceFactWrites({
      entity: 'Project', entityId: 'p1', after: { price_min_cr: 2 }, changed: ['price_min_cr'],
      verification: null, verifiedBy: 'ops@realtyask.in',
    })
    assert.equal(w.length, 1)
    assert.equal(w[0].data.tier, 'SCRAPED')
    assert.equal(w[0].data.verifiedAt, null)
    assert.equal(w[0].data.verifiedBy, null)
  })

  it('writes nothing when nothing changed and nothing was attested', () => {
    assert.deepEqual(priceFactWrites({
      entity: 'Project', entityId: 'p1', after: {}, changed: [], verification: null, verifiedBy: null,
    }), [])
  })
})

describe('priceFreshness and priceDateNote', () => {
  it('is fresh inside the window and says who confirmed', () => {
    const f = priceFreshness({ tier: 'BUILDER_ATTESTED', verifiedAt: daysAgo(13) }, NOW)
    assert.equal(f.state, 'fresh')
    assert.match(priceDateNote(f), /^confirmed by the builder on 2 Oct 2026$/)
  })

  it('is stale after 30 days, with its date and a may-have-changed warning', () => {
    const f = priceFreshness({ tier: 'BUILDER_ATTESTED', verifiedAt: daysAgo(31) }, NOW)
    assert.equal(f.state, 'stale')
    assert.match(priceDateNote(f), /last confirmed by the builder on 14 Sep(?:t)? 2026 \(31 days ago\), so it may have changed/)
  })

  it('day 30 is still fresh, day 31 is stale', () => {
    assert.equal(priceFreshness({ tier: 'VERIFIED', verifiedAt: daysAgo(30) }, NOW).state, 'fresh')
    assert.equal(priceFreshness({ tier: 'VERIFIED', verifiedAt: daysAgo(31) }, NOW).state, 'stale')
  })

  it('SCRAPED, undated and missing rows are all "not on record"', () => {
    for (const rec of [null, undefined, { tier: 'SCRAPED' as const, verifiedAt: null }, { tier: 'SCRAPED' as const, verifiedAt: daysAgo(1) }]) {
      assert.equal(priceDateNote(priceFreshness(rec, NOW)), 'date of last confirmation not on record')
    }
  })

  it('never claims an inspection or live data', () => {
    for (const tier of ['BUILDER_ATTESTED', 'VERIFIED'] as const) {
      const note = priceDateNote(priceFreshness({ tier, verifiedAt: daysAgo(1) }, NOW))
      assert.ok(!/inspect|live|real-time|site visit/i.test(note), note)
    }
  })
})

describe('combinePriceFreshness', () => {
  const rec = (n: number, tier: 'BUILDER_ATTESTED' | 'VERIFIED' = 'BUILDER_ATTESTED') => ({ tier, verifiedAt: daysAgo(n) })

  it('has nothing to confirm → undated', () => {
    assert.equal(combinePriceFreshness([], NOW).state, 'undated')
  })

  it('one undated or missing price makes the whole statement undated', () => {
    assert.equal(combinePriceFreshness([rec(1), null], NOW).state, 'undated')
    assert.equal(combinePriceFreshness([rec(1), { tier: 'SCRAPED', verifiedAt: null }], NOW).state, 'undated')
  })

  it('is as fresh as the stalest part', () => {
    const f = combinePriceFreshness([rec(2), rec(40)], NOW)
    assert.equal(f.state, 'stale')
    assert.ok(f.state === 'stale' && f.days === 40)
  })

  it('mixed tiers take the weaker claim', () => {
    const f = combinePriceFreshness([rec(2, 'VERIFIED'), rec(3, 'BUILDER_ATTESTED')], NOW)
    assert.ok(f.state !== 'undated' && f.tier === 'BUILDER_ATTESTED')
  })
})

describe('summarisePriceNotes', () => {
  it('says nothing for an empty list', () => {
    assert.equal(summarisePriceNotes([]), null)
  })

  it('returns the shared note when every project has the same one', () => {
    assert.equal(summarisePriceNotes([UNDATED_NOTE, UNDATED_NOTE]), UNDATED_NOTE)
  })

  it('points at the per-project difference when the notes differ', () => {
    const s = summarisePriceNotes([UNDATED_NOTE, 'confirmed by the builder on 2 Oct 2026'])
    assert.match(s!, /^confirmation dates differ by project/)
  })
})
